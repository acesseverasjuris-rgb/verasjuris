import {
  assertSafeNonNegativeInt,
  assertSafePositiveInt,
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

export type TaxInstallmentInput = {
  ruleSetVersion: string;
  totalDebtCents: MoneyCents;
  installmentCount: number;
  ruleParams?: TaxRuleParams;
  period?: TaxPeriod;
  referenceDate?: string;
};

export type TaxInstallmentScheduleLine = {
  installmentNumber: number;
  principalPortionCents: MoneyCents;
  interestPortionCents: MoneyCents;
  installmentTotalCents: MoneyCents;
};

export type TaxInstallmentResult = {
  totalDebtCents: MoneyCents;
  installmentCount: number;
  totalInterestCents: MoneyCents;
  grandTotalCents: MoneyCents;
  schedule: TaxInstallmentScheduleLine[];
};

/**
 * Parcelamento: divide principal informado e aplica juros de parcelamento via basis points do rule set.
 */
export function calculateTaxInstallment(
  input: TaxInstallmentInput,
): CalculationEnvelope<TaxInstallmentResult> {
  const memory: CalculationMemoryStep[] = [];
  const warnings: string[] = [
    "Parcelamento simulado com divisão inteira e juros do input; não substitui programa oficial de parcelamento.",
  ];
  const missingData: string[] = [];

  assertSafeNonNegativeInt(input.totalDebtCents, "totalDebtCents");
  assertSafePositiveInt(input.installmentCount, "installmentCount");

  const interestBasisPoints = input.ruleParams?.installmentInterestBasisPoints;
  if (interestBasisPoints === undefined) {
    missingData.push("ruleParams.installmentInterestBasisPoints");
  }

  const totalInterestCents = applyBasisPointsFromRule(
    input.totalDebtCents,
    interestBasisPoints,
    "ruleParams.installmentInterestBasisPoints",
  );
  const grandTotalCents = input.totalDebtCents + totalInterestCents;

  const basePerInstallment = Math.floor(input.totalDebtCents / input.installmentCount);
  const principalRemainder = input.totalDebtCents - basePerInstallment * input.installmentCount;
  const interestPerInstallment = Math.floor(totalInterestCents / input.installmentCount);
  const interestRemainder = totalInterestCents - interestPerInstallment * input.installmentCount;

  const schedule: TaxInstallmentScheduleLine[] = [];
  for (let i = 1; i <= input.installmentCount; i += 1) {
    const principalPortionCents =
      basePerInstallment + (i === input.installmentCount ? principalRemainder : 0);
    const interestPortionCents =
      interestPerInstallment + (i === input.installmentCount ? interestRemainder : 0);
    schedule.push({
      installmentNumber: i,
      principalPortionCents,
      interestPortionCents,
      installmentTotalCents: principalPortionCents + interestPortionCents,
    });
  }

  const result: TaxInstallmentResult = {
    totalDebtCents: input.totalDebtCents,
    installmentCount: input.installmentCount,
    totalInterestCents,
    grandTotalCents,
    schedule,
  };

  appendTaxMemoryPipeline(memory, {
    inputDetail: {
      totalDebtCents: input.totalDebtCents,
      installmentCount: input.installmentCount,
      ruleParams: input.ruleParams ?? null,
      referenceDate: input.referenceDate ?? null,
    },
    ruleSetVersion: input.ruleSetVersion,
    indexConfigured: true,
    period: input.period,
    intermediateDetail: {
      installmentInterestBasisPoints: interestBasisPoints ?? null,
      totalInterestCents,
    },
    resultDetail: {
      grandTotalCents: result.grandTotalCents,
      installmentCount: result.installmentCount,
    },
    warningMessages: warnings,
  });

  return calculationEnvelope(result, {
    ruleSetVersion: input.ruleSetVersion,
    memory,
    warnings: [...new Set(warnings)],
    missingData,
  });
}
