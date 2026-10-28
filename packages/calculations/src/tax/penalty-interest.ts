import {
  assertSafeNonNegativeInt,
  type CalculationEnvelope,
  type CalculationMemoryStep,
  calculationEnvelope,
  type MoneyCents,
} from "../types.js";
import {
  appendTaxMemoryPipeline,
  applyBasisPointsFromRule,
  type TaxPeriod,
  type TaxRuleParams,
} from "./types.js";

export type PenaltyInterestInput = {
  ruleSetVersion: string;
  baseCents: MoneyCents;
  ruleParams: TaxRuleParams;
  period?: TaxPeriod;
  referenceDate?: string;
};

export type PenaltyInterestResult = {
  baseCents: MoneyCents;
  penaltyCents: MoneyCents;
  interestCents: MoneyCents;
  totalAccessoryCents: MoneyCents;
};

/**
 * Multa e juros a partir de basis points informados no rule set (sem alíquotas oficiais embutidas).
 */
export function calculatePenaltyInterest(
  input: PenaltyInterestInput,
): CalculationEnvelope<PenaltyInterestResult> {
  const memory: CalculationMemoryStep[] = [];
  const warnings: string[] = [
    "Multa e juros calculados apenas com basis points do input; não substituem lançamento fiscal oficial.",
  ];
  const missingData: string[] = [];

  assertSafeNonNegativeInt(input.baseCents, "baseCents");

  if (input.ruleParams.penaltyBasisPoints === undefined) {
    missingData.push("ruleParams.penaltyBasisPoints");
  }
  if (input.ruleParams.interestBasisPoints === undefined) {
    missingData.push("ruleParams.interestBasisPoints");
  }

  const penaltyCents = applyBasisPointsFromRule(
    input.baseCents,
    input.ruleParams.penaltyBasisPoints,
    "ruleParams.penaltyBasisPoints",
  );
  const interestCents = applyBasisPointsFromRule(
    input.baseCents,
    input.ruleParams.interestBasisPoints,
    "ruleParams.interestBasisPoints",
  );
  const totalAccessoryCents = penaltyCents + interestCents;

  const result: PenaltyInterestResult = {
    baseCents: input.baseCents,
    penaltyCents,
    interestCents,
    totalAccessoryCents,
  };

  appendTaxMemoryPipeline(memory, {
    inputDetail: {
      baseCents: input.baseCents,
      ruleParams: input.ruleParams,
      referenceDate: input.referenceDate ?? null,
    },
    ruleSetVersion: input.ruleSetVersion,
    indexConfigured: true,
    period: input.period,
    intermediateDetail: {
      penaltyBasisPoints: input.ruleParams.penaltyBasisPoints ?? null,
      interestBasisPoints: input.ruleParams.interestBasisPoints ?? null,
    },
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
