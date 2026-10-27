import { AppError } from "@verasjuris/types";

export const CALENDAR_EVENT_STATUSES = [
  "scheduled",
  "confirmed",
  "rescheduled",
  "completed",
  "cancelled",
] as const;
export type CalendarEventStatus = (typeof CALENDAR_EVENT_STATUSES)[number];

const EVENT_TRANSITIONS: Record<CalendarEventStatus, readonly CalendarEventStatus[]> = {
  scheduled: ["confirmed", "rescheduled", "completed", "cancelled"],
  confirmed: ["rescheduled", "completed", "cancelled"],
  rescheduled: ["scheduled", "confirmed", "completed", "cancelled"],
  completed: [],
  cancelled: ["scheduled"],
};

export function assertCalendarEventTransition(
  from: CalendarEventStatus,
  to: CalendarEventStatus,
): void {
  if (from === to) return;
  if (!EVENT_TRANSITIONS[from].includes(to)) {
    throw new AppError(
      "CONFLICT",
      `A transição de status do compromisso de “${from}” para “${to}” não é permitida.`,
    );
  }
}
