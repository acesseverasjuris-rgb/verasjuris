import { calculateAtrasados, type AtrasadosInput } from "./atrasados.js";
import { calculateCarencia, type CarenciaInput } from "./carencia.js";
import { InsuredStatusCalculator, type InsuredStatusInput } from "./qualidade.js";
import { InitialMonthlyBenefitCalculator, type RmiInput } from "./rmi.js";
import { calculateSalarioBeneficio, type SalarioBeneficioInput } from "./salario-beneficio.js";
import { compareBenefitScenarios, type ScenariosInput } from "./scenarios.js";
import { calculateContributionTime, type TempoInput } from "./tempo.js";

export {
  calculateAtrasados,
  type AtrasadosInput,
  type AtrasadosResult,
  type ArrearsMonthlyValue,
} from "./atrasados.js";
export {
  calculateCarencia,
  type CarenciaCompetenceInput,
  type CarenciaInput,
  type CarenciaResult,
} from "./carencia.js";
export {
  InsuredStatusCalculator,
  type InsuredBenefitPeriod,
  type InsuredContribution,
  type InsuredStatus,
  type InsuredStatusInput,
  type InsuredStatusResult,
  type InsuredStatusRuleParams,
} from "./qualidade.js";
export {
  InitialMonthlyBenefitCalculator,
  type RmiInput,
  type RmiResult,
} from "./rmi.js";
export {
  calculateSalarioBeneficio,
  type SalarioBeneficioInput,
  type SalarioBeneficioResult,
  type SalaryCompetence,
} from "./salario-beneficio.js";
export {
  compareBenefitScenarios,
  HIGHEST_ESTIMATED_SCENARIO_LABEL,
  type BenefitScenario,
  type ScenariosComparisonResult,
  type ScenariosInput,
} from "./scenarios.js";
export {
  calculateContributionTime,
  type ContributionPeriod,
  type ContributionPeriodKind,
  type OverlapDetail,
  type TempoInput,
  type TempoResult,
} from "./tempo.js";

/**
 * Fachada determinística dos cálculos previdenciários.
 * Separada do AIGateway — sem DB/IA/Fastify.
 */
export class PrevidentiaryCalculationEngine {
  private readonly insuredStatus = new InsuredStatusCalculator();
  private readonly rmi = new InitialMonthlyBenefitCalculator();

  carencia(input: CarenciaInput) {
    return calculateCarencia(input);
  }

  qualidade(input: InsuredStatusInput) {
    return this.insuredStatus.calculate(input);
  }

  tempo(input: TempoInput) {
    return calculateContributionTime(input);
  }

  salarioBeneficio(input: SalarioBeneficioInput) {
    return calculateSalarioBeneficio(input);
  }

  rmiCalc(input: RmiInput) {
    return this.rmi.calculate(input);
  }

  atrasados(input: AtrasadosInput) {
    return calculateAtrasados(input);
  }

  scenarios(input: ScenariosInput) {
    return compareBenefitScenarios(input);
  }
}
