import { AppError } from "@verasjuris/types";

export type PushProviderHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type PushDeliveryStatus = "queued" | "sent" | "delivered" | "failed" | "not_configured";

export type SendPushInput = {
  deviceToken: string;
  title?: string;
  body: string;
  data?: Record<string, string>;
  templateId?: string;
  templateVariables?: Record<string, string>;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export type PushSendResult = {
  externalMessageId: string | null;
  status: PushDeliveryStatus;
  providerKey: string;
};

export interface PushProvider {
  readonly id: string;
  send(input: SendPushInput): Promise<PushSendResult>;
  getStatus(externalMessageId: string, signal?: AbortSignal): Promise<PushSendResult>;
  healthCheck(): Promise<PushProviderHealth>;
  supportsTemplate(): boolean;
  supportsAttachments(): boolean;
}

const MESSAGE = "Nenhum provedor de push notification está configurado.";

export class NotConfiguredPushProvider implements PushProvider {
  readonly id = "not_configured";

  send(_input: SendPushInput): Promise<PushSendResult> {
    return Promise.resolve({
      externalMessageId: null,
      status: "not_configured",
      providerKey: "not_configured",
    });
  }

  getStatus(_externalMessageId: string): Promise<PushSendResult> {
    return Promise.resolve({
      externalMessageId: null,
      status: "not_configured",
      providerKey: "not_configured",
    });
  }

  healthCheck(): Promise<PushProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor de push não configurado.",
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

export function pushProviderNotConfiguredError(): AppError {
  return new AppError("PUSH_PROVIDER_NOT_CONFIGURED", MESSAGE);
}
