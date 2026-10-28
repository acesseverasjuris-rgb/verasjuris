import { AppError } from "@verasjuris/types";

export type EmailProviderHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type EmailDeliveryStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "bounced"
  | "not_configured";

export type EmailAttachment = {
  filename: string;
  mimeType: string;
  body: Uint8Array | string;
};

export type SendEmailInput = {
  to: string;
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  templateId?: string;
  templateVariables?: Record<string, string>;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export type EmailSendResult = {
  externalMessageId: string | null;
  status: EmailDeliveryStatus;
  providerKey: string;
};

export interface EmailProvider {
  readonly id: string;
  send(input: SendEmailInput): Promise<EmailSendResult>;
  getStatus(externalMessageId: string, signal?: AbortSignal): Promise<EmailSendResult>;
  healthCheck(): Promise<EmailProviderHealth>;
  supportsTemplate(): boolean;
  supportsAttachments(): boolean;
}

const MESSAGE = "Nenhum provedor de e-mail transacional está configurado.";

export class NotConfiguredEmailProvider implements EmailProvider {
  readonly id = "not_configured";

  send(_input: SendEmailInput): Promise<EmailSendResult> {
    return Promise.resolve({
      externalMessageId: null,
      status: "not_configured",
      providerKey: "not_configured",
    });
  }

  getStatus(_externalMessageId: string): Promise<EmailSendResult> {
    return Promise.resolve({
      externalMessageId: null,
      status: "not_configured",
      providerKey: "not_configured",
    });
  }

  healthCheck(): Promise<EmailProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor de e-mail não configurado.",
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

export function emailProviderNotConfiguredError(): AppError {
  return new AppError("EMAIL_PROVIDER_NOT_CONFIGURED", MESSAGE);
}
