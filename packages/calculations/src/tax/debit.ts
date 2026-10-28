import {
  assertSafeNonNegativeInt,
  type CalculationEnvelope,
  type CalculationMemoryStep,
  calculationEnvelope,
  type MoneyCents,
} from "../types.js";
import {
  appendTaxMemoryPipeline,
  emptyTaxTotals,
  finalizeTaxTotals,
  sumTaxLine,
  type TaxMonetaryLine,
  type TaxPeriod,
} from "./types.js";

export type TaxDebitInput = {
  ruleSetVersion: string;
  obligationKey: string;
  lines: readonly TaxMonetaryLine[];
  period?: TaxPeriod;
  deductionsCents?: MoneyCents;
  referenceDate?: string;
};

export type TaxDebitResult = {
  obligationKey: string;
  totalDeductionsCents: MoneyCents;
  netDebitCents: MoneyCents;
} & import("./types.js").TaxMonetaryTotals;

/**
 * Débito tributário: soma componentes e aplica abatimentos informados.
 */
export function calculateTaxDebit(input: TaxDebitInput): CalculationEnvelope<TaxDebitResult> {
  const memory: CalculationMemoryStep[] = [];
  const warnings: string[] = ["Débito estimativo; confirme com lançamento e certidão oficiais."];
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

  const totalDeductionsCents = input.deductionsCents ?? 0;
  if (input.deductionsCents !== undefined) {
    assertSafeNonNegativeInt(input.deductionsCents, "deductionsCents");
  }
  const netDebitCents = totals.totalCents - totalDeductionsCents;

  appendTaxMemoryPipeline(memory, {
    inputDetail: {
      obligationKey: input.obligationKey,
      lines: input.lines,
      deductionsCents: input.deductionsCents ?? null,
      referenceDate: input.referenceDate ?? null,
    },
    ruleSetVersion: input.ruleSetVersion,
    indexConfigured: !anyIndexMissing && input.lines.length > 0,
    indexKey: input.obligationKey,
    period: input.period,
    intermediateDetail: {
      grossTotalCents: totals.totalCents,
      totalDeductionsCents,
    },
    resultDetail: {
      obligationKey: input.obligationKey,
      netDebitCents,
      ...totals,
      totalDeductionsCents,
    },
    warningMessages: warnings,
  });

  return calculationEnvelope(
    {
      obligationKey: input.obligationKey,
      ...totals,
      totalDeductionsCents,
      netDebitCents,
    },
    {
      ruleSetVersion: input.ruleSetVersion,
      memory,
      warnings: [...new Set(warnings)],
      missingData,
    },
  );
}
