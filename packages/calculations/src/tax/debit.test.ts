import { describe, expect, it } from "vitest";
import { calculateTaxDebit } from "./debit.js";
import { expectTaxMemoryPipeline } from "./test-helpers.js";

describe("calculateTaxDebit", () => {
  const ruleSetVersion = "tax-debit-v1";

  it("calcula débito líquido com abatimentos", () => {
    const result = calculateTaxDebit({
      ruleSetVersion,
      obligationKey: "icms_sp",
      lines: [
        {
          key: "principal",
          principalCents: 500_000,
          correctionCents: 25_000,
          interestCents: 10_000,
          penaltyCents: 5_000,
        },
      ],
      deductionsCents: 15_000,
    });

    expect(result.result.totalCents).toBe(540_000);
    expect(result.result.netDebitCents).toBe(525_000);
    expectTaxMemoryPipeline(result);
  });

  it("rejeita correção negativa", () => {
    expect(() =>
      calculateTaxDebit({
        ruleSetVersion,
        obligationKey: "x",
        lines: [{ key: "a", principalCents: 100, correctionCents: -1 }],
      }),
    ).toThrow(/inteiro não negativo/);
  });

  it("marca índice ausente em missingData", () => {
    const result = calculateTaxDebit({
      ruleSetVersion,
      obligationKey: "fed",
      lines: [{ key: "comp", principalCents: 1_000, indexConfigured: false }],
    });
    expect(result.missingData).toContain("index:comp");
    expect(result.warnings).toContain("not_configured_index");
  });

  it("grandes valores", () => {
    const result = calculateTaxDebit({
      ruleSetVersion,
      obligationKey: "big",
      lines: [{ key: "p", principalCents: 5_000_000_000_000 }],
    });
    expect(result.result.netDebitCents).toBe(5_000_000_000_000);
  });
});
