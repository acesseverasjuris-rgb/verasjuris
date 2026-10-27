import { AppError } from "@verasjuris/types";
import type {
  HolidayCalendarProvider,
  NotificationProvider,
  OutboundNotification,
  SendNotificationResult,
} from "./types.js";

/** Canal in-app: a persistência fica a cargo do serviço da API. */
export class InAppNotificationProvider implements NotificationProvider {
  readonly status = "ready" as const;
  readonly channel = "in_app" as const;
  readonly outbox: OutboundNotification[] = [];

  async send(message: OutboundNotification): Promise<SendNotificationResult> {
    if (message.channel !== "in_app") {
      throw new AppError("VALIDATION_ERROR", "Canal incompatível com o provider in-app.");
    }
    this.outbox.push(message);
    return { status: "queued" };
  }
}

export class NotConfiguredNotificationProvider implements NotificationProvider {
  readonly status = "not_configured" as const;
  constructor(readonly channel: NotificationProvider["channel"]) {}

  async send(_message: OutboundNotification): Promise<SendNotificationResult> {
    return { status: "not_configured" };
  }
}

/** Nenhum calendário oficial de feriados está conectado. */
export class NotConfiguredHolidayCalendar implements HolidayCalendarProvider {
  readonly status = "NOT_CONFIGURED" as const;

  async isHoliday(_date: Date, _timezone: string): Promise<boolean> {
    return false;
  }
}
