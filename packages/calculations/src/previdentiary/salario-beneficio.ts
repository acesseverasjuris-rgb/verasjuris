import {
  assertSafeNonNegativeInt,
  type CalculationEnvelope,
  type CalculationMemoryStep,
  calculationEnvelope,
  type MoneyCents,
} from "../types.js";

export type SalaryCompetence = {
  competence: string;
  salaryCents: MoneyCents;
  excluded?: boolean;
  exclusionReason?: string;
  /** Índice aplicado (inteiro em basis points relativos a 10_000 = 1.0000). Ausente → sem correção inventada. */
  indexBasisPoints?: number;
};

export type SalarioBeneficioInput = {
  ruleSetVersion: string;
  salaries: readonly SalaryCompetence[];
};

export type SalarioBeneficioResult = {
  usedSalariesCents: MoneyCents[];
  usedCompetences: string[];
  excludedCompetences: string[];
  correctedSalariesCents: MoneyCents[];
  averageCents: MoneyCents;
  salariesCount: number;
};

/**
 * Média de salários em centavos com exclusões.
 * Índices ausentes → warning; não inventa correção.
 */
export function calculateSalarioBeneficio(
  input: SalarioBeneficioInput,
): CalculationEnvelope<SalarioBeneficioResult> {
  const memory: CalculationMemoryStep[] = [];
  const warnings: string[] = [];
  const missingData: string[] = [];

  const usedSalariesCents: MoneyCents[] = [];
  const usedCompetences: string[] = [];
  const excludedCompetences: string[] = [];
  const correctedSalariesCents: MoneyCents[] = [];
  let missingIndexes = 0;

  for (const item of input.salaries) {
    assertSafeNonNegativeInt(item.salaryCents, `salaryCents:${item.competence}`);
    if (item.excluded) {
      excludedCompetences.push(item.competence);
      memory.push({
        key: "excluded_salary",
        description: item.exclusionReason ?? "Salário excluído da média.",
        detail: { competence: item.competence, salaryCents: item.salaryCents },
      });
      continue;
    }

    usedCompetences.push(item.competence);
    usedSalariesCents.push(item.salaryCents);

    let corrected = item.salaryCents;
    if (item.indexBasisPoints === undefined) {
      missingIndexes += 1;
      memory.push({
        key: "missing_index",
        description: "Índice ausente; salário utilizado sem correção inventada.",
        detail: { competence: item.competence, salaryCents: item.salaryCents },
      });
    } else {
      assertSafeNonNegativeInt(item.indexBasisPoints, `indexBasisPoints:${item.competence}`);
      corrected = Math.floor((item.salaryCents * item.indexBasisPoints) / 10_000);
      memory.push({
        key: "corrected_salary",
        description: "Salário corrigido por índice informado (basis points).",
        detail: {
          competence: item.competence,
          salaryCents: item.salaryCents,
          indexBasisPoints: item.indexBasisPoints,
          correctedCents: corrected,
        },
      });
    }
    correctedSalariesCents.push(corrected);
  }

  if (missingIndexes > 0) {
    warnings.push("missing indexes");
    missingData.push("indexes");
  }

  if (correctedSalariesCents.length === 0) {
    missingData.push("salaries");
    memory.push({
      key: "no_salaries",
      description: "Nenhum salário válido para média.",
    });
    return calculationEnvelope(
      {
        usedSalariesCents,
        usedCompetences,
        excludedCompetences,
        correctedSalariesCents,
        averageCents: 0,
        salariesCount: 0,
      },
      {
        ruleSetVersion: input.ruleSetVersion,
        memory,
        warnings,
        missingData,
      },
    );
  }

  const sum = correctedSalariesCents.reduce((acc, value) => acc + value, 0);
  const averageCents = Math.floor(sum / correctedSalariesCents.length);
  memory.push({
    key: "average",
    description: "Média aritmética truncada dos salários corrigidos (centavos).",
    detail: { sum, count: correctedSalariesCents.length, averageCents },
  });

  return calculationEnvelope(
    {
      usedSalariesCents,
      usedCompetences,
      excludedCompetences,
      correctedSalariesCents,
      averageCents,
      salariesCount: correctedSalariesCents.length,
    },
    {
      ruleSetVersion: input.ruleSetVersion,
      memory,
      warnings,
      missingData,
    },
  );
}
