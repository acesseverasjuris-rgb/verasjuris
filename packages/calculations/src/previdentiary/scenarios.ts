import {
  assertSafeNonNegativeInt,
  type CalculationEnvelope,
  type CalculationMemoryStep,
  calculationEnvelope,
  type MoneyCents,
} from "../types.js";

export const HIGHEST_ESTIMATED_SCENARIO_LABEL =
  "Cenário com maior valor estimado entre os dados simulados." as const;

export type BenefitScenario = {
  id: string;
  benefitType: string;
  der?: string;
  ruleSetVersion?: string;
  eligibilityStatus?: string;
  estimatedRmiCents: MoneyCents;
  estimatedStart?: string;
  assumptions?: string[];
  missingData?: string[];
};

export type ScenariosInput = {
  ruleSetVersion: string;
  scenarios: readonly BenefitScenario[];
};

export type ScenariosComparisonResult = {
  scenariosSorted: BenefitScenario[];
  highestScenarioId: string | null;
  highestEstimatedRmiCents: MoneyCents | null;
  label: typeof HIGHEST_ESTIMATED_SCENARIO_LABEL | null;
};

/**
 * Compara cenários por estimatedRmiCents.
 * Nunca rotula como "melhor benefício definitivo".
 */
export function compareBenefitScenarios(
  input: ScenariosInput,
): CalculationEnvelope<ScenariosComparisonResult> {
  const memory: CalculationMemoryStep[] = [];
  const warnings: string[] = [];
  const missingData: string[] = [];

  for (const scenario of input.scenarios) {
    assertSafeNonNegativeInt(scenario.estimatedRmiCents, `estimatedRmiCents:${scenario.id}`);
  }

  if (input.scenarios.length === 0) {
    missingData.push("scenarios");
    return calculationEnvelope(
      {
        scenariosSorted: [],
        highestScenarioId: null,
        highestEstimatedRmiCents: null,
        label: null,
      },
      {
        ruleSetVersion: input.ruleSetVersion,
        memory,
        warnings,
        missingData,
      },
    );
  }

  const scenariosSorted = [...input.scenarios].sort(
    (a, b) => b.estimatedRmiCents - a.estimatedRmiCents,
  );
  const highest = scenariosSorted[0]!;

  memory.push({
    key: "scenario_ranking",
    description: "Cenários ordenados por RMI estimado (centavos).",
    detail: {
      order: scenariosSorted.map((s) => ({
        id: s.id,
        estimatedRmiCents: s.estimatedRmiCents,
      })),
    },
  });

  for (const scenario of input.scenarios) {
    if (scenario.missingData && scenario.missingData.length > 0) {
      missingData.push(...scenario.missingData.map((item) => `${scenario.id}:${item}`));
    }
  }

  warnings.push(
    "Comparação estimativa entre cenários simulados; não constitui recomendação automática de benefício.",
  );

  return calculationEnvelope(
    {
      scenariosSorted,
      highestScenarioId: highest.id,
      highestEstimatedRmiCents: highest.estimatedRmiCents,
      label: HIGHEST_ESTIMATED_SCENARIO_LABEL,
    },
    {
      ruleSetVersion: input.ruleSetVersion,
      memory,
      warnings,
      missingData,
    },
  );
}
