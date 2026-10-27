import { describe, expect, it } from "vitest";
import { AppError } from "@verasjuris/types";
import { assertIntakeTransition, assertTriageTransition } from "./intake-state.js";

describe("intake state machine", () => {
  it("permite open → triage", () => {
    expect(() => assertIntakeTransition("open", "triage")).not.toThrow();
  });

  it("bloqueia archived → open", () => {
    expect(() => assertIntakeTransition("archived", "open")).toThrow(AppError);
  });

  it("permite converted → closed", () => {
    expect(() => assertIntakeTransition("converted", "closed")).not.toThrow();
  });
});

describe("triage state machine", () => {
  it("permite draft → in_progress", () => {
    expect(() => assertTriageTransition("draft", "in_progress")).not.toThrow();
  });

  it("bloqueia closed → reviewed", () => {
    expect(() => assertTriageTransition("closed", "reviewed")).toThrow(AppError);
  });

  it("permite ready_for_analysis → reviewed", () => {
    expect(() => assertTriageTransition("ready_for_analysis", "reviewed")).not.toThrow();
  });
});
