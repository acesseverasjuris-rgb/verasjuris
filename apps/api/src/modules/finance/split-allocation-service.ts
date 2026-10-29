import { recordAudit } from "@verasjuris/audit";
import { policyPayable, policyPaymentAllocation, type SessionAccount } from "@verasjuris/auth";
import {
  financialRetentions,
  payables,
  paymentAllocations,
  payments,
  splitRules,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, asc, count, desc, eq, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { authorize, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import { LedgerPostingService, type LedgerEntryInput } from "./ledger-posting-service.js";

type SplitRuleRow = typeof splitRules.$inferSelect;

type CalculatedSlice = {
  rule: SplitRuleRow;
  grossCents: number;
  feeCents: number;
  retentionCents: number;
  netCents: number;
  beneficiaryId: string;
  allocationType: string;
  snapshot: Record<string, unknown>;
};

function serializeSplitRule(row: SplitRuleRow) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    key: row.key,
    productType: row.productType,
    serviceType: row.serviceType,
    beneficiaryType: row.beneficiaryType,
    calculationType: row.calculationType,
    percentageBps: row.percentageBps,
    fixedAmountCents: row.fixedAmountCents,
    priority: row.priority,
    validFrom: iso(row.validFrom),
    validTo: iso(row.validTo),
    status: row.status,
    version: row.version,
    snapshotJson: row.snapshotJson,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeAllocation(row: typeof paymentAllocations.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    paymentId: row.paymentId,
    beneficiaryType: row.beneficiaryType,
    beneficiaryId: row.beneficiaryId,
    allocationType: row.allocationType,
    grossAmountCents: row.grossAmountCents ?? row.grossCents,
    grossCents: row.grossCents,
    feeAmountCents: row.feeAmountCents ?? row.feeCents,
    feeCents: row.feeCents,
    retentionAmountCents: row.retentionAmountCents,
    netAmountCents: row.netAmountCents ?? row.netCents,
    netCents: row.netCents,
    currency: row.currency,
    status: row.status,
    ruleVersionId: row.ruleVersionId,
    ruleSnapshotJson: row.ruleSnapshotJson,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializePayable(row: typeof payables.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    beneficiaryType: row.beneficiaryType,
    beneficiaryId: row.beneficiaryId,
    sourceAllocationId: row.sourceAllocationId,
    amountCents: row.amountCents,
    currency: row.currency,
    availableAt: iso(row.availableAt),
    dueAt: iso(row.dueAt),
    status: row.status,
    holdReason: row.holdReason,
    heldByDisputeId: row.heldByDisputeId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function parseDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}

function mapAllocationType(beneficiaryType: string): string {
  switch (beneficiaryType) {
    case "platform":
      return "platform_fee";
    case "professional":
    case "correspondent":
    case "instructor":
    case "service_provider":
      return "professional_fee";
    case "partner":
      return "partner_share";
    default:
      return "other";
  }
}

function calculateRuleAmount(
  rule: SplitRuleRow,
  paymentCents: number,
  remainderPool: number,
): number {
  const pct = rule.percentageBps ?? 0;
  const fixed = rule.fixedAmountCents ?? 0;
  switch (rule.calculationType) {
    case "percentage":
      return Math.floor((paymentCents * pct) / 10_000);
    case "fixed":
      return fixed;
    case "percentage_plus_fixed":
      return Math.floor((paymentCents * pct) / 10_000) + fixed;
    case "remainder":
      return Math.max(0, remainderPool);
    case "custom_rule":
      throw new AppError(
        "VALIDATION_ERROR",
        "Regra custom_rule exige cálculo externo — use percentage/fixed/remainder.",
        [{ path: "calculationType", message: "custom_rule não é suportado neste fluxo." }],
      );
    default:
      throw new AppError("VALIDATION_ERROR", `Tipo de cálculo inválido: ${rule.calculationType}.`);
  }
}

/**
 * Split interno: regras → payment_allocations (+ snapshot) → retentions → payables.
 * Não depende de PSP split; ledger opcional via LedgerPostingService.
 */
export class SplitAllocationService {
  private readonly ledger: LedgerPostingService;

  constructor(private readonly db: AppDatabase) {
    this.ledger = new LedgerPostingService(db);
  }

  async listSplitRules(
    account: SessionAccount,
    organizationId: string,
    query: {
      status?: string;
      productType?: string;
      beneficiaryType?: string;
      limit: number;
      offset: number;
    },
  ) {
    authorize(account, organizationId, (m) => policyPaymentAllocation(m, "finance.split.read"));
    const filters: SQL[] = [
      or(eq(splitRules.organizationId, organizationId), isNull(splitRules.organizationId))!,
    ];
    if (query.status) filters.push(eq(splitRules.status, query.status as SplitRuleRow["status"]));
    if (query.productType) filters.push(eq(splitRules.productType, query.productType));
    if (query.beneficiaryType) {
      filters.push(
        eq(splitRules.beneficiaryType, query.beneficiaryType as SplitRuleRow["beneficiaryType"]),
      );
    }
    const where = and(...filters);
    const [items, totalRow] = await Promise.all([
      this.db.query.splitRules.findMany({
        where,
        orderBy: [asc(splitRules.priority), desc(splitRules.version)],
        limit: query.limit,
        offset: query.offset,
      }),
      this.db.select({ value: count() }).from(splitRules).where(where),
    ]);
    return {
      items: items.map(serializeSplitRule),
      total: Number(totalRow[0]?.value ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async createSplitRule(
    account: SessionAccount,
    organizationId: string,
    input: {
      key: string;
      productType: string;
      serviceType?: string;
      beneficiaryType: SplitRuleRow["beneficiaryType"];
      calculationType: SplitRuleRow["calculationType"];
      percentageBps?: number | null;
      fixedAmountCents?: number | null;
      priority?: number;
      validFrom?: string;
      validTo?: string;
      status?: SplitRuleRow["status"];
      snapshotJson?: Record<string, unknown>;
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyPaymentAllocation(m, "finance.split.manage"));

    const existing = await this.db.query.splitRules.findMany({
      where: and(eq(splitRules.organizationId, organizationId), eq(splitRules.key, input.key)),
      orderBy: [desc(splitRules.version)],
      limit: 1,
    });
    const nextVersion = (existing[0]?.version ?? 0) + 1;

    const snapshotJson = {
      ...(input.snapshotJson ?? {}),
      key: input.key,
      productType: input.productType,
      serviceType: input.serviceType ?? null,
      beneficiaryType: input.beneficiaryType,
      calculationType: input.calculationType,
      percentageBps: input.percentageBps ?? null,
      fixedAmountCents: input.fixedAmountCents ?? null,
      priority: input.priority ?? 100,
      version: nextVersion,
    };

    const [row] = await this.db
      .insert(splitRules)
      .values({
        organizationId,
        key: input.key,
        productType: input.productType,
        serviceType: input.serviceType ?? null,
        beneficiaryType: input.beneficiaryType,
        calculationType: input.calculationType,
        percentageBps: input.percentageBps ?? null,
        fixedAmountCents: input.fixedAmountCents ?? null,
        priority: input.priority ?? 100,
        validFrom: parseDate(input.validFrom) ?? new Date(),
        validTo: parseDate(input.validTo) ?? null,
        status: input.status ?? "active",
        version: nextVersion,
        snapshotJson,
      })
      .returning();

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "finance.split_rule_created",
      resourceType: "split_rule",
      resourceId: row!.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { key: row!.key, version: row!.version },
    });

    return { splitRule: serializeSplitRule(row!) };
  }

  async listAllocations(
    account: SessionAccount,
    organizationId: string,
    query: {
      status?: string;
      paymentId?: string;
      beneficiaryType?: string;
      beneficiaryId?: string;
      limit: number;
      offset: number;
    },
  ) {
    authorize(account, organizationId, (m) => policyPaymentAllocation(m, "finance.split.read"));
    const filters: SQL[] = [eq(paymentAllocations.organizationId, organizationId)];
    if (query.status) {
      filters.push(
        eq(
          paymentAllocations.status,
          query.status as (typeof paymentAllocations.$inferSelect)["status"],
        ),
      );
    }
    if (query.paymentId) filters.push(eq(paymentAllocations.paymentId, query.paymentId));
    if (query.beneficiaryType) {
      filters.push(eq(paymentAllocations.beneficiaryType, query.beneficiaryType));
    }
    if (query.beneficiaryId) {
      filters.push(eq(paymentAllocations.beneficiaryId, query.beneficiaryId));
    }
    const where = and(...filters);
    const [items, totalRow] = await Promise.all([
      this.db.query.paymentAllocations.findMany({
        where,
        orderBy: [desc(paymentAllocations.createdAt)],
        limit: query.limit,
        offset: query.offset,
      }),
      this.db.select({ value: count() }).from(paymentAllocations).where(where),
    ]);
    return {
      items: items.map(serializeAllocation),
      total: Number(totalRow[0]?.value ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async listPayables(
    account: SessionAccount,
    organizationId: string,
    query: {
      status?: string;
      beneficiaryType?: string;
      beneficiaryId?: string;
      limit: number;
      offset: number;
    },
  ) {
    authorize(account, organizationId, (m) => policyPayable(m, "finance.payout.read"));
    const filters: SQL[] = [eq(payables.organizationId, organizationId)];
    if (query.status) {
      filters.push(eq(payables.status, query.status as (typeof payables.$inferSelect)["status"]));
    }
    if (query.beneficiaryType) filters.push(eq(payables.beneficiaryType, query.beneficiaryType));
    if (query.beneficiaryId) filters.push(eq(payables.beneficiaryId, query.beneficiaryId));
    const where = and(...filters);
    const [items, totalRow] = await Promise.all([
      this.db.query.payables.findMany({
        where,
        orderBy: [desc(payables.createdAt)],
        limit: query.limit,
        offset: query.offset,
      }),
      this.db.select({ value: count() }).from(payables).where(where),
    ]);
    return {
      items: items.map(serializePayable),
      total: Number(totalRow[0]?.value ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async holdPayable(
    account: SessionAccount,
    organizationId: string,
    payableId: string,
    input: { holdReason: string; heldByDisputeId?: string },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyPayable(m, "finance.payout.hold"));
    const payable = await this.requirePayable(organizationId, payableId);
    if (
      payable.status === "paid" ||
      payable.status === "cancelled" ||
      payable.status === "reversed"
    ) {
      throw new AppError("CONFLICT", "Este payable não pode ser retido neste status.");
    }
    const [updated] = await this.db
      .update(payables)
      .set({
        status: "held",
        holdReason: input.holdReason,
        heldByDisputeId: input.heldByDisputeId ?? payable.heldByDisputeId,
        updatedAt: new Date(),
      })
      .where(eq(payables.id, payable.id))
      .returning();

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "finance.payable_held",
      resourceType: "payable",
      resourceId: payable.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { holdReason: input.holdReason, heldByDisputeId: input.heldByDisputeId ?? null },
    });

    return { payable: serializePayable(updated!) };
  }

  async releasePayable(
    account: SessionAccount,
    organizationId: string,
    payableId: string,
    input: { note?: string },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyPayable(m, "finance.payout.release"));
    const payable = await this.requirePayable(organizationId, payableId);
    if (payable.status !== "held") {
      throw new AppError("CONFLICT", "Somente payables retidos podem ser liberados.");
    }
    const [updated] = await this.db
      .update(payables)
      .set({
        status: "available",
        holdReason: null,
        heldByDisputeId: null,
        updatedAt: new Date(),
      })
      .where(eq(payables.id, payable.id))
      .returning();

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "finance.payable_released",
      resourceType: "payable",
      resourceId: payable.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { note: input.note ?? null },
    });

    return { payable: serializePayable(updated!) };
  }

  /**
   * Carrega regras ativas por productType (e versão opcional) e aloca o pagamento.
   * INTERNAL: funciona sem PSP split.
   */
  async allocatePayment(
    account: SessionAccount,
    organizationId: string,
    input: {
      paymentId: string;
      productType: string;
      serviceType?: string;
      ruleVersion?: number;
      beneficiaryIds?: Record<string, string>;
      retentions?: Array<{
        ruleKey?: string;
        type: (typeof financialRetentions.$inferInsert)["type"];
        amountCents: number;
        source: (typeof financialRetentions.$inferInsert)["source"];
        ruleSetId?: string;
        metadata?: Record<string, unknown>;
      }>;
      postLedger?: boolean;
      availableAt?: string;
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyPaymentAllocation(m, "finance.split.manage"));

    const payment = await this.db.query.payments.findFirst({
      where: and(eq(payments.id, input.paymentId), eq(payments.organizationId, organizationId)),
    });
    if (!payment) throw new AppError("NOT_FOUND", "Não encontramos este pagamento.");
    if (payment.status !== "confirmed" && payment.status !== "partially_refunded") {
      throw new AppError("CONFLICT", "Somente pagamentos confirmados podem ser alocados.");
    }

    const rules = await this.loadActiveRules(
      organizationId,
      input.productType,
      input.serviceType,
      input.ruleVersion,
    );
    if (rules.length === 0) {
      throw new AppError("NOT_FOUND", "Nenhuma regra de split ativa para este produto.");
    }

    const slices = this.calculateSlices(
      rules,
      payment.amountCents,
      organizationId,
      input.beneficiaryIds,
    );
    this.validateSlices(slices, payment.amountCents, payment.currency);

    const availableAt = parseDate(input.availableAt) ?? new Date();
    const retentionByRule = new Map<string, NonNullable<typeof input.retentions>>();
    for (const retention of input.retentions ?? []) {
      const key = retention.ruleKey ?? "__all__";
      const list = retentionByRule.get(key) ?? [];
      list.push(retention);
      retentionByRule.set(key, list);
    }

    const result = await this.db.transaction(async (tx) => {
      const createdAllocations: (typeof paymentAllocations.$inferSelect)[] = [];
      const createdRetentions: (typeof financialRetentions.$inferSelect)[] = [];
      const createdPayables: (typeof payables.$inferSelect)[] = [];

      for (const slice of slices) {
        const ruleRetentions = [
          ...(retentionByRule.get(slice.rule.key) ?? []),
          ...(retentionByRule.get("__all__") ?? []),
        ];
        const retentionCents = ruleRetentions.reduce((sum, r) => sum + r.amountCents, 0);
        if (retentionCents < 0) {
          throw new AppError("VALIDATION_ERROR", "Retenção não pode ser negativa.");
        }
        const netCents = slice.grossCents - slice.feeCents - retentionCents;
        if (netCents < 0) {
          throw new AppError(
            "VALIDATION_ERROR",
            `Net negativo para regra ${slice.rule.key} após retenções.`,
          );
        }

        const [allocation] = await tx
          .insert(paymentAllocations)
          .values({
            organizationId,
            paymentId: payment.id,
            beneficiaryType: slice.rule.beneficiaryType,
            beneficiaryId: slice.beneficiaryId,
            allocationType: slice.allocationType,
            grossAmountCents: slice.grossCents,
            grossCents: slice.grossCents,
            feeAmountCents: slice.feeCents,
            feeCents: slice.feeCents,
            retentionAmountCents: retentionCents,
            netAmountCents: netCents,
            netCents,
            currency: payment.currency,
            status: "pending",
            ruleVersionId: slice.rule.id,
            ruleSnapshotJson: slice.snapshot,
          })
          .returning();
        createdAllocations.push(allocation!);

        for (const retention of ruleRetentions) {
          const [row] = await tx
            .insert(financialRetentions)
            .values({
              organizationId,
              allocationId: allocation!.id,
              type: retention.type,
              amountCents: retention.amountCents,
              currency: payment.currency,
              source: retention.source,
              ruleSetId: retention.ruleSetId ?? null,
              status: "applied",
              metadata: retention.metadata ?? null,
            })
            .returning();
          createdRetentions.push(row!);
        }

        // Platform fee stays as revenue accrual; other beneficiaries get payables (payable BEFORE payout).
        if (slice.rule.beneficiaryType !== "platform" && netCents > 0) {
          const [payable] = await tx
            .insert(payables)
            .values({
              organizationId,
              beneficiaryType: slice.rule.beneficiaryType,
              beneficiaryId: slice.beneficiaryId,
              sourceAllocationId: allocation!.id,
              amountCents: netCents,
              currency: payment.currency,
              availableAt,
              status: "available",
            })
            .returning();
          createdPayables.push(payable!);
        }
      }

      let ledgerTransactionId: string | null = null;
      const ledgerInputs = await this.prepareLedgerEntries(
        organizationId,
        payment.currency,
        createdAllocations,
        tx,
      );

      if (input.postLedger && ledgerInputs.entries.length >= 2) {
        const posted = await this.ledger.post(
          {
            organizationId,
            transactionType: "platform_fee",
            referenceType: "payment",
            referenceId: payment.id,
            currency: payment.currency,
            idempotencyKey: `split_allocate:${payment.id}:${createdAllocations[0]!.id}`,
            description: `Alocação split pagamento ${payment.id}`,
            entries: ledgerInputs.entries,
          },
          tx,
        );
        ledgerTransactionId = posted.id;
      }

      return {
        allocations: createdAllocations,
        retentions: createdRetentions,
        payables: createdPayables,
        ledgerTransactionId,
        ledgerEntryInputs: ledgerInputs.entries,
      };
    });

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "finance.payment_allocated",
      resourceType: "payment",
      resourceId: payment.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        allocationCount: result.allocations.length,
        payableCount: result.payables.length,
        ledgerTransactionId: result.ledgerTransactionId,
      },
    });

    return {
      paymentId: payment.id,
      allocations: result.allocations.map(serializeAllocation),
      retentions: result.retentions.map((row) => ({
        id: row.id,
        allocationId: row.allocationId,
        type: row.type,
        amountCents: row.amountCents,
        currency: row.currency,
        source: row.source,
        status: row.status,
      })),
      payables: result.payables.map(serializePayable),
      ledgerTransactionId: result.ledgerTransactionId,
      ledgerEntryInputs: result.ledgerEntryInputs,
    };
  }

  async loadActiveRules(
    organizationId: string,
    productType: string,
    serviceType?: string,
    ruleVersion?: number,
  ): Promise<SplitRuleRow[]> {
    const now = new Date();
    const filters: SQL[] = [
      or(eq(splitRules.organizationId, organizationId), isNull(splitRules.organizationId))!,
      eq(splitRules.productType, productType),
      eq(splitRules.status, "active"),
      lte(splitRules.validFrom, now),
      or(isNull(splitRules.validTo), sql`${splitRules.validTo} > ${now}`)!,
    ];
    if (serviceType) {
      filters.push(or(eq(splitRules.serviceType, serviceType), isNull(splitRules.serviceType))!);
    }
    if (ruleVersion !== undefined) {
      filters.push(eq(splitRules.version, ruleVersion));
    }

    const rows = await this.db.query.splitRules.findMany({
      where: and(...filters),
      orderBy: [asc(splitRules.priority), desc(splitRules.version)],
    });

    // Deduplicate by key keeping highest version / first priority match.
    const byKey = new Map<string, SplitRuleRow>();
    for (const row of rows) {
      if (!byKey.has(row.key)) byKey.set(row.key, row);
    }
    return [...byKey.values()].sort((a, b) => a.priority - b.priority);
  }

  calculateSlices(
    rules: SplitRuleRow[],
    paymentCents: number,
    organizationId: string,
    beneficiaryIds?: Record<string, string>,
  ): CalculatedSlice[] {
    const ordered = [...rules].sort((a, b) => {
      const aRem = a.calculationType === "remainder" ? 1 : 0;
      const bRem = b.calculationType === "remainder" ? 1 : 0;
      if (aRem !== bRem) return aRem - bRem;
      return a.priority - b.priority;
    });

    let allocated = 0;
    const slices: CalculatedSlice[] = [];

    for (const rule of ordered) {
      const remainderPool = paymentCents - allocated;
      const gross = calculateRuleAmount(rule, paymentCents, remainderPool);
      if (gross < 0) {
        throw new AppError("VALIDATION_ERROR", `Valor negativo na regra ${rule.key}.`);
      }
      if (rule.calculationType !== "remainder") {
        allocated += gross;
      } else {
        allocated += gross;
      }

      const beneficiaryId =
        beneficiaryIds?.[rule.key] ??
        (rule.beneficiaryType === "platform" || rule.beneficiaryType === "organization"
          ? organizationId
          : undefined);
      if (!beneficiaryId) {
        throw new AppError(
          "VALIDATION_ERROR",
          `Informe beneficiaryIds[${rule.key}] para beneficiário ${rule.beneficiaryType}.`,
          [{ path: `beneficiaryIds.${rule.key}`, message: "Beneficiário obrigatório." }],
        );
      }

      const snapshot: Record<string, unknown> = {
        ...(rule.snapshotJson ?? {}),
        ruleId: rule.id,
        key: rule.key,
        version: rule.version,
        productType: rule.productType,
        serviceType: rule.serviceType,
        beneficiaryType: rule.beneficiaryType,
        calculationType: rule.calculationType,
        percentageBps: rule.percentageBps,
        fixedAmountCents: rule.fixedAmountCents,
        priority: rule.priority,
        calculatedGrossCents: gross,
        calculatedAt: new Date().toISOString(),
      };

      slices.push({
        rule,
        grossCents: gross,
        feeCents: 0,
        retentionCents: 0,
        netCents: gross,
        beneficiaryId,
        allocationType: mapAllocationType(rule.beneficiaryType),
        snapshot,
      });
    }

    return slices;
  }

  validateSlices(slices: CalculatedSlice[], paymentCents: number, currency: string) {
    let sum = 0;
    for (const slice of slices) {
      const ruleCurrency = slice.snapshot.currency ?? slice.rule.snapshotJson?.currency;
      if (
        typeof ruleCurrency === "string" &&
        ruleCurrency.length === 3 &&
        ruleCurrency !== currency
      ) {
        throw new AppError(
          "VALIDATION_ERROR",
          `Moeda da regra (${ruleCurrency}) não coincide com o pagamento (${currency}).`,
          [{ path: "currency", message: "currency_mismatch" }],
        );
      }
      if (slice.grossCents < 0 || slice.netCents < 0 || slice.feeCents < 0) {
        throw new AppError("VALIDATION_ERROR", "Alocação não pode ter valores negativos.");
      }
      sum += slice.grossCents;
    }
    if (sum > paymentCents) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Soma das alocações (${sum}) excede o pagamento (${paymentCents}).`,
      );
    }
  }

  async prepareLedgerEntries(
    organizationId: string,
    currency: string,
    allocations: (typeof paymentAllocations.$inferSelect)[],
    db: AppDatabase | Parameters<Parameters<AppDatabase["transaction"]>[0]>[0] = this.db,
  ): Promise<{ entries: LedgerEntryInput[] }> {
    await this.ledger.ensureSystemAccounts(organizationId, currency, db);
    const platformRevenue = await this.ledger.getSystemAccount(
      organizationId,
      "PLATFORM_REVENUE",
      currency,
      db,
    );
    const professionalPayable = await this.ledger.getSystemAccount(
      organizationId,
      "PROFESSIONAL_PAYABLE",
      currency,
      db,
    );

    let payableCents = 0;
    for (const allocation of allocations) {
      const net = allocation.netAmountCents ?? allocation.netCents;
      if (net <= 0) continue;
      if (allocation.beneficiaryType !== "platform") {
        payableCents += net;
      }
    }

    // Reclass: portion owed to beneficiaries moves from revenue to PROFESSIONAL_PAYABLE.
    // Platform share already sits in PLATFORM_REVENUE from payment_received — no-op if only platform.
    if (payableCents <= 0) return { entries: [] };

    return {
      entries: [
        {
          accountId: platformRevenue.id,
          direction: "debit",
          amountCents: payableCents,
          metadata: { purpose: "reclass_to_payable" },
        },
        {
          accountId: professionalPayable.id,
          direction: "credit",
          amountCents: payableCents,
          metadata: { purpose: "beneficiary_payable" },
        },
      ] satisfies LedgerEntryInput[],
    };
  }

  private async requirePayable(organizationId: string, payableId: string) {
    const payable = await this.db.query.payables.findFirst({
      where: and(eq(payables.id, payableId), eq(payables.organizationId, organizationId)),
    });
    if (!payable) throw new AppError("NOT_FOUND", "Não encontramos este payable.");
    return payable;
  }
}
