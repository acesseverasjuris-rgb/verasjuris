import {
  applyIntegerCoefficient,
  assertSafeNonNegativeInt,
  type CalculationMemoryStep,
  type DateOnly,
  type IntegerCoefficient,
  type MoneyCents,
} from "../types.js";

export type TaxPeriod = {
  startDate?: DateOnly;
  endDate?: DateOnly;
  competence?: string;
};

/** Parâmetros do rule set — taxas em basis points (10_000 = 100%). Sem alíquotas oficiais embutidas. */
export type TaxRuleParams = {
  penaltyBasisPoints?: number;
  interestBasisPoints?: number;
  correctionBasisPoints?: number;
  installmentInterestBasisPoints?: number;
};

export type TaxMonetaryLine = {
  key: string;
  principalCents: MoneyCents;
  correctionCents?: MoneyCents;
  interestCents?: MoneyCents;
  penaltyCents?: MoneyCents;
  indexConfigured?: boolean;
  indexKey?: string;
};

export type TaxMonetaryTotals = {
  totalPrincipalCents: MoneyCents;
  totalCorrectionCents: MoneyCents;
  totalInterestCents: MoneyCents;
  totalPenaltyCents: MoneyCents;
  totalCents: MoneyCents;
};

export type TaxMemoryContext = {
  inputDetail: Record<string, unknown>;
  ruleSetVersion: string;
  indexKey?: string;
  indexConfigured: boolean;
  period?: TaxPeriod;
  intermediateDetail: Record<string, unknown>;
  resultDetail: Record<string, unknown>;
  warningMessages: readonly string[];
};

export function sumTaxLine(
  line: TaxMonetaryLine,
  totals: TaxMonetaryTotals,
): { warnings: string[]; missingData: string[]; memoryExtras: CalculationMemoryStep[] } {
  const warnings: string[] = [];
  const missingData: string[] = [];
  const memoryExtras: CalculationMemoryStep[] = [];

  assertSafeNonNegativeInt(line.principalCents, `principalCents:${line.key}`);
  totals.totalPrincipalCents += line.principalCents;

  const indexKey = line.indexKey ?? line.key;
  const indexConfigured = line.indexConfigured ?? line.correctionCents !== undefined;
  if (!indexConfigured) {
    warnings.push("not_configured_index");
    missingData.push(`index:${indexKey}`);
    memoryExtras.push({
      key: "INDEX",
      description: "Índice de correção não configurado.",
      detail: { indexKey, lineKey: line.key },
    });
  }

  if (line.correctionCents !== undefined) {
    assertSafeNonNegativeInt(line.correctionCents, `correctionCents:${line.key}`);
    totals.totalCorrectionCents += line.correctionCents;
  }
  if (line.interestCents !== undefined) {
    assertSafeNonNegativeInt(line.interestCents, `interestCents:${line.key}`);
    totals.totalInterestCents += line.interestCents;
  }
  if (line.penaltyCents !== undefined) {
    assertSafeNonNegativeInt(line.penaltyCents, `penaltyCents:${line.key}`);
    totals.totalPenaltyCents += line.penaltyCents;
  }

  return { warnings, missingData, memoryExtras };
}

export function finalizeTaxTotals(totals: TaxMonetaryTotals): void {
  totals.totalCents =
    totals.totalPrincipalCents +
    totals.totalCorrectionCents +
    totals.totalInterestCents +
    totals.totalPenaltyCents;
}

export function emptyTaxTotals(): TaxMonetaryTotals {
  return {
    totalPrincipalCents: 0,
    totalCorrectionCents: 0,
    totalInterestCents: 0,
    totalPenaltyCents: 0,
    totalCents: 0,
  };
}

export function appendTaxMemoryPipeline(
  memory: CalculationMemoryStep[],
  ctx: TaxMemoryContext,
): void {
  memory.push({
    key: "INPUT",
    description: "Parâmetros informados para o cálculo tributário.",
    detail: ctx.inputDetail,
  });
  memory.push({
    key: "RULE_SET",
    description: "Conjunto de regras versionado aplicado.",
    detail: { ruleSetVersion: ctx.ruleSetVersion },
  });
  memory.push({
    key: "INDEX",
    description: ctx.indexConfigured
      ? "Índice de correção considerado configurado."
      : "Índice de correção ausente ou não configurado.",
    detail: {
      indexKey: ctx.indexKey ?? null,
      indexConfigured: ctx.indexConfigured,
    },
  });
  if (ctx.period) {
    memory.push({
      key: "PERIOD",
      description: "Período ou competência de referência.",
      detail: { ...ctx.period },
    });
  }
  memory.push({
    key: "INTERMEDIATE",
    description: "Valores intermediários do cálculo.",
    detail: ctx.intermediateDetail,
  });
  memory.push({
    key: "RESULT",
    description: "Resultado determinístico (centavos inteiros).",
    detail: ctx.resultDetail,
  });
  if (ctx.warningMessages.length > 0) {
    memory.push({
      key: "WARNINGS",
      description: "Avisos operacionais e jurídicos.",
      detail: { messages: [...ctx.warningMessages] },
    });
  }
}

export function applyBasisPointsFromRule(
  baseCents: MoneyCents,
  basisPoints: number | undefined,
  path: string,
): MoneyCents {
  if (basisPoints === undefined) {
    return 0;
  }
  assertSafeNonNegativeInt(basisPoints, path);
  return applyIntegerCoefficient(baseCents, {
    kind: "basis_points",
    basisPoints,
  } satisfies IntegerCoefficient);
}
