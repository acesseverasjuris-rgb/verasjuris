import { expect } from "vitest";
import type { CalculationEnvelope } from "../types.js";

const PIPELINE_KEYS = ["INPUT", "RULE_SET", "INDEX", "RESULT", "WARNINGS"] as const;

export function expectTaxMemoryPipeline(envelope: CalculationEnvelope<unknown>): void {
  const keys = envelope.memory.map((s) => s.key);
  for (const required of PIPELINE_KEYS) {
    expect(keys).toContain(required);
  }
}

export function memoryKeys(envelope: CalculationEnvelope<unknown>): string[] {
  return envelope.memory.map((s) => s.key);
}
