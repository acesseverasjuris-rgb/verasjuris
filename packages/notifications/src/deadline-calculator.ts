import type { HolidayCalendarProvider } from "./types.js";
import type { DeadlineCalculationInput, DeadlineCalculationResult } from "./types.js";

function addCalendarDays(base: Date, days: number): Date {
  const result = new Date(base.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

async function addBusinessDays(
  base: Date,
  days: number,
  holidays: HolidayCalendarProvider,
  timezone: string,
): Promise<{ due: Date; holidayProviderReady: boolean }> {
  let remaining = days;
  let cursor = new Date(base.getTime());
  const holidayReady = holidays.status === "READY";
  while (remaining > 0) {
    cursor = addCalendarDays(cursor, 1);
    const weekday = cursor.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    if (holidayReady && (await holidays.isHoliday(cursor, timezone))) continue;
    remaining -= 1;
  }
  return { due: cursor, holidayProviderReady: holidayReady };
}

/**
 * Calculadora interna de prazos.
 * Com HolidayCalendar NOT_CONFIGURED, business_days ignora feriados e o resultado
 * permanece SUGGESTED / PENDING_CONFIRMATION — nunca definitivo jurídico.
 */
export async function calculateDeadlineDueAt(
  input: DeadlineCalculationInput,
  holidays: HolidayCalendarProvider,
): Promise<DeadlineCalculationResult> {
  if (input.ruleType === "manual_date") {
    if (!input.manualDueAt) {
      return {
        calculatedDueAt: null,
        status: "pending_confirmation",
        notes: "Informe a data manual do prazo.",
      };
    }
    return {
      calculatedDueAt: input.manualDueAt,
      status: "suggested",
      notes: "Data informada manualmente. Confirme a regra e o termo inicial.",
    };
  }

  if (input.ruleType === "custom") {
    return {
      calculatedDueAt: input.manualDueAt ?? null,
      status: "pending_confirmation",
      notes: "Regra customizada exige conferência humana. Não há motor jurídico universal.",
    };
  }

  const days = input.ruleDays ?? 0;
  if (days <= 0) {
    return {
      calculatedDueAt: null,
      status: "pending_confirmation",
      notes: "Quantidade de dias inválida para o cálculo.",
    };
  }

  if (input.ruleType === "calendar_days") {
    return {
      calculatedDueAt: addCalendarDays(input.baseDate, days),
      status: "suggested",
      notes: "Prazo sugerido em dias corridos. Confirme a regra e o termo inicial.",
    };
  }

  const { due, holidayProviderReady } = await addBusinessDays(
    input.baseDate,
    days,
    holidays,
    input.timezone,
  );

  if (!holidayProviderReady) {
    return {
      calculatedDueAt: due,
      status: "suggested",
      notes:
        "Prazo sugerido em dias úteis básicos (sáb/dom excluídos). Calendário oficial de feriados: NOT_CONFIGURED — não trate como prazo jurídico definitivo.",
    };
  }

  return {
    calculatedDueAt: due,
    status: "suggested",
    notes: "Prazo sugerido em dias úteis com calendário de feriados. Confirme a regra.",
  };
}
