import { AppError } from "@verasjuris/types";

export type WhatsAppProviderHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type WhatsAppDeliveryStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "not_configured";

export type SendWhatsAppInput = {
  to: string;
  body: string;
  templateName?: string;
  templateVariables?: Record<string, string>;
  mediaUrl?: string;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export type WhatsAppSendResult = {
  externalMessageId: string | null;
  status: WhatsAppDeliveryStatus;
  providerKey: string;
};

export interface WhatsAppProvider {
  readonly id: string;
  send(input: SendWhatsAppInput): Promise<WhatsAppSendResult>;
  getStatus(externalMessageId: string, signal?: AbortSignal): Promise<WhatsAppSendResult>;
  healthCheck(): Promise<WhatsAppProviderHealth>;
  supportsTemplate(): boolean;
  supportsAttachments(): boolean;
}

const MESSAGE = "Nenhum provedor de WhatsApp está configurado.";

export class NotConfiguredWhatsAppProvider implements WhatsAppProvider {
  readonly id = "not_configured";

  send(_input: SendWhatsAppInput): Promise<WhatsAppSendResult> {
    return Promise.resolve({
      externalMessageId: null,
      status: "not_configured",
      providerKey: "not_configured",
    });
  }

  getStatus(_externalMessageId: string): Promise<WhatsAppSendResult> {
    return Promise.resolve({
      externalMessageId: null,
      status: "not_configured",
      providerKey: "not_configured",
    });
  }

  healthCheck(): Promise<WhatsAppProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor de WhatsApp não configurado.",
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

export function whatsAppProviderNotConfiguredError(): AppError {
  return new AppError("WHATSAPP_PROVIDER_NOT_CONFIGURED", MESSAGE);
}
