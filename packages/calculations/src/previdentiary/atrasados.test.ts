import { describe, expect, it } from "vitest";
import { calculateAtrasados } from "./atrasados.js";

describe("atrasados", () => {
  it("soma partes conhecidas e avisa índice não configurado", () => {
    const result = calculateAtrasados({
      ruleSetVersion: "atrasados-v1",
      monthlyValues: [
        {
          competence: "2024-01",
          principalCents: 100_000,
          correctionCents: 5_000,
          interestCents: 1_000,
        },
        {
          competence: "2024-02",
          principalCents: 100_000,
          indexConfigured: false,
        },
      ],
    });

    expect(result.result.totalPrincipalCents).toBe(200_000);
    expect(result.result.totalCorrectionCents).toBe(5_000);
    expect(result.result.totalInterestCents).toBe(1_000);
    expect(result.result.totalCents).toBe(206_000);
    expect(result.result.monthsMissingIndex).toBe(1);
    expect(result.warnings).toContain("not_configured_index");
    expect(result.missingData).toContain("index:2024-02");
  });
});
