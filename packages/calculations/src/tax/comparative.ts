import {
  assertSafeNonNegativeInt,
  type CalculationEnvelope,
  type CalculationMemoryStep,
  calculationEnvelope,
  type MoneyCents,
} from "../types.js";
import { appendTaxMemoryPipeline } from "./types.js";

export const LOWEST_TAX_SCENARIO_LABEL =
  "Cenário com menor débito líquido estimado entre os simulados." as const;

export type TaxScenario = {
  id: string;
  label: string;
  estimatedNetDebitCents: MoneyCents;
  assumptions?: string[];
  missingData?: string[];
};

export type TaxComparativeInput = {
  ruleSetVersion: string;
  scenarios: readonly TaxScenario[];
};

export type TaxComparativeResult = {
  scenariosSorted: TaxScenario[];
  lowestScenarioId: string | null;
  lowestNetDebitCents: MoneyCents | null;
  label: typeof LOWEST_TAX_SCENARIO_LABEL | null;
};

/**
 * Compara cenários tributários por débito líquido estimado informado.
 */
export function compareTaxScenarios(
  input: TaxComparativeInput,
): CalculationEnvelope<TaxComparativeResult> {
  const memory: CalculationMemoryStep[] = [];
  const warnings: string[] = [
    "Comparativo entre cenários simulados; não indica benefício fiscal definitivo.",
  ];
  const missingData: string[] = [];

  for (const scenario of input.scenarios) {
    assertSafeNonNegativeInt(
      scenario.estimatedNetDebitCents,
      `estimatedNetDebitCents:${scenario.id}`,
    );
  }

  if (input.scenarios.length === 0) {
    missingData.push("scenarios");
    appendTaxMemoryPipeline(memory, {
      inputDetail: { scenarios: [] },
      ruleSetVersion: input.ruleSetVersion,
      indexConfigured: true,
      intermediateDetail: {},
      resultDetail: {
        lowestScenarioId: null,
        lowestNetDebitCents: null,
      },
      warningMessages: warnings,
    });
    return calculationEnvelope(
      {
        scenariosSorted: [],
        lowestScenarioId: null,
        lowestNetDebitCents: null,
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
    (a, b) => a.estimatedNetDebitCents - b.estimatedNetDebitCents,
  );
  const lowest = scenariosSorted[0]!;

  appendTaxMemoryPipeline(memory, {
    inputDetail: { scenarioCount: input.scenarios.length },
    ruleSetVersion: input.ruleSetVersion,
    indexConfigured: true,
    intermediateDetail: {
      order: scenariosSorted.map((s) => ({
        id: s.id,
        estimatedNetDebitCents: s.estimatedNetDebitCents,
      })),
    },
    resultDetail: {
      lowestScenarioId: lowest.id,
      lowestNetDebitCents: lowest.estimatedNetDebitCents,
      label: LOWEST_TAX_SCENARIO_LABEL,
    },
    warningMessages: warnings,
  });

  return calculationEnvelope(
    {
      scenariosSorted,
      lowestScenarioId: lowest.id,
      lowestNetDebitCents: lowest.estimatedNetDebitCents,
      label: LOWEST_TAX_SCENARIO_LABEL,
    },
    {
      ruleSetVersion: input.ruleSetVersion,
      memory,
      warnings,
      missingData,
    },
  );
}
