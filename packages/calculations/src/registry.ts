import { calculateLiquidacao, type LiquidacaoInput } from "./labor/liquidacao.js";
import { calculateFerias, type FeriasInput } from "./labor/ferias.js";
import { calculateFgtsEstimate, type FgtsInput } from "./labor/fgts.js";
import { calculateJornada, type JornadaInput } from "./labor/jornada.js";
import { calculateRemuneracao, type RemuneracaoInput } from "./labor/remuneracao.js";
import { TerminationCalculator, type TerminationInput } from "./labor/rescisao.js";
import { calculateAtrasados, type AtrasadosInput } from "./previdentiary/atrasados.js";
import { calculateCarencia, type CarenciaInput } from "./previdentiary/carencia.js";
import { InsuredStatusCalculator, type InsuredStatusInput } from "./previdentiary/qualidade.js";
import { InitialMonthlyBenefitCalculator, type RmiInput } from "./previdentiary/rmi.js";
import {
  calculateSalarioBeneficio,
  type SalarioBeneficioInput,
} from "./previdentiary/salario-beneficio.js";
import { compareBenefitScenarios, type ScenariosInput } from "./previdentiary/scenarios.js";
import { calculateContributionTime, type TempoInput } from "./previdentiary/tempo.js";
import { calculateTaxCompensation, type TaxCompensationInput } from "./tax/compensation.js";
import { compareTaxScenarios, type TaxComparativeInput } from "./tax/comparative.js";
import { calculateTaxCredit, type TaxCreditInput } from "./tax/credit.js";
import { calculateTaxDebit, type TaxDebitInput } from "./tax/debit.js";
import { calculateTaxInstallment, type TaxInstallmentInput } from "./tax/installment.js";
import { calculatePenaltyInterest, type PenaltyInterestInput } from "./tax/penalty-interest.js";
import { calculateTaxRefund, type TaxRefundInput } from "./tax/refund.js";
import { calculateTaxUpdate, type TaxUpdateInput } from "./tax/update.js";
import type { CalculationEnvelope } from "./types.js";

export type CalculationDomain = "tax" | "labor" | "previdentiary";

export type CalculatorFn = (input: unknown) => CalculationEnvelope<unknown>;

const terminationCalculator = new TerminationCalculator();
const insuredStatusCalculator = new InsuredStatusCalculator();
const rmiCalculator = new InitialMonthlyBenefitCalculator();

const REGISTRY: Record<CalculationDomain, Record<string, CalculatorFn>> = {
  tax: {
    update: (input) => calculateTaxUpdate(input as TaxUpdateInput),
    debit: (input) => calculateTaxDebit(input as TaxDebitInput),
    credit: (input) => calculateTaxCredit(input as TaxCreditInput),
    refund: (input) => calculateTaxRefund(input as TaxRefundInput),
    compensation: (input) => calculateTaxCompensation(input as TaxCompensationInput),
    penalty_interest: (input) => calculatePenaltyInterest(input as PenaltyInterestInput),
    installment: (input) => calculateTaxInstallment(input as TaxInstallmentInput),
    comparative: (input) => compareTaxScenarios(input as TaxComparativeInput),
  },
  labor: {
    jornada: (input) => calculateJornada(input as JornadaInput),
    remuneracao: (input) => calculateRemuneracao(input as RemuneracaoInput),
    ferias: (input) => calculateFerias(input as FeriasInput),
    fgts: (input) => calculateFgtsEstimate(input as FgtsInput),
    rescisao: (input) => terminationCalculator.calculate(input as TerminationInput),
    liquidacao: (input) => calculateLiquidacao(input as LiquidacaoInput),
  },
  previdentiary: {
    atrasados: (input) => calculateAtrasados(input as AtrasadosInput),
    carencia: (input) => calculateCarencia(input as CarenciaInput),
    qualidade: (input) => insuredStatusCalculator.calculate(input as InsuredStatusInput),
    tempo: (input) => calculateContributionTime(input as TempoInput),
    salario_beneficio: (input) => calculateSalarioBeneficio(input as SalarioBeneficioInput),
    rmi: (input) => rmiCalculator.calculate(input as RmiInput),
    scenarios: (input) => compareBenefitScenarios(input as ScenariosInput),
  },
};

export function getCalculator(domain: CalculationDomain, key: string): CalculatorFn | undefined {
  return REGISTRY[domain]?.[key];
}

export function listCalculatorKeys(domain: CalculationDomain): string[] {
  return Object.keys(REGISTRY[domain] ?? {});
}
