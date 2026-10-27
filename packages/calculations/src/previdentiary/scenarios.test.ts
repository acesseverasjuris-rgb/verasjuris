import { describe, expect, it } from "vitest";
import { compareBenefitScenarios, HIGHEST_ESTIMATED_SCENARIO_LABEL } from "./scenarios.js";

describe("benefit scenarios label", () => {
  it("usa rótulo estimativo e nunca 'melhor benefício definitivo'", () => {
    const result = compareBenefitScenarios({
      ruleSetVersion: "scenarios-v1",
      scenarios: [
        { id: "a", benefitType: "aposentadoria", estimatedRmiCents: 200_000 },
        { id: "b", benefitType: "auxilio", estimatedRmiCents: 350_000 },
        { id: "c", benefitType: "pensao", estimatedRmiCents: 150_000 },
      ],
    });

    expect(result.result.highestScenarioId).toBe("b");
    expect(result.result.highestEstimatedRmiCents).toBe(350_000);
    expect(result.result.label).toBe(HIGHEST_ESTIMATED_SCENARIO_LABEL);
    expect(result.result.label).toBe("Cenário com maior valor estimado entre os dados simulados.");
    expect(JSON.stringify(result)).not.toMatch(/melhor benefício definitivo/i);
    expect(result.result.scenariosSorted.map((s) => s.id)).toEqual(["b", "a", "c"]);
  });
});
