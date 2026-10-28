import { calculateTaxCompensation, type TaxCompensationInput } from "./compensation.js";
import { compareTaxScenarios, type TaxComparativeInput } from "./comparative.js";
import { calculateTaxCredit, type TaxCreditInput } from "./credit.js";
import { calculateTaxDebit, type TaxDebitInput } from "./debit.js";
import { calculateTaxInstallment, type TaxInstallmentInput } from "./installment.js";
import { calculatePenaltyInterest, type PenaltyInterestInput } from "./penalty-interest.js";
import { calculateTaxRefund, type TaxRefundInput } from "./refund.js";
import { calculateTaxUpdate, type TaxUpdateInput } from "./update.js";

export {
  compareTaxScenarios,
  LOWEST_TAX_SCENARIO_LABEL,
  type TaxComparativeInput,
  type TaxComparativeResult,
  type TaxScenario,
} from "./comparative.js";
export {
  calculateTaxCompensation,
  type TaxCompensationInput,
  type TaxCompensationResult,
} from "./compensation.js";
export {
  calculateTaxCredit,
  type TaxCreditInput,
  type TaxCreditResult,
} from "./credit.js";
export {
  calculateTaxDebit,
  type TaxDebitInput,
  type TaxDebitResult,
} from "./debit.js";
export {
  calculateTaxInstallment,
  type TaxInstallmentInput,
  type TaxInstallmentResult,
  type TaxInstallmentScheduleLine,
} from "./installment.js";
export {
  calculatePenaltyInterest,
  type PenaltyInterestInput,
  type PenaltyInterestResult,
} from "./penalty-interest.js";
export {
  calculateTaxRefund,
  type TaxRefundInput,
  type TaxRefundResult,
} from "./refund.js";
export {
  appendTaxMemoryPipeline,
  applyBasisPointsFromRule,
  type TaxMemoryContext,
  type TaxMonetaryLine,
  type TaxMonetaryTotals,
  type TaxPeriod,
  type TaxRuleParams,
} from "./types.js";
export {
  calculateTaxUpdate,
  type TaxUpdateInput,
  type TaxUpdateResult,
} from "./update.js";

/**
 * Fachada determinística dos cálculos tributários.
 * Separada do AIGateway — sem DB/IA/Fastify.
 */
export class TaxCalculationEngine {
  update(input: TaxUpdateInput) {
    return calculateTaxUpdate(input);
  }

  debit(input: TaxDebitInput) {
    return calculateTaxDebit(input);
  }

  credit(input: TaxCreditInput) {
    return calculateTaxCredit(input);
  }

  refund(input: TaxRefundInput) {
    return calculateTaxRefund(input);
  }

  compensation(input: TaxCompensationInput) {
    return calculateTaxCompensation(input);
  }

  penaltyInterest(input: PenaltyInterestInput) {
    return calculatePenaltyInterest(input);
  }

  installment(input: TaxInstallmentInput) {
    return calculateTaxInstallment(input);
  }

  comparative(input: TaxComparativeInput) {
    return compareTaxScenarios(input);
  }
}
