import { AppError } from "@verasjuris/types";

/**
 * PaymentProvider — adaptador PSP (Etapas 8 + 16 + 21).
 * Evoluir este contrato; não criar um segundo PaymentProvider.
 * Chargeback/disputa: ver `PaymentDisputeProvider` em `payment-dispute-provider.ts`
 * (não duplicar PaymentProvider). Default: NotConfiguredPaymentProvider — nunca inventa liquidação / paid.
 */

export type PaymentProviderHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type PaymentStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partially_refunded"
  | "not_configured";

export type PaymentMethod =
  | "pix"
  | "credit_card"
  | "debit_card"
  | "boleto"
  | "bank_transfer"
  | "wallet"
  | "other";

export const PAYMENT_PROVIDER_CAPABILITIES = [
  "refund",
  "split",
  "webhook",
  "checkout_session",
] as const;

export type PaymentProviderCapability = (typeof PAYMENT_PROVIDER_CAPABILITIES)[number];

export type PaymentRecord = {
  externalPaymentId: string | null;
  status: PaymentStatus;
  providerKey: string;
  amountCents: number;
  paidAt?: string | null;
};

export type CreatePaymentInput = {
  amountCents: number;
  currency?: string;
  description?: string;
  customerReference?: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export type PaymentIntentStatus =
  | "created"
  | "requires_action"
  | "processing"
  | "authorized"
  | "confirmed"
  | "failed"
  | "cancelled"
  | "expired"
  | "not_configured";

export type PaymentIntentCreateInput = {
  amountCents: number;
  currency?: string;
  paymentMethod?: PaymentMethod;
  description?: string;
  customerReference?: string;
  referenceType?: string;
  referenceId?: string;
  invoiceId?: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
  expiresAt?: string;
  signal?: AbortSignal;
};

export type PaymentIntentRecord = {
  externalIntentId: string | null;
  status: PaymentIntentStatus;
  providerKey: string;
  amountCents: number;
  currency: string;
  paymentMethod?: PaymentMethod | null;
  clientSecret?: string | null;
  checkoutUrl?: string | null;
  expiresAt?: string | null;
  metadata?: Record<string, string>;
};

export type CheckoutSessionInput = {
  amountCents: number;
  currency?: string;
  paymentMethods?: readonly PaymentMethod[];
  description?: string;
  customerReference?: string;
  successUrl: string;
  cancelUrl: string;
  referenceType?: string;
  referenceId?: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
  expiresAt?: string;
  signal?: AbortSignal;
};

export type CheckoutSessionStatus =
  | "open"
  | "complete"
  | "expired"
  | "unavailable"
  | "not_configured";

export type CheckoutSessionResult = {
  externalSessionId: string | null;
  status: CheckoutSessionStatus;
  providerKey: string;
  checkoutUrl: string | null;
  amountCents: number;
  currency: string;
  expiresAt?: string | null;
};

export type PaymentWebhookPayload = {
  rawBody: string | Uint8Array;
  headers: Record<string, string>;
  signal?: AbortSignal;
};

/**
 * Verificação de assinatura de webhook.
 * `toleranceSeconds` limita replay (diferença aceitável entre timestamp do header e agora).
 */
export type PaymentWebhookVerifyInput = {
  rawBody: string | Uint8Array;
  headers: Record<string, string>;
  /** Assinatura explícita; se omitida, o provedor pode ler de `headers`. */
  signature?: string;
  /** Timestamp da assinatura (unix seconds ou header parseado). */
  timestamp?: number | string;
  /** Tolerância máxima em segundos para o timestamp (anti-replay). */
  toleranceSeconds?: number;
  signal?: AbortSignal;
};

export type PaymentWebhookVerificationResult = {
  valid: boolean;
  reason?: string;
  /** Timestamp usado na verificação, quando aplicável. */
  timestamp?: number | null;
  /** Se a assinatura passou mas o timestamp excedeu a tolerância. */
  timestampOutOfTolerance?: boolean;
};

export type PaymentWebhookEventType =
  | "payment.created"
  | "payment.updated"
  | "payment.paid"
  | "payment.failed"
  | "payment.cancelled"
  | "payment.refunded"
  | "intent.updated"
  | "checkout.completed"
  | "checkout.expired"
  | "unknown";

export type PaymentWebhookEvent = {
  type: PaymentWebhookEventType;
  externalPaymentId?: string | null;
  externalIntentId?: string | null;
  externalSessionId?: string | null;
  status?: PaymentStatus | PaymentIntentStatus | CheckoutSessionStatus;
  amountCents?: number | null;
  rawType?: string;
  detail?: string;
  occurredAt?: string | null;
};

export type PaymentWebhookResult = {
  externalPaymentId: string;
  status: PaymentStatus;
  detail?: string;
};

export interface PaymentProvider {
  readonly id: string;
  /** Capacidades declaradas pelo adaptador (vazio = nenhuma). */
  readonly capabilities: readonly PaymentProviderCapability[];

  createPayment(input: CreatePaymentInput): Promise<PaymentRecord>;
  createPaymentIntent(input: PaymentIntentCreateInput): Promise<PaymentIntentRecord>;
  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult>;

  getStatus(externalPaymentId: string, signal?: AbortSignal): Promise<PaymentRecord>;
  /** Alias de `getStatus`. */
  getPaymentStatus(externalPaymentId: string, signal?: AbortSignal): Promise<PaymentRecord>;

  cancel(externalPaymentId: string, signal?: AbortSignal): Promise<PaymentRecord>;
  /** Alias de `cancel`. */
  cancelPayment(externalPaymentId: string, signal?: AbortSignal): Promise<PaymentRecord>;

  refund(
    externalPaymentId: string,
    amountCents?: number,
    signal?: AbortSignal,
  ): Promise<PaymentRecord>;
  /** Alias de `refund`. */
  refundPayment(
    externalPaymentId: string,
    amountCents?: number,
    signal?: AbortSignal,
  ): Promise<PaymentRecord>;

  /** Verifica assinatura (e opcionalmente tolerância de timestamp). Não processa o evento. */
  verifyWebhook(
    payload: PaymentWebhookVerifyInput | PaymentWebhookPayload,
  ): Promise<boolean | PaymentWebhookVerificationResult>;

  /** Interpreta o payload após verificação. */
  parseWebhook(payload: PaymentWebhookPayload): Promise<PaymentWebhookEvent>;

  /** Fluxo legado: validar + interpretar + mapear para resultado de pagamento. */
  handleWebhook(payload: PaymentWebhookPayload): Promise<PaymentWebhookResult>;

  healthCheck(): Promise<PaymentProviderHealth>;
}

const MESSAGE =
  "Nenhum provedor de pagamento está configurado. Registre pagamentos manualmente com evidência documental.";

function notConfiguredPayment(amountCents = 0): PaymentRecord {
  return {
    externalPaymentId: null,
    status: "not_configured",
    providerKey: "not_configured",
    amountCents,
    paidAt: null,
  };
}

function notConfiguredIntent(input: PaymentIntentCreateInput): PaymentIntentRecord {
  return {
    externalIntentId: null,
    status: "not_configured",
    providerKey: "not_configured",
    amountCents: input.amountCents,
    currency: input.currency ?? "BRL",
    paymentMethod: input.paymentMethod ?? null,
    clientSecret: null,
    checkoutUrl: null,
    expiresAt: null,
    metadata: input.metadata,
  };
}

function notConfiguredCheckout(input: CheckoutSessionInput): CheckoutSessionResult {
  return {
    externalSessionId: null,
    status: "not_configured",
    providerKey: "not_configured",
    checkoutUrl: null,
    amountCents: input.amountCents,
    currency: input.currency ?? "BRL",
    expiresAt: null,
  };
}

export class NotConfiguredPaymentProvider implements PaymentProvider {
  readonly id = "not_configured";
  readonly capabilities: readonly PaymentProviderCapability[] = [];

  createPayment(input: CreatePaymentInput): Promise<PaymentRecord> {
    return Promise.resolve(notConfiguredPayment(input.amountCents));
  }

  createPaymentIntent(input: PaymentIntentCreateInput): Promise<PaymentIntentRecord> {
    return Promise.resolve(notConfiguredIntent(input));
  }

  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    // Honesto: sem URL de checkout e status not_configured — nunca finge sessão paga.
    return Promise.resolve(notConfiguredCheckout(input));
  }

  getStatus(_externalPaymentId: string, _signal?: AbortSignal): Promise<PaymentRecord> {
    return Promise.resolve(notConfiguredPayment());
  }

  getPaymentStatus(externalPaymentId: string, signal?: AbortSignal): Promise<PaymentRecord> {
    return this.getStatus(externalPaymentId, signal);
  }

  cancel(_externalPaymentId: string, _signal?: AbortSignal): Promise<PaymentRecord> {
    return Promise.reject(new AppError("PAYMENT_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  cancelPayment(externalPaymentId: string, signal?: AbortSignal): Promise<PaymentRecord> {
    return this.cancel(externalPaymentId, signal);
  }

  refund(
    _externalPaymentId: string,
    _amountCents?: number,
    _signal?: AbortSignal,
  ): Promise<PaymentRecord> {
    return Promise.reject(new AppError("PAYMENT_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  refundPayment(
    externalPaymentId: string,
    amountCents?: number,
    signal?: AbortSignal,
  ): Promise<PaymentRecord> {
    return this.refund(externalPaymentId, amountCents, signal);
  }

  verifyWebhook(
    _payload: PaymentWebhookVerifyInput | PaymentWebhookPayload,
  ): Promise<boolean | PaymentWebhookVerificationResult> {
    return Promise.resolve({
      valid: false,
      reason: "PAYMENT_PROVIDER_NOT_CONFIGURED",
      timestamp: null,
      timestampOutOfTolerance: false,
    });
  }

  parseWebhook(_payload: PaymentWebhookPayload): Promise<PaymentWebhookEvent> {
    return Promise.reject(new AppError("PAYMENT_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  handleWebhook(_payload: PaymentWebhookPayload): Promise<PaymentWebhookResult> {
    return Promise.reject(new AppError("PAYMENT_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  healthCheck(): Promise<PaymentProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor de pagamento não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
