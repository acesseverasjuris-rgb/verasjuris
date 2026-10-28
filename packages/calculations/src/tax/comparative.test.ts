import { describe, expect, it } from "vitest";
import { compareTaxScenarios, LOWEST_TAX_SCENARIO_LABEL } from "./comparative.js";
import { expectTaxMemoryPipeline } from "./test-helpers.js";

describe("compareTaxScenarios", () => {
  const ruleSetVersion = "tax-comp-scenario-v1";

  it("ordena cenários pelo menor débito", () => {
    const result = compareTaxScenarios({
      ruleSetVersion,
      scenarios: [
        { id: "a", label: "Cenário A", estimatedNetDebitCents: 500_000 },
        { id: "b", label: "Cenário B", estimatedNetDebitCents: 200_000 },
        { id: "c", label: "Cenário C", estimatedNetDebitCents: 800_000 },
      ],
    });
    expect(result.result.lowestScenarioId).toBe("b");
    expect(result.result.lowestNetDebitCents).toBe(200_000);
    expect(result.result.label).toBe(LOWEST_TAX_SCENARIO_LABEL);
    expect(result.result.scenariosSorted[0]?.id).toBe("b");
    expectTaxMemoryPipeline(result);
  });

  it("lista vazia", () => {
    const result = compareTaxScenarios({ ruleSetVersion, scenarios: [] });
    expect(result.result.lowestScenarioId).toBeNull();
    expect(result.missingData).toContain("scenarios");
  });

  it("rejeita débito estimado negativo", () => {
    expect(() =>
      compareTaxScenarios({
        ruleSetVersion,
        scenarios: [{ id: "bad", label: "x", estimatedNetDebitCents: -1 }],
      }),
    ).toThrow(/inteiro não negativo/);
  });
});
