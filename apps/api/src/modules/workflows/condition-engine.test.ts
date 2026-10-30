import { describe, expect, it } from "vitest";
import { assertSafeConditionTree, evaluateCondition } from "./condition-engine.js";

describe("workflow condition-engine", () => {
  it("evaluates equals / not_equals / exists", () => {
    const payload = { status: "open", amount: 10 };
    expect(evaluateCondition({ operator: "equals", field: "status", value: "open" }, payload)).toBe(
      true,
    );
    expect(
      evaluateCondition({ operator: "not_equals", field: "status", value: "closed" }, payload),
    ).toBe(true);
    expect(evaluateCondition({ operator: "exists", field: "amount" }, payload)).toBe(true);
    expect(evaluateCondition({ operator: "not_exists", field: "missing" }, payload)).toBe(true);
  });

  it("evaluates in / comparisons / and / or", () => {
    const payload = { status: "active", score: 8 };
    expect(
      evaluateCondition({ operator: "in", field: "status", value: ["active", "trial"] }, payload),
    ).toBe(true);
    expect(evaluateCondition({ operator: "greater_than", field: "score", value: 5 }, payload)).toBe(
      true,
    );
    expect(
      evaluateCondition(
        {
          operator: "and",
          children: [
            { operator: "equals", field: "status", value: "active" },
            { operator: "less_than", field: "score", value: 10 },
          ],
        },
        payload,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        {
          operator: "or",
          children: [
            { operator: "equals", field: "status", value: "closed" },
            { operator: "equals", field: "status", value: "active" },
          ],
        },
        payload,
      ),
    ).toBe(true);
  });

  it("rejects unsafe field paths", () => {
    expect(() =>
      assertSafeConditionTree({ operator: "equals", field: "status;drop", value: 1 }),
    ).toThrow();
  });

  it("does not use eval", () => {
    const src = evaluateCondition.toString();
    expect(src).not.toMatch(/\beval\s*\(/);
    expect(src).not.toMatch(/new Function/);
  });
});
