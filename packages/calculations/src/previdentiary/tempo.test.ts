import { describe, expect, it } from "vitest";
import { calculateContributionTime } from "./tempo.js";

describe("tempo de contribuição — overlap", () => {
  it("não conta dias sobrepostos em dobro e avisa concomitância", () => {
    const result = calculateContributionTime({
      ruleSetVersion: "tempo-v1",
      periods: [
        { id: "a", start: "2024-01-01", end: "2024-01-10", kind: "comum" },
        { id: "b", start: "2024-01-06", end: "2024-01-15", kind: "especial" },
      ],
    });

    // 01–10 = 10 dias; 11–15 = 5 dias novos → 15 únicos (não 20)
    expect(result.result.totalDaysCounted).toBe(15);
    expect(result.result.concurrentPeriodsDetected).toBe(true);
    expect(result.result.overlaps).toHaveLength(1);
    expect(result.result.overlaps[0]?.overlapDays).toBe(5);
    expect(result.warnings.some((w) => w.includes("concomitantes"))).toBe(true);
    expect(result.result.daysByKind.comum).toBe(10);
    expect(result.result.daysByKind.especial).toBe(5);
  });
});
