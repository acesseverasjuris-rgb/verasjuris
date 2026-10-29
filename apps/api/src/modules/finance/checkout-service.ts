import type { PaymentProvider } from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import { policyPaymentIntent, type SessionAccount } from "@verasjuris/auth";
import {
  invoices,
  type invoiceLines,
  isUniqueViolation,
  paymentIntents,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, eq } from "drizzle-orm";
import { authorize } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import { BillingService } from "./billing-service.js";

function parseDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}

/**
 * Orquestra validação comercial → invoice opcional → payment intent → checkout session.
 * Nunca marca pagamento aprovado quando o provider está ausente.
 */
export class CheckoutService {
  private readonly billing: BillingService;

  constructor(
    private readonly db: AppDatabase,
    private readonly paymentProvider: PaymentProvider,
  ) {
    this.billing = new BillingService(db, paymentProvider);
  }

  async checkout(
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
      description?: string;
      successUrl: string;
      cancelUrl: string;
      idempotencyKey: string;
      expiresAt?: string;
      createInvoiceIfMissing?: boolean;
      invoiceLines?: Array<{
        type: (typeof invoiceLines.$inferInsert)["type"];
        description: string;
        quantity: number;
        unitAmountCents: number;
        totalAmountCents: number;
        referenceType?: string;
        referenceId?: string;
        metadata?: Record<string, unknown>;
      }>;
      metadata?: Record<string, unknown>;
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyPaymentIntent(m, "finance.payment.read"));

    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      throw new AppError("VALIDATION_ERROR", "Informe um valor positivo em centavos.", [
        { path: "amountCents", message: "Valor inválido." },
      ]);
    }
    if (input.currency.length !== 3) {
      throw new AppError("VALIDATION_ERROR", "Moeda inválida.", [
        { path: "currency", message: "Use ISO-4217 (3 letras)." },
      ]);
    }

    const existingIntent = await this.db.query.paymentIntents.findFirst({
      where: and(
        eq(paymentIntents.organizationId, organizationId),
        eq(paymentIntents.idempotencyKey, input.idempotencyKey),
      ),
    });
    if (existingIntent) {
      const health = await this.paymentProvider.healthCheck();
      return {
        paymentIntent: serializeIntent(existingIntent),
        checkout: null as null | Record<string, unknown>,
        providerStatus: health,
        unavailable:
          health.status === "not_configured" || existingIntent.status === "not_configured",
        alreadyExists: true,
      };
    }

    let invoiceId = input.invoiceId ?? null;
    if (invoiceId) {
      const invoice = await this.db.query.invoices.findFirst({
        where: and(eq(invoices.id, invoiceId), eq(invoices.organizationId, organizationId)),
      });
      if (!invoice) throw new AppError("NOT_FOUND", "Não encontramos esta fatura.");
      if (invoice.currency !== input.currency) {
        throw new AppError("VALIDATION_ERROR", "Moeda do checkout diverge da fatura.");
      }
      if (invoice.amountDueCents > 0 && invoice.amountDueCents !== input.amountCents) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Valor do checkout deve corresponder ao saldo da fatura.",
          [{ path: "amountCents", message: `Esperado ${invoice.amountDueCents} centavos.` }],
        );
      }
    } else if (input.createInvoiceIfMissing) {
      const created = await this.billing.createInvoice(
        account,
        organizationId,
        {
          currency: input.currency,
          subtotalCents: input.amountCents,
          discountCents: 0,
          taxCents: 0,
          status: "open",
          lines: input.invoiceLines ?? [
            {
              type: "other",
              description: input.description ?? "Checkout",
              quantity: 1,
              unitAmountCents: input.amountCents,
              totalAmountCents: input.amountCents,
              referenceType: input.referenceType,
              referenceId: input.referenceId,
            },
          ],
          metadata: input.metadata,
        },
        meta,
      );
      invoiceId = created.invoice.id;
    }

    const health = await this.paymentProvider.healthCheck();
    const providerConfigured =
      health.status !== "not_configured" && this.paymentProvider.id !== "not_configured";

    let providerResult = await this.paymentProvider.createPaymentIntent({
      amountCents: input.amountCents,
      currency: input.currency,
      paymentMethod: input.paymentMethod === "manual" ? "other" : (input.paymentMethod as "pix"),
      description: input.description,
      customerReference: input.payerId,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      invoiceId: invoiceId ?? undefined,
      metadata: stringRecord(input.metadata),
      idempotencyKey: input.idempotencyKey,
      expiresAt: input.expiresAt,
    });

    if (!providerConfigured || providerResult.status === "not_configured") {
      providerResult = {
        ...providerResult,
        status: "not_configured",
        providerKey: "not_configured",
        externalIntentId: null,
        checkoutUrl: null,
        clientSecret: null,
      };
    }

    let checkoutSession: Awaited<ReturnType<PaymentProvider["createCheckoutSession"]>> | null =
      null;
    if (providerConfigured && this.paymentProvider.capabilities.includes("checkout_session")) {
      checkoutSession = await this.paymentProvider.createCheckoutSession({
        amountCents: input.amountCents,
        currency: input.currency,
        paymentMethods:
          input.paymentMethod === "manual"
            ? undefined
            : ([input.paymentMethod] as ("pix" | "credit_card")[]),
        description: input.description,
        customerReference: input.payerId,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        metadata: stringRecord(input.metadata),
        idempotencyKey: `${input.idempotencyKey}:checkout`,
        expiresAt: input.expiresAt,
      });
      if (checkoutSession.status === "not_configured") {
        checkoutSession = null;
      }
    }

    try {
      const [intent] = await this.db
        .insert(paymentIntents)
        .values({
          organizationId,
          payerType: input.payerType,
          payerId: input.payerId,
          invoiceId,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          amountCents: input.amountCents,
          currency: input.currency,
          paymentMethod: input.paymentMethod,
          status: providerResult.status,
          providerKey: providerResult.providerKey,
          externalIntentId: providerResult.externalIntentId,
          idempotencyKey: input.idempotencyKey,
          expiresAt:
            parseDate(input.expiresAt) ?? parseDate(providerResult.expiresAt ?? undefined) ?? null,
          metadata: {
            ...(input.metadata ?? {}),
            ...(checkoutSession?.externalSessionId
              ? { externalSessionId: checkoutSession.externalSessionId }
              : {}),
            ...(checkoutSession?.checkoutUrl ? { checkoutUrl: checkoutSession.checkoutUrl } : {}),
            description: input.description ?? null,
          },
        })
        .returning();

      await recordAudit(this.db, {
        actorUserId: account.user.id,
        organizationId,
        action: "payment.checkout_created",
        resourceType: "payment_intent",
        resourceId: intent!.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: {
          status: intent!.status,
          amountCents: intent!.amountCents,
          providerKey: intent!.providerKey,
        },
      });

      const unavailable = intent!.status === "not_configured" || !providerConfigured;

      return {
        paymentIntent: serializeIntent(intent!),
        checkout: checkoutSession
          ? {
              status: checkoutSession.status,
              checkoutUrl: checkoutSession.checkoutUrl,
              externalSessionId: checkoutSession.externalSessionId,
              expiresAt: checkoutSession.expiresAt ?? null,
            }
          : null,
        providerStatus: health,
        unavailable,
        message: unavailable
          ? "Provedor de pagamento não configurado. Checkout indisponível — nenhum pagamento foi aprovado."
          : null,
        alreadyExists: false,
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await this.db.query.paymentIntents.findFirst({
          where: and(
            eq(paymentIntents.organizationId, organizationId),
            eq(paymentIntents.idempotencyKey, input.idempotencyKey),
          ),
        });
        if (raced) {
          return {
            paymentIntent: serializeIntent(raced),
            checkout: null,
            providerStatus: health,
            unavailable: raced.status === "not_configured",
            alreadyExists: true,
          };
        }
      }
      throw error;
    }
  }
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
    expiresAt: row.expiresAt?.toISOString() ?? null,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function stringRecord(metadata?: Record<string, unknown>): Record<string, string> | undefined {
  if (!metadata) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null) continue;
    out[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return out;
}
