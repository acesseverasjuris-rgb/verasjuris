import { AppError } from "@verasjuris/types";

/**
 * Repasses externos (beneficiário / saque) — Etapa 21.3.
 * Distinto do PaymentProvider (cobrança entrante). Default: not_configured — nunca marca PAID.
 */

export type PayoutProviderHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type PayoutRecipientStatus =
  | "pending"
  | "validated"
  | "rejected"
  | "disabled"
  | "not_configured";

export type PayoutStatus =
  | "pending"
  | "scheduled"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled"
  | "not_configured";

export type CreatePayoutRecipientInput = {
  beneficiaryType?: string;
  beneficiaryId?: string;
  legalName?: string;
  taxId?: string;
  bankCode?: string;
  branch?: string;
  accountNumber?: string;
  accountType?: string;
  pixKey?: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export type PayoutRecipientRecord = {
  externalRecipientId: string | null;
  providerKey: string;
  status: PayoutRecipientStatus;
  detail?: string;
};

export type ValidatePayoutRecipientInput = {
  externalRecipientId: string;
  signal?: AbortSignal;
};

export type CreatePayoutInput = {
  externalRecipientId?: string;
  amountCents: number;
  currency?: string;
  description?: string;
  payableId?: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export type PayoutRecord = {
  externalPayoutId: string | null;
  providerKey: string;
  status: PayoutStatus;
  amountCents: number;
  currency: string;
  paidAt?: string | null;
  detail?: string;
};

export interface PayoutProvider {
  readonly id: string;
  createRecipient(input: CreatePayoutRecipientInput): Promise<PayoutRecipientRecord>;
  validateRecipient(input: ValidatePayoutRecipientInput): Promise<PayoutRecipientRecord>;
  createPayout(input: CreatePayoutInput): Promise<PayoutRecord>;
  getPayoutStatus(externalPayoutId: string, signal?: AbortSignal): Promise<PayoutRecord>;
  cancelPayout(externalPayoutId: string, signal?: AbortSignal): Promise<PayoutRecord>;
  healthCheck(): Promise<PayoutProviderHealth>;
}

const MESSAGE =
  "Nenhum provedor de repasse (payout) está configurado. Registre beneficiários e pagamentos manuais com evidência; não marque como pago automaticamente.";

function notConfiguredRecipient(): PayoutRecipientRecord {
  return {
    externalRecipientId: null,
    providerKey: "not_configured",
    status: "not_configured",
    detail: "Provedor de payout não configurado.",
  };
}

function notConfiguredPayout(amountCents = 0, currency = "BRL"): PayoutRecord {
  return {
    externalPayoutId: null,
    providerKey: "not_configured",
    status: "not_configured",
    amountCents,
    currency,
    paidAt: null,
    detail: "Provedor de payout não configurado — nunca marca PAID.",
  };
}

export class NotConfiguredPayoutProvider implements PayoutProvider {
  readonly id = "not_configured";

  createRecipient(_input: CreatePayoutRecipientInput): Promise<PayoutRecipientRecord> {
    return Promise.resolve(notConfiguredRecipient());
  }

  validateRecipient(_input: ValidatePayoutRecipientInput): Promise<PayoutRecipientRecord> {
    return Promise.resolve(notConfiguredRecipient());
  }

  createPayout(input: CreatePayoutInput): Promise<PayoutRecord> {
    // Honesto: status not_configured — nunca finge liquidação / PAID.
    return Promise.resolve(notConfiguredPayout(input.amountCents, input.currency ?? "BRL"));
  }

  getPayoutStatus(_externalPayoutId: string, _signal?: AbortSignal): Promise<PayoutRecord> {
    return Promise.resolve(notConfiguredPayout());
  }

  cancelPayout(_externalPayoutId: string, _signal?: AbortSignal): Promise<PayoutRecord> {
    return Promise.reject(new AppError("PAYOUT_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  healthCheck(): Promise<PayoutProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor de payout não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
