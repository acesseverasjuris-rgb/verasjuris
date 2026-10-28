import {
  type CalculationEnvelope,
  type CalculationMemoryStep,
  calculationEnvelope,
} from "../types.js";
import {
  appendTaxMemoryPipeline,
  emptyTaxTotals,
  finalizeTaxTotals,
  sumTaxLine,
  type TaxMonetaryLine,
  type TaxPeriod,
} from "./types.js";

export type TaxUpdateInput = {
  ruleSetVersion: string;
  lines: readonly TaxMonetaryLine[];
  period?: TaxPeriod;
  referenceDate?: string;
};

export type TaxUpdateResult = {
  linesCounted: number;
} & import("./types.js").TaxMonetaryTotals;

/**
 * Atualização monetária: principal + correção + juros + multa informados ou parcialmente ausentes.
 */
export function calculateTaxUpdate(input: TaxUpdateInput): CalculationEnvelope<TaxUpdateResult> {
  const memory: CalculationMemoryStep[] = [];
  const warnings: string[] = [
    "Atualização estimativa a partir dos valores informados; não substitui cálculo fiscal oficial.",
  ];
  const missingData: string[] = [];
  const totals = emptyTaxTotals();

  if (input.lines.length === 0) {
    missingData.push("lines");
  }

  let anyIndexMissing = false;
  for (const line of input.lines) {
    const {
      warnings: lineWarnings,
      missingData: lineMissing,
      memoryExtras,
    } = sumTaxLine(line, totals);
    warnings.push(...lineWarnings);
    missingData.push(...lineMissing);
    if (lineMissing.some((m) => m.startsWith("index:"))) {
      anyIndexMissing = true;
    }
    memory.push(...memoryExtras);
  }

  finalizeTaxTotals(totals);

  appendTaxMemoryPipeline(memory, {
    inputDetail: {
      lines: input.lines,
      referenceDate: input.referenceDate ?? null,
    },
    ruleSetVersion: input.ruleSetVersion,
    indexConfigured: !anyIndexMissing && input.lines.length > 0,
    period: input.period,
    intermediateDetail: { perLineProcessed: input.lines.length },
    resultDetail: { ...totals, linesCounted: input.lines.length },
    warningMessages: [...new Set(warnings)],
  });

  return calculationEnvelope(
    { ...totals, linesCounted: input.lines.length },
    {
      ruleSetVersion: input.ruleSetVersion,
      memory,
      warnings: [...new Set(warnings)],
      missingData,
    },
  );
}
