import {
  accountsPayable,
  aiCreditTransactions,
  aiCreditWallets,
  isUniqueViolation,
  payables,
  receivables,
  softwareLicenses,
  delinquencyCases,
  type AppDatabase,
} from "@verasjuris/database";
import type { JobHandler, JobRecord } from "@verasjuris/events";
import { and, eq, inArray, isNotNull, lt, lte, sql } from "drizzle-orm";

/* ─── Split / payouts (21.3) ─── */
export const JOB_PAYMENT_ALLOCATION = "PAYMENT_ALLOCATION" as const;
export const JOB_PAYABLE_RELEASE = "PAYABLE_RELEASE" as const;
export const JOB_PAYOUT_SCHEDULE = "PAYOUT_SCHEDULE" as const;
export const JOB_PAYOUT_PROCESS = "PAYOUT_PROCESS" as const;
export const JOB_PAYOUT_STATUS_SYNC = "PAYOUT_STATUS_SYNC" as const;

/* ─── Refund / dispute (21.4) ─── */
export const JOB_REFUND_PROCESS = "REFUND_PROCESS" as const;
export const JOB_REFUND_STATUS_SYNC = "REFUND_STATUS_SYNC" as const;
export const JOB_DISPUTE_STATUS_SYNC = "DISPUTE_STATUS_SYNC" as const;

/* ─── Reconciliation (21.5) ─── */
export const JOB_GATEWAY_RECONCILIATION = "GATEWAY_RECONCILIATION" as const;
export const JOB_BANK_RECONCILIATION = "BANK_RECONCILIATION" as const;
export const JOB_LEDGER_RECONCILIATION = "LEDGER_RECONCILIATION" as const;
export const JOB_RECONCILIATION_IMPORT = "RECONCILIATION_IMPORT" as const;

/* ─── Treasury (21.5) ─── */
export const JOB_DELINQUENCY_CHECK = "DELINQUENCY_CHECK" as const;
export const JOB_PAYABLE_DUE_CHECK = "PAYABLE_DUE_CHECK" as const;
export const JOB_RECEIVABLE_DUE_CHECK = "RECEIVABLE_DUE_CHECK" as const;
export const JOB_FORECAST_REFRESH = "FORECAST_REFRESH" as const;

/* ─── Monetization (22) ─── */
export const JOB_USAGE_AGGREGATION = "USAGE_AGGREGATION" as const;
export const JOB_AI_CREDIT_EXPIRATION = "AI_CREDIT_EXPIRATION" as const;
export const JOB_API_USAGE_BILLING = "API_USAGE_BILLING" as const;
export const JOB_LICENSE_EXPIRATION = "LICENSE_EXPIRATION" as const;
export const JOB_PLAN_ENTITLEMENT_REFRESH = "PLAN_ENTITLEMENT_REFRESH" as const;

type OrgPayload = {
  organizationId?: string;
  payableId?: string;
  receivableId?: string;
  walletId?: string;
  licenseId?: string;
  forecastId?: string;
  paymentId?: string;
};

function requireOrganizationId(job: JobRecord): string {
  const payload = job.payload as OrgPayload | null;
  const organizationId = payload?.organizationId?.trim();
  if (!organizationId) {
    throw Object.assign(new Error(`${job.type} exige organizationId`), {
      code: "VALIDATION_ERROR",
    });
  }
  return organizationId;
}

function createNotConfiguredSyncHandler(code: string, message: string): JobHandler {
  return async (job: JobRecord) => {
    requireOrganizationId(job);
    throw Object.assign(new Error(message), { code });
  };
}

function createNoOpHandler(_db: AppDatabase): JobHandler {
  return async (job: JobRecord) => {
    requireOrganizationId(job);
  };
}

function stageFromDays(days: number): (typeof delinquencyCases.$inferInsert)["stage"] {
  if (days >= 90) return "legal";
  if (days >= 60) return "collection";
  if (days >= 30) return "negotiation";
  if (days >= 15) return "notice";
  return "reminder";
}

