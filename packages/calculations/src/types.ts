/**
 * Contratos compartilhados dos motores de cálculo.
 * Valores monetários sempre em centavos inteiros. Sem float para dinheiro.
 */

export type CalculationMemoryStep = {
  key: string;
  description: string;
  detail?: Record<string, unknown>;
};

/** Status operacional do cálculo determinístico. */
export type CalculationStatus = "calculated";

/**
 * Hint de produto: resultados jurídicos calculados sempre exigem revisão humana.
 * calculated → review_required
 */
export type CalculationReviewHint = "review_required";

export type CalculationEnvelope<T> = {
  result: T;
  memory: CalculationMemoryStep[];
  warnings: string[];
  missingData: string[];
  ruleSetVersion: string;
  status: CalculationStatus;
  reviewHint: CalculationReviewHint;
};

export type YearMonth = `${number}${number}${number}${number}-${number}${number}`;

export type DateOnly = `${number}${number}${number}${number}-${number}${number}-${number}${number}`;

export type MoneyCents = number;

/** Coeficiente racional em inteiros (ex.: 60/100) ou basis points (10_000 = 100%). */
export type IntegerCoefficient =
  | { kind: "basis_points"; basisPoints: number }
  | { kind: "rational"; numerator: number; denominator: number };

export function emptyMemory(): CalculationMemoryStep[] {
  return [];
}

export function calculationEnvelope<T>(
  result: T,
  options: {
    ruleSetVersion: string;
    memory?: CalculationMemoryStep[];
    warnings?: string[];
    missingData?: string[];
  },
): CalculationEnvelope<T> {
  return {
    result,
    memory: options.memory ?? [],
    warnings: options.warnings ?? [],
    missingData: options.missingData ?? [],
    ruleSetVersion: options.ruleSetVersion,
    status: "calculated",
    reviewHint: "review_required",
  };
}

export function assertSafeNonNegativeInt(value: number, path: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Valor inválido em ${path}: informe inteiro não negativo.`);
  }
}

export function assertSafePositiveInt(value: number, path: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Valor inválido em ${path}: informe inteiro positivo.`);
  }
}

/** Aplica coeficiente inteiro sobre centavos com truncamento (sem float). */
export function applyIntegerCoefficient(
  baseCents: MoneyCents,
  coefficient: IntegerCoefficient,
): MoneyCents {
  assertSafeNonNegativeInt(baseCents, "baseCents");
  if (coefficient.kind === "basis_points") {
    assertSafeNonNegativeInt(coefficient.basisPoints, "coefficient.basisPoints");
    return Math.floor((baseCents * coefficient.basisPoints) / 10_000);
  }
  assertSafeNonNegativeInt(coefficient.numerator, "coefficient.numerator");
  assertSafePositiveInt(coefficient.denominator, "coefficient.denominator");
  return Math.floor((baseCents * coefficient.numerator) / coefficient.denominator);
}

/** Diferença inclusiva de dias entre datas AAAA-MM-DD (UTC). */
export function daysBetweenInclusive(start: string, end: string): number {
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  const endMs = Date.parse(`${end}T00:00:00.000Z`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
    return 0;
  }
  return Math.floor((endMs - startMs) / 86_400_000) + 1;
}

export function periodsOverlap(
  a: { start: string; end: string },
  b: { start: string; end: string },
): boolean {
  return a.start <= b.end && b.start <= a.end;
}
