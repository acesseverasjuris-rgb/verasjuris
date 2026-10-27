import { describe, expect, it } from "vitest";
import { calculateJornada } from "./jornada.js";

describe("jornada — overtime", () => {
  it("soma minutos de hora extra e avisa sobreposição", () => {
    const result = calculateJornada({
      ruleSetVersion: "jornada-v1",
      records: [
        { id: "n1", startMinute: 480, endMinute: 720, kind: "normal" },
        { id: "e1", startMinute: 720, endMinute: 780, kind: "overtime" },
        { id: "e2", startMinute: 750, endMinute: 810, kind: "overtime" },
        { id: "i1", startMinute: 720, endMinute: 780, kind: "interval" },
        { id: "night", startMinute: 1320, endMinute: 1440, kind: "night" },
      ],
    });

    expect(result.result.normalMinutes).toBe(240);
    expect(result.result.overtimeMinutes).toBe(120);
    expect(result.result.intervalMinutes).toBe(60);
    expect(result.result.nightMinutes).toBe(120);
    expect(result.result.overlapWarnings.length).toBeGreaterThan(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