/** Parse expiresAt from grant reason: JSON `{expiresAt}` or `expiresAt=<iso>`. */
function parseExpiresAtFromReason(reason: string | null): Date | null {
  if (!reason?.trim()) return null;
  const trimmed = reason.trim();
  try {
    const parsed = JSON.parse(trimmed) as { expiresAt?: unknown };
    if (typeof parsed.expiresAt === "string" && parsed.expiresAt.trim()) {
      const d = new Date(parsed.expiresAt);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  } catch {
    // not JSON — fall through
  }
  const match = /expiresAt[=:]\s*(\S+)/i.exec(trimmed);
  if (!match?.[1]) return null;
  const d = new Date(match[1].replace(/[,;].*$/, ""));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * pending → available when availableAt passed.
 * Never touches held/scheduled/paid (no inventar liberação de hold/disputa).
 */
export function createPayableReleaseHandler(db: AppDatabase): JobHandler {
  return async (job: JobRecord) => {
    const organizationId = requireOrganizationId(job);
    const payload = job.payload as OrgPayload;
    const now = new Date();
    const filters = [
      eq(payables.organizationId, organizationId),
      eq(payables.status, "pending"),
      lte(payables.availableAt, now),
    ];
    if (payload.payableId) {
      filters.push(eq(payables.id, payload.payableId));
    }
    await db
      .update(payables)
      .set({ status: "available", updatedAt: now })
      .where(and(...filters));
  };
}

/** Contas a pagar (tesouraria) approved/scheduled com dueAt passado → overdue. */
export function createPayableDueCheckHandler(db: AppDatabase): JobHandler {
  return async (job: JobRecord) => {
    const organizationId = requireOrganizationId(job);
    const payload = job.payload as OrgPayload;
    const now = new Date();
    const filters = [
      eq(accountsPayable.organizationId, organizationId),
      inArray(accountsPayable.status, ["approved", "scheduled"]),
      isNotNull(accountsPayable.dueAt),
      lt(accountsPayable.dueAt, now),
    ];
    if (payload.payableId) {
      filters.push(eq(accountsPayable.id, payload.payableId));
    }
    await db
      .update(accountsPayable)
      .set({ status: "overdue", updatedAt: now })
      .where(and(...filters));
  };
}

/** Receivables open/partial com dueAt passado → overdue. */
export function createReceivableDueCheckHandler(db: AppDatabase): JobHandler {
  return async (job: JobRecord) => {
    const organizationId = requireOrganizationId(job);
    const payload = job.payload as OrgPayload;
    const now = new Date();
    const filters = [
      eq(receivables.organizationId, organizationId),
      inArray(receivables.status, ["open", "partial"]),
      isNotNull(receivables.dueAt),
      lt(receivables.dueAt, now),
      sql`${receivables.amountCents} > ${receivables.amountPaidCents}`,
    ];
    if (payload.receivableId) {
      filters.push(eq(receivables.id, payload.receivableId));
    }
    await db
      .update(receivables)
      .set({ status: "overdue", updatedAt: now })
      .where(and(...filters));
  };
}

/**
 * Cria/atualiza delinquency_cases a partir de receivables vencidos.
 * Não inventa cobrança externa / collection provider.
 */
export function createDelinquencyCheckHandler(db: AppDatabase): JobHandler {
  return async (job: JobRecord) => {
    const organizationId = requireOrganizationId(job);
    const now = new Date();

    // Primeiro marca overdue (idempotente).
    await db
      .update(receivables)
      .set({ status: "overdue", updatedAt: now })
      .where(
        and(
          eq(receivables.organizationId, organizationId),
          inArray(receivables.status, ["open", "partial", "overdue"]),
          isNotNull(receivables.dueAt),
          lt(receivables.dueAt, now),
          sql`${receivables.amountCents} > ${receivables.amountPaidCents}`,
        ),
      );

    const overdueRows = await db.query.receivables.findMany({
      where: and(eq(receivables.organizationId, organizationId), eq(receivables.status, "overdue")),
    });

    for (const recv of overdueRows) {
      if (!recv.dueAt) continue;
      const daysOverdue = Math.max(
        0,
        Math.floor((now.getTime() - recv.dueAt.getTime()) / 86_400_000),
      );
      const stage = stageFromDays(daysOverdue);
      const existing = await db.query.delinquencyCases.findFirst({
        where: eq(delinquencyCases.receivableId, recv.id),
      });
      if (existing) {
        if (
          existing.status === "resolved" ||
          existing.status === "written_off" ||
          existing.status === "cancelled"
        ) {
          continue;
        }
        await db
          .update(delinquencyCases)
          .set({
            daysOverdue,
            stage,
            status: existing.status === "open" ? "in_progress" : existing.status,
            updatedAt: now,
          })
          .where(eq(delinquencyCases.id, existing.id));
      } else {
        try {
          await db.insert(delinquencyCases).values({
            organizationId,
            receivableId: recv.id,
            daysOverdue,
            stage,
            status: "open",
          });
        } catch (error) {
          if (isUniqueViolation(error)) continue;
          throw error;
        }
      }
    }
  };
}

/**
 * Licenças active com endsAt passado → expired.
 * Não inventa renovação / license server externo.
 */
export function createLicenseExpirationHandler(db: AppDatabase): JobHandler {
  return async (job: JobRecord) => {
    const organizationId = requireOrganizationId(job);
    const payload = job.payload as OrgPayload;
    const now = new Date();
    const filters = [
      eq(softwareLicenses.organizationId, organizationId),
      eq(softwareLicenses.status, "active"),
      isNotNull(softwareLicenses.endsAt),
      lt(softwareLicenses.endsAt, now),
    ];
    if (payload.licenseId) {
      filters.push(eq(softwareLicenses.id, payload.licenseId));
    }
    await db
      .update(softwareLicenses)
      .set({ status: "expired", updatedAt: now })
      .where(and(...filters));
  };
}

/**
 * Expira créditos de IA cujo grant/purchase declara expiresAt no reason
 * (JSON `{expiresAt}` ou `expiresAt=<iso>`). Idempotente por grant.
 * Sem data de expiração explícita: noop (não inventa vencimento).
 */
export function createAiCreditExpirationHandler(db: AppDatabase): JobHandler {
  return async (job: JobRecord) => {
    const organizationId = requireOrganizationId(job);
    const payload = job.payload as OrgPayload;
    const now = new Date();

    const walletFilters = [eq(aiCreditWallets.organizationId, organizationId)];
    if (payload.walletId) {
      walletFilters.push(eq(aiCreditWallets.id, payload.walletId));
    }
    const wallets = await db.query.aiCreditWallets.findMany({
      where: and(...walletFilters),
    });

    for (const wallet of wallets) {
      if (wallet.balanceCredits <= 0) continue;

      const grants = await db.query.aiCreditTransactions.findMany({
        where: and(
          eq(aiCreditTransactions.walletId, wallet.id),
          inArray(aiCreditTransactions.type, ["grant", "purchase"]),
        ),
      });

      let remainingBalance = wallet.balanceCredits;

      for (const grant of grants) {
        if (remainingBalance <= 0) break;
        const expiresAt = parseExpiresAtFromReason(grant.reason);
        if (!expiresAt || expiresAt.getTime() >= now.getTime()) continue;

        const idempotencyKey = `ai-credit-expire:${grant.id}`;
        const already = await db.query.aiCreditTransactions.findFirst({
          where: and(
            eq(aiCreditTransactions.walletId, wallet.id),
            eq(aiCreditTransactions.idempotencyKey, idempotencyKey),
          ),
        });
        if (already) continue;

        const amount = Math.min(grant.amountCredits, remainingBalance);
        if (amount <= 0) continue;

        const nextBalance = remainingBalance - amount;
        try {
          await db.insert(aiCreditTransactions).values({
            walletId: wallet.id,
            type: "expiration",
            amountCredits: amount,
            balanceAfterCredits: nextBalance,
            reason: `expired_grant:${grant.id}`,
            sourceType: "ai_credit_grant",
            sourceId: grant.id,
            idempotencyKey,
          });
        } catch (error) {
          if (isUniqueViolation(error)) continue;
          throw error;
        }

        await db
          .update(aiCreditWallets)
          .set({ balanceCredits: nextBalance, updatedAt: now })
          .where(eq(aiCreditWallets.id, wallet.id));
        remainingBalance = nextBalance;
      }
    }
  };
}

/**
 * Handlers locais (LocalInProcessQueueProvider) — Etapas 21.3 / 21.4 / 21.5 / 22.
 * Externos: NOT_CONFIGURED honesto. Safe DB: release/overdue/expire. Sem paid/match inventado.
 */
export function registerLocalMonetizationTreasuryHandlers(
  queue: {
    status: string;
    registerHandler?: (type: string, handler: JobHandler) => void;
  },
  db: AppDatabase,
): void {
  if (queue.status !== "local_in_process" || typeof queue.registerHandler !== "function") {
    return;
  }

  const noOp = createNoOpHandler(db);

  // Allocation é síncrona via API; job async não inventa split.
  queue.registerHandler(JOB_PAYMENT_ALLOCATION, noOp);
  queue.registerHandler(JOB_PAYABLE_RELEASE, createPayableReleaseHandler(db));
  // Agenda não cria payouts pagos — noop até schedule explícito via API.
  queue.registerHandler(JOB_PAYOUT_SCHEDULE, noOp);
  queue.registerHandler(
    JOB_PAYOUT_PROCESS,
    createNotConfiguredSyncHandler(
      "PAYOUT_PROVIDER_NOT_CONFIGURED",
      "PAYOUT_PROCESS: nenhum provedor de payout/repasse configurado.",
    ),
  );
  queue.registerHandler(
    JOB_PAYOUT_STATUS_SYNC,
    createNotConfiguredSyncHandler(
      "PAYOUT_PROVIDER_NOT_CONFIGURED",
      "PAYOUT_STATUS_SYNC: nenhum provedor de payout configurado.",
    ),
  );

  queue.registerHandler(
    JOB_REFUND_PROCESS,
    createNotConfiguredSyncHandler(
      "PAYMENT_PROVIDER_NOT_CONFIGURED",
      "REFUND_PROCESS: nenhum provedor de pagamento/reembolso configurado.",
    ),
  );
  queue.registerHandler(
    JOB_REFUND_STATUS_SYNC,
    createNotConfiguredSyncHandler(
      "PAYMENT_PROVIDER_NOT_CONFIGURED",
      "REFUND_STATUS_SYNC: nenhum provedor de pagamento configurado.",
    ),
  );
  queue.registerHandler(
    JOB_DISPUTE_STATUS_SYNC,
    createNotConfiguredSyncHandler(
      "PAYMENT_DISPUTE_PROVIDER_NOT_CONFIGURED",
      "DISPUTE_STATUS_SYNC: nenhum provedor de disputa/chargeback configurado.",
    ),
  );

  queue.registerHandler(
    JOB_GATEWAY_RECONCILIATION,
    createNotConfiguredSyncHandler(
      "RECONCILIATION_PROVIDER_NOT_CONFIGURED",
      "GATEWAY_RECONCILIATION: nenhum provedor de conciliação/gateway configurado.",
    ),
  );
  queue.registerHandler(
    JOB_BANK_RECONCILIATION,
    createNotConfiguredSyncHandler(
      "BANKING_PROVIDER_NOT_CONFIGURED",
      "BANK_RECONCILIATION: nenhum BankingProvider configurado.",
    ),
  );
  // Ledger interno pode ser comparado localmente; sem import externo = noop seguro
  // (não inventa matches bancários). Job completo aguarda ReconciliationService + fontes.
  queue.registerHandler(JOB_LEDGER_RECONCILIATION, noOp);
  queue.registerHandler(
    JOB_RECONCILIATION_IMPORT,
    createNotConfiguredSyncHandler(
      "RECONCILIATION_PROVIDER_NOT_CONFIGURED",
      "RECONCILIATION_IMPORT: importação bancária/OFX/CNAB sem provedor configurado.",
    ),
  );

  queue.registerHandler(JOB_DELINQUENCY_CHECK, createDelinquencyCheckHandler(db));
  queue.registerHandler(JOB_PAYABLE_DUE_CHECK, createPayableDueCheckHandler(db));
  queue.registerHandler(JOB_RECEIVABLE_DUE_CHECK, createReceivableDueCheckHandler(db));
  // Forecast refresh exige snapshot via API (TreasuryForecastService) — noop sem inventar.
  queue.registerHandler(JOB_FORECAST_REFRESH, noOp);

  queue.registerHandler(JOB_USAGE_AGGREGATION, noOp);
  queue.registerHandler(JOB_AI_CREDIT_EXPIRATION, createAiCreditExpirationHandler(db));
  // Faturamento de API exige invoiceId/periodKey/unit via API — não inventa invoice.
  queue.registerHandler(JOB_API_USAGE_BILLING, noOp);
  queue.registerHandler(JOB_LICENSE_EXPIRATION, createLicenseExpirationHandler(db));
  // Entitlements são derivados (sem cache persistente) — noop idempotente.
  queue.registerHandler(JOB_PLAN_ENTITLEMENT_REFRESH, noOp);
}
