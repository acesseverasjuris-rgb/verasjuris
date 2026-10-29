import { AppError } from "@verasjuris/types";

/**
 * Cobrança externa / debt collection — stub futuro (Etapa 21).
 * Default: NOT_CONFIGURED — sem agência de cobrança simulada.
 */

export type DebtCollectionHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type DebtCollectionCaseStatus =
  | "open"
  | "in_collection"
  | "settled"
  | "closed"
  | "not_configured";

export type SubmitDebtCollectionCaseInput = {
  organizationId?: string;
  invoiceId?: string;
  amountCents: number;
  currency?: string;
  debtorReference?: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export type DebtCollectionCaseRecord = {
  externalCaseId: string | null;
  providerKey: string;
  status: DebtCollectionCaseStatus;
  amountCents: number;
  currency: string;
  detail?: string;
};

export interface DebtCollectionProvider {
  readonly id: string;
  submitCase(input: SubmitDebtCollectionCaseInput): Promise<DebtCollectionCaseRecord>;
  getCaseStatus(externalCaseId: string, signal?: AbortSignal): Promise<DebtCollectionCaseRecord>;
  healthCheck(): Promise<DebtCollectionHealth>;
}

const MESSAGE = "Nenhum provedor de cobrança externa (debt collection) está configurado.";

export class NotConfiguredDebtCollectionProvider implements DebtCollectionProvider {
  readonly id = "not_configured";

  submitCase(input: SubmitDebtCollectionCaseInput): Promise<DebtCollectionCaseRecord> {
    return Promise.resolve({
      externalCaseId: null,
      providerKey: "not_configured",
      status: "not_configured",
      amountCents: input.amountCents,
      currency: input.currency ?? "BRL",
      detail: MESSAGE,
    });
  }

  getCaseStatus(_externalCaseId: string, _signal?: AbortSignal): Promise<DebtCollectionCaseRecord> {
    return Promise.resolve({
      externalCaseId: null,
      providerKey: "not_configured",
      status: "not_configured",
      amountCents: 0,
      currency: "BRL",
      detail: MESSAGE,
    });
  }

  healthCheck(): Promise<DebtCollectionHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: MESSAGE,
      checkedAt: new Date().toISOString(),
    });
  }
}

/** Helper para rejeitar mutações que exigiriam provider real. */
export function debtCollectionProviderNotConfiguredError(): AppError {
  return new AppError("DEBT_COLLECTION_PROVIDER_NOT_CONFIGURED", MESSAGE);
}
