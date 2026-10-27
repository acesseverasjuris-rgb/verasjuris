import { describe, expect, it } from "vitest";
import { calculateCarencia } from "./carencia.js";

describe("carencia", () => {
  it("conta meses válidos, aplica exclusões e rejeita duplicatas", () => {
    const result = calculateCarencia({
      ruleSetVersion: "carencia-v1",
      requiredMonths: 12,
      competences: [
        { competence: "2023-01" },
        { competence: "2023-02" },
        { competence: "2023-02" },
        { competence: "2023-03", excluded: true, exclusionReason: "baixo valor" },
        { competence: "2023-04" },
      ],
    });

    expect(result.status).toBe("calculated");
    expect(result.reviewHint).toBe("review_required");
    expect(result.ruleSetVersion).toBe("carencia-v1");
    expect(result.result.validMonths).toBe(3);
    expect(result.result.countedCompetences).toEqual(["2023-01", "2023-02", "2023-04"]);
    expect(result.result.excludedCompetences).toEqual(["2023-03"]);
    expect(result.result.duplicateCompetences).toEqual(["2023-02"]);
    expect(result.result.carenciaMet).toBe(false);
    expect(result.warnings.some((w) => w.includes("duplicada"))).toBe(true);
    expect(result.memory.some((step) => step.key === "counted_competence")).toBe(true);
  });

  it("marca missingData quando requiredMonths ausente", () => {
    const result = calculateCarencia({
      ruleSetVersion: "carencia-v1",
      competences: [{ competence: "2024-01" }],
    });
    expect(result.missingData).toContain("requiredMonths");
    expect(result.result.carenciaMet).toBeNull();
  });
});
