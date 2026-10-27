import {
  assertSafeNonNegativeInt,
  type CalculationEnvelope,
  type CalculationMemoryStep,
  calculationEnvelope,
  type MoneyCents,
} from "../types.js";

export type ArrearsMonthlyValue = {
  competence: string;
  principalCents: MoneyCents;
  /** Correção já calculada/informada em centavos; ausente se índice não configurado. */
  correctionCents?: MoneyCents;
  /** Juros já calculados/informados em centavos. */
  interestCents?: MoneyCents;
  deductionCents?: MoneyCents;
  indexConfigured?: boolean;
};

export type AtrasadosInput = {
  ruleSetVersion: string;
  startDate?: string;
  endDate?: string;
  monthlyValues: readonly ArrearsMonthlyValue[];
};

export type AtrasadosResult = {
  totalPrincipalCents: MoneyCents;
  totalCorrectionCents: MoneyCents;
  totalInterestCents: MoneyCents;
  totalDeductionsCents: MoneyCents;
  totalCents: MoneyCents;
  monthsCounted: number;
  monthsMissingIndex: number;
};

/**
 * Atrasados: soma partes conhecidas.
 * Índice ausente → warning `not_configured_index`; total ainda considera partes conhecidas.
 */
export function calculateAtrasados(input: AtrasadosInput): CalculationEnvelope<AtrasadosResult> {
  const memory: CalculationMemoryStep[] = [];
  const warnings: string[] = [];
  const missingData: string[] = [];

  let totalPrincipalCents = 0;
  let totalCorrectionCents = 0;
  let totalInterestCents = 0;
  let totalDeductionsCents = 0;
  let monthsMissingIndex = 0;

  for (const month of input.monthlyValues) {
    assertSafeNonNegativeInt(month.principalCents, `principalCents:${month.competence}`);
    totalPrincipalCents += month.principalCents;

    const indexConfigured = month.indexConfigured ?? month.correctionCents !== undefined;
    if (!indexConfigured) {
      monthsMissingIndex += 1;
      warnings.push("not_configured_index");
      missingData.push(`index:${month.competence}`);
      memory.push({
        key: "not_configured_index",
        description: "Índice de correção não configurado para a competência.",
        detail: { competence: month.competence },
      });
    }

    if (month.correctionCents !== undefined) {
      assertSafeNonNegativeInt(month.correctionCents, `correctionCents:${month.competence}`);
      totalCorrectionCents += month.correctionCents;
    }
    if (month.interestCents !== undefined) {
      assertSafeNonNegativeInt(month.interestCents, `interestCents:${month.competence}`);
      totalInterestCents += month.interestCents;
    }
    if (month.deductionCents !== undefined) {
      assertSafeNonNegativeInt(month.deductionCents, `deductionCents:${month.competence}`);
      totalDeductionsCents += month.deductionCents;
    }

    memory.push({
      key: "month_accumulated",
      description: "Competência acumulada nos atrasados.",
      detail: {
        competence: month.competence,
        principalCents: month.principalCents,
        correctionCents: month.correctionCents ?? null,
        interestCents: month.interestCents ?? null,
        deductionCents: month.deductionCents ?? null,
      },
    });
  }

  if (input.monthlyValues.length === 0) {
    missingData.push("monthlyValues");
  }

  const totalCents =
    totalPrincipalCents + totalCorrectionCents + totalInterestCents - totalDeductionsCents;

  memory.push({
    key: "atrasados_total",
    description: "Total de atrasados a partir das partes conhecidas.",
    detail: {
      totalPrincipalCents,
      totalCorrectionCents,
      totalInterestCents,
      totalDeductionsCents,
      totalCents,
      monthsMissingIndex,
    },
  });

  return calculationEnvelope(
    {
      totalPrincipalCents,
      totalCorrectionCents,
      totalInterestCents,
      totalDeductionsCents,
      totalCents,
      monthsCounted: input.monthlyValues.length,
      monthsMissingIndex,
    },
    {
      ruleSetVersion: input.ruleSetVersion,
      memory,
      warnings: [...new Set(warnings)],
      missingData,
    },
  );
}
