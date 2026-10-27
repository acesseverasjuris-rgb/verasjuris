import { describe, expect, it } from "vitest";
import { calculateFgtsEstimate, FGTS_ESTIMATE_LABEL } from "./fgts.js";

describe("fgts estimate wording", () => {
  it("estima por rate_bp e nunca chama saldo oficial", () => {
    const result = calculateFgtsEstimate({
      ruleSetVersion: "fgts-v1",
      baseCents: 1_000_000,
      rateBasisPoints: 800,
      informedDepositCents: 75_000,
    });

    expect(result.result.expectedCents).toBe(80_000);
    expect(result.result.differenceCents).toBe(5_000);
    expect(result.result.label).toBe(FGTS_ESTIMATE_LABEL);
    expect(result.result.label).toContain("não é saldo oficial");
    expect(result.result.label.toLowerCase()).not.toBe("saldo oficial");
    expect(result.warnings).toContain(FGTS_ESTIMATE_LABEL);
  });
});
