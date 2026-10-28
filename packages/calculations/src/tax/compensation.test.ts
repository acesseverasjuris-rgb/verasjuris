import { describe, expect, it } from "vitest";
import { calculateTaxCompensation } from "./compensation.js";
import { expectTaxMemoryPipeline } from "./test-helpers.js";

describe("calculateTaxCompensation", () => {
  const ruleSetVersion = "tax-comp-v1";

  it("compensa pelo mínimo entre crédito e débito", () => {
    const result = calculateTaxCompensation({
      ruleSetVersion,
      sourceCreditKey: "cred_pis",
      destinationDebitKey: "deb_cofins",
      availableCreditCents: 400_000,
      debitDueCents: 250_000,
    });
    expect(result.result.compensatedCents).toBe(250_000);
    expect(result.result.remainingCreditCents).toBe(150_000);
    expect(result.result.remainingDebitCents).toBe(0);
    expectTaxMemoryPipeline(result);
  });

  it("crédito menor que débito", () => {
    const result = calculateTaxCompensation({
      ruleSetVersion,
      sourceCreditKey: "a",
      destinationDebitKey: "b",
      availableCreditCents: 50_000,
      debitDueCents: 1_000_000,
    });
    expect(result.result.compensatedCents).toBe(50_000);
    expect(result.result.remainingDebitCents).toBe(950_000);
  });

  it("zero em ambos", () => {
    const result = calculateTaxCompensation({
      ruleSetVersion,
      sourceCreditKey: "a",
      destinationDebitKey: "b",
      availableCreditCents: 0,
      debitDueCents: 0,
    });
    expect(result.result.compensatedCents).toBe(0);
  });

  it("rejeita débito negativo", () => {
    expect(() =>
      calculateTaxCompensation({
        ruleSetVersion,
        sourceCreditKey: "a",
        destinationDebitKey: "b",
        availableCreditCents: 100,
        debitDueCents: -1,
      }),
    ).toThrow(/inteiro não negativo/);
  });
});
