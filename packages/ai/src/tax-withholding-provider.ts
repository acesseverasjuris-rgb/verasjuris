import { AppError } from "@verasjuris/types";

/**
 * Retenção tributária oficial / estimativa via provedor externo.
 * Default: not_configured — nunca inventa retenção oficial (PROVIDER_CONFIRMED).
 */

export type TaxWithholdingHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type TaxWithholdingSource = "manual" | "estimated" | "provider_confirmed" | "not_configured";

export type EstimateTaxWithholdingInput = {
  organizationId?: string;
  amountCents: number;
  currency?: string;
  serviceCode?: string;
  municipalityCode?: string;
  payeeTaxId?: string;
  payerTaxId?: string;
  metadata?: Record<string, string>;
  signal?: AbortSignal;
};

export type TaxWithholdingEstimate = {
  providerKey: string;
  status: "ok" | "unavailable" | "not_configured";
  source: TaxWithholdingSource;
  grossAmountCents: number;
  withholdingCents: number | null;
  currency: string;
  breakdown?: readonly { code: string; amountCents: number; label?: string }[];
  detail?: string;
};

export type ConfirmTaxWithholdingInput = {
  organizationId?: string;
  estimateReference?: string;
  amountCents: number;
  currency?: string;
  serviceCode?: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export type TaxWithholdingConfirmation = {
  providerKey: string;
  status: "confirmed" | "rejected" | "not_configured";
  source: TaxWithholdingSource;
  externalReference: string | null;
  withholdingCents: number | null;
  currency: string;
  detail?: string;
};

export interface TaxWithholdingProvider {
  readonly id: string;
  estimateWithholding(input: EstimateTaxWithholdingInput): Promise<TaxWithholdingEstimate>;
  confirmWithholding(input: ConfirmTaxWithholdingInput): Promise<TaxWithholdingConfirmation>;
  healthCheck(): Promise<TaxWithholdingHealth>;
}

const MESSAGE =
  "Nenhum provedor de retenção tributária está configurado. Use retenção MANUAL ou ESTIMATED com source explícita; não invente retenção oficial.";

export class NotConfiguredTaxWithholdingProvider implements TaxWithholdingProvider {
  readonly id = "not_configured";

  estimateWithholding(input: EstimateTaxWithholdingInput): Promise<TaxWithholdingEstimate> {
    // Sem valor oficial — withholdingCents null, source not_configured.
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      source: "not_configured",
      grossAmountCents: input.amountCents,
      withholdingCents: null,
      currency: input.currency ?? "BRL",
      breakdown: [],
      detail: "Provedor de retenção não configurado — sem cálculo oficial.",
    });
  }

  confirmWithholding(_input: ConfirmTaxWithholdingInput): Promise<TaxWithholdingConfirmation> {
    return Promise.reject(new AppError("TAX_WITHHOLDING_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  healthCheck(): Promise<TaxWithholdingHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor de retenção tributária não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
