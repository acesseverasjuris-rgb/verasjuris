import { describe, expect, it } from "vitest";
import { calculateTaxCredit } from "./credit.js";
import { expectTaxMemoryPipeline } from "./test-helpers.js";

describe("calculateTaxCredit", () => {
  const ruleSetVersion = "tax-credit-v1";

  it("soma principal e correção", () => {
    const result = calculateTaxCredit({
      ruleSetVersion,
      creditKey: "pis_cofins",
      principalCents: 200_000,
      correctionCents: 12_000,
    });
    expect(result.result.totalCreditCents).toBe(212_000);
    expectTaxMemoryPipeline(result);
  });

  it("zero principal com correção zero explícita", () => {
    const result = calculateTaxCredit({
      ruleSetVersion,
      creditKey: "z",
      principalCents: 0,
      correctionCents: 0,
    });
    expect(result.result.totalCreditCents).toBe(0);
  });

  it("índice não configurado sem correção", () => {
    const result = calculateTaxCredit({
      ruleSetVersion,
      creditKey: "cred_a",
      principalCents: 50_000,
      indexConfigured: false,
    });
    expect(result.warnings).toContain("not_configured_index");
    expect(result.missingData).toContain("index:cred_a");
  });

  it("rejeita principal negativo", () => {
    expect(() =>
      calculateTaxCredit({
        ruleSetVersion,
        creditKey: "bad",
        principalCents: -100,
      }),
    ).toThrow(/inteiro não negativo/);
  });
});
