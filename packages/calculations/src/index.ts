/**
 * @verasjuris/calculations — motores determinísticos previdenciários e trabalhistas.
 *
 * - TypeScript puro (sem DB / IA / Fastify)
 * - Dinheiro em centavos inteiros
 * - Rule sets versionados passados no input
 * - Todo cálculo: result + memory + warnings + missingData + ruleSetVersion
 * - Status: calculated → review_required
 */

export {
  applyIntegerCoefficient,
  assertSafeNonNegativeInt,
  assertSafePositiveInt,
  calculationEnvelope,
  daysBetweenInclusive,
  emptyMemory,
  periodsOverlap,
  type CalculationEnvelope,
  type CalculationMemoryStep,
  type CalculationReviewHint,
  type CalculationStatus,
  type DateOnly,
  type IntegerCoefficient,
  type MoneyCents,
  type YearMonth,
} from "./types.js";

export {
  PrevidentiaryCalculationEngine,
  calculateAtrasados,
  calculateCarencia,
  calculateContributionTime,
  calculateSalarioBeneficio,
  compareBenefitScenarios,
  HIGHEST_ESTIMATED_SCENARIO_LABEL,
  InitialMonthlyBenefitCalculator,
  InsuredStatusCalculator,
  type AtrasadosInput,
  type AtrasadosResult,
  type ArrearsMonthlyValue,
  type BenefitScenario,
  type CarenciaCompetenceInput,
  type CarenciaInput,
  type CarenciaResult,
  type ContributionPeriod,
  type ContributionPeriodKind,
  type InsuredBenefitPeriod,
  type InsuredContribution,
  type InsuredStatus,
  type InsuredStatusInput,
  type InsuredStatusResult,
  type InsuredStatusRuleParams,
  type OverlapDetail,
  type RmiInput,
  type RmiResult,
  type SalarioBeneficioInput,
  type SalarioBeneficioResult,
  type SalaryCompetence,
  type ScenariosComparisonResult,
  type ScenariosInput,
  type TempoInput,
  type TempoResult,
} from "./previdentiary/index.js";

export {
  LaborCalculationEngine,
  TerminationCalculator,
  calculateFerias,
  calculateFgtsEstimate,
  calculateJornada,
  calculateLiquidacao,
  calculateRemuneracao,
  FGTS_ESTIMATE_LABEL,
  type FeriasInput,
  type FeriasResult,
  type FeriasRuleParams,
  type FgtsInput,
  type FgtsResult,
  type JornadaInput,
  type JornadaResult,
  type LiquidacaoInput,
  type LiquidacaoResult,
  type LiquidationClaim,
  type RemuneracaoComponent,
  type RemuneracaoInput,
  type RemuneracaoResult,
  type TerminationInput,
  type TerminationResult,
  type TerminationRuleParams,
  type TerminationVerb,
  type TimeRecordSegment,
} from "./labor/index.js";
