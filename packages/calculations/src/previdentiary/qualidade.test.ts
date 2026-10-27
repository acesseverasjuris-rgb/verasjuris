import { describe, expect, it } from "vitest";
import { InsuredStatusCalculator } from "./qualidade.js";

describe("InsuredStatusCalculator", () => {
  const calculator = new InsuredStatusCalculator();

  it("mantém qualidade dentro do período contributivo", () => {
    const result = calculator.calculate({
      ruleSetVersion: "qualidade-v1",
      category: "empregado",
      referenceDate: "2024-06-01",
      contributions: [{ start: "2023-01-01", end: "2024-06-15" }],
      ruleParams: { gracePeriodMonths: 12 },
    });

    expect(result.status).toBe("calculated");
    expect(result.reviewHint).toBe("review_required");
    expect(result.result.status).toBe("maintained");
    expect(result.result.lastQualifyingDate).toBe("2024-06-15");
    expect(result.result.gracePeriod.months).toBe(12);
    expect(result.result.reasoning.length).toBeGreaterThan(0);
  });

  it("identifica período de graça e perda", () => {
    const inGrace = calculator.calculate({
      ruleSetVersion: "qualidade-v1",
      referenceDate: "2024-06-01",
      contributions: [{ start: "2022-01-01", end: "2023-12-31" }],
      ruleParams: { gracePeriodMonths: 12 },
    });
    expect(inGrace.result.status).toBe("in_grace_period");
    expect(inGrace.result.gracePeriod.endsOn).toBe("2024-12-31");

    const lost = calculator.calculate({
      ruleSetVersion: "qualidade-v1",
      referenceDate: "2025-01-01",
      contributions: [{ start: "2022-01-01", end: "2023-12-31" }],
      ruleParams: { gracePeriodMonths: 12 },
    });
    expect(lost.result.status).toBe("lost");
  });

  it("retorna never_acquired sem contribuições", () => {
    const result = calculator.calculate({
      ruleSetVersion: "qualidade-v1",
      referenceDate: "2024-01-01",
      contributions: [],
      ruleParams: { gracePeriodMonths: 6 },
    });
    expect(result.result.status).toBe("never_acquired");
    expect(result.missingData).toContain("contributions");
  });
});
