import { describe, expect, it } from "vitest";
import { calculateTaxRefund } from "./refund.js";
import { expectTaxMemoryPipeline } from "./test-helpers.js";

describe("calculateTaxRefund", () => {
  const ruleSetVersion = "tax-refund-v1";

  it("aprova pedido dentro do crédito", () => {
    const result = calculateTaxRefund({
      ruleSetVersion,
      creditKey: "irrf",
      availableCreditCents: 300_000,
      requestedRefundCents: 250_000,
    });
    expect(result.result.approvedRefundCents).toBe(250_000);
    expect(result.result.remainingCreditCents).toBe(50_000);
    expect(result.result.cappedByAvailable).toBe(false);
    expectTaxMemoryPipeline(result);
  });

  it("limita pedido ao crédito disponível", () => {
    const result = calculateTaxRefund({
      ruleSetVersion,
      creditKey: "irrf",
      availableCreditCents: 100_000,
      requestedRefundCents: 500_000,
    });
    expect(result.result.approvedRefundCents).toBe(100_000);
    expect(result.result.cappedByAvailable).toBe(true);
    expect(result.warnings).toContain("refund_capped_by_available_credit");
  });

  it("zero pedido", () => {
    const result = calculateTaxRefund({
      ruleSetVersion,
      creditKey: "x",
      availableCreditCents: 10_000,
      requestedRefundCents: 0,
    });
    expect(result.result.approvedRefundCents).toBe(0);
  });

  it("rejeita crédito negativo", () => {
    expect(() =>
      calculateTaxRefund({
        ruleSetVersion,
        creditKey: "bad",
        availableCreditCents: -1,
        requestedRefundCents: 0,
      }),
    ).toThrow(/inteiro não negativo/);
  });
});
