import { recordAudit } from "@verasjuris/audit";
import { policyTreasury, type SessionAccount } from "@verasjuris/auth";
import {
  accountsPayable,
  billingPlanVersions,
  costRecords,
  delinquencyCases,
  invoices,
  receivables,
  subscriptions,
  treasuryCashPositions,
  treasuryForecastVersions,
  treasuryForecasts,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, asc, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { authorize, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import { AccountsReceivableService } from "./accounts-receivable.js";
import { LedgerBalanceService } from "./ledger-balance-service.js";

type ForecastScenario = "pessimistic" | "base" | "favorable" | "custom";

const SCENARIO_FACTORS: Record<
  Exclude<ForecastScenario, "custom">,
  { inflowBps: number; outflowBps: number }
> = {
  // Deterministic multipliers in basis points (10000 = 100%).
  pessimistic: { inflowBps: 7000, outflowBps: 12000 },
  base: { inflowBps: 10000, outflowBps: 10000 },
  favorable: { inflowBps: 12000, outflowBps: 8500 },
};

/**
 * Tesouraria: caixa derivado do ledger; AR/AP/delinquency/forecast separados de saldo real.
 * Forecast ≠ actual — campos e shape de resposta deixam a distinção explícita.
 */
export class TreasuryService {
  readonly ar: AccountsReceivableService;
  readonly balances: LedgerBalanceService;
  readonly forecast: TreasuryForecastService;

  constructor(private readonly db: AppDatabase) {
    this.ar = new AccountsReceivableService(db);
    this.balances = new LedgerBalanceService(db);
    this.forecast = new TreasuryForecastService(db, this.balances, this.ar);
  }

  /**
   * Cash position DERIVED from ledger (CASH_CLEARING). Never invents bank balances.
   */
  async getCashPosition(
    account: SessionAccount,
    organizationId: string,
    query: { currency?: string; asOf?: string } = {},
  ) {
    authorize(account, organizationId, (m) => policyTreasury(m, "finance.treasury.read"));
    const currency = query.currency ?? "BRL";
    const asOf = query.asOf ? new Date(query.asOf) : new Date();
    const clearing = await this.balances.cashClearingBalance(organizationId, currency, asOf);
    const orgBalances = await this.balances.organizationBalances({
      organizationId,
      currency,
      asOf,
    });
    const assetCash = orgBalances.accounts
      .filter(
        (a) => a.type === "asset" && (a.systemKey === "CASH_CLEARING" || a.code.startsWith("1.1")),
      )
      .reduce((sum, a) => sum + a.balanceCents, 0);

    const balanceCents = clearing.accountId ? clearing.balanceCents : assetCash;

    // Snapshot projection row (derived_from=ledger) — not a source of truth.
    const day = new Date(asOf);
    day.setUTCHours(0, 0, 0, 0);
    await this.db
      .insert(treasuryCashPositions)
      .values({
        organizationId,
        currency,
        sourceAccountKey: "ledger_derived",
        asOfDate: day,
        balanceCents,
        derivedFrom: "ledger",
      })
      .onConflictDoUpdate({
        target: [
          treasuryCashPositions.organizationId,
          treasuryCashPositions.currency,
          treasuryCashPositions.sourceAccountKey,
          treasuryCashPositions.asOfDate,
        ],
        set: {
          balanceCents,
          derivedFrom: "ledger",
          updatedAt: new Date(),
        },
      });

    return {
      kind: "cash_position" as const,
      /** Explicit UI/API flag: this is actual ledger-derived cash, not forecast. */
      isForecast: false,
      isActual: true,
      derivedFrom: "ledger" as const,
      notBankBalance: true,
      currency,
      asOf: asOf.toISOString(),
      balanceCents,
      accountId: clearing.accountId,
      sourceAccountKey: "ledger_derived",
      accounts: orgBalances.accounts.filter((a) => a.type === "asset" || a.type === "clearing"),
    };
  }

  async syncReceivables(
    account: SessionAccount,
    organizationId: string,
    meta: RequestMeta,
    currency = "BRL",
  ) {
    authorize(account, organizationId, (m) =>
      policyTreasury(m, "finance.accounts_receivable.manage"),
    );
    const result = await this.ar.syncFromInvoices(organizationId, currency);
    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "finance.receivables_synced",
      resourceType: "receivable",
      resourceId: organizationId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { upserted: result.upserted, openCents: result.openCents },
    });
    return result;
  }

  async listReceivables(
    account: SessionAccount,
    organizationId: string,
    query: {
      status?: (typeof receivables.$inferSelect)["status"];
      sourceType?: string;
      limit: number;
      offset: number;
      sync?: boolean;
    },
  ) {
    authorize(account, organizationId, (m) => policyTreasury(m, "finance.treasury.read"));
    if (query.sync) {
      await this.ar.syncFromInvoices(organizationId);
    }
    return this.ar.listReceivables(organizationId, query);
  }

  /* ─── Accounts payable (treasury AP, distinct from split payables) ─── */

  async createPayable(
    account: SessionAccount,
    organizationId: string,
    input: {
      vendorName?: string;
      beneficiaryType?: string;
      beneficiaryId?: string;
      category?: string;
      description: string;
      amountCents: number;
      currency: string;
      dueAt?: string;
      status?: (typeof accountsPayable.$inferInsert)["status"];
      documentId?: string;
      sourceType?: string;
      sourceId?: string;
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyTreasury(m, "finance.accounts_payable.manage"));
    const [row] = await this.db
      .insert(accountsPayable)
      .values({
        organizationId,
        vendorName: input.vendorName ?? null,
        beneficiaryType: input.beneficiaryType ?? null,
        beneficiaryId: input.beneficiaryId ?? null,
        category: input.category ?? "other",
        description: input.description,
        amountCents: input.amountCents,
        currency: input.currency,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        status: input.status ?? "draft",
        documentId: input.documentId ?? null,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
      })
      .returning();

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "finance.accounts_payable_created",
      resourceType: "accounts_payable",
      resourceId: row!.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { amountCents: row!.amountCents, status: row!.status },
    });

    return { payable: serializeAp(row!) };
  }

  async listPayables(
    account: SessionAccount,
    organizationId: string,
    query: {
      status?: (typeof accountsPayable.$inferSelect)["status"];
      category?: string;
      limit: number;
      offset: number;
    },
  ) {
    authorize(account, organizationId, (m) => policyTreasury(m, "finance.treasury.read"));
    const filters: SQL[] = [eq(accountsPayable.organizationId, organizationId)];
    if (query.status) filters.push(eq(accountsPayable.status, query.status));
    if (query.category) filters.push(eq(accountsPayable.category, query.category));
    const where = and(...filters);
    const [items, totalRow] = await Promise.all([
      this.db.query.accountsPayable.findMany({
        where,
        orderBy: [asc(accountsPayable.dueAt), desc(accountsPayable.createdAt)],
        limit: query.limit,
        offset: query.offset,
      }),
      this.db.select({ value: count() }).from(accountsPayable).where(where),
    ]);
    return {
      items: items.map(serializeAp),
      total: Number(totalRow[0]?.value ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async updatePayable(
    account: SessionAccount,
    organizationId: string,
    payableId: string,
    input: Partial<{
      vendorName: string | null;
      category: string;
      description: string;
      amountCents: number;
      dueAt: string | null;
      status: (typeof accountsPayable.$inferSelect)["status"];
      documentId: string | null;
    }>,
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyTreasury(m, "finance.accounts_payable.manage"));
    const existing = await this.requirePayable(organizationId, payableId);
    const [row] = await this.db
      .update(accountsPayable)
      .set({
        vendorName: input.vendorName === undefined ? existing.vendorName : input.vendorName,
        category: input.category ?? existing.category,
        description: input.description ?? existing.description,
        amountCents: input.amountCents ?? existing.amountCents,
        dueAt:
          input.dueAt === undefined
            ? existing.dueAt
            : input.dueAt === null
              ? null
              : new Date(input.dueAt),
        status: input.status ?? existing.status,
        documentId: input.documentId === undefined ? existing.documentId : input.documentId,
        updatedAt: new Date(),
      })
      .where(eq(accountsPayable.id, existing.id))
      .returning();

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "finance.accounts_payable_updated",
      resourceType: "accounts_payable",
      resourceId: row!.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { status: row!.status },
    });
    return { payable: serializeAp(row!) };
  }

  async approvePayable(
    account: SessionAccount,
    organizationId: string,
    payableId: string,
    input: { note?: string },
    meta: RequestMeta,
  ) {
    const membership = authorize(account, organizationId, (m) =>
      policyTreasury(m, "finance.accounts_payable.manage"),
    );
    const existing = await this.requirePayable(organizationId, payableId);
    if (existing.status !== "draft" && existing.status !== "disputed") {
      throw new AppError(
        "CONFLICT",
        "Somente contas a pagar em draft/disputed podem ser aprovadas.",
      );
    }
    const [row] = await this.db
      .update(accountsPayable)
      .set({
        status: "approved",
        approvedByMembershipId: membership.membershipId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(accountsPayable.id, existing.id))
      .returning();

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "finance.payable_approved",
      resourceType: "accounts_payable",
      resourceId: row!.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { note: input.note ?? null, status: "approved" },
    });
    return { payable: serializeAp(row!) };
  }

  /* ─── Delinquency ─── */

  async syncDelinquency(account: SessionAccount, organizationId: string, meta: RequestMeta) {
    authorize(account, organizationId, (m) =>
      policyTreasury(m, "finance.accounts_receivable.manage"),
    );
    await this.ar.syncFromInvoices(organizationId);
    const overdue = await this.db.query.receivables.findMany({
      where: and(
        eq(receivables.organizationId, organizationId),
        inArray(receivables.status, ["overdue", "open", "partial"]),
      ),
    });
    const now = Date.now();
    let created = 0;
    let updated = 0;

    for (const recv of overdue) {
      if (!recv.dueAt) continue;
      const daysOverdue = Math.max(0, Math.floor((now - recv.dueAt.getTime()) / 86_400_000));
      if (daysOverdue <= 0 && recv.status !== "overdue") continue;

      const stage = stageFromDays(daysOverdue);
      const existing = await this.db.query.delinquencyCases.findFirst({
        where: eq(delinquencyCases.receivableId, recv.id),
      });
      if (existing) {
        await this.db
          .update(delinquencyCases)
          .set({
            daysOverdue,
            stage,
            status: existing.status === "resolved" ? existing.status : "in_progress",
            updatedAt: new Date(),
          })
          .where(eq(delinquencyCases.id, existing.id));
        updated += 1;
      } else {
        await this.db.insert(delinquencyCases).values({
          organizationId,
          receivableId: recv.id,
          daysOverdue,
          stage,
          status: "open",
        });
        created += 1;
      }

      if (recv.status !== "overdue" && daysOverdue > 0) {
        await this.db
          .update(receivables)
          .set({ status: "overdue", updatedAt: new Date() })
          .where(eq(receivables.id, recv.id));
      }
    }

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "finance.delinquency_synced",
      resourceType: "delinquency_case",
      resourceId: organizationId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { created, updated },
    });

    return this.listDelinquency(account, organizationId, { limit: 100, offset: 0 });
  }

  async listDelinquency(
    account: SessionAccount,
    organizationId: string,
    query: {
      stage?: (typeof delinquencyCases.$inferSelect)["stage"];
      status?: (typeof delinquencyCases.$inferSelect)["status"];
      limit: number;
      offset: number;
    },
  ) {
    authorize(account, organizationId, (m) => policyTreasury(m, "finance.treasury.read"));
    const filters: SQL[] = [eq(delinquencyCases.organizationId, organizationId)];
    if (query.stage) filters.push(eq(delinquencyCases.stage, query.stage));
    if (query.status) filters.push(eq(delinquencyCases.status, query.status));
    const where = and(...filters);
    const [items, totalRow] = await Promise.all([
      this.db.query.delinquencyCases.findMany({
        where,
        orderBy: [desc(delinquencyCases.daysOverdue), desc(delinquencyCases.createdAt)],
        limit: query.limit,
        offset: query.offset,
      }),
      this.db.select({ value: count() }).from(delinquencyCases).where(where),
    ]);
    return {
      items: items.map((row) => ({
        id: row.id,
        organizationId: row.organizationId,
        receivableId: row.receivableId,
        daysOverdue: row.daysOverdue,
        stage: row.stage,
        status: row.status,
        lastContactAt: iso(row.lastContactAt),
        nextActionAt: iso(row.nextActionAt),
        notes: row.notes,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      total: Number(totalRow[0]?.value ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async updateDelinquency(
    account: SessionAccount,
    organizationId: string,
    caseId: string,
    input: Partial<{
      stage: (typeof delinquencyCases.$inferSelect)["stage"];
      status: (typeof delinquencyCases.$inferSelect)["status"];
      notes: string;
      lastContactAt: string;
      nextActionAt: string;
    }>,
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) =>
      policyTreasury(m, "finance.accounts_receivable.manage"),
    );
    const existing = await this.db.query.delinquencyCases.findFirst({
      where: and(
        eq(delinquencyCases.id, caseId),
        eq(delinquencyCases.organizationId, organizationId),
      ),
    });
    if (!existing) throw new AppError("NOT_FOUND", "Caso de inadimplência não encontrado.");

    const [row] = await this.db
      .update(delinquencyCases)
      .set({
        stage: input.stage ?? existing.stage,
        status: input.status ?? existing.status,
        notes: input.notes ?? existing.notes,
        lastContactAt: input.lastContactAt ? new Date(input.lastContactAt) : existing.lastContactAt,
        nextActionAt: input.nextActionAt ? new Date(input.nextActionAt) : existing.nextActionAt,
        updatedAt: new Date(),
      })
      .where(eq(delinquencyCases.id, existing.id))
      .returning();

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "finance.delinquency_updated",
      resourceType: "delinquency_case",
      resourceId: row!.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { stage: row!.stage, status: row!.status },
    });
    return { delinquencyCase: row };
  }

  private async requirePayable(organizationId: string, payableId: string) {
    const row = await this.db.query.accountsPayable.findFirst({
      where: and(
        eq(accountsPayable.id, payableId),
        eq(accountsPayable.organizationId, organizationId),
      ),
    });
    if (!row) throw new AppError("NOT_FOUND", "Conta a pagar não encontrada.");
    return row;
  }
}

/**
 * Forecast determinístico BASE/PESSIMISTIC/FAVORABLE.
 * Versões imutáveis; projected* ≠ actual*.
 */
export class TreasuryForecastService {
  constructor(
    private readonly db: AppDatabase,
    private readonly balances: LedgerBalanceService,
    private readonly ar: AccountsReceivableService,
  ) {}

  async createForecast(
    account: SessionAccount,
    organizationId: string,
    input: {
      name: string;
      scenario: ForecastScenario;
      currency: string;
      periodStart: string;
      periodEnd: string;
    },
    meta: RequestMeta,
  ) {
    const membership = authorize(account, organizationId, (m) =>
      policyTreasury(m, "finance.forecast.manage"),
    );
    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);
    if (!(periodStart < periodEnd)) {
      throw new AppError("VALIDATION_ERROR", "periodStart deve ser anterior a periodEnd.");
    }

    const [forecast] = await this.db
      .insert(treasuryForecasts)
      .values({
        organizationId,
        name: input.name,
        scenario: input.scenario,
        currency: input.currency,
        periodStart,
        periodEnd,
      })
      .returning();

    const version = await this.buildVersion(
      organizationId,
      forecast!,
      membership.membershipId,
      input.scenario,
    );

    const [updated] = await this.db
      .update(treasuryForecasts)
      .set({ currentVersionId: version.id, updatedAt: new Date() })
      .where(eq(treasuryForecasts.id, forecast!.id))
      .returning();

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "finance.forecast_created",
      resourceType: "treasury_forecast",
      resourceId: forecast!.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        scenario: input.scenario,
        versionId: version.id,
        projectedClosingCents: version.closingBalanceCents,
      },
    });

    return {
      forecast: serializeForecast(updated!),
      currentVersion: serializeForecastVersion(version),
      /** UI clarity: nested forecast vs actual. */
      projected: {
        openingBalanceCents: version.openingBalanceCents,
        inflowsCents: version.projectedInflowsCents,
        outflowsCents: version.projectedOutflowsCents,
        closingBalanceCents: version.closingBalanceCents,
      },
      actual: {
        openingBalanceCents: version.actualOpeningCents,
        inflowsCents: version.actualInflowsCents,
        outflowsCents: version.actualOutflowsCents,
        closingBalanceCents:
          version.actualOpeningCents != null &&
          version.actualInflowsCents != null &&
          version.actualOutflowsCents != null
            ? version.actualOpeningCents + version.actualInflowsCents - version.actualOutflowsCents
            : null,
      },
      isForecast: true,
      isActual: false,
    };
  }

  async listForecasts(
    account: SessionAccount,
    organizationId: string,
    query: { limit: number; offset: number },
  ) {
    authorize(account, organizationId, (m) => policyTreasury(m, "finance.treasury.read"));
    const where = eq(treasuryForecasts.organizationId, organizationId);
    const [items, totalRow] = await Promise.all([
      this.db.query.treasuryForecasts.findMany({
        where,
        orderBy: [desc(treasuryForecasts.createdAt)],
        limit: query.limit,
        offset: query.offset,
      }),
      this.db.select({ value: count() }).from(treasuryForecasts).where(where),
    ]);
    return {
      items: items.map(serializeForecast),
      total: Number(totalRow[0]?.value ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async getForecast(account: SessionAccount, organizationId: string, forecastId: string) {
    authorize(account, organizationId, (m) => policyTreasury(m, "finance.treasury.read"));
    const forecast = await this.requireForecast(organizationId, forecastId);
    const versions = await this.db.query.treasuryForecastVersions.findMany({
      where: eq(treasuryForecastVersions.forecastId, forecast.id),
      orderBy: [desc(treasuryForecastVersions.version)],
    });
    const current = versions.find((v) => v.id === forecast.currentVersionId) ?? versions[0] ?? null;
    return {
      forecast: serializeForecast(forecast),
      versions: versions.map(serializeForecastVersion),
      currentVersion: current ? serializeForecastVersion(current) : null,
      projected: current
        ? {
            openingBalanceCents: current.openingBalanceCents,
            inflowsCents: current.projectedInflowsCents,
            outflowsCents: current.projectedOutflowsCents,
            closingBalanceCents: current.closingBalanceCents,
          }
        : null,
      actual: current
        ? {
            openingBalanceCents: current.actualOpeningCents,
            inflowsCents: current.actualInflowsCents,
            outflowsCents: current.actualOutflowsCents,
          }
        : null,
      isForecast: true,
      isActual: false,
    };
  }

  async refreshVersion(
    account: SessionAccount,
    organizationId: string,
    forecastId: string,
    meta: RequestMeta,
  ) {
    const membership = authorize(account, organizationId, (m) =>
      policyTreasury(m, "finance.forecast.manage"),
    );
    const forecast = await this.requireForecast(organizationId, forecastId);
    const version = await this.buildVersion(
      organizationId,
      forecast,
      membership.membershipId,
      forecast.scenario,
    );
    await this.db
      .update(treasuryForecasts)
      .set({ currentVersionId: version.id, updatedAt: new Date() })
      .where(eq(treasuryForecasts.id, forecast.id));

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "finance.forecast_created",
      resourceType: "treasury_forecast_version",
      resourceId: version.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { forecastId, version: version.version },
    });

    return {
      forecast: serializeForecast({ ...forecast, currentVersionId: version.id }),
      currentVersion: serializeForecastVersion(version),
      projected: {
        openingBalanceCents: version.openingBalanceCents,
        inflowsCents: version.projectedInflowsCents,
        outflowsCents: version.projectedOutflowsCents,
        closingBalanceCents: version.closingBalanceCents,
      },
      actual: {
        openingBalanceCents: version.actualOpeningCents,
        inflowsCents: version.actualInflowsCents,
        outflowsCents: version.actualOutflowsCents,
      },
      isForecast: true,
      isActual: false,
    };
  }

  private async buildVersion(
    organizationId: string,
    forecast: typeof treasuryForecasts.$inferSelect,
    membershipId: string | null,
    scenario: ForecastScenario,
  ) {
    const currency = forecast.currency;
    const cash = await this.balances.cashClearingBalance(organizationId, currency);
    const ar = await this.ar.syncFromInvoices(organizationId, currency);
    const apRows = await this.db.query.accountsPayable.findMany({
      where: and(
        eq(accountsPayable.organizationId, organizationId),
        inArray(accountsPayable.status, ["draft", "approved", "scheduled", "overdue"]),
      ),
    });
    const openAp = apRows.reduce((s, r) => s + r.amountCents, 0);

    const activeSubs = await this.db.query.subscriptions.findMany({
      where: and(
        eq(subscriptions.organizationId, organizationId),
        inArray(subscriptions.status, ["active", "trialing"]),
      ),
    });
    const planVersionIds = [...new Set(activeSubs.map((s) => s.planVersionId))];
    const planVersions =
      planVersionIds.length > 0
        ? await this.db.query.billingPlanVersions.findMany({
            where: inArray(billingPlanVersions.id, planVersionIds),
          })
        : [];
    const planVersionById = new Map(planVersions.map((v) => [v.id, v]));
    const renewalCents = activeSubs.reduce((s, sub) => {
      const version = planVersionById.get(sub.planVersionId);
      const price = version?.priceCents ?? 0;
      const interval = version?.billingInterval;
      if (!interval || interval === "one_time" || interval === "custom") return s;
      if (interval === "yearly") return s + Math.floor(price / 12);
      if (interval === "quarterly") return s + Math.floor(price / 3);
      return s + price;
    }, 0);

    const costs = await this.db
      .select({
        total: sql<string>`coalesce(sum(${costRecords.amountCents}), 0)::text`,
      })
      .from(costRecords)
      .where(eq(costRecords.organizationId, organizationId));
    const historicalCostHint = Number(costs[0]?.total ?? 0);

    const factors = scenario === "custom" ? SCENARIO_FACTORS.base : SCENARIO_FACTORS[scenario];

    const baseInflows = ar.openCents + renewalCents;
    const baseOutflows = openAp + Math.floor(historicalCostHint / 12);
    const projectedInflowsCents = Math.floor((baseInflows * factors.inflowBps) / 10_000);
    const projectedOutflowsCents = Math.floor((baseOutflows * factors.outflowBps) / 10_000);
    const openingBalanceCents = cash.balanceCents;
    const closingBalanceCents =
      openingBalanceCents + projectedInflowsCents - projectedOutflowsCents;

    // Actuals: only opening from ledger; inflows/outflows null until period closes.
    const paidInvoices = await this.db.query.invoices.findMany({
      where: and(
        eq(invoices.organizationId, organizationId),
        eq(invoices.status, "paid"),
        eq(invoices.currency, currency),
      ),
    });
    const actualInflowsInPeriod = paidInvoices
      .filter(
        (inv) =>
          inv.paidAt && inv.paidAt >= forecast.periodStart && inv.paidAt <= forecast.periodEnd,
      )
      .reduce((s, inv) => s + inv.amountPaidCents, 0);

    const last = await this.db.query.treasuryForecastVersions.findFirst({
      where: eq(treasuryForecastVersions.forecastId, forecast.id),
      orderBy: [desc(treasuryForecastVersions.version)],
    });
    const nextVersion = (last?.version ?? 0) + 1;

    const [version] = await this.db
      .insert(treasuryForecastVersions)
      .values({
        forecastId: forecast.id,
        version: nextVersion,
        openingBalanceCents,
        projectedInflowsCents,
        projectedOutflowsCents,
        closingBalanceCents,
        actualOpeningCents: openingBalanceCents,
        actualInflowsCents: actualInflowsInPeriod > 0 ? actualInflowsInPeriod : null,
        actualOutflowsCents: null,
        snapshotJson: {
          scenario,
          factors,
          inputs: {
            openReceivablesCents: ar.openCents,
            openAccountsPayableCents: openAp,
            renewalRunRateCents: renewalCents,
            historicalCostHintCents: historicalCostHint,
          },
          note: "projected* is forecast; actual* is observed. Never treat projected as cash.",
        },
        createdByMembershipId: membershipId,
      })
      .returning();

    return version!;
  }

  private async requireForecast(organizationId: string, forecastId: string) {
    const row = await this.db.query.treasuryForecasts.findFirst({
      where: and(
        eq(treasuryForecasts.id, forecastId),
        eq(treasuryForecasts.organizationId, organizationId),
      ),
    });
    if (!row) throw new AppError("NOT_FOUND", "Forecast não encontrado.");
    return row;
  }
}

