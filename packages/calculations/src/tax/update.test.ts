import { describe, expect, it } from "vitest";
import { calculateTaxUpdate } from "./update.js";
import { expectTaxMemoryPipeline } from "./test-helpers.js";

describe("calculateTaxUpdate", () => {
  const ruleSetVersion = "tax-update-v1";

  it("agrega principal, correção, juros e multa com precisão", () => {
    const result = calculateTaxUpdate({
      ruleSetVersion,
      lines: [
        {
          key: "principal_2024",
          principalCents: 1_000_000,
          correctionCents: 100_000,
          interestCents: 50_000,
          penaltyCents: 20_000,
        },
      ],
    });

    expect(result.result.totalPrincipalCents).toBe(1_000_000);
    expect(result.result.totalCorrectionCents).toBe(100_000);
    expect(result.result.totalInterestCents).toBe(50_000);
    expect(result.result.totalPenaltyCents).toBe(20_000);
    expect(result.result.totalCents).toBe(1_170_000);
    expect(result.reviewHint).toBe("review_required");
    expectTaxMemoryPipeline(result);
  });

  it("suporta valores grandes sem float", () => {
    const result = calculateTaxUpdate({
      ruleSetVersion,
      lines: [{ key: "large", principalCents: 9_007_199_254_740_000, correctionCents: 0 }],
    });
    expect(result.result.totalCents).toBe(9_007_199_254_740_000);
  });

  it("aceita zero em componentes opcionais", () => {
    const result = calculateTaxUpdate({
      ruleSetVersion,
      lines: [
        {
          key: "zero_parts",
          principalCents: 0,
          correctionCents: 0,
          interestCents: 0,
          penaltyCents: 0,
        },
      ],
    });
    expect(result.result.totalCents).toBe(0);
  });

  it("rejeita principal negativo", () => {
    expect(() =>
      calculateTaxUpdate({
        ruleSetVersion,
        lines: [{ key: "bad", principalCents: -1 }],
      }),
    ).toThrow(/inteiro não negativo/);
  });

  it("avisa índice não configurado", () => {
    const result = calculateTaxUpdate({
      ruleSetVersion,
      lines: [{ key: "sem_indice", principalCents: 10_000, indexConfigured: false }],
    });
    expect(result.warnings).toContain("not_configured_index");
    expect(result.missingData).toContain("index:sem_indice");
    expect(result.memory.some((s) => s.key === "INDEX")).toBe(true);
  });
});
