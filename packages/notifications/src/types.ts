export type NotificationChannel = "in_app" | "email" | "push" | "sms" | "whatsapp";

export type NotificationProviderStatus = "ready" | "not_configured";

export type OutboundNotification = {
  organizationId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  resourceType?: string;
  resourceId?: string;
  channel: NotificationChannel;
};

export type SendNotificationResult = {
  status: "sent" | "not_configured" | "queued";
  notificationId?: string;
};

export interface NotificationProvider {
  readonly status: NotificationProviderStatus;
  readonly channel: NotificationChannel;
  send(message: OutboundNotification): Promise<SendNotificationResult>;
}

export type HolidayCalendarStatus = "READY" | "NOT_CONFIGURED";

export interface HolidayCalendarProvider {
  readonly status: HolidayCalendarStatus;
  isHoliday(date: Date, timezone: string): Promise<boolean>;
}

export type DeadlineCalculationInput = {
  baseDate: Date;
  ruleType: "manual_date" | "calendar_days" | "business_days" | "custom";
  ruleDays?: number | null;
  timezone: string;
  manualDueAt?: Date | null;
};

export type DeadlineCalculationResult = {
  calculatedDueAt: Date | null;
  status: "suggested" | "pending_confirmation" | "not_configured";
  notes: string;
};
