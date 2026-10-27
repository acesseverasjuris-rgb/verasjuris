import {
  type CalculationEnvelope,
  type CalculationMemoryStep,
  calculationEnvelope,
} from "../types.js";

export type CarenciaCompetenceInput = {
  /** Competência AAAA-MM. */
  competence: string;
  /** Marca competências a excluir do cômputo. */
  excluded?: boolean;
  exclusionReason?: string;
};

export type CarenciaInput = {
  ruleSetVersion: string;
  competences: readonly CarenciaCompetenceInput[];
  /** Meta de meses de carência (informativa). */
  requiredMonths?: number;
};

export type CarenciaResult = {
  validMonths: number;
  requiredMonths: number | null;
  countedCompetences: string[];
  excludedCompetences: string[];
  duplicateCompetences: string[];
  carenciaMet: boolean | null;
};

/**
 * Conta meses de carência válidos.
 * Rejeita competências duplicadas (não contam; entram em warning).
 */
export function calculateCarencia(input: CarenciaInput): CalculationEnvelope<CarenciaResult> {
  const memory: CalculationMemoryStep[] = [];
  const warnings: string[] = [];
  const missingData: string[] = [];

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  const counted: string[] = [];
  const excluded: string[] = [];

  for (const item of input.competences) {
    const competence = item.competence.trim();
    if (!/^\d{4}-\d{2}$/.test(competence)) {
      warnings.push(`Competência inválida ignorada: ${item.competence}`);
      memory.push({
        key: "invalid_competence",
        description: "Competência fora do formato AAAA-MM foi ignorada.",
        detail: { competence: item.competence },
      });
      continue;
    }

    if (seen.has(competence)) {
      duplicates.add(competence);
      warnings.push(`Competência duplicada rejeitada: ${competence}`);
      memory.push({
        key: "duplicate_competence",
        description: "Competência duplicada rejeitada do cômputo de carência.",
        detail: { competence },
      });
      continue;
    }
    seen.add(competence);

    if (item.excluded) {
      excluded.push(competence);
      memory.push({
        key: "excluded_competence",
        description: item.exclusionReason ?? "Competência excluída do cômputo.",
        detail: { competence },
      });
      continue;
    }

    counted.push(competence);
    memory.push({
      key: "counted_competence",
      description: "Competência contabilizada na carência.",
      detail: { competence },
    });
  }

  counted.sort();
  excluded.sort();
  const duplicateCompetences = [...duplicates].sort();

  const requiredMonths =
    input.requiredMonths !== undefined && Number.isSafeInteger(input.requiredMonths)
      ? input.requiredMonths
      : null;

  if (requiredMonths === null) {
    missingData.push("requiredMonths");
  }

  const validMonths = counted.length;
  const carenciaMet = requiredMonths === null ? null : validMonths >= requiredMonths;

  memory.push({
    key: "carencia_summary",
    description: "Resumo do cômputo de carência.",
    detail: {
      validMonths,
      requiredMonths,
      countedCompetences: counted,
      carenciaMet,
    },
  });

  return calculationEnvelope(
    {
      validMonths,
      requiredMonths,
      countedCompetences: counted,
      excludedCompetences: excluded,
      duplicateCompetences,
      carenciaMet,
    },
    {
      ruleSetVersion: input.ruleSetVersion,
      memory,
      warnings,
      missingData,
    },
  );
}
