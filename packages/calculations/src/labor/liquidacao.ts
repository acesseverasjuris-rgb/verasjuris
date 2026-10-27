import {
  assertSafeNonNegativeInt,
  type CalculationEnvelope,
  type CalculationMemoryStep,
  calculationEnvelope,
  type MoneyCents,
} from "../types.js";

export type LiquidationClaim = {
  key: string;
  principalCents: MoneyCents;
  correctionCents?: MoneyCents;
  interestCents?: MoneyCents;
  discountCents?: MoneyCents;
  indexConfigured?: boolean;
};

export type LiquidacaoInput = {
  ruleSetVersion: string;
  claims: readonly LiquidationClaim[];
};

export type LiquidacaoResult = {
  totalPrincipalCents: MoneyCents;
  totalCorrectionCents: MoneyCents;
  totalInterestCents: MoneyCents;
  totalDiscountsCents: MoneyCents;
  totalCents: MoneyCents;
  claimsCounted: number;
};

/**
 * Agrega pedidos/verbas com correção/juros opcionais do input.
 * Não substitui liquidação judicial oficial.
 */
export function calculateLiquidacao(input: LiquidacaoInput): CalculationEnvelope<LiquidacaoResult> {
  const memory: CalculationMemoryStep[] = [];
  const warnings: string[] = [];
  const missingData: string[] = [];

  let totalPrincipalCents = 0;
  let totalCorrectionCents = 0;
  let totalInterestCents = 0;
  let totalDiscountsCents = 0;

  if (input.claims.length === 0) {
    missingData.push("claims");
  }

  for (const claim of input.claims) {
    assertSafeNonNegativeInt(claim.principalCents, `principalCents:${claim.key}`);
    totalPrincipalCents += claim.principalCents;

    const indexConfigured = claim.indexConfigured ?? claim.correctionCents !== undefined;
    if (!indexConfigured) {
      warnings.push("not_configured_index");
      missingData.push(`index:${claim.key}`);
    }

    if (claim.correctionCents !== undefined) {
      assertSafeNonNegativeInt(claim.correctionCents, `correctionCents:${claim.key}`);
      totalCorrectionCents += claim.correctionCents;
    }
    if (claim.interestCents !== undefined) {
      assertSafeNonNegativeInt(claim.interestCents, `interestCents:${claim.key}`);
      totalInterestCents += claim.interestCents;
    }
    if (claim.discountCents !== undefined) {
      assertSafeNonNegativeInt(claim.discountCents, `discountCents:${claim.key}`);
      totalDiscountsCents += claim.discountCents;
    }

    memory.push({
      key: "liquidation_claim",
      description: "Pedido acumulado na liquidação.",
      detail: { ...claim },
    });
  }

  const totalCents =
    totalPrincipalCents + totalCorrectionCents + totalInterestCents - totalDiscountsCents;

  memory.push({
    key: "liquidation_total",
    description: "Total agregado da liquidação (estimativa; não oficial).",
    detail: {
      totalPrincipalCents,
      totalCorrectionCents,
      totalInterestCents,
      totalDiscountsCents,
      totalCents,
    },
  });

  warnings.push(
    "Liquidação estimativa a partir dos valores informados; não substitui cálculo judicial oficial.",
  );

  return calculationEnvelope(
    {
      totalPrincipalCents,
      totalCorrectionCents,
      totalInterestCents,
      totalDiscountsCents,
      totalCents,
      claimsCounted: input.claims.length,
    },
    {
      ruleSetVersion: input.ruleSetVersion,
      memory,
      warnings: [...new Set(warnings)],
      missingData,
    },
  );
}
