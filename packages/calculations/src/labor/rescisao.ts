import {
  assertSafeNonNegativeInt,
  type CalculationEnvelope,
  type CalculationMemoryStep,
  calculationEnvelope,
  type MoneyCents,
} from "../types.js";

export type TerminationRuleParams = {
  /** Proporcional de 13º em basis points do salário (ex.: 5000 = 50%). */
  thirteenthBasisPoints: number;
  /** Férias proporcionais em basis points do salário. */
  proportionalVacationBasisPoints: number;
  /** Terço sobre férias proporcionais em basis points. */
  vacationThirdBasisPoints: number;
  /** Aviso indenizado em basis points do salário (0 se não aplicável). */
  noticeBasisPoints: number;
  /** Multa FGTS em basis points sobre base FGTS informada. */
  fgtsPenaltyBasisPoints: number;
};

export type TerminationInput = {
  ruleSetVersion: string;
  lastSalaryCents: MoneyCents;
  balanceSalaryCents?: MoneyCents;
  fgtsBaseCents?: MoneyCents;
  terminationDate?: string;
  noticeStart?: string;
  noticeEnd?: string;
  ruleParams: TerminationRuleParams;
};

export type TerminationVerb = {
  key: string;
  amountCents: MoneyCents;
};

export type TerminationResult = {
  verbs: TerminationVerb[];
  bases: {
    lastSalaryCents: MoneyCents;
    fgtsBaseCents: MoneyCents | null;
  };
  dates: {
    terminationDate: string | null;
    noticeStart: string | null;
    noticeEnd: string | null;
  };
  totalCents: MoneyCents;
};

/**
 * TerminationCalculator — verbas a partir de inputs + parâmetros do rule set.
 */
export class TerminationCalculator {
  calculate(input: TerminationInput): CalculationEnvelope<TerminationResult> {
    assertSafeNonNegativeInt(input.lastSalaryCents, "lastSalaryCents");
    const memory: CalculationMemoryStep[] = [];
    const warnings: string[] = [];
    const missingData: string[] = [];
    const verbs: TerminationVerb[] = [];

    const params = input.ruleParams;
    for (const [key, value] of Object.entries(params)) {
      assertSafeNonNegativeInt(value, `ruleParams.${key}`);
    }

    const balanceSalaryCents = input.balanceSalaryCents ?? 0;
    if (input.balanceSalaryCents === undefined) {
      missingData.push("balanceSalaryCents");
    } else {
      assertSafeNonNegativeInt(input.balanceSalaryCents, "balanceSalaryCents");
    }
    if (balanceSalaryCents > 0) {
      verbs.push({ key: "saldo_salario", amountCents: balanceSalaryCents });
    }

    const thirteenth = Math.floor((input.lastSalaryCents * params.thirteenthBasisPoints) / 10_000);
    verbs.push({ key: "decimo_terceiro_proporcional", amountCents: thirteenth });

    const proportionalVacation = Math.floor(
      (input.lastSalaryCents * params.proportionalVacationBasisPoints) / 10_000,
    );
    const vacationThird = Math.floor(
      (proportionalVacation * params.vacationThirdBasisPoints) / 10_000,
    );
    verbs.push({ key: "ferias_proporcionais", amountCents: proportionalVacation });
    verbs.push({ key: "terco_ferias", amountCents: vacationThird });

    const notice = Math.floor((input.lastSalaryCents * params.noticeBasisPoints) / 10_000);
    if (notice > 0) {
      verbs.push({ key: "aviso_indenizado", amountCents: notice });
    }

    let fgtsBaseCents: MoneyCents | null = null;
    if (input.fgtsBaseCents === undefined) {
      missingData.push("fgtsBaseCents");
    } else {
      assertSafeNonNegativeInt(input.fgtsBaseCents, "fgtsBaseCents");
      fgtsBaseCents = input.fgtsBaseCents;
      const penalty = Math.floor((fgtsBaseCents * params.fgtsPenaltyBasisPoints) / 10_000);
      verbs.push({ key: "multa_fgts", amountCents: penalty });
    }

    if (!input.terminationDate) missingData.push("terminationDate");

    const totalCents = verbs.reduce((acc, verb) => acc + verb.amountCents, 0);
    memory.push({
      key: "termination_verbs",
      description: "Verbas rescisórias calculadas conforme rule set.",
      detail: { verbs, totalCents, ruleParams: params },
    });

    warnings.push(
      "Cálculo rescisório estimativo conforme parâmetros informados; exige revisão humana.",
    );

    return calculationEnvelope(
      {
        verbs,
        bases: {
          lastSalaryCents: input.lastSalaryCents,
          fgtsBaseCents,
        },
        dates: {
          terminationDate: input.terminationDate ?? null,
          noticeStart: input.noticeStart ?? null,
          noticeEnd: input.noticeEnd ?? null,
        },
        totalCents,
      },
      {
        ruleSetVersion: input.ruleSetVersion,
        memory,
        warnings,
        missingData,
      },
    );
  }
}
