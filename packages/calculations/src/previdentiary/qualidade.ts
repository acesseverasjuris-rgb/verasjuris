import {
  type CalculationEnvelope,
  type CalculationMemoryStep,
  calculationEnvelope,
  daysBetweenInclusive,
} from "../types.js";

export type InsuredContribution = {
  start: string;
  end: string;
};

export type InsuredBenefitPeriod = {
  start: string;
  end: string;
};

export type InsuredStatusRuleParams = {
  /** Meses de graça após a última contribuição qualificadora (inteiro). */
  gracePeriodMonths: number;
};

export type InsuredStatusInput = {
  ruleSetVersion: string;
  contributions: readonly InsuredContribution[];
  benefitPeriods?: readonly InsuredBenefitPeriod[];
  category?: string;
  referenceDate: string;
  ruleParams: InsuredStatusRuleParams;
};

export type InsuredStatus = "maintained" | "in_grace_period" | "lost" | "never_acquired";

export type InsuredStatusResult = {
  status: InsuredStatus;
  lastQualifyingDate: string | null;
  gracePeriod: {
    months: number;
    endsOn: string | null;
  };
  reasoning: string[];
  rulesUsed: string[];
  category: string | null;
};

function addMonthsUtc(dateOnly: string, months: number): string {
  const [y, m, d] = dateOnly.split("-").map(Number) as [number, number, number];
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCMonth(base.getUTCMonth() + months);
  const yy = base.getUTCFullYear();
  const mm = String(base.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(base.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function latestEndDate(periods: readonly { end: string }[]): string | null {
  let latest: string | null = null;
  for (const period of periods) {
    if (!latest || period.end > latest) latest = period.end;
  }
  return latest;
}

/**
 * InsuredStatusCalculator — qualidade de segurado determinística.
 * Sempre calculated → review_required.
 */
export class InsuredStatusCalculator {
  calculate(input: InsuredStatusInput): CalculationEnvelope<InsuredStatusResult> {
    const memory: CalculationMemoryStep[] = [];
    const warnings: string[] = [];
    const missingData: string[] = [];
    const reasoning: string[] = [];
    const rulesUsed = [
      `ruleSet:${input.ruleSetVersion}`,
      `gracePeriodMonths:${input.ruleParams.gracePeriodMonths}`,
    ];

    const graceMonths = input.ruleParams.gracePeriodMonths;
    if (!Number.isSafeInteger(graceMonths) || graceMonths < 0) {
      throw new Error("ruleParams.gracePeriodMonths deve ser inteiro não negativo.");
    }

    const contributions = input.contributions.filter((c) => c.start <= c.end);
    const benefitPeriods = (input.benefitPeriods ?? []).filter((b) => b.start <= b.end);

    if (contributions.length === 0 && benefitPeriods.length === 0) {
      missingData.push("contributions");
      reasoning.push("Não há contribuições nem períodos de benefício informados.");
      memory.push({
        key: "no_qualifying_periods",
        description: "Sem períodos qualificadores informados.",
      });
      return calculationEnvelope(
        {
          status: "never_acquired",
          lastQualifyingDate: null,
          gracePeriod: { months: graceMonths, endsOn: null },
          reasoning,
          rulesUsed,
          category: input.category ?? null,
        },
        {
          ruleSetVersion: input.ruleSetVersion,
          memory,
          warnings,
          missingData,
        },
      );
    }

    const lastContribution = latestEndDate(contributions);
    const lastBenefit = latestEndDate(benefitPeriods);
    const lastQualifyingDate =
      lastContribution && lastBenefit
        ? lastContribution >= lastBenefit
          ? lastContribution
          : lastBenefit
        : (lastContribution ?? lastBenefit);

    memory.push({
      key: "last_qualifying_date",
      description: "Última data qualificadora identificada.",
      detail: { lastQualifyingDate, lastContribution, lastBenefit },
    });

    if (!lastQualifyingDate) {
      reasoning.push("Não foi possível determinar a última data qualificadora.");
      return calculationEnvelope(
        {
          status: "never_acquired",
          lastQualifyingDate: null,
          gracePeriod: { months: graceMonths, endsOn: null },
          reasoning,
          rulesUsed,
          category: input.category ?? null,
        },
        {
          ruleSetVersion: input.ruleSetVersion,
          memory,
          warnings,
          missingData,
        },
      );
    }

    const graceEndsOn = addMonthsUtc(lastQualifyingDate, graceMonths);
    memory.push({
      key: "grace_period",
      description: "Período de graça calculado a partir da última data qualificadora.",
      detail: { gracePeriodMonths: graceMonths, endsOn: graceEndsOn },
    });

    let status: InsuredStatus;
    if (input.referenceDate <= lastQualifyingDate) {
      status = "maintained";
      reasoning.push(
        `Na data de referência (${input.referenceDate}) ainda há vínculo/contribuição qualificadora até ${lastQualifyingDate}.`,
      );
    } else if (input.referenceDate <= graceEndsOn) {
      status = "in_grace_period";
      reasoning.push(
        `Data de referência ${input.referenceDate} está dentro do período de graça que termina em ${graceEndsOn}.`,
      );
    } else {
      status = "lost";
      reasoning.push(
        `Data de referência ${input.referenceDate} é posterior ao fim do período de graça (${graceEndsOn}).`,
      );
    }

    if (input.category) {
      reasoning.push(`Categoria informada: ${input.category}.`);
    } else {
      missingData.push("category");
      warnings.push("Categoria do segurado não informada; regra pode variar.");
    }

    // Memória auxiliar: duração do último intervalo
    if (contributions.length > 0) {
      const last = contributions.reduce((acc, c) => (c.end >= acc.end ? c : acc));
      memory.push({
        key: "last_contribution_span",
        description: "Último período contributivo considerado.",
        detail: {
          start: last.start,
          end: last.end,
          daysInclusive: daysBetweenInclusive(last.start, last.end),
        },
      });
    }

    return calculationEnvelope(
      {
        status,
        lastQualifyingDate,
        gracePeriod: { months: graceMonths, endsOn: graceEndsOn },
        reasoning,
        rulesUsed,
        category: input.category ?? null,
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
