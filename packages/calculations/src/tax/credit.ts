import {
  assertSafeNonNegativeInt,
  type CalculationEnvelope,
  type CalculationMemoryStep,
  calculationEnvelope,
  type MoneyCents,
} from "../types.js";
import { appendTaxMemoryPipeline, type TaxPeriod } from "./types.js";

export type TaxCreditInput = {
  ruleSetVersion: string;
  creditKey: string;
  principalCents: MoneyCents;
  correctionCents?: MoneyCents;
  indexConfigured?: boolean;
  indexKey?: string;
  period?: TaxPeriod;
  referenceDate?: string;
};

export type TaxCreditResult = {
  creditKey: string;
  principalCents: MoneyCents;
  correctionCents: MoneyCents;
  totalCreditCents: MoneyCents;
};

/**
 * Crédito tributário identificado a partir de valores informados.
 */
export function calculateTaxCredit(input: TaxCreditInput): CalculationEnvelope<TaxCreditResult> {
  const memory: CalculationMemoryStep[] = [];
  const warnings: string[] = [
    "Crédito calculado apenas com dados informados; homologação administrativa não simulada.",
  ];
  const missingData: string[] = [];

  assertSafeNonNegativeInt(input.principalCents, "principalCents");

  const indexKey = input.indexKey ?? input.creditKey;
  const indexConfigured = input.indexConfigured ?? input.correctionCents !== undefined;
  if (!indexConfigured) {
    warnings.push("not_configured_index");
    missingData.push(`index:${indexKey}`);
  }

  let correctionCents = 0;
  if (input.correctionCents !== undefined) {
    assertSafeNonNegativeInt(input.correctionCents, "correctionCents");
    correctionCents = input.correctionCents;
  }

  const totalCreditCents = input.principalCents + correctionCents;

  const result: TaxCreditResult = {
    creditKey: input.creditKey,
    principalCents: input.principalCents,
    correctionCents,
    totalCreditCents,
  };

  appendTaxMemoryPipeline(memory, {
    inputDetail: {
      creditKey: input.creditKey,
      principalCents: input.principalCents,
      correctionCents: input.correctionCents ?? null,
      referenceDate: input.referenceDate ?? null,
    },
    ruleSetVersion: input.ruleSetVersion,
    indexKey,
    indexConfigured,
    period: input.period,
    intermediateDetail: { correctionAppliedCents: correctionCents },
    resultDetail: { ...result },
    warningMessages: warnings,
  });

  return calculationEnvelope(result, {
    ruleSetVersion: input.ruleSetVersion,
    memory,
    warnings: [...new Set(warnings)],
    missingData,
  });
}
