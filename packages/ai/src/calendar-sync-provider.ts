import { AppError } from "@verasjuris/types";

/**
 * Calendário externo (Google/Microsoft/etc.).
 * Arquivo: calendar-sync-provider.ts — evita choque com domínio interno de calendário.
 * Default: not_configured.
 */

export type CalendarProviderHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type ExternalCalendarRecord = {
  externalCalendarId: string;
  name: string;
  timeZone?: string | null;
  primary?: boolean;
};

export type ExternalCalendarEventInput = {
  organizationId?: string;
  externalCalendarId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  description?: string | null;
  location?: string | null;
  attendees?: readonly string[];
  signal?: AbortSignal;
};

export type ExternalCalendarEventRecord = {
  externalEventId: string | null;
  externalCalendarId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: "confirmed" | "tentative" | "cancelled" | "not_configured";
  providerKey: string;
  detail?: string;
};

export type FreeBusyQueryInput = {
  organizationId?: string;
  externalCalendarIds: readonly string[];
  from: string;
  to: string;
  signal?: AbortSignal;
};

export type FreeBusySlot = {
  externalCalendarId: string;
  startsAt: string;
  endsAt: string;
  busy: boolean;
};

export type CalendarSyncResult = {
  providerKey: string;
  status: "synced" | "partial" | "failed" | "not_configured";
  importedCount: number;
  exportedCount: number;
  detail?: string;
};

export interface CalendarProvider {
  readonly id: string;
  listCalendars(
    organizationId?: string,
    signal?: AbortSignal,
  ): Promise<readonly ExternalCalendarRecord[]>;
  createEvent(input: ExternalCalendarEventInput): Promise<ExternalCalendarEventRecord>;
  updateEvent(
    externalEventId: string,
    input: Partial<ExternalCalendarEventInput> & { externalCalendarId: string },
  ): Promise<ExternalCalendarEventRecord>;
  deleteEvent(
    externalCalendarId: string,
    externalEventId: string,
    signal?: AbortSignal,
  ): Promise<void>;
  sync(organizationId?: string, signal?: AbortSignal): Promise<CalendarSyncResult>;
  freeBusy(input: FreeBusyQueryInput): Promise<readonly FreeBusySlot[]>;
  healthCheck(): Promise<CalendarProviderHealth>;
}

const MESSAGE = "Nenhum provedor de calendário externo está configurado.";

function notConfiguredEvent(
  calendarId: string,
  title = "",
  startsAt = "",
  endsAt = "",
): ExternalCalendarEventRecord {
  return {
    externalEventId: null,
    externalCalendarId: calendarId,
    title,
    startsAt,
    endsAt,
    status: "not_configured",
    providerKey: "not_configured",
    detail: MESSAGE,
  };
}

export class NotConfiguredCalendarProvider implements CalendarProvider {
  readonly id = "not_configured";

  listCalendars(
    _organizationId?: string,
    _signal?: AbortSignal,
  ): Promise<readonly ExternalCalendarRecord[]> {
    return Promise.resolve([]);
  }

  createEvent(input: ExternalCalendarEventInput): Promise<ExternalCalendarEventRecord> {
    return Promise.resolve(
      notConfiguredEvent(input.externalCalendarId, input.title, input.startsAt, input.endsAt),
    );
  }

  updateEvent(
    _externalEventId: string,
    input: Partial<ExternalCalendarEventInput> & { externalCalendarId: string },
  ): Promise<ExternalCalendarEventRecord> {
    return Promise.resolve(
      notConfiguredEvent(
        input.externalCalendarId,
        input.title ?? "",
        input.startsAt ?? "",
        input.endsAt ?? "",
      ),
    );
  }

  deleteEvent(
    _externalCalendarId: string,
    _externalEventId: string,
    _signal?: AbortSignal,
  ): Promise<void> {
    return Promise.resolve();
  }

  sync(_organizationId?: string, _signal?: AbortSignal): Promise<CalendarSyncResult> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      importedCount: 0,
      exportedCount: 0,
      detail: MESSAGE,
    });
  }

  freeBusy(_input: FreeBusyQueryInput): Promise<readonly FreeBusySlot[]> {
    return Promise.resolve([]);
  }

  healthCheck(): Promise<CalendarProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: MESSAGE,
      checkedAt: new Date().toISOString(),
    });
  }
}

export function calendarProviderNotConfiguredError(): AppError {
  return new AppError("NOT_CONFIGURED", MESSAGE);
}
