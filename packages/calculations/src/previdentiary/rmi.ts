import {
  applyIntegerCoefficient,
  assertSafeNonNegativeInt,
  type CalculationEnvelope,
  type CalculationMemoryStep,
  calculationEnvelope,
  type IntegerCoefficient,
  type MoneyCents,
} from "../types.js";

export type RmiInput = {
  ruleSetVersion: string;
  baseCents: MoneyCents;
  coefficient: IntegerCoefficient;
  factors?: Readonly<Record<string, number>>;
};

export type RmiResult = {
  baseCents: MoneyCents;
  coefficient: IntegerCoefficient;
  factors: Record<string, number>;
  rmiCents: MoneyCents;
};

/**
 * InitialMonthlyBenefitCalculator — RMI em centavos inteiros.
 */
export class InitialMonthlyBenefitCalculator {
  calculate(input: RmiInput): CalculationEnvelope<RmiResult> {
    assertSafeNonNegativeInt(input.baseCents, "baseCents");
    const memory: CalculationMemoryStep[] = [];
    const warnings: string[] = [];
    const missingData: string[] = [];

    memory.push({
      key: "base",
      description: "Base de cálculo informada (centavos).",
      detail: { baseCents: input.baseCents },
    });

    const rmiCents = applyIntegerCoefficient(input.baseCents, input.coefficient);
    memory.push({
      key: "coefficient_applied",
      description: "Coeficiente inteiro aplicado com truncamento.",
      detail: { coefficient: input.coefficient, rmiCents },
    });

    const factors = { ...(input.factors ?? {}) };
    if (Object.keys(factors).length === 0) {
      missingData.push("factors");
    } else {
      memory.push({
        key: "factors",
        description: "Fatores informados (não reaplicados automaticamente).",
        detail: { factors },
      });
    }

    return calculationEnvelope(
      {
        baseCents: input.baseCents,
        coefficient: input.coefficient,
        factors,
        rmiCents,
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
