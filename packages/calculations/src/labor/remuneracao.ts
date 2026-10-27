import {
  assertSafeNonNegativeInt,
  type CalculationEnvelope,
  type CalculationMemoryStep,
  calculationEnvelope,
  type MoneyCents,
} from "../types.js";

export type RemuneracaoComponent = {
  key: string;
  amountCents: MoneyCents;
  kind: "base" | "variable" | "addition" | "other";
  includedInAverage?: boolean;
};

export type RemuneracaoInput = {
  ruleSetVersion: string;
  components: readonly RemuneracaoComponent[];
};

export type RemuneracaoResult = {
  baseCents: MoneyCents;
  additionsCents: MoneyCents;
  variablesCents: MoneyCents;
  averageCents: MoneyCents;
  totalCents: MoneyCents;
};

export function calculateRemuneracao(
  input: RemuneracaoInput,
): CalculationEnvelope<RemuneracaoResult> {
  const memory: CalculationMemoryStep[] = [];
  const warnings: string[] = [];
  const missingData: string[] = [];

  let baseCents = 0;
  let additionsCents = 0;
  let variablesCents = 0;
  let averageSum = 0;
  let averageCount = 0;
  let totalCents = 0;

  if (input.components.length === 0) {
    missingData.push("components");
  }

  for (const component of input.components) {
    assertSafeNonNegativeInt(component.amountCents, `amountCents:${component.key}`);
    totalCents += component.amountCents;
    switch (component.kind) {
      case "base":
        baseCents += component.amountCents;
        break;
      case "addition":
        additionsCents += component.amountCents;
        break;
      case "variable":
        variablesCents += component.amountCents;
        break;
      default:
        break;
    }
    if (component.includedInAverage !== false) {
      averageSum += component.amountCents;
      averageCount += 1;
    }
    memory.push({
      key: "remuneracao_component",
      description: "Componente de remuneração acumulado.",
      detail: { ...component },
    });
  }

  const averageCents = averageCount === 0 ? 0 : Math.floor(averageSum / averageCount);
  memory.push({
    key: "remuneracao_summary",
    description: "Resumo de bases/médias/adicionais (centavos).",
    detail: { baseCents, additionsCents, variablesCents, averageCents, totalCents },
  });

  return calculationEnvelope(
    {
      baseCents,
      additionsCents,
      variablesCents,
      averageCents,
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
