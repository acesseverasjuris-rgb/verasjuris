import {
  assertSafeNonNegativeInt,
  type CalculationEnvelope,
  type CalculationMemoryStep,
  calculationEnvelope,
  type MoneyCents,
} from "../types.js";

export type FeriasRuleParams = {
  /** Dias de férias do cenário (inteiro). */
  vacationDays: number;
  /** Divisor para média diária (ex.: 30). */
  dayDivisor: number;
  /** Terço constitucional em basis points (ex.: 3333 ≈ 1/3 truncado, ou 10000/3 via rational externo). */
  constitutionalThirdBasisPoints: number;
};

export type FeriasInput = {
  ruleSetVersion: string;
  averageRemunerationCents: MoneyCents;
  ruleParams: FeriasRuleParams;
};

export type FeriasResult = {
  averageRemunerationCents: MoneyCents;
  dailyCents: MoneyCents;
  vacationCents: MoneyCents;
  constitutionalThirdCents: MoneyCents;
  totalCents: MoneyCents;
  vacationDays: number;
};

/**
 * Cenário de férias a partir de parâmetros do rule set informado.
 * Não embute validade jurídica — depende do rule set versionado.
 */
export function calculateFerias(input: FeriasInput): CalculationEnvelope<FeriasResult> {
  assertSafeNonNegativeInt(input.averageRemunerationCents, "averageRemunerationCents");
  assertSafeNonNegativeInt(input.ruleParams.vacationDays, "ruleParams.vacationDays");
  assertSafeNonNegativeInt(input.ruleParams.dayDivisor, "ruleParams.dayDivisor");
  assertSafeNonNegativeInt(
    input.ruleParams.constitutionalThirdBasisPoints,
    "ruleParams.constitutionalThirdBasisPoints",
  );

  const memory: CalculationMemoryStep[] = [];
  const warnings: string[] = [];
  const missingData: string[] = [];

  if (input.ruleParams.dayDivisor === 0) {
    throw new Error("ruleParams.dayDivisor deve ser positivo.");
  }

  const dailyCents = Math.floor(input.averageRemunerationCents / input.ruleParams.dayDivisor);
  const vacationCents = dailyCents * input.ruleParams.vacationDays;
  const constitutionalThirdCents = Math.floor(
    (vacationCents * input.ruleParams.constitutionalThirdBasisPoints) / 10_000,
  );
  const totalCents = vacationCents + constitutionalThirdCents;

  memory.push({
    key: "ferias_scenario",
    description: "Cenário de férias conforme parâmetros do rule set.",
    detail: {
      dailyCents,
      vacationCents,
      constitutionalThirdCents,
      totalCents,
      ruleParams: input.ruleParams,
    },
  });

  return calculationEnvelope(
    {
      averageRemunerationCents: input.averageRemunerationCents,
      dailyCents,
      vacationCents,
      constitutionalThirdCents,
      totalCents,
      vacationDays: input.ruleParams.vacationDays,
    },
    {
      ruleSetVersion: input.ruleSetVersion,
      memory,
      warnings,
      missingData,
    },
  );
}
