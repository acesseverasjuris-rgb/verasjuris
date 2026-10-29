import type {
  PaymentProvider,
  PaymentWebhookEvent,
  PaymentWebhookVerificationResult,
} from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import {
  policyPayment,
  policyPaymentIntent,
  policyRefund,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  billingCredits,
  isUniqueViolation,
  payables,
  paymentAllocations,
  paymentIntents,
  payments,
  paymentWebhookEvents,
  payouts,
  receivables,
  refundHistory,
  refunds,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { createHash } from "node:crypto";
import { and, count, desc, eq, inArray, type SQL } from "drizzle-orm";
import { authorize, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import { requireDocumentInOrg } from "../documents/service.js";
import { BillingService } from "./billing-service.js";
import { LedgerPostingService } from "./ledger-posting-service.js";

type RefundType = "full" | "partial" | "credit";
type AllocationReversalPolicy = "proportional";

const DEFAULT_REVERSAL_POLICY: AllocationReversalPolicy = "proportional";

const PROVIDER_ALLOWLIST = new Set([
  "not_configured",
  "stripe",
  "mercadopago",
  "pagarme",
  "asaas",
  "adyen",
  "manual",
]);

function parseDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}

function hashPayload(raw: string | Uint8Array): string {
  const buf = typeof raw === "string" ? Buffer.from(raw) : Buffer.from(raw);
  return createHash("sha256").update(buf).digest("hex");
}

function serializePayment(row: typeof payments.$inferSelect) {
  return {
    id: row.id,
    paymentIntentId: row.paymentIntentId,
    organizationId: row.organizationId,
    amountCents: row.amountCents,
    currency: row.currency,
    status: row.status,
    providerKey: row.providerKey,
    externalPaymentId: row.externalPaymentId,
    confirmedAt: iso(row.confirmedAt),
    failedAt: iso(row.failedAt),
    failureCode: row.failureCode,
    evidenceDocumentId: row.evidenceDocumentId,
    recordedByMembershipId: row.recordedByMembershipId,
    ledgerTransactionId: row.ledgerTransactionId,
    isManual: row.isManual,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeIntent(row: typeof paymentIntents.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    payerType: row.payerType,
    payerId: row.payerId,
    invoiceId: row.invoiceId,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    amountCents: row.amountCents,
    currency: row.currency,
    paymentMethod: row.paymentMethod,
    status: row.status,
    providerKey: row.providerKey,
    externalIntentId: row.externalIntentId,
    idempotencyKey: row.idempotencyKey,
    expiresAt: iso(row.expiresAt),
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeRefund(row: typeof refunds.$inferSelect) {
  return {
    id: row.id,
    paymentId: row.paymentId,
    organizationId: row.organizationId,
    invoiceId: row.invoiceId,
    amountCents: row.amountCents,
    currency: row.currency,
    refundType: row.refundType,
    reasonCode: row.reasonCode,
    status: row.status,
    providerKey: row.providerKey,
    externalRefundId: row.externalRefundId,
    reason: row.reason,
    requestedByUserId: row.requestedByUserId,
    requestedAt: iso(row.requestedAt),
    confirmedAt: iso(row.confirmedAt),
    failedAt: iso(row.failedAt),
    creditId: row.creditId,
    ledgerTransactionId: row.ledgerTransactionId,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function isVerifyResult(
  value: boolean | PaymentWebhookVerificationResult,
): value is PaymentWebhookVerificationResult {
  return typeof value === "object" && value !== null && "valid" in value;
}

export class PaymentService {
  private readonly ledger: LedgerPostingService;
  private readonly billing: BillingService;

  constructor(
    private readonly db: AppDatabase,
    private readonly paymentProvider: PaymentProvider,
  ) {
    this.ledger = new LedgerPostingService(db);
    this.billing = new BillingService(db, paymentProvider);
  }

  async providerStatus() {
    return this.paymentProvider.healthCheck();
  }

  async createIntent(
    account: SessionAccount,
    organizationId: string,
    input: {
      payerType: string;
      payerId: string;
      invoiceId?: string;
      referenceType: string;
      referenceId: string;
      amountCents: number;
      currency: string;
      paymentMethod: (typeof paymentIntents.$inferInsert)["paymentMethod"];
      providerKey?: string;
      idempotencyKey: string;
      expiresAt?: string;
      metadata?: Record<string, unknown>;
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) =>
      policyPaymentIntent(m, "finance.payment.record_manual"),
    );

    const existing = await this.db.query.paymentIntents.findFirst({
      where: and(
        eq(paymentIntents.organizationId, organizationId),
        eq(paymentIntents.idempotencyKey, input.idempotencyKey),
      ),
    });
    if (existing) return { paymentIntent: serializeIntent(existing), alreadyExists: true };

    const health = await this.paymentProvider.healthCheck();
    const configured =
      health.status !== "not_configured" && this.paymentProvider.id !== "not_configured";

    let providerResult = await this.paymentProvider.createPaymentIntent({
      amountCents: input.amountCents,
      currency: input.currency,
      paymentMethod: input.paymentMethod === "manual" ? "other" : (input.paymentMethod as "pix"),
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      invoiceId: input.invoiceId,
      idempotencyKey: input.idempotencyKey,
      expiresAt: input.expiresAt,
      metadata: stringMeta(input.metadata),
    });

    if (!configured || providerResult.status === "not_configured") {
      providerResult = {
        ...providerResult,
        status: "not_configured",
        providerKey: "not_configured",
        externalIntentId: null,
      };
    }

    try {
      const [intent] = await this.db
        .insert(paymentIntents)
        .values({
          organizationId,
          payerType: input.payerType,
          payerId: input.payerId,
          invoiceId: input.invoiceId ?? null,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          amountCents: input.amountCents,
          currency: input.currency,
          paymentMethod: input.paymentMethod,
          status: providerResult.status,
          providerKey: configured
            ? providerResult.providerKey || input.providerKey || this.paymentProvider.id
            : "not_configured",
          externalIntentId: providerResult.externalIntentId,
          idempotencyKey: input.idempotencyKey,
          expiresAt: parseDate(input.expiresAt) ?? null,
          metadata: input.metadata ?? null,
        })
        .returning();

      await recordAudit(this.db, {
        actorUserId: account.user.id,
        organizationId,
        action: "payment.intent_created",
        resourceType: "payment_intent",
        resourceId: intent!.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: { status: intent!.status, amountCents: intent!.amountCents },
      });

      return { paymentIntent: serializeIntent(intent!), alreadyExists: false };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await this.db.query.paymentIntents.findFirst({
          where: and(
            eq(paymentIntents.organizationId, organizationId),
            eq(paymentIntents.idempotencyKey, input.idempotencyKey),
          ),
        });
        if (raced) return { paymentIntent: serializeIntent(raced), alreadyExists: true };
      }
      throw error;
    }
  }

  async getIntent(account: SessionAccount, organizationId: string | null, intentId: string) {
    const intent = await this.db.query.paymentIntents.findFirst({
      where: eq(paymentIntents.id, intentId),
    });
    if (!intent) throw new AppError("NOT_FOUND", "Não encontramos este payment intent.");
    const orgId = intent.organizationId ?? organizationId;
    if (!orgId) throw new AppError("NOT_FOUND", "Não encontramos este payment intent.");
    if (organizationId && intent.organizationId && intent.organizationId !== organizationId) {
      throw new AppError("NOT_FOUND", "Não encontramos este payment intent.");
    }
    authorize(account, orgId, (m) => policyPaymentIntent(m, "finance.payment.read"));
    return { paymentIntent: serializeIntent(intent) };
  }

  async listIntents(
    account: SessionAccount,
    organizationId: string,
    query: {
      status?: string;
      invoiceId?: string;
      referenceType?: string;
      referenceId?: string;
      limit: number;
      offset: number;
    },
  ) {
    authorize(account, organizationId, (m) => policyPaymentIntent(m, "finance.payment.read"));
    const filters: SQL[] = [eq(paymentIntents.organizationId, organizationId)];
    if (query.status) {
      filters.push(
        eq(paymentIntents.status, query.status as typeof paymentIntents.$inferSelect.status),
      );
    }
    if (query.invoiceId) filters.push(eq(paymentIntents.invoiceId, query.invoiceId));
    if (query.referenceType) filters.push(eq(paymentIntents.referenceType, query.referenceType));
    if (query.referenceId) filters.push(eq(paymentIntents.referenceId, query.referenceId));
    const where = and(...filters);
    const [items, totalRow] = await Promise.all([
      this.db.query.paymentIntents.findMany({
        where,
        orderBy: [desc(paymentIntents.createdAt)],
        limit: query.limit,
        offset: query.offset,
      }),
      this.db.select({ value: count() }).from(paymentIntents).where(where),
    ]);
    return {
      items: items.map(serializeIntent),
      total: Number(totalRow[0]?.value ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async getPayment(account: SessionAccount, organizationId: string | null, paymentId: string) {
    const payment = await this.db.query.payments.findFirst({
      where: eq(payments.id, paymentId),
    });
    if (!payment) throw new AppError("NOT_FOUND", "Não encontramos este pagamento.");
    const orgId = payment.organizationId ?? organizationId;
    if (!orgId) throw new AppError("NOT_FOUND", "Não encontramos este pagamento.");
    if (organizationId && payment.organizationId && payment.organizationId !== organizationId) {
      throw new AppError("NOT_FOUND", "Não encontramos este pagamento.");
    }
    authorize(account, orgId, (m) => policyPayment(m, "finance.payment.read"));
    return { payment: serializePayment(payment) };
  }

  async listPayments(
    account: SessionAccount,
    organizationId: string,
    query: {
      status?: string;
      paymentIntentId?: string;
      isManual?: boolean;
      limit: number;
      offset: number;
    },
  ) {
    authorize(account, organizationId, (m) => policyPayment(m, "finance.payment.read"));
    const filters: SQL[] = [eq(payments.organizationId, organizationId)];
    if (query.status) {
      filters.push(eq(payments.status, query.status as typeof payments.$inferSelect.status));
    }
    if (query.paymentIntentId) filters.push(eq(payments.paymentIntentId, query.paymentIntentId));
    if (query.isManual !== undefined) filters.push(eq(payments.isManual, query.isManual));
    const where = and(...filters);
    const [items, totalRow] = await Promise.all([
      this.db.query.payments.findMany({
        where,
        orderBy: [desc(payments.createdAt)],
        limit: query.limit,
        offset: query.offset,
      }),
      this.db.select({ value: count() }).from(payments).where(where),
    ]);
    return {
      items: items.map(serializePayment),
      total: Number(totalRow[0]?.value ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  /**
   * Confirmação única: status confirmed + ledger post exactly-once.
   * Frontend redirect NUNCA chama isto sozinho — só webhook/provider/manual com evidência.
   */
  async confirmPayment(input: {
    paymentId?: string;
    paymentIntentId?: string;
    organizationId: string;
    amountCents: number;
    currency: string;
    providerKey: string;
    externalPaymentId?: string | null;
    isManual?: boolean;
    evidenceDocumentId?: string | null;
    recordedByMembershipId?: string | null;
    metadata?: Record<string, unknown>;
    actorUserId?: string | null;
    meta?: RequestMeta;
    creditReceivable?: boolean;
  }) {
    const result = await this.db.transaction(async (tx) => {
      let payment =
        input.paymentId != null
          ? await tx.query.payments.findFirst({ where: eq(payments.id, input.paymentId) })
          : null;

      if (!payment && input.paymentIntentId) {
        const existingForIntent = await tx.query.payments.findFirst({
          where: and(
            eq(payments.paymentIntentId, input.paymentIntentId),
            eq(payments.status, "confirmed"),
          ),
        });
        if (existingForIntent) payment = existingForIntent;
      }

      if (payment?.status === "confirmed" && payment.ledgerTransactionId) {
        return {
          payment,
          alreadyConfirmed: true as const,
          invoiceId: null as string | null,
        };
      }

      let newlyConfirmed = false;

      if (!payment) {
        if (!input.paymentIntentId) {
          throw new AppError(
            "VALIDATION_ERROR",
            "paymentIntentId é obrigatório para criar pagamento.",
          );
        }
        const [created] = await tx
          .insert(payments)
          .values({
            paymentIntentId: input.paymentIntentId,
            organizationId: input.organizationId,
            amountCents: input.amountCents,
            currency: input.currency,
            status: "confirmed",
            providerKey: input.providerKey,
            externalPaymentId: input.externalPaymentId ?? null,
            confirmedAt: new Date(),
            evidenceDocumentId: input.evidenceDocumentId ?? null,
            recordedByMembershipId: input.recordedByMembershipId ?? null,
            isManual: input.isManual ?? false,
            metadata: input.metadata ?? null,
          })
          .returning();
        payment = created!;
        newlyConfirmed = true;
      } else if (payment.status !== "confirmed") {
        const [updated] = await tx
          .update(payments)
          .set({
            status: "confirmed",
            confirmedAt: new Date(),
            failedAt: null,
            failureCode: null,
            externalPaymentId: input.externalPaymentId ?? payment.externalPaymentId,
            evidenceDocumentId: input.evidenceDocumentId ?? payment.evidenceDocumentId,
            updatedAt: new Date(),
          })
          .where(eq(payments.id, payment.id))
          .returning();
        payment = updated!;
        newlyConfirmed = true;
      }

      await tx
        .update(paymentIntents)
        .set({ status: "confirmed", updatedAt: new Date() })
        .where(eq(paymentIntents.id, payment.paymentIntentId));

      if (!payment.ledgerTransactionId) {
        await this.ledger.ensureSystemAccounts(input.organizationId, input.currency, tx);
        const cash = await this.ledger.getSystemAccount(
          input.organizationId,
          "CASH_CLEARING",
          input.currency,
          tx,
        );
        const creditKey = input.creditReceivable ? "PAYMENT_RECEIVABLE" : "PLATFORM_REVENUE";
        const creditAccount = await this.ledger.getSystemAccount(
          input.organizationId,
          creditKey,
          input.currency,
          tx,
        );

        const posted = await this.ledger.post(
          {
            organizationId: input.organizationId,
            transactionType: "payment_received",
            referenceType: "payment",
            referenceId: payment.id,
            currency: input.currency,
            idempotencyKey: `payment_confirm:${payment.id}`,
            description: `Pagamento confirmado ${payment.id}`,
            createdByMembershipId: input.recordedByMembershipId ?? null,
            entries: [
              {
                accountId: cash.id,
                direction: "debit",
                amountCents: payment.amountCents,
              },
              {
                accountId: creditAccount.id,
                direction: "credit",
                amountCents: payment.amountCents,
              },
            ],
          },
          tx,
        );

        try {
          const [linked] = await tx
            .update(payments)
            .set({ ledgerTransactionId: posted.id, updatedAt: new Date() })
            .where(eq(payments.id, payment.id))
            .returning();
          payment = linked!;
        } catch (error) {
          if (!isUniqueViolation(error)) throw error;
          const again = await tx.query.payments.findFirst({
            where: eq(payments.id, payment.id),
          });
          payment = again!;
        }
      }

      const intent = await tx.query.paymentIntents.findFirst({
        where: eq(paymentIntents.id, payment.paymentIntentId),
      });

      if (input.actorUserId && input.meta && newlyConfirmed) {
        await recordAudit(tx, {
          actorUserId: input.actorUserId,
          organizationId: input.organizationId,
          action: "payment.confirmed",
          resourceType: "payment",
          resourceId: payment.id,
          source: "api",
          requestId: input.meta.requestId,
          ip: input.meta.ip,
          after: {
            amountCents: payment.amountCents,
            ledgerTransactionId: payment.ledgerTransactionId,
            isManual: payment.isManual,
          },
        });
      }

      return {
        payment,
        alreadyConfirmed: !newlyConfirmed,
        invoiceId: newlyConfirmed ? (intent?.invoiceId ?? null) : null,
      };
    });

    if (result.invoiceId) {
      await this.billing.applyPaymentToInvoice(
        input.organizationId,
        result.invoiceId,
        result.payment.amountCents,
      );
    }

    return {
      payment: serializePayment(result.payment),
      alreadyConfirmed: result.alreadyConfirmed,
    };
  }

  async markPaymentFailed(input: {
    paymentIntentId: string;
    organizationId: string;
    amountCents: number;
    currency: string;
    providerKey: string;
    externalPaymentId?: string | null;
    failureCode?: string | null;
    actorUserId?: string | null;
    meta?: RequestMeta;
  }) {
    const [payment] = await this.db
      .insert(payments)
      .values({
        paymentIntentId: input.paymentIntentId,
        organizationId: input.organizationId,
        amountCents: input.amountCents,
        currency: input.currency,
        status: "failed",
        providerKey: input.providerKey,
        externalPaymentId: input.externalPaymentId ?? null,
        failedAt: new Date(),
        failureCode: input.failureCode ?? null,
        isManual: false,
      })
      .returning();

    await this.db
      .update(paymentIntents)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(paymentIntents.id, input.paymentIntentId));

    // FAILED → nenhum lançamento de caixa no ledger.
    if (input.actorUserId && input.meta) {
      await recordAudit(this.db, {
        actorUserId: input.actorUserId,
        organizationId: input.organizationId,
        action: "payment.failed",
        resourceType: "payment",
        resourceId: payment!.id,
        source: "api",
        requestId: input.meta.requestId,
        ip: input.meta.ip,
        after: { failureCode: input.failureCode ?? null },
      });
    }

    return { payment: serializePayment(payment!) };
  }

  async recordManualPayment(
    account: SessionAccount,
    organizationId: string,
    input: {
      paymentIntentId: string;
      amountCents: number;
      currency: string;
      evidenceDocumentId: string;
      externalPaymentId?: string;
      metadata?: Record<string, unknown>;
    },
    meta: RequestMeta,
  ) {
    const membership = authorize(account, organizationId, (m) =>
      policyPayment(m, "finance.payment.record_manual"),
    );

    if (!input.evidenceDocumentId) {
      throw new AppError("VALIDATION_ERROR", "Evidência documental é obrigatória.", [
        { path: "evidenceDocumentId", message: "Informe o documento de comprovante." },
      ]);
    }
    await requireDocumentInOrg(this.db, organizationId, input.evidenceDocumentId);

    const intent = await this.db.query.paymentIntents.findFirst({
      where: and(
        eq(paymentIntents.id, input.paymentIntentId),
        eq(paymentIntents.organizationId, organizationId),
      ),
    });
    if (!intent) throw new AppError("NOT_FOUND", "Não encontramos este payment intent.");

    const creditReceivable = Boolean(intent.invoiceId);
    return this.confirmPayment({
      paymentIntentId: intent.id,
      organizationId,
      amountCents: input.amountCents,
      currency: input.currency,
      providerKey: "manual",
      externalPaymentId: input.externalPaymentId ?? null,
      isManual: true,
      evidenceDocumentId: input.evidenceDocumentId,
      recordedByMembershipId: membership.membershipId,
      metadata: input.metadata,
      actorUserId: account.user.id,
      meta,
      creditReceivable,
    });
  }

  async refundableAmount(paymentId: string, organizationId: string) {
    const payment = await this.db.query.payments.findFirst({
      where: and(eq(payments.id, paymentId), eq(payments.organizationId, organizationId)),
    });
    if (!payment) throw new AppError("NOT_FOUND", "Não encontramos este pagamento.");
    const confirmed = await this.db.query.refunds.findMany({
      where: and(eq(refunds.paymentId, paymentId), eq(refunds.status, "confirmed")),
    });
    const refundedCents = confirmed.reduce((sum, row) => sum + row.amountCents, 0);
    return {
      paymentAmountCents: payment.amountCents,
      refundedCents,
      refundableCents: Math.max(0, payment.amountCents - refundedCents),
      currency: payment.currency,
    };
  }

  async listRefunds(
    account: SessionAccount,
    organizationId: string,
    query: {
      status?: string;
      refundType?: string;
      paymentId?: string;
      limit: number;
      offset: number;
    },
  ) {
    authorize(account, organizationId, (m) => policyRefund(m, "finance.refund.read"));
    const filters: SQL[] = [eq(refunds.organizationId, organizationId)];
    if (query.status) {
      filters.push(eq(refunds.status, query.status as (typeof refunds.$inferSelect)["status"]));
    }
    if (query.refundType) filters.push(eq(refunds.refundType, query.refundType));
    if (query.paymentId) filters.push(eq(refunds.paymentId, query.paymentId));
    const where = and(...filters);
    const [items, totalRow] = await Promise.all([
      this.db.query.refunds.findMany({
        where,
        orderBy: [desc(refunds.createdAt)],
        limit: query.limit,
        offset: query.offset,
      }),
      this.db.select({ value: count() }).from(refunds).where(where),
    ]);
    return {
      items: items.map(serializeRefund),
      total: Number(totalRow[0]?.value ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async requestRefund(
    account: SessionAccount,
    organizationId: string,
    paymentId: string,
    input: {
      amountCents?: number;
      currency?: string;
      reason?: string;
      reasonCode?: string;
      invoiceId?: string;
      providerKey?: string;
      refundType?: RefundType;
      idempotencyKey?: string;
      allocationReversalPolicy?: AllocationReversalPolicy;
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyRefund(m, "finance.refund.request"));
    const refundType: RefundType = input.refundType ?? "partial";

    if (input.idempotencyKey) {
      const existing = await this.db.query.refunds.findFirst({
        where: and(
          eq(refunds.organizationId, organizationId),
          eq(refunds.idempotencyKey, input.idempotencyKey),
        ),
      });
      if (existing) return { refund: serializeRefund(existing), alreadyExists: true };
    }

    const payment = await this.db.query.payments.findFirst({
      where: and(eq(payments.id, paymentId), eq(payments.organizationId, organizationId)),
    });
    if (!payment) throw new AppError("NOT_FOUND", "Não encontramos este pagamento.");
    if (payment.status !== "confirmed" && payment.status !== "partially_refunded") {
      throw new AppError("CONFLICT", "Somente pagamentos confirmados podem ser reembolsados.");
    }

    const available = await this.refundableAmount(paymentId, organizationId);
    const amountCents =
      refundType === "full" ? available.refundableCents : (input.amountCents ?? 0);
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new AppError("VALIDATION_ERROR", "Informe um valor positivo em centavos.", [
        { path: "amountCents", message: "Valor inválido." },
      ]);
    }
    if (amountCents > available.refundableCents) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Reembolso excede o refundable (${available.refundableCents} centavos).`,
        [{ path: "amountCents", message: "Over-refund bloqueado." }],
      );
    }

    const currency = input.currency ?? payment.currency;
    if (currency !== payment.currency) {
      throw new AppError("VALIDATION_ERROR", "Moeda do reembolso deve coincidir com o pagamento.");
    }

    const health = await this.paymentProvider.healthCheck();
    const configured =
      health.status !== "not_configured" && this.paymentProvider.id !== "not_configured";

    let externalRefundId: string | null = null;
    let status: (typeof refunds.$inferInsert)["status"] = "requested";
    let providerKey = input.providerKey ?? payment.providerKey;
    let creditId: string | null = null;

    // Credit refund: no cash returned — grant billing_credits instead of PSP refund.
    if (refundType === "credit") {
      status = "confirmed";
      providerKey = "internal_credit";
    } else if (!configured || !payment.externalPaymentId) {
      status = configured ? "requested" : "not_configured";
      providerKey = configured ? providerKey : "not_configured";
    } else {
      try {
        const result = await this.paymentProvider.refundPayment(
          payment.externalPaymentId,
          amountCents,
        );
        if (result.status === "not_configured") {
          status = "not_configured";
          providerKey = "not_configured";
        } else if (result.status === "refunded" || result.status === "partially_refunded") {
          status = "confirmed";
          externalRefundId = result.externalPaymentId;
        } else if (result.status === "failed") {
          status = "failed";
        } else {
          status = "processing";
          externalRefundId = result.externalPaymentId;
        }
      } catch (error) {
        if (error instanceof AppError && error.code === "PAYMENT_PROVIDER_NOT_CONFIGURED") {
          status = "not_configured";
          providerKey = "not_configured";
        } else {
          throw error;
        }
      }
    }

    const refund = await this.db.transaction(async (tx) => {
      if (refundType === "credit") {
        const [credit] = await tx
          .insert(billingCredits)
          .values({
            organizationId,
            amountCents,
            remainingCents: amountCents,
            currency,
            reason: input.reason ?? `Reembolso em crédito do pagamento ${paymentId}`,
            source: "refund_credit",
            status: "available",
          })
          .returning();
        creditId = credit!.id;
      }

      const [row] = await tx
        .insert(refunds)
        .values({
          paymentId,
          organizationId,
          invoiceId: input.invoiceId ?? null,
          amountCents,
          currency,
          refundType,
          reasonCode: input.reasonCode ?? null,
          status,
          providerKey,
          externalRefundId,
          reason: input.reason ?? null,
          requestedByUserId: account.user.id,
          confirmedAt: status === "confirmed" ? new Date() : null,
          creditId,
          idempotencyKey: input.idempotencyKey ?? null,
        })
        .returning();

      await tx.insert(refundHistory).values({
        refundId: row!.id,
        fromStatus: null,
        toStatus: status,
        note: input.reason ?? `Refund ${refundType} solicitado`,
        actorUserId: account.user.id,
      });

      return row!;
    });

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "payment.refund_requested",
      resourceType: "refund",
      resourceId: refund.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { amountCents, status, refundType, creditId },
    });

    if (status === "confirmed") {
      const posted = await this.confirmRefundLedger(refund.id, account.user.id, meta, {
        allocationReversalPolicy: input.allocationReversalPolicy ?? DEFAULT_REVERSAL_POLICY,
      });
      return { refund: posted.refund, alreadyExists: false };
    }

    return { refund: serializeRefund(refund), alreadyExists: false };
  }

  async approveRefund(
    account: SessionAccount,
    organizationId: string,
    refundId: string,
    input: { note?: string; externalRefundId?: string },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyRefund(m, "finance.refund.approve"));
    const refund = await this.db.query.refunds.findFirst({
      where: and(eq(refunds.id, refundId), eq(refunds.organizationId, organizationId)),
    });
    if (!refund) throw new AppError("NOT_FOUND", "Não encontramos este reembolso.");
    if (refund.status === "confirmed") {
      return this.confirmRefundLedger(refund.id, account.user.id, meta);
    }
    if (
      refund.status !== "requested" &&
      refund.status !== "processing" &&
      refund.status !== "not_configured"
    ) {
      throw new AppError("CONFLICT", "Este reembolso não pode ser aprovado neste status.");
    }

    const fromStatus = refund.status;
    await this.db
      .update(refunds)
      .set({
        status: "confirmed",
        confirmedAt: new Date(),
        externalRefundId: input.externalRefundId ?? refund.externalRefundId,
        updatedAt: new Date(),
      })
      .where(eq(refunds.id, refund.id));

    await this.db.insert(refundHistory).values({
      refundId: refund.id,
      fromStatus,
      toStatus: "confirmed",
      note: input.note ?? "Reembolso aprovado",
      actorUserId: account.user.id,
    });

    return this.confirmRefundLedger(refund.id, account.user.id, meta);
  }

  async cancelRefund(
    account: SessionAccount,
    organizationId: string,
    refundId: string,
    input: { reason: string },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyRefund(m, "finance.refund.cancel"));
    const refund = await this.db.query.refunds.findFirst({
      where: and(eq(refunds.id, refundId), eq(refunds.organizationId, organizationId)),
    });
    if (!refund) throw new AppError("NOT_FOUND", "Não encontramos este reembolso.");
    if (refund.status === "confirmed") {
      throw new AppError("CONFLICT", "Reembolso confirmado não pode ser cancelado.");
    }

    const fromStatus = refund.status;
    const [updated] = await this.db
      .update(refunds)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(refunds.id, refund.id))
      .returning();

    await this.db.insert(refundHistory).values({
      refundId: refund.id,
      fromStatus,
      toStatus: "cancelled",
      note: input.reason,
      actorUserId: account.user.id,
    });

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "payment.refund_cancelled",
      resourceType: "refund",
      resourceId: refund.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { reason: input.reason },
    });

    return { refund: serializeRefund(updated!) };
  }

  async confirmRefundLedger(
    refundId: string,
    actorUserId?: string,
    meta?: RequestMeta,
    options?: { allocationReversalPolicy?: AllocationReversalPolicy },
  ) {
    const refund = await this.db.query.refunds.findFirst({ where: eq(refunds.id, refundId) });
    if (!refund) throw new AppError("NOT_FOUND", "Não encontramos este reembolso.");
    if (refund.ledgerTransactionId) {
      return { refund: serializeRefund(refund), alreadyPosted: true };
    }
    if (!refund.organizationId) {
      throw new AppError("CONFLICT", "Reembolso sem organização não posta ledger.");
    }

    const organizationId = refund.organizationId;
    const isCredit = refund.refundType === "credit";

    await this.ledger.ensureSystemAccounts(organizationId, refund.currency);
    const revenue = await this.ledger.getSystemAccount(
      organizationId,
      "PLATFORM_REVENUE",
      refund.currency,
    );

    // Nova postagem — nunca edita o lançamento antigo do pagamento.
    const creditAccount = isCredit
      ? await this.ledger.getSystemAccount(
          organizationId,
          "CUSTOMER_CREDIT_LIABILITY",
          refund.currency,
        )
      : await this.ledger.getSystemAccount(organizationId, "REFUND_PAYABLE", refund.currency);

    const posted = await this.ledger.post({
      organizationId,
      transactionType: isCredit ? "credit_applied" : "refund",
      referenceType: "refund",
      referenceId: refund.id,
      currency: refund.currency,
      idempotencyKey: `refund_confirm:${refund.id}`,
      description: refund.reason ?? `Reembolso ${refund.id}`,
      entries: [
        { accountId: revenue.id, direction: "debit", amountCents: refund.amountCents },
        { accountId: creditAccount.id, direction: "credit", amountCents: refund.amountCents },
      ],
    });

    if (isCredit && refund.creditId) {
      await this.db
        .update(billingCredits)
        .set({ ledgerTransactionId: posted.id, updatedAt: new Date() })
        .where(eq(billingCredits.id, refund.creditId));
    }

    const [updated] = await this.db
      .update(refunds)
      .set({
        status: "confirmed",
        confirmedAt: refund.confirmedAt ?? new Date(),
        ledgerTransactionId: posted.id,
        updatedAt: new Date(),
      })
      .where(eq(refunds.id, refund.id))
      .returning();

    const payment = await this.db.query.payments.findFirst({
      where: eq(payments.id, refund.paymentId),
    });
    if (payment) {
      const allRefunds = await this.db.query.refunds.findMany({
        where: and(eq(refunds.paymentId, payment.id), eq(refunds.status, "confirmed")),
      });
      const refundedCents = allRefunds.reduce((sum, row) => sum + row.amountCents, 0);
      const nextStatus = refundedCents >= payment.amountCents ? "refunded" : "partially_refunded";
      await this.db
        .update(payments)
        .set({ status: nextStatus, updatedAt: new Date() })
        .where(eq(payments.id, payment.id));

      await this.applyAllocationReversal(
        organizationId,
        payment,
        updated!,
        options?.allocationReversalPolicy ?? DEFAULT_REVERSAL_POLICY,
      );
    }

    if (actorUserId && meta) {
      await this.db.insert(refundHistory).values({
        refundId: refund.id,
        fromStatus: refund.status,
        toStatus: "confirmed",
        note: "Ledger postado",
        actorUserId,
      });
      await recordAudit(this.db, {
        actorUserId,
        organizationId,
        action: "payment.refund_confirmed",
        resourceType: "refund",
        resourceId: refund.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: { ledgerTransactionId: posted.id, refundType: refund.refundType },
      });
    }

    return { refund: serializeRefund(updated!), alreadyPosted: false };
  }

  /**
   * Versioned proportional reversal: never edits original allocation rows.
   * Creates negative adjustment payables / receivable when already paid out.
   */
  private async applyAllocationReversal(
    organizationId: string,
    payment: typeof payments.$inferSelect,
    refund: typeof refunds.$inferSelect,
    policy: AllocationReversalPolicy,
  ) {
    if (policy !== "proportional") {
      throw new AppError("VALIDATION_ERROR", `Política de reversão não suportada: ${policy}.`);
    }

    const allocations = await this.db.query.paymentAllocations.findMany({
      where: and(
        eq(paymentAllocations.paymentId, payment.id),
        eq(paymentAllocations.organizationId, organizationId),
      ),
    });
    if (allocations.length === 0) return;

    const paymentGross = payment.amountCents;
    if (paymentGross <= 0) return;

    for (const allocation of allocations) {
      const gross = allocation.grossAmountCents ?? allocation.grossCents;
      const share = Math.floor((gross * refund.amountCents) / paymentGross);
      if (share <= 0) continue;

      const relatedPayables = await this.db.query.payables.findMany({
        where: and(
          eq(payables.organizationId, organizationId),
          eq(payables.sourceAllocationId, allocation.id),
        ),
      });

      const unpaid = relatedPayables.filter(
        (p) =>
          p.status === "available" ||
          p.status === "pending" ||
          p.status === "held" ||
          p.status === "scheduled",
      );
      const paidOut = relatedPayables.filter((p) => p.status === "paid");

      // Reverse unpaid payable capacity via negative adjustment payable (append-only).
      const unpaidCents = unpaid.reduce((sum, p) => sum + p.amountCents, 0);
      const reverseFromUnpaid = Math.min(share, unpaidCents);
      const remainderAfterUnpaid = share - reverseFromUnpaid;

      if (reverseFromUnpaid > 0) {
        await this.db.insert(payables).values({
          organizationId,
          beneficiaryType: allocation.beneficiaryType,
          beneficiaryId: allocation.beneficiaryId,
          sourceAllocationId: allocation.id,
          amountCents: -reverseFromUnpaid,
          currency: refund.currency,
          status: "reversed",
          holdReason: `refund_adjustment:${refund.id}`,
        });

        // Reduce open payables proportionally without editing history of paid amounts —
        // mark matching open ones reversed when fully covered.
        let left = reverseFromUnpaid;
        for (const payable of unpaid) {
          if (left <= 0) break;
          if (payable.amountCents <= left) {
            left -= payable.amountCents;
            await this.db
              .update(payables)
              .set({ status: "reversed", updatedAt: new Date() })
              .where(eq(payables.id, payable.id));
          } else {
            // Partial: append offsetting payable; keep original row intact.
            await this.db.insert(payables).values({
              organizationId,
              beneficiaryType: payable.beneficiaryType,
              beneficiaryId: payable.beneficiaryId,
              sourceAllocationId: allocation.id,
              amountCents: -left,
              currency: refund.currency,
              status: "reversed",
              holdReason: `refund_partial_offset:${refund.id}:${payable.id}`,
            });
            left = 0;
          }
        }
      }

      // Refund after payout: create receivable (clawback) for already paid portion.
      const paidShare = Math.min(
        remainderAfterUnpaid,
        paidOut.reduce((sum, p) => sum + p.amountCents, 0),
      );
      if (paidShare > 0) {
        await this.db.insert(payables).values({
          organizationId,
          beneficiaryType: allocation.beneficiaryType,
          beneficiaryId: allocation.beneficiaryId,
          sourceAllocationId: allocation.id,
          amountCents: -paidShare,
          currency: refund.currency,
          status: "reversed",
          holdReason: `refund_after_payout:${refund.id}`,
        });

        try {
          await this.db.insert(receivables).values({
            organizationId,
            sourceType: "refund_clawback",
            sourceId: refund.id,
            debtorType: allocation.beneficiaryType,
            debtorId: allocation.beneficiaryId,
            amountCents: paidShare,
            amountPaidCents: 0,
            currency: refund.currency,
            status: "open",
          });
        } catch (error) {
          if (!isUniqueViolation(error)) throw error;
        }
      }

      // Snapshot adjustment allocation row (negative) — never mutate original.
      await this.db.insert(paymentAllocations).values({
        organizationId,
        paymentId: payment.id,
        beneficiaryType: allocation.beneficiaryType,
        beneficiaryId: allocation.beneficiaryId,
        allocationType: "adjustment",
        grossAmountCents: -share,
        grossCents: -share,
        feeAmountCents: 0,
        feeCents: 0,
        retentionAmountCents: 0,
        netAmountCents: -share,
        netCents: -share,
        currency: refund.currency,
        status: "cancelled",
        ruleVersionId: allocation.ruleVersionId,
        ruleSnapshotJson: {
          ...(allocation.ruleSnapshotJson ?? {}),
          reversalOfAllocationId: allocation.id,
          refundId: refund.id,
          policy: "proportional",
          policyVersion: 1,
        },
      });
    }

    // Hold in-flight payouts linked to these allocations.
    const allocationIds = allocations.map((a) => a.id);
    if (allocationIds.length > 0) {
      await this.db
        .update(payouts)
        .set({
          status: "held",
          holdReason: `refund:${refund.id}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(payouts.organizationId, organizationId),
            inArray(payouts.allocationId, allocationIds),
            inArray(payouts.status, ["pending", "scheduled", "processing", "not_configured"]),
          ),
        );
    }
  }

  async handleWebhook(input: {
    provider: string;
    rawBody: string | Uint8Array;
    headers: Record<string, string>;
  }) {
    const providerKey = input.provider.trim().toLowerCase();
    if (!PROVIDER_ALLOWLIST.has(providerKey)) {
      throw new AppError("AUTHORIZATION_ERROR", "Provedor de webhook não autorizado.");
    }

    if (
      this.paymentProvider.id === "not_configured" ||
      (providerKey !== "not_configured" &&
        this.paymentProvider.id !== providerKey &&
        this.paymentProvider.id !== "not_configured")
    ) {
      // Allow exact match; if injected provider id differs but allowlisted, still verify via adapter.
      if (this.paymentProvider.id !== "not_configured" && this.paymentProvider.id !== providerKey) {
        throw new AppError(
          "AUTHORIZATION_ERROR",
          "Provedor de webhook não corresponde ao configurado.",
        );
      }
    }

    const verify = await this.paymentProvider.verifyWebhook({
      rawBody: input.rawBody,
      headers: input.headers,
      toleranceSeconds: 300,
    });
    const valid = isVerifyResult(verify) ? verify.valid : verify;
    if (!valid) {
      throw new AppError("AUTHORIZATION_ERROR", "Assinatura de webhook inválida.");
    }
    if (isVerifyResult(verify) && verify.timestampOutOfTolerance) {
      throw new AppError("AUTHORIZATION_ERROR", "Timestamp de webhook fora da tolerância.");
    }

    let parsed: PaymentWebhookEvent;
    try {
      parsed = await this.paymentProvider.parseWebhook({
        rawBody: input.rawBody,
        headers: input.headers,
      });
    } catch (error) {
      if (error instanceof AppError && error.code === "PAYMENT_PROVIDER_NOT_CONFIGURED") {
        throw error;
      }
      throw error;
    }

    const payloadHash = hashPayload(input.rawBody);
    const externalEventId =
      parsed.externalPaymentId ||
      parsed.externalIntentId ||
      parsed.externalSessionId ||
      payloadHash;

    const duplicate = await this.db.query.paymentWebhookEvents.findFirst({
      where: and(
        eq(paymentWebhookEvents.providerKey, providerKey),
        eq(paymentWebhookEvents.externalEventId, externalEventId),
      ),
    });
    if (duplicate) {
      return {
        status: "already_processed" as const,
        eventId: duplicate.id,
        payment: null as ReturnType<typeof serializePayment> | null,
      };
    }

    let eventRow: typeof paymentWebhookEvents.$inferSelect;
    try {
      const [created] = await this.db
        .insert(paymentWebhookEvents)
        .values({
          providerKey,
          externalEventId,
          eventType: parsed.type,
          payloadHash,
          signatureValid: true,
          status: "processing",
          rawPayloadRef: null,
        })
        .returning();
      eventRow = created!;
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await this.db.query.paymentWebhookEvents.findFirst({
          where: and(
            eq(paymentWebhookEvents.providerKey, providerKey),
            eq(paymentWebhookEvents.externalEventId, externalEventId),
          ),
        });
        return {
          status: "already_processed" as const,
          eventId: raced?.id ?? null,
          payment: null,
        };
      }
      throw error;
    }

    await recordAudit(this.db, {
      actorUserId: null,
      organizationId: null,
      action: "payment.provider_event_received",
      resourceType: "payment_webhook_event",
      resourceId: eventRow.id,
      source: "system",
      requestId: null,
      ip: null,
      after: { providerKey, eventType: parsed.type, externalEventId },
    });

    try {
      let paymentResult: ReturnType<typeof serializePayment> | null = null;
      const intent = await this.findIntentForWebhook(parsed, providerKey);

      if (intent) {
        await this.db
          .update(paymentWebhookEvents)
          .set({ paymentIntentId: intent.id })
          .where(eq(paymentWebhookEvents.id, eventRow.id));
      }

      const paid =
        parsed.type === "payment.paid" ||
        parsed.type === "checkout.completed" ||
        parsed.status === "paid" ||
        parsed.status === "confirmed";

      const failed = parsed.type === "payment.failed" || parsed.status === "failed";

      if (paid && intent?.organizationId) {
        const creditReceivable = Boolean(intent.invoiceId);
        const confirmed = await this.confirmPayment({
          paymentIntentId: intent.id,
          organizationId: intent.organizationId,
          amountCents: parsed.amountCents ?? intent.amountCents,
          currency: intent.currency,
          providerKey,
          externalPaymentId: parsed.externalPaymentId ?? null,
          isManual: false,
          creditReceivable,
        });
        paymentResult = confirmed.payment;
      } else if (failed && intent?.organizationId) {
        const failedPayment = await this.markPaymentFailed({
          paymentIntentId: intent.id,
          organizationId: intent.organizationId,
          amountCents: parsed.amountCents ?? intent.amountCents,
          currency: intent.currency,
          providerKey,
          externalPaymentId: parsed.externalPaymentId ?? null,
          failureCode: parsed.detail ?? parsed.rawType ?? "provider_failed",
        });
        paymentResult = failedPayment.payment;
      } else if (parsed.type === "payment.refunded" && parsed.externalPaymentId) {
        const payment = await this.db.query.payments.findFirst({
          where: and(
            eq(payments.providerKey, providerKey),
            eq(payments.externalPaymentId, parsed.externalPaymentId),
          ),
        });
        if (payment) {
          const [refund] = await this.db
            .insert(refunds)
            .values({
              paymentId: payment.id,
              organizationId: payment.organizationId,
              amountCents: parsed.amountCents ?? payment.amountCents,
              currency: payment.currency,
              refundType: "partial",
              status: "confirmed",
              providerKey,
              externalRefundId: parsed.externalPaymentId,
              confirmedAt: new Date(),
            })
            .returning();
          await this.db.insert(refundHistory).values({
            refundId: refund!.id,
            fromStatus: null,
            toStatus: "confirmed",
            note: "Webhook payment.refunded",
            actorUserId: null,
          });
          await this.confirmRefundLedger(refund!.id);
        }
      }

      await this.db
        .update(paymentWebhookEvents)
        .set({ status: "processed", processedAt: new Date() })
        .where(eq(paymentWebhookEvents.id, eventRow.id));

      return {
        status: "processed" as const,
        eventId: eventRow.id,
        payment: paymentResult,
      };
    } catch (error) {
      await this.db
        .update(paymentWebhookEvents)
        .set({
          status: "failed",
          errorCode: error instanceof AppError ? error.code : "INTERNAL_ERROR",
          processedAt: new Date(),
        })
        .where(eq(paymentWebhookEvents.id, eventRow.id));
      throw error;
    }
  }

  private async findIntentForWebhook(parsed: PaymentWebhookEvent, providerKey: string) {
    if (parsed.externalIntentId) {
      const byExternal = await this.db.query.paymentIntents.findFirst({
        where: and(
          eq(paymentIntents.providerKey, providerKey),
          eq(paymentIntents.externalIntentId, parsed.externalIntentId),
        ),
      });
      if (byExternal) return byExternal;
    }
    if (parsed.externalPaymentId) {
      const payment = await this.db.query.payments.findFirst({
        where: and(
          eq(payments.providerKey, providerKey),
          eq(payments.externalPaymentId, parsed.externalPaymentId),
        ),
      });
      if (payment) {
        return this.db.query.paymentIntents.findFirst({
          where: eq(paymentIntents.id, payment.paymentIntentId),
        });
      }
    }
    return null;
  }
}

function stringMeta(metadata?: Record<string, unknown>): Record<string, string> | undefined {
  if (!metadata) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null) continue;
    out[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return out;
}
