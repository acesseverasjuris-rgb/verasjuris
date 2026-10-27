import { describe, expect, it } from "vitest";
import { InitialMonthlyBenefitCalculator } from "./rmi.js";

describe("InitialMonthlyBenefitCalculator — cents", () => {
  const calculator = new InitialMonthlyBenefitCalculator();

  it("aplica coeficiente em basis points com truncamento inteiro", () => {
    const result = calculator.calculate({
      ruleSetVersion: "rmi-v1",
      baseCents: 100_033,
      coefficient: { kind: "basis_points", basisPoints: 6_000 },
      factors: { tempo: 1 },
    });

    expect(result.status).toBe("calculated");
    expect(result.reviewHint).toBe("review_required");
    // floor(100033 * 6000 / 10000) = 60019
    expect(result.result.rmiCents).toBe(60_019);
    expect(Number.isInteger(result.result.rmiCents)).toBe(true);
  });

  it("aplica coeficiente racional inteiro", () => {
    const result = calculator.calculate({
      ruleSetVersion: "rmi-v1",
      baseCents: 10_000,
      coefficient: { kind: "rational", numerator: 1, denominator: 3 },
    });
    expect(result.result.rmiCents).toBe(3_333);
    expect(result.missingData).toContain("factors");
  });
});
