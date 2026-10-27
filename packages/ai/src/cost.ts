/**
 * Custos sempre em MICROS inteiros (1 unidade monetária = 1_000_000 micros). Nunca float.
 * `estimatedCostMicros` (nosso cálculo) é distinto de `providerReportedCostMicros` (informado pelo fornecedor).
 */

export const MICROS_PER_UNIT = 1_000_000;
const TOKENS_PER_MILLION = 1_000_000n;

export type ModelPricing = {
  /** Micros por 1.000.000 de tokens de entrada. */
  inputCostPerMillionMicros: number;
  /** Micros por 1.000.000 de tokens de saída. */
  outputCostPerMillionMicros: number;
  currency?: string;
};

export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number | null;
  totalTokens: number;
  /** true quando os tokens foram estimados localmente (provedor não informou). */
  tokensAreEstimate: boolean;
  estimatedCostMicros: number;
  providerReportedCostMicros: number | null;
  currency: string;
};

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} deve ser um inteiro não negativo.`);
  }
}

/** Estimativa grosseira e determinística: ~4 caracteres por token, arredondada para cima. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Custo estimado em micros inteiros. Usa BigInt e arredonda para cima (conservador):
 * ceil((input * inputRate + output * outputRate) / 1_000_000).
 */
export function estimateCostMicros(
  inputTokens: number,
  outputTokens: number,
  inputCostPerMillionMicros: number,
  outputCostPerMillionMicros: number,
): number {
  assertNonNegativeInteger(inputTokens, "inputTokens");
  assertNonNegativeInteger(outputTokens, "outputTokens");
  assertNonNegativeInteger(inputCostPerMillionMicros, "inputCostPerMillionMicros");
  assertNonNegativeInteger(outputCostPerMillionMicros, "outputCostPerMillionMicros");
  const numerator =
    BigInt(inputTokens) * BigInt(inputCostPerMillionMicros) +
    BigInt(outputTokens) * BigInt(outputCostPerMillionMicros);
  const micros = (numerator + TOKENS_PER_MILLION - 1n) / TOKENS_PER_MILLION;
  if (micros > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("Custo estimado excede o limite inteiro seguro.");
  }
  return Number(micros);
}

export function estimateCostFromPricing(
  inputTokens: number,
  outputTokens: number,
  pricing: ModelPricing,
): number {
  return estimateCostMicros(
    inputTokens,
    outputTokens,
    pricing.inputCostPerMillionMicros,
    pricing.outputCostPerMillionMicros,
  );
}

/** Soma segura de valores em micros. */
export function addMicros(...values: number[]): number {
  let total = 0;
  for (const value of values) {
    assertNonNegativeInteger(value, "micros");
    total += value;
    if (!Number.isSafeInteger(total)) throw new RangeError("Soma de micros excede o limite.");
  }
  return total;
}

/** Converte micros inteiros em string decimal exata (sem float), ex.: 1500000 -> "1.500000". */
export function formatMicros(micros: number): string {
  assertNonNegativeInteger(micros, "micros");
  const whole = Math.floor(micros / MICROS_PER_UNIT);
  const fraction = String(micros % MICROS_PER_UNIT).padStart(6, "0");
  return `${whole}.${fraction}`;
}