function stageFromDays(days: number): (typeof delinquencyCases.$inferInsert)["stage"] {
  if (days <= 7) return "reminder";
  if (days <= 15) return "notice";
  if (days <= 30) return "negotiation";
  if (days <= 60) return "collection";
  if (days <= 90) return "legal";
  return "written_off";
}

function serializeAp(row: typeof accountsPayable.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    vendorName: row.vendorName,
    beneficiaryType: row.beneficiaryType,
    beneficiaryId: row.beneficiaryId,
    category: row.category,
    description: row.description,
    amountCents: row.amountCents,
    currency: row.currency,
    dueAt: iso(row.dueAt),
    status: row.status,
    documentId: row.documentId,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    approvedByMembershipId: row.approvedByMembershipId,
    approvedAt: iso(row.approvedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeForecast(row: typeof treasuryForecasts.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    scenario: row.scenario,
    currency: row.currency,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    currentVersionId: row.currentVersionId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeForecastVersion(row: typeof treasuryForecastVersions.$inferSelect) {
  return {
    id: row.id,
    forecastId: row.forecastId,
    version: row.version,
    /** Forecast fields */
    projected: {
      openingBalanceCents: row.openingBalanceCents,
      inflowsCents: row.projectedInflowsCents,
      outflowsCents: row.projectedOutflowsCents,
      closingBalanceCents: row.closingBalanceCents,
    },
    /** Actual/observed fields — may be null; never confuse with projected. */
    actual: {
      openingBalanceCents: row.actualOpeningCents,
      inflowsCents: row.actualInflowsCents,
      outflowsCents: row.actualOutflowsCents,
    },
    openingBalanceCents: row.openingBalanceCents,
    projectedInflowsCents: row.projectedInflowsCents,
    projectedOutflowsCents: row.projectedOutflowsCents,
    closingBalanceCents: row.closingBalanceCents,
    actualOpeningCents: row.actualOpeningCents,
    actualInflowsCents: row.actualInflowsCents,
    actualOutflowsCents: row.actualOutflowsCents,
    snapshotJson: row.snapshotJson,
    createdByMembershipId: row.createdByMembershipId,
    createdAt: row.createdAt.toISOString(),
    isForecastVersion: true,
  };
}
