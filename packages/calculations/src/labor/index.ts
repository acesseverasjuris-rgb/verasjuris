import { calculateFerias, type FeriasInput } from "./ferias.js";
import { calculateFgtsEstimate, type FgtsInput } from "./fgts.js";
import { calculateJornada, type JornadaInput } from "./jornada.js";
import { calculateLiquidacao, type LiquidacaoInput } from "./liquidacao.js";
import { calculateRemuneracao, type RemuneracaoInput } from "./remuneracao.js";
import { TerminationCalculator, type TerminationInput } from "./rescisao.js";

export {
  calculateFerias,
  type FeriasInput,
  type FeriasResult,
  type FeriasRuleParams,
} from "./ferias.js";
export {
  calculateFgtsEstimate,
  FGTS_ESTIMATE_LABEL,
  type FgtsInput,
  type FgtsResult,
} from "./fgts.js";
export {
  calculateJornada,
  type JornadaInput,
  type JornadaResult,
  type TimeRecordSegment,
} from "./jornada.js";
export {
  calculateLiquidacao,
  type LiquidacaoInput,
  type LiquidacaoResult,
  type LiquidationClaim,
} from "./liquidacao.js";
export {
  calculateRemuneracao,
  type RemuneracaoComponent,
  type RemuneracaoInput,
  type RemuneracaoResult,
} from "./remuneracao.js";
export {
  TerminationCalculator,
  type TerminationInput,
  type TerminationResult,
  type TerminationRuleParams,
  type TerminationVerb,
} from "./rescisao.js";

/**
 * Fachada determinística dos cálculos trabalhistas.
 * Separada do AIGateway — sem DB/IA/Fastify.
 */
export class LaborCalculationEngine {
  private readonly termination = new TerminationCalculator();

  jornada(input: JornadaInput) {
    return calculateJornada(input);
  }

  remuneracao(input: RemuneracaoInput) {
    return calculateRemuneracao(input);
  }

  ferias(input: FeriasInput) {
    return calculateFerias(input);
  }

  fgts(input: FgtsInput) {
    return calculateFgtsEstimate(input);
  }

  rescisao(input: TerminationInput) {
    return this.termination.calculate(input);
  }

  liquidacao(input: LiquidacaoInput) {
    return calculateLiquidacao(input);
  }
}
