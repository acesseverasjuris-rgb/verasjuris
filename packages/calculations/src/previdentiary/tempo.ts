import {
  type CalculationEnvelope,
  type CalculationMemoryStep,
  calculationEnvelope,
  daysBetweenInclusive,
  periodsOverlap,
} from "../types.js";

export type ContributionPeriodKind = "comum" | "especial" | "rural" | "publico" | "other";

export type ContributionPeriod = {
  id?: string;
  start: string;
  end: string;
  kind: ContributionPeriodKind;
};

export type TempoInput = {
  ruleSetVersion: string;
  periods: readonly ContributionPeriod[];
};

export type OverlapDetail = {
  periodAId: string;
  periodBId: string;
  overlapStart: string;
  overlapEnd: string;
  overlapDays: number;
};

export type TempoResult = {
  totalDaysCounted: number;
  daysByKind: Record<string, number>;
  overlaps: OverlapDetail[];
  concurrentPeriodsDetected: boolean;
};

type DayKey = string;

function enumerateDays(start: string, end: string): DayKey[] {
  const days: DayKey[] = [];
  let cursor = Date.parse(`${start}T00:00:00.000Z`);
  const endMs = Date.parse(`${end}T00:00:00.000Z`);
  if (Number.isNaN(cursor) || Number.isNaN(endMs) || endMs < cursor) return days;
  while (cursor <= endMs) {
    days.push(new Date(cursor).toISOString().slice(0, 10));
    cursor += 86_400_000;
  }
  return days;
}

/**
 * Tempo de contribuição com detecção de sobreposição.
 * Dias sobrepostos não são contados em dobro.
 */
export function calculateContributionTime(input: TempoInput): CalculationEnvelope<TempoResult> {
  const memory: CalculationMemoryStep[] = [];
  const warnings: string[] = [];
  const missingData: string[] = [];

  const periods = input.periods
    .map((p, index) => ({
      ...p,
      id: p.id ?? `period-${index + 1}`,
    }))
    .filter((p) => {
      if (p.start > p.end) {
        warnings.push(`Período inválido ignorado (${p.id}): fim anterior ao início.`);
        return false;
      }
      return true;
    });

  if (periods.length === 0) {
    missingData.push("periods");
  }

  const overlaps: OverlapDetail[] = [];
  for (let i = 0; i < periods.length; i += 1) {
    for (let j = i + 1; j < periods.length; j += 1) {
      const a = periods[i]!;
      const b = periods[j]!;
      if (!periodsOverlap(a, b)) continue;
      const overlapStart = a.start > b.start ? a.start : b.start;
      const overlapEnd = a.end < b.end ? a.end : b.end;
      overlaps.push({
        periodAId: a.id,
        periodBId: b.id,
        overlapStart,
        overlapEnd,
        overlapDays: daysBetweenInclusive(overlapStart, overlapEnd),
      });
    }
  }

  const concurrentPeriodsDetected = overlaps.length > 0;
  if (concurrentPeriodsDetected) {
    warnings.push(
      "Períodos concomitantes/sobrepostos detectados; dias sobrepostos não foram contados em dobro.",
    );
    memory.push({
      key: "overlaps",
      description: "Sobreposições detectadas entre períodos.",
      detail: { overlaps },
    });
  }

  // Contagem por dia civil (UTC): um dia conta no máximo uma vez.
  const countedDays = new Map<DayKey, ContributionPeriodKind>();
  const daysByKind: Record<string, number> = {};

  for (const period of periods) {
    const days = enumerateDays(period.start, period.end);
    let newlyCounted = 0;
    let skippedOverlap = 0;
    for (const day of days) {
      if (countedDays.has(day)) {
        skippedOverlap += 1;
        continue;
      }
      countedDays.set(day, period.kind);
      daysByKind[period.kind] = (daysByKind[period.kind] ?? 0) + 1;
      newlyCounted += 1;
    }
    memory.push({
      key: "period_counted",
      description: "Período processado no tempo de contribuição.",
      detail: {
        id: period.id,
        kind: period.kind,
        start: period.start,
        end: period.end,
        newlyCountedDays: newlyCounted,
        skippedOverlapDays: skippedOverlap,
      },
    });
  }

  const totalDaysCounted = countedDays.size;
  memory.push({
    key: "tempo_summary",
    description: "Resumo do tempo de contribuição (dias únicos).",
    detail: { totalDaysCounted, daysByKind },
  });

  return calculationEnvelope(
    {
      totalDaysCounted,
      daysByKind,
      overlaps,
      concurrentPeriodsDetected,
    },
    {
      ruleSetVersion: input.ruleSetVersion,
      memory,
      warnings,
      missingData,
    },
  );
}
