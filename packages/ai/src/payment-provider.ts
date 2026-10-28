import { AppError } from "@verasjuris/types";

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

export type PaymentWebhookPayload = {
  rawBody: string | Uint8Array;
  headers: Record<string, string>;
  signal?: AbortSignal;
};

export type PaymentWebhookResult = {
  externalPaymentId: string;
  status: PaymentStatus;
  detail?: string;
};

export interface PaymentProvider {
  readonly id: string;
  createPayment(input: CreatePaymentInput): Promise<PaymentRecord>;
  getStatus(externalPaymentId: string, signal?: AbortSignal): Promise<PaymentRecord>;
  cancel(externalPaymentId: string, signal?: AbortSignal): Promise<PaymentRecord>;
  refund(
    externalPaymentId: string,
    amountCents?: number,
    signal?: AbortSignal,
  ): Promise<PaymentRecord>;
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

export class NotConfiguredPaymentProvider implements PaymentProvider {
  readonly id = "not_configured";

  createPayment(input: CreatePaymentInput): Promise<PaymentRecord> {
    return Promise.resolve(notConfiguredPayment(input.amountCents));
  }

  getStatus(_externalPaymentId: string): Promise<PaymentRecord> {
    return Promise.resolve(notConfiguredPayment());
  }

  cancel(_externalPaymentId: string): Promise<PaymentRecord> {
    return Promise.reject(new AppError("PAYMENT_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  refund(_externalPaymentId: string, _amountCents?: number): Promise<PaymentRecord> {
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
