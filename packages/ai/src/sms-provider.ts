import { AppError } from "@verasjuris/types";

export type SmsProviderHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type SmsDeliveryStatus = "queued" | "sent" | "delivered" | "failed" | "not_configured";

export type SendSmsInput = {
  to: string;
  body: string;
  templateId?: string;
  templateVariables?: Record<string, string>;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export type SmsSendResult = {
  externalMessageId: string | null;
  status: SmsDeliveryStatus;
  providerKey: string;
};

export interface SmsProvider {
  readonly id: string;
  send(input: SendSmsInput): Promise<SmsSendResult>;
  getStatus(externalMessageId: string, signal?: AbortSignal): Promise<SmsSendResult>;
  healthCheck(): Promise<SmsProviderHealth>;
  supportsTemplate(): boolean;
  supportsAttachments(): boolean;
}

const MESSAGE = "Nenhum provedor de SMS está configurado.";

export class NotConfiguredSmsProvider implements SmsProvider {
  readonly id = "not_configured";

  send(_input: SendSmsInput): Promise<SmsSendResult> {
    return Promise.resolve({
      externalMessageId: null,
      status: "not_configured",
      providerKey: "not_configured",
    });
  }

  getStatus(_externalMessageId: string): Promise<SmsSendResult> {
    return Promise.resolve({
      externalMessageId: null,
      status: "not_configured",
      providerKey: "not_configured",
    });
  }

  healthCheck(): Promise<SmsProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor de SMS não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }

  supportsTemplate(): boolean {
    return false;
  }

  supportsAttachments(): boolean {
    return false;
  }
}

export function smsProviderNotConfiguredError(): AppError {
  return new AppError("SMS_PROVIDER_NOT_CONFIGURED", MESSAGE);
}
