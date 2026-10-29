import { recordAudit } from "@verasjuris/audit";
import { policyReconciliation, type SessionAccount } from "@verasjuris/auth";
import {
  externalFinancialTransactions,
  financialDiscrepancies,
  isUniqueViolation,
  ledgerTransactions,
  payments,
  reconciliationItems,
  reconciliationRuns,
  type AppDatabase,
} from "@verasjuris/database";
import type { ReconciliationProvider } from "@verasjuris/ai";
import { AppError } from "@verasjuris/types";
import { and, asc, count, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { authorize, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";

type ExternalSource = "payment_provider" | "ledger" | "bank" | "manual_import" | "erp";

type MatchCandidate = {
  id: string;
  sourceType: string;
  externalId: string | null;
  amountCents: number;
  currency: string;
  occurredAt: Date;
};

/**
 * Conciliação compara fontes distintas. Gateway ≠ Ledger ≠ Bank —
 * nunca assume igualdade nem muta ledger postado.
 * Resolução = nota de review; correções financeiras vão via
 * LedgerPostingService.reverse + novo lançamento.
 */
export class ReconciliationService {
  constructor(
    private readonly db: AppDatabase,
    private readonly reconciliationProvider?: ReconciliationProvider,
  ) {}

  private providerNotConfigured() {
    const provider = this.reconciliationProvider;
    return !provider || provider.id === "not_configured";
  }

  async importExternalTransactions(
    account: SessionAccount,
    organizationId: string,
    input: {
      sourceType: ExternalSource;
      importSource?: "api" | "webhook" | "csv" | "ofx" | "cnab" | "manual";
      providerKey?: string;
      externalId: string;
      occurredAt: string;
      amountCents: number;
      currency: string;
      direction: "inflow" | "outflow";
      description?: string;
      rawReference?: string;
      metadata?: Record<string, unknown>;
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) =>
      policyReconciliation(m, "finance.reconciliation.manage"),
    );

    const importSource = input.importSource ?? "manual";
    // Provider-driven import (api/webhook/ofx/cnab) requires a real ReconciliationProvider.
    if (
      (importSource === "api" ||
        importSource === "webhook" ||
        importSource === "ofx" ||
        importSource === "cnab") &&
      this.providerNotConfigured()
    ) {
      throw new AppError(
        "RECONCILIATION_PROVIDER_NOT_CONFIGURED",
        "Importação automática de extrato não está configurada. Use importação manual ou fixture.",
      );
    }

    try {
      const [row] = await this.db
        .insert(externalFinancialTransactions)
        .values({
          organizationId,
          sourceType: input.sourceType,
          importSource,
          providerKey: input.providerKey ?? "not_configured",
          externalId: input.externalId,
          occurredAt: new Date(input.occurredAt),
          amountCents: input.amountCents,
          currency: input.currency,
          direction: input.direction,
          description: input.description ?? null,
          rawReference: input.rawReference ?? null,
          status: "imported",
          metadata: input.metadata ?? null,
        })
        .returning();

      await recordAudit(this.db, {
        actorUserId: account.user.id,
        organizationId,
        action: "finance.reconciliation_import",
        resourceType: "external_financial_transaction",
        resourceId: row!.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: {
          sourceType: row!.sourceType,
          externalId: row!.externalId,
          amountCents: row!.amountCents,
        },
      });

      return { transaction: serializeExternalTx(row!) };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError("CONFLICT", "Transação externa já importada para este provedor.");
      }
      throw error;
    }
  }

  async listImports(
    account: SessionAccount,
    organizationId: string,
    query: { limit: number; offset: number },
  ) {
    authorize(account, organizationId, (m) =>
      policyReconciliation(m, "finance.reconciliation.read"),
    );
    const where = eq(externalFinancialTransactions.organizationId, organizationId);
    const [items, totalRow] = await Promise.all([
      this.db.query.externalFinancialTransactions.findMany({
        where,
        orderBy: [desc(externalFinancialTransactions.importedAt)],
        limit: query.limit,
        offset: query.offset,
      }),
      this.db.select({ value: count() }).from(externalFinancialTransactions).where(where),
    ]);
    return {
      items: items.map(serializeExternalTx),
      total: Number(totalRow[0]?.value ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async createRun(
    account: SessionAccount,
    organizationId: string,
    input: {
      sourceA: ExternalSource;
      sourceB: ExternalSource;
      periodStart: string;
      periodEnd: string;
    },
    meta: RequestMeta,
  ) {
    const membership = authorize(account, organizationId, (m) =>
      policyReconciliation(m, "finance.reconciliation.manage"),
    );
    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);
    if (!(periodStart < periodEnd)) {
      throw new AppError("VALIDATION_ERROR", "periodStart deve ser anterior a periodEnd.");
    }

    const [run] = await this.db
      .insert(reconciliationRuns)
      .values({
        organizationId,
        sourceA: input.sourceA,
        sourceB: input.sourceB,
        periodStart,
        periodEnd,
        status: "pending",
        createdByMembershipId: membership.membershipId,
      })
      .returning();

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "finance.reconciliation_started",
      resourceType: "reconciliation_run",
      resourceId: run!.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { sourceA: input.sourceA, sourceB: input.sourceB },
    });

    return this.executeRun(account, organizationId, run!.id, meta);
  }

  async executeRun(
    account: SessionAccount,
    organizationId: string,
    runId: string,
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) =>
      policyReconciliation(m, "finance.reconciliation.manage"),
    );
    const run = await this.requireRun(organizationId, runId);

    await this.db
      .update(reconciliationRuns)
      .set({ status: "running", startedAt: new Date(), updatedAt: new Date() })
      .where(eq(reconciliationRuns.id, run.id));

    try {
      const left = await this.loadCandidates(
        organizationId,
        run.sourceA,
        run.periodStart,
        run.periodEnd,
      );
      const right = await this.loadCandidates(
        organizationId,
        run.sourceB,
        run.periodStart,
        run.periodEnd,
      );

      const { items, discrepancies, summary } = matchDeterministic(left, right);

      for (const item of items) {
        const [created] = await this.db
          .insert(reconciliationItems)
          .values({
            runId: run.id,
            sourceAType: item.sourceAType,
            sourceAId: item.sourceAId,
            sourceBType: item.sourceBType,
            sourceBId: item.sourceBId,
            amountDifferenceCents: item.amountDifferenceCents,
            dateDifferenceHours: item.dateDifferenceHours,
            status: item.status,
            confidence: item.confidence,
          })
          .returning();

        if (item.discrepancy) {
          const [disc] = await this.db
            .insert(financialDiscrepancies)
            .values({
              organizationId,
              runId: run.id,
              source: `${run.sourceA}|${run.sourceB}`,
              type: item.discrepancy.type,
              amountCents: item.discrepancy.amountCents,
              currency: item.discrepancy.currency,
              status: "open",
              severity: item.discrepancy.severity,
              description: item.discrepancy.description,
            })
            .returning();
          discrepancies.push(disc!.id);
          await recordAudit(this.db, {
            actorUserId: account.user.id,
            organizationId,
            action: "finance.discrepancy_created",
            resourceType: "financial_discrepancy",
            resourceId: disc!.id,
            source: "api",
            requestId: meta.requestId,
            ip: meta.ip,
            after: { type: disc!.type, runId: run.id, itemId: created!.id },
          });
        }
      }

      const [completed] = await this.db
        .update(reconciliationRuns)
        .set({
          status: "completed",
          completedAt: new Date(),
          summary: {
            ...summary,
            discrepancyIds: discrepancies,
            note: "Matching determinístico; resolução não altera ledger postado.",
          },
          updatedAt: new Date(),
        })
        .where(eq(reconciliationRuns.id, run.id))
        .returning();

      await recordAudit(this.db, {
        actorUserId: account.user.id,
        organizationId,
        action: "finance.reconciliation_completed",
        resourceType: "reconciliation_run",
        resourceId: run.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: summary,
      });

      return { run: serializeRun(completed!) };
    } catch (error) {
      await this.db
        .update(reconciliationRuns)
        .set({
          status: "failed",
          completedAt: new Date(),
          summary: {
            error: error instanceof Error ? error.message : "unknown_error",
          },
          updatedAt: new Date(),
        })
        .where(eq(reconciliationRuns.id, run.id));
      throw error;
    }
  }

  async listRuns(
    account: SessionAccount,
    organizationId: string,
    query: {
      status?: (typeof reconciliationRuns.$inferSelect)["status"];
      from?: string;
      to?: string;
      limit: number;
      offset: number;
    },
  ) {
    authorize(account, organizationId, (m) =>
      policyReconciliation(m, "finance.reconciliation.read"),
    );
    const filters: SQL[] = [eq(reconciliationRuns.organizationId, organizationId)];
    if (query.status) filters.push(eq(reconciliationRuns.status, query.status));
    if (query.from) filters.push(gte(reconciliationRuns.periodStart, new Date(query.from)));
    if (query.to) filters.push(lte(reconciliationRuns.periodEnd, new Date(query.to)));
    const where = and(...filters);
    const [items, totalRow] = await Promise.all([
      this.db.query.reconciliationRuns.findMany({
        where,
        orderBy: [desc(reconciliationRuns.createdAt)],
        limit: query.limit,
        offset: query.offset,
      }),
      this.db.select({ value: count() }).from(reconciliationRuns).where(where),
    ]);
    return {
      items: items.map(serializeRun),
      total: Number(totalRow[0]?.value ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async getRun(account: SessionAccount, organizationId: string, runId: string) {
    authorize(account, organizationId, (m) =>
      policyReconciliation(m, "finance.reconciliation.read"),
    );
    const run = await this.requireRun(organizationId, runId);
    const items = await this.db.query.reconciliationItems.findMany({
      where: eq(reconciliationItems.runId, run.id),
      orderBy: [asc(reconciliationItems.createdAt)],
    });
    return { run: serializeRun(run), items: items.map(serializeItem) };
  }

  async listItems(
    account: SessionAccount,
    organizationId: string,
    query: { runId?: string; limit: number; offset: number },
  ) {
    authorize(account, organizationId, (m) =>
      policyReconciliation(m, "finance.reconciliation.read"),
    );
    if (query.runId) {
      await this.requireRun(organizationId, query.runId);
      const where = eq(reconciliationItems.runId, query.runId);
      const [items, totalRow] = await Promise.all([
        this.db.query.reconciliationItems.findMany({
          where,
          orderBy: [asc(reconciliationItems.createdAt)],
          limit: query.limit,
          offset: query.offset,
        }),
        this.db.select({ value: count() }).from(reconciliationItems).where(where),
      ]);
      return {
        items: items.map(serializeItem),
        total: Number(totalRow[0]?.value ?? 0),
        limit: query.limit,
        offset: query.offset,
      };
    }

    const runs = await this.db.query.reconciliationRuns.findMany({
      where: eq(reconciliationRuns.organizationId, organizationId),
      columns: { id: true },
    });
    const runIds = runs.map((r) => r.id);
    if (runIds.length === 0) {
      return { items: [], total: 0, limit: query.limit, offset: query.offset };
    }

    const items = await this.db.query.reconciliationItems.findMany({
      where: sql`${reconciliationItems.runId} in (${sql.join(
        runIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
      orderBy: [desc(reconciliationItems.createdAt)],
      limit: query.limit,
      offset: query.offset,
    });
    return {
      items: items.map(serializeItem),
      total: items.length,
      limit: query.limit,
      offset: query.offset,
    };
  }

  /**
   * Resolve item with a review note only — never mutates posted ledger entries.
   */
  async resolveItem(
    account: SessionAccount,
    organizationId: string,
    itemId: string,
    input: {
      status: (typeof reconciliationItems.$inferSelect)["status"];
      resolution: string;
    },
    meta: RequestMeta,
  ) {
    const membership = authorize(account, organizationId, (m) =>
      policyReconciliation(m, "finance.reconciliation.manage"),
    );
    const item = await this.db.query.reconciliationItems.findFirst({
      where: eq(reconciliationItems.id, itemId),
    });
    if (!item) throw new AppError("NOT_FOUND", "Item de conciliação não encontrado.");
    const run = await this.requireRun(organizationId, item.runId);

    const [updated] = await this.db
      .update(reconciliationItems)
      .set({
        status: input.status === "resolved" ? "resolved" : input.status,
        resolution: input.resolution,
        resolvedByMembershipId: membership.membershipId,
        resolvedAt: new Date(),
      })
      .where(eq(reconciliationItems.id, item.id))
      .returning();

    const related = await this.db.query.financialDiscrepancies.findMany({
      where: and(
        eq(financialDiscrepancies.organizationId, organizationId),
        eq(financialDiscrepancies.runId, run.id),
        eq(financialDiscrepancies.status, "open"),
      ),
    });
    for (const disc of related) {
      if (
        disc.description?.includes(item.id) ||
        (item.sourceAId && disc.description?.includes(item.sourceAId)) ||
        (item.sourceBId && disc.description?.includes(item.sourceBId))
      ) {
        await this.db
          .update(financialDiscrepancies)
          .set({
            status: "resolved",
            resolvedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(financialDiscrepancies.id, disc.id));
        await recordAudit(this.db, {
          actorUserId: account.user.id,
          organizationId,
          action: "finance.discrepancy_resolved",
          resourceType: "financial_discrepancy",
          resourceId: disc.id,
          source: "api",
          requestId: meta.requestId,
          ip: meta.ip,
          after: {
            resolution: input.resolution,
            ledgerMutated: false,
            note: "Correções de ledger exigem reverse + novo posting.",
          },
        });
      }
    }

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "finance.reconciliation_item_resolved",
      resourceType: "reconciliation_item",
      resourceId: item.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        status: updated!.status,
        resolution: input.resolution,
        ledgerMutated: false,
      },
    });

    return {
      item: serializeItem(updated!),
      ledgerMutated: false,
      correctionHint:
        "Resolução é nota de review. Para corrigir valores contábeis use LedgerPostingService.reverse + novo lançamento.",
    };
  }

  async listDiscrepancies(
    account: SessionAccount,
    organizationId: string,
    query: { status?: string; limit: number; offset: number },
  ) {
    authorize(account, organizationId, (m) =>
      policyReconciliation(m, "finance.reconciliation.read"),
    );
    const filters: SQL[] = [eq(financialDiscrepancies.organizationId, organizationId)];
    if (query.status) {
      filters.push(
        eq(
          financialDiscrepancies.status,
          query.status as (typeof financialDiscrepancies.$inferSelect)["status"],
        ),
      );
    }
    const where = and(...filters);
    const [items, totalRow] = await Promise.all([
      this.db.query.financialDiscrepancies.findMany({
        where,
        orderBy: [desc(financialDiscrepancies.openedAt)],
        limit: query.limit,
        offset: query.offset,
      }),
      this.db.select({ value: count() }).from(financialDiscrepancies).where(where),
    ]);
    return {
      items: items.map(serializeDiscrepancy),
      total: Number(totalRow[0]?.value ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async resolveDiscrepancy(
    account: SessionAccount,
    organizationId: string,
    discrepancyId: string,
    input: { status: "resolved" | "dismissed" | "investigating"; note?: string },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) =>
      policyReconciliation(m, "finance.reconciliation.manage"),
    );
    const row = await this.db.query.financialDiscrepancies.findFirst({
      where: and(
        eq(financialDiscrepancies.id, discrepancyId),
        eq(financialDiscrepancies.organizationId, organizationId),
      ),
    });
    if (!row) throw new AppError("NOT_FOUND", "Divergência não encontrada.");

    const [updated] = await this.db
      .update(financialDiscrepancies)
      .set({
        status: input.status,
        resolvedAt: input.status === "resolved" || input.status === "dismissed" ? new Date() : null,
        description: input.note
          ? `${row.description ?? ""}\n[resolve] ${input.note}`.trim()
          : row.description,
        updatedAt: new Date(),
      })
      .where(eq(financialDiscrepancies.id, row.id))
      .returning();

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "finance.discrepancy_resolved",
      resourceType: "financial_discrepancy",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { status: input.status, ledgerMutated: false, note: input.note ?? null },
    });

    return {
      discrepancy: serializeDiscrepancy(updated!),
      ledgerMutated: false,
    };
  }

  private async requireRun(organizationId: string, runId: string) {
    const run = await this.db.query.reconciliationRuns.findFirst({
      where: and(
        eq(reconciliationRuns.id, runId),
        eq(reconciliationRuns.organizationId, organizationId),
      ),
    });
    if (!run) throw new AppError("NOT_FOUND", "Execução de conciliação não encontrada.");
    return run;
  }

  private async loadCandidates(
    organizationId: string,
    source: ExternalSource,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<MatchCandidate[]> {
    if (source === "ledger") {
      const txs = await this.db.query.ledgerTransactions.findMany({
        where: and(
          eq(ledgerTransactions.organizationId, organizationId),
          eq(ledgerTransactions.status, "posted"),
          gte(ledgerTransactions.occurredAt, periodStart),
          lte(ledgerTransactions.occurredAt, periodEnd),
        ),
        orderBy: [asc(ledgerTransactions.occurredAt), asc(ledgerTransactions.id)],
      });
      // Amount from linked payment when available; otherwise 0 (amount match still needs currency+date+externalId).
      const paymentRows = await this.db.query.payments.findMany({
        where: and(
          eq(payments.organizationId, organizationId),
          gte(payments.createdAt, periodStart),
          lte(payments.createdAt, periodEnd),
        ),
      });
      const byLedgerTx = new Map(
        paymentRows
          .filter((p) => p.ledgerTransactionId)
          .map((p) => [p.ledgerTransactionId!, p] as const),
      );
      return txs.map((tx) => {
        const payment = byLedgerTx.get(tx.id);
        return {
          id: tx.id,
          sourceType: "ledger",
          externalId: payment?.externalPaymentId ?? tx.idempotencyKey,
          amountCents: payment?.amountCents ?? 0,
          currency: tx.currency,
          occurredAt: tx.occurredAt,
        };
      });
    }

    if (source === "payment_provider") {
      const rows = await this.db.query.payments.findMany({
        where: and(
          eq(payments.organizationId, organizationId),
          gte(payments.createdAt, periodStart),
          lte(payments.createdAt, periodEnd),
        ),
        orderBy: [asc(payments.createdAt), asc(payments.id)],
      });
      return rows.map((p) => ({
        id: p.id,
        sourceType: "payment_provider",
        externalId: p.externalPaymentId,
        amountCents: p.amountCents,
        currency: p.currency,
        occurredAt: p.confirmedAt ?? p.createdAt,
      }));
    }

    // bank / manual_import / erp → external_financial_transactions
    const sourceType =
      source === "bank"
        ? "bank"
        : source === "erp"
          ? "erp"
          : source === "manual_import"
            ? "manual_import"
            : "payment_provider";
    const rows = await this.db.query.externalFinancialTransactions.findMany({
      where: and(
        eq(externalFinancialTransactions.organizationId, organizationId),
        eq(externalFinancialTransactions.sourceType, sourceType),
        gte(externalFinancialTransactions.occurredAt, periodStart),
        lte(externalFinancialTransactions.occurredAt, periodEnd),
      ),
      orderBy: [
        asc(externalFinancialTransactions.occurredAt),
        asc(externalFinancialTransactions.id),
      ],
    });
    return rows.map((r) => ({
      id: r.id,
      sourceType: r.sourceType,
      externalId: r.externalId,
      amountCents: Math.abs(r.amountCents),
      currency: r.currency,
      occurredAt: r.occurredAt,
    }));
  }
}

type MatchResultItem = {
  sourceAType: string;
  sourceAId: string | null;
  sourceBType: string | null;
  sourceBId: string | null;
  amountDifferenceCents: number;
  dateDifferenceHours: number | null;
  status: (typeof reconciliationItems.$inferInsert)["status"];
  confidence: number;
  discrepancy: {
    type: (typeof financialDiscrepancies.$inferInsert)["type"];
    amountCents: number;
    currency: string;
    severity: (typeof financialDiscrepancies.$inferInsert)["severity"];
    description: string;
  } | null;
};

/**
 * Matching determinístico (ordem estável):
 * 1) externalId + currency
 * 2) amountCents + currency + date (mesmo dia UTC)
 * Sem match → missing_left / missing_right + discrepancy.
 */
function matchDeterministic(left: MatchCandidate[], right: MatchCandidate[]) {
  const items: MatchResultItem[] = [];
  const discrepancyIds: string[] = [];
  const usedRight = new Set<string>();

  const rightByExternal = new Map<string, MatchCandidate[]>();
  for (const r of right) {
    if (!r.externalId) continue;
    const key = `${r.currency}|${r.externalId}`;
    const list = rightByExternal.get(key) ?? [];
    list.push(r);
    rightByExternal.set(key, list);
  }

  let matched = 0;
  let amountMismatch = 0;
  let dateMismatch = 0;
  let missingRight = 0;
  let missingLeft = 0;

  for (const a of left) {
    let partner: MatchCandidate | null = null;
    let matchKind: "externalId" | "amount_date" | null = null;

    if (a.externalId) {
      const key = `${a.currency}|${a.externalId}`;
      const candidates = (rightByExternal.get(key) ?? []).filter((c) => !usedRight.has(c.id));
      if (candidates[0]) {
        partner = candidates[0]!;
        matchKind = "externalId";
      }
    }

    if (!partner) {
      const day = a.occurredAt.toISOString().slice(0, 10);
      partner =
        right.find(
          (b) =>
            !usedRight.has(b.id) &&
            b.currency === a.currency &&
            b.amountCents === a.amountCents &&
            b.occurredAt.toISOString().slice(0, 10) === day,
        ) ?? null;
      if (partner) matchKind = "amount_date";
    }

    if (!partner) {
      missingRight += 1;
      items.push({
        sourceAType: a.sourceType,
        sourceAId: a.id,
        sourceBType: null,
        sourceBId: null,
        amountDifferenceCents: a.amountCents,
        dateDifferenceHours: null,
        status: "missing_right",
        confidence: 100,
        discrepancy: {
          type: a.sourceType === "ledger" ? "missing_bank_entry" : "missing_payment",
          amountCents: a.amountCents,
          currency: a.currency,
          severity: "medium",
          description: `missing_right left=${a.id} externalId=${a.externalId ?? "null"}`,
        },
      });
      continue;
    }

    usedRight.add(partner.id);
    const amountDiff = a.amountCents - partner.amountCents;
    const hours = Math.round(
      Math.abs(a.occurredAt.getTime() - partner.occurredAt.getTime()) / 3_600_000,
    );
    const sameDay =
      a.occurredAt.toISOString().slice(0, 10) === partner.occurredAt.toISOString().slice(0, 10);

    if (amountDiff !== 0) {
      amountMismatch += 1;
      items.push({
        sourceAType: a.sourceType,
        sourceAId: a.id,
        sourceBType: partner.sourceType,
        sourceBId: partner.id,
        amountDifferenceCents: amountDiff,
        dateDifferenceHours: hours,
        status: "amount_mismatch",
        confidence: matchKind === "externalId" ? 90 : 70,
        discrepancy: {
          type: "amount_mismatch",
          amountCents: Math.abs(amountDiff),
          currency: a.currency,
          severity: "high",
          description: `amount_mismatch a=${a.id} b=${partner.id}`,
        },
      });
    } else if (!sameDay && hours > 48) {
      dateMismatch += 1;
      items.push({
        sourceAType: a.sourceType,
        sourceAId: a.id,
        sourceBType: partner.sourceType,
        sourceBId: partner.id,
        amountDifferenceCents: 0,
        dateDifferenceHours: hours,
        status: "date_mismatch",
        confidence: 60,
        discrepancy: {
          type: "other",
          amountCents: 0,
          currency: a.currency,
          severity: "low",
          description: `date_mismatch a=${a.id} b=${partner.id} hours=${hours}`,
        },
      });
    } else {
      matched += 1;
      items.push({
        sourceAType: a.sourceType,
        sourceAId: a.id,
        sourceBType: partner.sourceType,
        sourceBId: partner.id,
        amountDifferenceCents: 0,
        dateDifferenceHours: hours,
        status: "matched",
        confidence: matchKind === "externalId" ? 100 : 85,
        discrepancy: null,
      });
    }
  }

  for (const b of right) {
    if (usedRight.has(b.id)) continue;
    missingLeft += 1;
    items.push({
      sourceAType: left[0]?.sourceType ?? "unknown",
      sourceAId: null,
      sourceBType: b.sourceType,
      sourceBId: b.id,
      amountDifferenceCents: b.amountCents,
      dateDifferenceHours: null,
      status: "missing_left",
      confidence: 100,
      discrepancy: {
        type: b.sourceType === "ledger" ? "missing_ledger_entry" : "missing_payment",
        amountCents: b.amountCents,
        currency: b.currency,
        severity: "medium",
        description: `missing_left right=${b.id} externalId=${b.externalId ?? "null"}`,
      },
    });
  }

  return {
    items,
    discrepancies: discrepancyIds,
    summary: {
      matched,
      amountMismatch,
      dateMismatch,
      missingLeft,
      missingRight,
      leftCount: left.length,
      rightCount: right.length,
      itemCount: items.length,
    },
  };
}

function serializeExternalTx(row: typeof externalFinancialTransactions.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    sourceType: row.sourceType,
    importSource: row.importSource,
    providerKey: row.providerKey,
    externalId: row.externalId,
    occurredAt: row.occurredAt.toISOString(),
    amountCents: row.amountCents,
    currency: row.currency,
    direction: row.direction,
    description: row.description,
    rawReference: row.rawReference,
    status: row.status,
    importedAt: row.importedAt.toISOString(),
    metadata: row.metadata,
  };
}

function serializeRun(row: typeof reconciliationRuns.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    sourceA: row.sourceA,
    sourceB: row.sourceB,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    status: row.status,
    startedAt: iso(row.startedAt),
    completedAt: iso(row.completedAt),
    summary: row.summary,
    createdByMembershipId: row.createdByMembershipId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeItem(row: typeof reconciliationItems.$inferSelect) {
  return {
    id: row.id,
    runId: row.runId,
    sourceAType: row.sourceAType,
    sourceAId: row.sourceAId,
    sourceBType: row.sourceBType,
    sourceBId: row.sourceBId,
    amountDifferenceCents: row.amountDifferenceCents,
    dateDifferenceHours: row.dateDifferenceHours,
    status: row.status,
    confidence: row.confidence,
    resolution: row.resolution,
    resolvedByMembershipId: row.resolvedByMembershipId,
    resolvedAt: iso(row.resolvedAt),
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeDiscrepancy(row: typeof financialDiscrepancies.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    runId: row.runId,
    source: row.source,
    type: row.type,
    amountCents: row.amountCents,
    currency: row.currency,
    status: row.status,
    severity: row.severity,
    ownerMembershipId: row.ownerMembershipId,
    description: row.description,
    openedAt: row.openedAt.toISOString(),
    resolvedAt: iso(row.resolvedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
