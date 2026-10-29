import { AppError } from "@verasjuris/types";

/**
 * Chargeback / disputa no PSP — webhook e consulta.
 * Separado do PaymentProvider (não criar segundo PaymentProvider).
 * Default: NOT_CONFIGURED — nunca finge chargeback won/lost.
 */

export type PaymentDisputeHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type PaymentDisputeOutcome =
  | "open"
  | "under_review"
  | "won"
  | "lost"
  | "partially_won"
  | "cancelled"
  | "not_configured";

export type PaymentDisputeRecord = {
  externalDisputeId: string | null;
  providerKey: string;
  status: PaymentDisputeOutcome;
  externalPaymentId?: string | null;
  amountCents?: number | null;
  currency?: string;
  reasonCode?: string | null;
  detail?: string;
  occurredAt?: string | null;
};

export type PaymentDisputeWebhookPayload = {
  rawBody: string | Uint8Array;
  headers: Record<string, string>;
  signal?: AbortSignal;
};

export type PaymentDisputeWebhookVerifyInput = {
  rawBody: string | Uint8Array;
  headers: Record<string, string>;
  signature?: string;
  timestamp?: number | string;
  toleranceSeconds?: number;
  signal?: AbortSignal;
};

export type PaymentDisputeWebhookVerificationResult = {
  valid: boolean;
  reason?: string;
  timestamp?: number | null;
  timestampOutOfTolerance?: boolean;
};

export type PaymentDisputeWebhookEvent = {
  type: "dispute.opened" | "dispute.updated" | "dispute.won" | "dispute.lost" | "unknown";
  externalDisputeId?: string | null;
  externalPaymentId?: string | null;
  status?: PaymentDisputeOutcome;
  amountCents?: number | null;
  reasonCode?: string | null;
  detail?: string;
  occurredAt?: string | null;
};

export interface PaymentDisputeProvider {
  readonly id: string;
  getDispute(externalDisputeId: string, signal?: AbortSignal): Promise<PaymentDisputeRecord>;
  verifyWebhook(
    payload: PaymentDisputeWebhookVerifyInput | PaymentDisputeWebhookPayload,
  ): Promise<boolean | PaymentDisputeWebhookVerificationResult>;
  parseWebhook(payload: PaymentDisputeWebhookPayload): Promise<PaymentDisputeWebhookEvent>;
  healthCheck(): Promise<PaymentDisputeHealth>;
}

const MESSAGE =
  "Nenhum provedor de chargeback/disputa de pagamento está configurado. Não marque disputa como ganha/perdida automaticamente.";

export class NotConfiguredPaymentDisputeProvider implements PaymentDisputeProvider {
  readonly id = "not_configured";

  getDispute(_externalDisputeId: string, _signal?: AbortSignal): Promise<PaymentDisputeRecord> {
    // Honesto: never fake won/lost.
    return Promise.resolve({
      externalDisputeId: null,
      providerKey: "not_configured",
      status: "not_configured",
      externalPaymentId: null,
      amountCents: null,
      currency: "BRL",
      reasonCode: null,
      detail: MESSAGE,
      occurredAt: null,
    });
  }

  verifyWebhook(
    _payload: PaymentDisputeWebhookVerifyInput | PaymentDisputeWebhookPayload,
  ): Promise<boolean | PaymentDisputeWebhookVerificationResult> {
    return Promise.resolve({
      valid: false,
      reason: "CHARGEBACK_PROVIDER_NOT_CONFIGURED",
      timestamp: null,
      timestampOutOfTolerance: false,
    });
  }

  parseWebhook(_payload: PaymentDisputeWebhookPayload): Promise<PaymentDisputeWebhookEvent> {
    return Promise.reject(new AppError("CHARGEBACK_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  healthCheck(): Promise<PaymentDisputeHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor de chargeback/disputa não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
