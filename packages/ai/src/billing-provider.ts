import { AppError } from "@verasjuris/types";

/**
 * Gestão externa de assinaturas / cobrança recorrente (≠ PaymentProvider, ≠ ledger interno).
 * Default: not_configured — nunca marca assinatura active/paid fictícia.
 */

export type BillingProviderHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type BillingInterval = "monthly" | "quarterly" | "yearly" | "one_time" | "custom";

export type ExternalSubscriptionStatus =
  | "incomplete"
  | "trialing"
  | "active"
  | "past_due"
  | "suspended"
  | "cancelled"
  | "expired"
  | "not_configured";

export type CreateExternalSubscriptionInput = {
  organizationId?: string;
  userId?: string;
  planKey: string;
  billingInterval?: BillingInterval;
  trialEndsAt?: string | null;
  customerReference?: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export type ExternalSubscriptionRecord = {
  externalSubscriptionId: string | null;
  providerKey: string;
  status: ExternalSubscriptionStatus;
  planKey: string;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
};

export type CancelExternalSubscriptionInput = {
  externalSubscriptionId: string;
  atPeriodEnd?: boolean;
  signal?: AbortSignal;
};

export type SyncExternalSubscriptionInput = {
  externalSubscriptionId: string;
  signal?: AbortSignal;
};

export interface BillingProvider {
  readonly id: string;
  createSubscription(input: CreateExternalSubscriptionInput): Promise<ExternalSubscriptionRecord>;
  getSubscription(
    externalSubscriptionId: string,
    signal?: AbortSignal,
  ): Promise<ExternalSubscriptionRecord>;
  cancelSubscription(input: CancelExternalSubscriptionInput): Promise<ExternalSubscriptionRecord>;
  syncSubscription(input: SyncExternalSubscriptionInput): Promise<ExternalSubscriptionRecord>;
  healthCheck(): Promise<BillingProviderHealth>;
}

const MESSAGE =
  "Nenhum provedor externo de billing/assinatura está configurado. Gerencie planos e faturas no ledger interno ou registre manualmente.";

function notConfiguredSubscription(planKey = ""): ExternalSubscriptionRecord {
  return {
    externalSubscriptionId: null,
    providerKey: "not_configured",
    status: "not_configured",
    planKey,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  };
}

export class NotConfiguredBillingProvider implements BillingProvider {
  readonly id = "not_configured";

  createSubscription(input: CreateExternalSubscriptionInput): Promise<ExternalSubscriptionRecord> {
    return Promise.resolve(notConfiguredSubscription(input.planKey));
  }

  getSubscription(_externalSubscriptionId: string): Promise<ExternalSubscriptionRecord> {
    return Promise.resolve(notConfiguredSubscription());
  }

  cancelSubscription(_input: CancelExternalSubscriptionInput): Promise<ExternalSubscriptionRecord> {
    return Promise.reject(new AppError("BILLING_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  syncSubscription(_input: SyncExternalSubscriptionInput): Promise<ExternalSubscriptionRecord> {
    return Promise.reject(new AppError("BILLING_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  healthCheck(): Promise<BillingProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor de billing externo não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
