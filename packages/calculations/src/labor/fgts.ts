import {
  assertSafeNonNegativeInt,
  type CalculationEnvelope,
  type CalculationMemoryStep,
  calculationEnvelope,
  type MoneyCents,
} from "../types.js";

export const FGTS_ESTIMATE_LABEL =
  "Estimativa de FGTS com base nos valores informados (não é saldo oficial)." as const;

export type FgtsInput = {
  ruleSetVersion: string;
  baseCents: MoneyCents;
  /** Alíquota em basis points (ex.: 800 = 8%). */
  rateBasisPoints: number;
  informedDepositCents?: MoneyCents;
};

export type FgtsResult = {
  baseCents: MoneyCents;
  rateBasisPoints: number;
  expectedCents: MoneyCents;
  informedDepositCents: MoneyCents | null;
  differenceCents: MoneyCents | null;
  label: typeof FGTS_ESTIMATE_LABEL;
};

/**
 * Estimativa FGTS: base × rate_bp → esperado.
 * Compara com informado. NUNCA rotula como saldo oficial.
 */
export function calculateFgtsEstimate(input: FgtsInput): CalculationEnvelope<FgtsResult> {
  assertSafeNonNegativeInt(input.baseCents, "baseCents");
  assertSafeNonNegativeInt(input.rateBasisPoints, "rateBasisPoints");

  const memory: CalculationMemoryStep[] = [];
  const warnings: string[] = [];
  const missingData: string[] = [];

  const expectedCents = Math.floor((input.baseCents * input.rateBasisPoints) / 10_000);
  memory.push({
    key: "fgts_estimate",
    description: FGTS_ESTIMATE_LABEL,
    detail: {
      baseCents: input.baseCents,
      rateBasisPoints: input.rateBasisPoints,
      expectedCents,
    },
  });

  let informedDepositCents: MoneyCents | null = null;
  let differenceCents: MoneyCents | null = null;
  if (input.informedDepositCents === undefined) {
    missingData.push("informedDepositCents");
  } else {
    assertSafeNonNegativeInt(input.informedDepositCents, "informedDepositCents");
    informedDepositCents = input.informedDepositCents;
    differenceCents = expectedCents - informedDepositCents;
    memory.push({
      key: "fgts_comparison",
      description: "Comparação entre estimativa e depósito informado.",
      detail: { expectedCents, informedDepositCents, differenceCents },
    });
  }

  warnings.push(FGTS_ESTIMATE_LABEL);

  return calculationEnvelope(
    {
      baseCents: input.baseCents,
      rateBasisPoints: input.rateBasisPoints,
      expectedCents,
      informedDepositCents,
      differenceCents,
      label: FGTS_ESTIMATE_LABEL,
    },
    {
      ruleSetVersion: input.ruleSetVersion,
      memory,
      warnings,
      missingData,
    },
  );
}
