import {
  assertSafeNonNegativeInt,
  type CalculationEnvelope,
  type CalculationMemoryStep,
  calculationEnvelope,
  type MoneyCents,
} from "../types.js";
import { appendTaxMemoryPipeline, type TaxPeriod } from "./types.js";

export type TaxCompensationInput = {
  ruleSetVersion: string;
  sourceCreditKey: string;
  destinationDebitKey: string;
  availableCreditCents: MoneyCents;
  debitDueCents: MoneyCents;
  period?: TaxPeriod;
  referenceDate?: string;
};

export type TaxCompensationResult = {
  sourceCreditKey: string;
  destinationDebitKey: string;
  availableCreditCents: MoneyCents;
  debitDueCents: MoneyCents;
  compensatedCents: MoneyCents;
  remainingCreditCents: MoneyCents;
  remainingDebitCents: MoneyCents;
};

/**
 * Compensação: aplica crédito disponível contra débito informado (mínimo dos dois).
 */
export function calculateTaxCompensation(
  input: TaxCompensationInput,
): CalculationEnvelope<TaxCompensationResult> {
  const memory: CalculationMemoryStep[] = [];
  const warnings: string[] = [
    "Compensação estimativa; PER/DCOMP e regras de espécie não simuladas aqui.",
  ];
  const missingData: string[] = [];

  assertSafeNonNegativeInt(input.availableCreditCents, "availableCreditCents");
  assertSafeNonNegativeInt(input.debitDueCents, "debitDueCents");

  const compensatedCents = Math.min(input.availableCreditCents, input.debitDueCents);
  const remainingCreditCents = input.availableCreditCents - compensatedCents;
  const remainingDebitCents = input.debitDueCents - compensatedCents;

  const result: TaxCompensationResult = {
    sourceCreditKey: input.sourceCreditKey,
    destinationDebitKey: input.destinationDebitKey,
    availableCreditCents: input.availableCreditCents,
    debitDueCents: input.debitDueCents,
    compensatedCents,
    remainingCreditCents,
    remainingDebitCents,
  };

  appendTaxMemoryPipeline(memory, {
    inputDetail: {
      sourceCreditKey: input.sourceCreditKey,
      destinationDebitKey: input.destinationDebitKey,
      availableCreditCents: input.availableCreditCents,
      debitDueCents: input.debitDueCents,
      referenceDate: input.referenceDate ?? null,
    },
    ruleSetVersion: input.ruleSetVersion,
    indexConfigured: true,
    period: input.period,
    intermediateDetail: { compensatedCents },
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
