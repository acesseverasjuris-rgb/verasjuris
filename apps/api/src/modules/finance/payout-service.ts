import type { PayoutProvider } from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import { policyPayout, type SessionAccount } from "@verasjuris/auth";
import {
  isUniqueViolation,
  payables,
  payouts,
  payoutSchedules,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, count, desc, eq, inArray, type SQL } from "drizzle-orm";
import { authorize, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import { LedgerPostingService } from "./ledger-posting-service.js";

function parseDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}

function serializeSchedule(row: typeof payoutSchedules.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    beneficiaryType: row.beneficiaryType,
    beneficiaryId: row.beneficiaryId,
    frequency: row.frequency,
    dayOfWeek: row.dayOfWeek,
    dayOfMonth: row.dayOfMonth,
    minimumAmountCents: row.minimumAmountCents,
    delayDays: row.delayDays,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializePayout(row: typeof payouts.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    beneficiaryType: row.beneficiaryType,
    beneficiaryId: row.beneficiaryId,
    amountCents: row.amountCents,
    currency: row.currency,
    status: row.status,
    providerKey: row.providerKey,
    externalPayoutId: row.externalPayoutId,
    allocationId: row.allocationId,
    payableId: row.payableId,
    scheduledAt: iso(row.scheduledAt),
    initiatedAt: iso(row.initiatedAt),
    paidAt: iso(row.paidAt),
    failedAt: iso(row.failedAt),
    failureCode: row.failureCode,
    holdReason: row.holdReason,
    idempotencyKey: row.idempotencyKey,
    ledgerTransactionId: row.ledgerTransactionId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Repasses: payable BEFORE payout. PayoutProvider NOT_CONFIGURED → never mark PAID.
 */
export class PayoutService {
  private readonly ledger: LedgerPostingService;

  constructor(
    private readonly db: AppDatabase,
    private readonly payoutProvider: PayoutProvider,
  ) {
    this.ledger = new LedgerPostingService(db);
  }

  async providerStatus() {
    return this.payoutProvider.healthCheck();
  }

  async listSchedules(
    account: SessionAccount,
    organizationId: string,
    query: { limit: number; offset: number },
  ) {
    authorize(account, organizationId, (m) => policyPayout(m, "finance.payout.read"));
    const where = eq(payoutSchedules.organizationId, organizationId);
    const [items, totalRow] = await Promise.all([
      this.db.query.payoutSchedules.findMany({
        where,
        orderBy: [desc(payoutSchedules.createdAt)],
        limit: query.limit,
        offset: query.offset,
      }),
      this.db.select({ value: count() }).from(payoutSchedules).where(where),
    ]);
    return {
      items: items.map(serializeSchedule),
      total: Number(totalRow[0]?.value ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async createSchedule(
    account: SessionAccount,
    organizationId: string,
    input: {
      beneficiaryType: string;
      beneficiaryId: string;
      frequency: (typeof payoutSchedules.$inferInsert)["frequency"];
      dayOfWeek?: number | null;
      dayOfMonth?: number | null;
      minimumAmountCents?: number | null;
      delayDays?: number;
      active?: boolean;
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyPayout(m, "finance.payout.schedule"));

    try {
      const [row] = await this.db
        .insert(payoutSchedules)
        .values({
          organizationId,
          beneficiaryType: input.beneficiaryType,
          beneficiaryId: input.beneficiaryId,
          frequency: input.frequency,
          dayOfWeek: input.dayOfWeek ?? null,
          dayOfMonth: input.dayOfMonth ?? null,
          minimumAmountCents: input.minimumAmountCents ?? null,
          delayDays: input.delayDays ?? 0,
          active: input.active ?? true,
        })
        .returning();

      await recordAudit(this.db, {
        actorUserId: account.user.id,
        organizationId,
        action: "finance.payout_schedule_created",
        resourceType: "payout_schedule",
        resourceId: row!.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: { frequency: row!.frequency },
      });

      return { schedule: serializeSchedule(row!) };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError("CONFLICT", "Já existe agenda de payout para este beneficiário.");
      }
      throw error;
    }
  }

  async listPayouts(
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
    authorize(account, organizationId, (m) => policyPayout(m, "finance.payout.read"));
    const filters: SQL[] = [eq(payouts.organizationId, organizationId)];
    if (query.status) {
      filters.push(eq(payouts.status, query.status as (typeof payouts.$inferSelect)["status"]));
    }
    if (query.beneficiaryType) filters.push(eq(payouts.beneficiaryType, query.beneficiaryType));
    if (query.beneficiaryId) filters.push(eq(payouts.beneficiaryId, query.beneficiaryId));
    const where = and(...filters);
    const [items, totalRow] = await Promise.all([
      this.db.query.payouts.findMany({
        where,
        orderBy: [desc(payouts.createdAt)],
        limit: query.limit,
        offset: query.offset,
      }),
      this.db.select({ value: count() }).from(payouts).where(where),
    ]);
    return {
      items: items.map(serializePayout),
      total: Number(totalRow[0]?.value ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  /**
   * Cria payout a partir de payables disponíveis. Payable deve existir (payable BEFORE payout).
   */
  async createFromPayables(
    account: SessionAccount,
    organizationId: string,
    input: {
      payableIds: string[];
      scheduledAt?: string;
      providerKey?: string;
      idempotencyKey: string;
      holdReason?: string;
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyPayout(m, "finance.payout.schedule"));

    const existing = await this.db.query.payouts.findFirst({
      where: and(
        eq(payouts.organizationId, organizationId),
        eq(payouts.idempotencyKey, input.idempotencyKey),
      ),
    });
    if (existing) {
      return { payout: serializePayout(existing), alreadyExists: true };
    }

    const selected = await this.db.query.payables.findMany({
      where: and(
        eq(payables.organizationId, organizationId),
        inArray(payables.id, input.payableIds),
      ),
    });
    if (selected.length !== input.payableIds.length) {
      throw new AppError("NOT_FOUND", "Um ou mais payables não foram encontrados.");
    }
    if (selected.length === 0) {
      throw new AppError("VALIDATION_ERROR", "Informe ao menos um payable.");
    }

    const beneficiaryType = selected[0]!.beneficiaryType;
    const beneficiaryId = selected[0]!.beneficiaryId;
    const currency = selected[0]!.currency;
    let amountCents = 0;

    for (const payable of selected) {
      if (payable.beneficiaryType !== beneficiaryType || payable.beneficiaryId !== beneficiaryId) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Todos os payables de um payout devem ter o mesmo beneficiário.",
        );
      }
      if (payable.currency !== currency) {
        throw new AppError("VALIDATION_ERROR", "Moeda dos payables deve coincidir.");
      }
      if (payable.status !== "available" && payable.status !== "pending") {
        throw new AppError(
          "CONFLICT",
          `Payable ${payable.id} não está disponível (status ${payable.status}).`,
        );
      }
      if (payable.amountCents <= 0) {
        throw new AppError("VALIDATION_ERROR", "Payable com valor inválido.");
      }
      amountCents += payable.amountCents;
    }

    const held = Boolean(input.holdReason);
    const health = await this.payoutProvider.healthCheck();
    const providerConfigured =
      health.status !== "not_configured" && this.payoutProvider.id !== "not_configured";
    const providerKey = providerConfigured
      ? (input.providerKey ?? this.payoutProvider.id)
      : "not_configured";

    // Primary payable link (first); remaining marked scheduled against same payout via status.
    const primaryPayable = selected[0]!;

    try {
      const result = await this.db.transaction(async (tx) => {
        const [payout] = await tx
          .insert(payouts)
          .values({
            organizationId,
            beneficiaryType,
            beneficiaryId,
            amountCents,
            currency,
            status: held ? "held" : providerConfigured ? "pending" : "not_configured",
            providerKey,
            payableId: primaryPayable.id,
            allocationId: primaryPayable.sourceAllocationId,
            scheduledAt: parseDate(input.scheduledAt) ?? null,
            holdReason: input.holdReason ?? null,
            idempotencyKey: input.idempotencyKey,
          })
          .returning();

        await tx
          .update(payables)
          .set({
            status: held ? "held" : "scheduled",
            holdReason: input.holdReason ?? null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(payables.organizationId, organizationId),
              inArray(payables.id, input.payableIds),
            ),
          );

        return payout!;
      });

      await recordAudit(this.db, {
        actorUserId: account.user.id,
        organizationId,
        action: "finance.payout_created",
        resourceType: "payout",
        resourceId: result.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: {
          amountCents,
          payableIds: input.payableIds,
          status: result.status,
        },
      });

      return {
        payout: serializePayout(result),
        alreadyExists: false,
        payableIds: input.payableIds,
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await this.db.query.payouts.findFirst({
          where: and(
            eq(payouts.organizationId, organizationId),
            eq(payouts.idempotencyKey, input.idempotencyKey),
          ),
        });
        if (raced) return { payout: serializePayout(raced), alreadyExists: true };
      }
      throw error;
    }
  }

  async holdPayout(
    account: SessionAccount,
    organizationId: string,
    payoutId: string,
    input: { holdReason: string },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyPayout(m, "finance.payout.hold"));
    const payout = await this.requirePayout(organizationId, payoutId);
    if (payout.status === "paid" || payout.status === "cancelled") {
      throw new AppError("CONFLICT", "Este payout não pode ser retido neste status.");
    }
    const [updated] = await this.db
      .update(payouts)
      .set({ status: "held", holdReason: input.holdReason, updatedAt: new Date() })
      .where(eq(payouts.id, payout.id))
      .returning();

    if (payout.payableId) {
      await this.db
        .update(payables)
        .set({ status: "held", holdReason: input.holdReason, updatedAt: new Date() })
        .where(eq(payables.id, payout.payableId));
    }

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "finance.payout_held",
      resourceType: "payout",
      resourceId: payout.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { holdReason: input.holdReason },
    });

    return { payout: serializePayout(updated!) };
  }

  async releasePayout(
    account: SessionAccount,
    organizationId: string,
    payoutId: string,
    input: { note?: string },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyPayout(m, "finance.payout.release"));
    const payout = await this.requirePayout(organizationId, payoutId);
    if (payout.status !== "held") {
      throw new AppError("CONFLICT", "Somente payouts retidos podem ser liberados.");
    }

    const health = await this.payoutProvider.healthCheck();
    const providerConfigured =
      health.status !== "not_configured" && this.payoutProvider.id !== "not_configured";
    const nextStatus = providerConfigured ? "pending" : "not_configured";

    const [updated] = await this.db
      .update(payouts)
      .set({ status: nextStatus, holdReason: null, updatedAt: new Date() })
      .where(eq(payouts.id, payout.id))
      .returning();

    if (payout.payableId) {
      await this.db
        .update(payables)
        .set({ status: "scheduled", holdReason: null, updatedAt: new Date() })
        .where(eq(payables.id, payout.payableId));
    }

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "finance.payout_released",
      resourceType: "payout",
      resourceId: payout.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { note: input.note ?? null, status: nextStatus },
    });

    return { payout: serializePayout(updated!) };
  }

  /**
   * Processa payout no PayoutProvider. Se NOT_CONFIGURED → status not_configured, never PAID.
   */
  async processPayout(
    account: SessionAccount,
    organizationId: string,
    payoutId: string,
    input: { note?: string },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyPayout(m, "finance.payout.schedule"));
    const payout = await this.requirePayout(organizationId, payoutId);
    if (payout.status === "paid") {
      return { payout: serializePayout(payout), alreadyPaid: true };
    }
    if (payout.status === "held") {
      throw new AppError("CONFLICT", "Libere o hold antes de processar o payout.");
    }
    if (!payout.payableId) {
      throw new AppError("CONFLICT", "Payout sem payable vinculado — payable BEFORE payout.");
    }

    const health = await this.payoutProvider.healthCheck();
    const providerConfigured =
      health.status !== "not_configured" && this.payoutProvider.id !== "not_configured";

    if (!providerConfigured) {
      const [updated] = await this.db
        .update(payouts)
        .set({
          status: "not_configured",
          providerKey: "not_configured",
          initiatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(payouts.id, payout.id))
        .returning();

      await recordAudit(this.db, {
        actorUserId: account.user.id,
        organizationId,
        action: "finance.payout_not_configured",
        resourceType: "payout",
        resourceId: payout.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: { note: input.note ?? null },
      });

      return { payout: serializePayout(updated!), alreadyPaid: false };
    }

    await this.db
      .update(payouts)
      .set({ status: "processing", initiatedAt: new Date(), updatedAt: new Date() })
      .where(eq(payouts.id, payout.id));

    const providerResult = await this.payoutProvider.createPayout({
      amountCents: payout.amountCents,
      currency: payout.currency,
      payableId: payout.payableId,
      idempotencyKey: payout.idempotencyKey ?? payout.id,
      description: input.note,
      metadata: { payoutId: payout.id, organizationId },
    });

    if (providerResult.status === "not_configured") {
      // Hard rule: never mark PAID as fake.
      const [updated] = await this.db
        .update(payouts)
        .set({
          status: "not_configured",
          providerKey: "not_configured",
          externalPayoutId: providerResult.externalPayoutId,
          updatedAt: new Date(),
        })
        .where(eq(payouts.id, payout.id))
        .returning();
      return { payout: serializePayout(updated!), alreadyPaid: false };
    }

    if (providerResult.status === "paid") {
      return this.confirmPaid(
        account,
        organizationId,
        payout.id,
        {
          externalPayoutId: providerResult.externalPayoutId ?? undefined,
          paidAt: providerResult.paidAt ?? undefined,
          note: input.note,
        },
        meta,
      );
    }

    if (providerResult.status === "failed") {
      const [updated] = await this.db
        .update(payouts)
        .set({
          status: "failed",
          failedAt: new Date(),
          failureCode: providerResult.detail ?? "provider_failed",
          externalPayoutId: providerResult.externalPayoutId,
          providerKey: providerResult.providerKey,
          updatedAt: new Date(),
        })
        .where(eq(payouts.id, payout.id))
        .returning();
      return { payout: serializePayout(updated!), alreadyPaid: false };
    }

    const [updated] = await this.db
      .update(payouts)
      .set({
        status:
          providerResult.status === "scheduled"
            ? "scheduled"
            : providerResult.status === "processing"
              ? "processing"
              : "pending",
        externalPayoutId: providerResult.externalPayoutId,
        providerKey: providerResult.providerKey,
        updatedAt: new Date(),
      })
      .where(eq(payouts.id, payout.id))
      .returning();

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "finance.payout_processing",
      resourceType: "payout",
      resourceId: payout.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { status: updated!.status, externalPayoutId: updated!.externalPayoutId },
    });

    return { payout: serializePayout(updated!), alreadyPaid: false };
  }

  /**
   * Confirma liquidação (provider ou fixture). Posta ledger exactly-once.
   */
  async confirmPaid(
    account: SessionAccount | null,
    organizationId: string,
    payoutId: string,
    input: { externalPayoutId?: string; paidAt?: string; note?: string },
    meta?: RequestMeta,
  ) {
    if (account) {
      authorize(account, organizationId, (m) => policyPayout(m, "finance.payout.schedule"));
    }

    const payout = await this.requirePayout(organizationId, payoutId);
    if (payout.status === "paid" && payout.ledgerTransactionId) {
      return { payout: serializePayout(payout), alreadyPaid: true };
    }
    if (!payout.payableId) {
      throw new AppError("CONFLICT", "Payout sem payable — payable BEFORE payout.");
    }

    await this.ledger.ensureSystemAccounts(organizationId, payout.currency);
    const payableAccount = await this.ledger.getSystemAccount(
      organizationId,
      "PROFESSIONAL_PAYABLE",
      payout.currency,
    );
    const cash = await this.ledger.getSystemAccount(
      organizationId,
      "CASH_CLEARING",
      payout.currency,
    );

    const posted = await this.ledger.post({
      organizationId,
      transactionType: "payout",
      referenceType: "payout",
      referenceId: payout.id,
      currency: payout.currency,
      idempotencyKey: `payout_paid:${payout.id}`,
      description: input.note ?? `Payout ${payout.id}`,
      entries: [
        { accountId: payableAccount.id, direction: "debit", amountCents: payout.amountCents },
        { accountId: cash.id, direction: "credit", amountCents: payout.amountCents },
      ],
    });

    const [updated] = await this.db
      .update(payouts)
      .set({
        status: "paid",
        paidAt: parseDate(input.paidAt) ?? new Date(),
        externalPayoutId: input.externalPayoutId ?? payout.externalPayoutId,
        ledgerTransactionId: posted.id,
        failureCode: null,
        failedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(payouts.id, payout.id))
      .returning();

    await this.db
      .update(payables)
      .set({ status: "paid", updatedAt: new Date() })
      .where(eq(payables.id, payout.payableId));

    if (account && meta) {
      await recordAudit(this.db, {
        actorUserId: account.user.id,
        organizationId,
        action: "finance.payout_paid",
        resourceType: "payout",
        resourceId: payout.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: { ledgerTransactionId: posted.id },
      });
    }

    return { payout: serializePayout(updated!), alreadyPaid: false };
  }

  private async requirePayout(organizationId: string, payoutId: string) {
    const payout = await this.db.query.payouts.findFirst({
      where: and(eq(payouts.id, payoutId), eq(payouts.organizationId, organizationId)),
    });
    if (!payout) throw new AppError("NOT_FOUND", "Não encontramos este payout.");
    return payout;
  }
}
