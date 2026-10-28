import { describe, expect, it } from "vitest";
import { calculatePenaltyInterest } from "./penalty-interest.js";
import { expectTaxMemoryPipeline } from "./test-helpers.js";

describe("calculatePenaltyInterest", () => {
  const ruleSetVersion = "tax-penalty-v1";

  it("aplica basis points com truncamento inteiro", () => {
    const result = calculatePenaltyInterest({
      ruleSetVersion,
      baseCents: 1_000_003,
      ruleParams: {
        penaltyBasisPoints: 2_000,
        interestBasisPoints: 1_000,
      },
    });
    expect(result.result.penaltyCents).toBe(200_000);
    expect(result.result.interestCents).toBe(100_000);
    expect(result.result.totalAccessoryCents).toBe(300_000);
    expectTaxMemoryPipeline(result);
  });

  it("zero base produz zero multa/juros", () => {
    const result = calculatePenaltyInterest({
      ruleSetVersion,
      baseCents: 0,
      ruleParams: { penaltyBasisPoints: 5_000, interestBasisPoints: 5_000 },
    });
    expect(result.result.totalAccessoryCents).toBe(0);
  });

  it("marca parâmetros ausentes em missingData", () => {
    const result = calculatePenaltyInterest({
      ruleSetVersion,
      baseCents: 10_000,
      ruleParams: {},
    });
    expect(result.missingData).toContain("ruleParams.penaltyBasisPoints");
    expect(result.missingData).toContain("ruleParams.interestBasisPoints");
  });

  it("rejeita base negativa", () => {
    expect(() =>
      calculatePenaltyInterest({
        ruleSetVersion,
        baseCents: -1,
        ruleParams: { penaltyBasisPoints: 100, interestBasisPoints: 100 },
      }),
    ).toThrow(/inteiro não negativo/);
  });

  it("valores grandes", () => {
    const result = calculatePenaltyInterest({
      ruleSetVersion,
      baseCents: 900_000_000_000,
      ruleParams: { penaltyBasisPoints: 100, interestBasisPoints: 100 },
    });
    expect(result.result.penaltyCents).toBe(9_000_000_000);
    expect(result.result.interestCents).toBe(9_000_000_000);
  });
});
