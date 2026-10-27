import {
  assertSafeNonNegativeInt,
  type CalculationEnvelope,
  type CalculationMemoryStep,
  calculationEnvelope,
} from "../types.js";

export type TimeRecordSegment = {
  id?: string;
  /** Minutos desde meia-noite (0–1440+ para cruzar dia). */
  startMinute: number;
  endMinute: number;
  kind: "normal" | "overtime" | "interval" | "night";
};

export type JornadaInput = {
  ruleSetVersion: string;
  records: readonly TimeRecordSegment[];
};

export type JornadaResult = {
  normalMinutes: number;
  overtimeMinutes: number;
  intervalMinutes: number;
  nightMinutes: number;
  overlapWarnings: string[];
};

function segmentsOverlap(a: TimeRecordSegment, b: TimeRecordSegment): boolean {
  return a.startMinute < b.endMinute && b.startMinute < a.endMinute;
}

/**
 * Agrega minutos de jornada a partir de registros.
 * Sobreposições geram warning (não inventa regra jurídica).
 */
export function calculateJornada(input: JornadaInput): CalculationEnvelope<JornadaResult> {
  const memory: CalculationMemoryStep[] = [];
  const warnings: string[] = [];
  const missingData: string[] = [];
  const overlapWarnings: string[] = [];

  let normalMinutes = 0;
  let overtimeMinutes = 0;
  let intervalMinutes = 0;
  let nightMinutes = 0;

  const records = input.records.map((record, index) => ({
    ...record,
    id: record.id ?? `record-${index + 1}`,
  }));

  if (records.length === 0) {
    missingData.push("records");
  }

  for (let i = 0; i < records.length; i += 1) {
    for (let j = i + 1; j < records.length; j += 1) {
      const a = records[i]!;
      const b = records[j]!;
      if (!segmentsOverlap(a, b)) continue;
      const message = `Sobreposição de registros de jornada: ${a.id} e ${b.id}.`;
      overlapWarnings.push(message);
      warnings.push(message);
    }
  }

  for (const record of records) {
    assertSafeNonNegativeInt(record.startMinute, `startMinute:${record.id}`);
    assertSafeNonNegativeInt(record.endMinute, `endMinute:${record.id}`);
    if (record.endMinute < record.startMinute) {
      warnings.push(`Registro inválido ignorado (${record.id}): fim anterior ao início.`);
      continue;
    }
    const minutes = record.endMinute - record.startMinute;
    switch (record.kind) {
      case "normal":
        normalMinutes += minutes;
        break;
      case "overtime":
        overtimeMinutes += minutes;
        break;
      case "interval":
        intervalMinutes += minutes;
        break;
      case "night":
        nightMinutes += minutes;
        break;
      default:
        warnings.push(`Tipo de registro desconhecido ignorado (${record.id}).`);
    }
    memory.push({
      key: "jornada_segment",
      description: "Segmento de jornada acumulado.",
      detail: {
        id: record.id,
        kind: record.kind,
        minutes,
      },
    });
  }

  memory.push({
    key: "jornada_summary",
    description: "Totais de minutos por tipo.",
    detail: { normalMinutes, overtimeMinutes, intervalMinutes, nightMinutes },
  });

  return calculationEnvelope(
    {
      normalMinutes,
      overtimeMinutes,
      intervalMinutes,
      nightMinutes,
      overlapWarnings,
    },
    {
      ruleSetVersion: input.ruleSetVersion,
      memory,
      warnings,
      missingData,
    },
  );
}
