import {
  assertSafeNonNegativeInt,
  type CalculationEnvelope,
  type CalculationMemoryStep,
  calculationEnvelope,
  type MoneyCents,
} from "../types.js";
import { appendTaxMemoryPipeline, type TaxPeriod } from "./types.js";

export type TaxRefundInput = {
  ruleSetVersion: string;
  creditKey: string;
  availableCreditCents: MoneyCents;
  requestedRefundCents: MoneyCents;
  period?: TaxPeriod;
  referenceDate?: string;
};

export type TaxRefundResult = {
  creditKey: string;
  availableCreditCents: MoneyCents;
  requestedRefundCents: MoneyCents;
  approvedRefundCents: MoneyCents;
  remainingCreditCents: MoneyCents;
  cappedByAvailable: boolean;
};

/**
 * Restituição a partir de crédito disponível (limitada ao saldo informado).
 */
export function calculateTaxRefund(input: TaxRefundInput): CalculationEnvelope<TaxRefundResult> {
  const memory: CalculationMemoryStep[] = [];
  const warnings: string[] = [
    "Restituição estimativa; pedido administrativo e homologação não simulados.",
  ];
  const missingData: string[] = [];

  assertSafeNonNegativeInt(input.availableCreditCents, "availableCreditCents");
  assertSafeNonNegativeInt(input.requestedRefundCents, "requestedRefundCents");

  const cappedByAvailable = input.requestedRefundCents > input.availableCreditCents;
  if (cappedByAvailable) {
    warnings.push("refund_capped_by_available_credit");
  }

  const approvedRefundCents = Math.min(input.requestedRefundCents, input.availableCreditCents);
  const remainingCreditCents = input.availableCreditCents - approvedRefundCents;

  const result: TaxRefundResult = {
    creditKey: input.creditKey,
    availableCreditCents: input.availableCreditCents,
    requestedRefundCents: input.requestedRefundCents,
    approvedRefundCents,
    remainingCreditCents,
    cappedByAvailable,
  };

  appendTaxMemoryPipeline(memory, {
    inputDetail: {
      creditKey: input.creditKey,
      availableCreditCents: input.availableCreditCents,
      requestedRefundCents: input.requestedRefundCents,
      referenceDate: input.referenceDate ?? null,
    },
    ruleSetVersion: input.ruleSetVersion,
    indexConfigured: true,
    period: input.period,
    intermediateDetail: { cappedByAvailable },
    resultDetail: { ...result },
    warningMessages: warnings,
  });

  return calculationEnvelope(result, {
    ruleSetVersion: input.ruleSetVersion,
    memory,
    warnings: [...new Set(warnings)],
    missingData,
  });
}
