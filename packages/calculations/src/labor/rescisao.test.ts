import { describe, expect, it } from "vitest";
import { TerminationCalculator } from "./rescisao.js";

describe("TerminationCalculator", () => {
  it("produz verbas a partir do rule set e marca review_required", () => {
    const calculator = new TerminationCalculator();
    const result = calculator.calculate({
      ruleSetVersion: "rescisao-v1",
      lastSalaryCents: 300_000,
      balanceSalaryCents: 50_000,
      fgtsBaseCents: 1_000_000,
      terminationDate: "2024-08-15",
      ruleParams: {
        thirteenthBasisPoints: 5_000,
        proportionalVacationBasisPoints: 5_000,
        vacationThirdBasisPoints: 3_333,
        noticeBasisPoints: 10_000,
        fgtsPenaltyBasisPoints: 4_000,
      },
    });

    expect(result.status).toBe("calculated");
    expect(result.reviewHint).toBe("review_required");
    expect(result.result.verbs.find((v) => v.key === "saldo_salario")?.amountCents).toBe(50_000);
    expect(
      result.result.verbs.find((v) => v.key === "decimo_terceiro_proporcional")?.amountCents,
    ).toBe(150_000);
    expect(result.result.verbs.find((v) => v.key === "aviso_indenizado")?.amountCents).toBe(
      300_000,
    );
    expect(result.result.verbs.find((v) => v.key === "multa_fgts")?.amountCents).toBe(400_000);
    expect(result.result.totalCents).toBeGreaterThan(0);
  });
});
