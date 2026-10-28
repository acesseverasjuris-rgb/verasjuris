import { describe, expect, it } from "vitest";
import { calculateTaxInstallment } from "./installment.js";
import { expectTaxMemoryPipeline } from "./test-helpers.js";

describe("calculateTaxInstallment", () => {
  const ruleSetVersion = "tax-installment-v1";

  it("divide dívida e aplica juros de parcelamento", () => {
    const result = calculateTaxInstallment({
      ruleSetVersion,
      totalDebtCents: 100_000,
      installmentCount: 4,
      ruleParams: { installmentInterestBasisPoints: 1_000 },
    });
    expect(result.result.totalInterestCents).toBe(10_000);
    expect(result.result.grandTotalCents).toBe(110_000);
    expect(result.result.schedule).toHaveLength(4);
    const sumPrincipal = result.result.schedule.reduce(
      (acc, line) => acc + line.principalPortionCents,
      0,
    );
    expect(sumPrincipal).toBe(100_000);
    expectTaxMemoryPipeline(result);
  });

  it("reparte resto na última parcela", () => {
    const result = calculateTaxInstallment({
      ruleSetVersion,
      totalDebtCents: 100,
      installmentCount: 3,
      ruleParams: { installmentInterestBasisPoints: 0 },
    });
    const sum = result.result.schedule.reduce((acc, line) => acc + line.installmentTotalCents, 0);
    expect(sum).toBe(100);
  });

  it("rejeita parcelas zero", () => {
    expect(() =>
      calculateTaxInstallment({
        ruleSetVersion,
        totalDebtCents: 100,
        installmentCount: 0,
        ruleParams: { installmentInterestBasisPoints: 0 },
      }),
    ).toThrow(/inteiro positivo/);
  });

  it("rejeita dívida negativa", () => {
    expect(() =>
      calculateTaxInstallment({
        ruleSetVersion,
        totalDebtCents: -1,
        installmentCount: 2,
        ruleParams: { installmentInterestBasisPoints: 0 },
      }),
    ).toThrow(/inteiro não negativo/);
  });
});
