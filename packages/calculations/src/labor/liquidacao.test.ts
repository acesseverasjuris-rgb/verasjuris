import { describe, expect, it } from "vitest";
import { calculateLiquidacao } from "./liquidacao.js";

describe("liquidacao", () => {
  it("agrega pedidos com correção/juros opcionais", () => {
    const result = calculateLiquidacao({
      ruleSetVersion: "liquidacao-v1",
      claims: [
        {
          key: "horas_extras",
          principalCents: 100_000,
          correctionCents: 10_000,
          interestCents: 5_000,
        },
        {
          key: "adicional_noturno",
          principalCents: 50_000,
          discountCents: 2_000,
          indexConfigured: false,
        },
      ],
    });

    expect(result.result.totalPrincipalCents).toBe(150_000);
    expect(result.result.totalCorrectionCents).toBe(10_000);
    expect(result.result.totalInterestCents).toBe(5_000);
    expect(result.result.totalDiscountsCents).toBe(2_000);
    expect(result.result.totalCents).toBe(163_000);
    expect(result.warnings).toContain("not_configured_index");
    expect(result.reviewHint).toBe("review_required");
  });
});
