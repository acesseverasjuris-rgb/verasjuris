import type { EmailProvider, EmailSendResult, SendEmailInput } from "./email-provider.js";
import { NotConfiguredEmailProvider } from "./email-provider.js";
import type { PushProvider, PushSendResult, SendPushInput } from "./push-provider.js";
import { NotConfiguredPushProvider } from "./push-provider.js";
import type { SendSmsInput, SmsProvider, SmsSendResult } from "./sms-provider.js";
import { NotConfiguredSmsProvider } from "./sms-provider.js";
import type {
  SendWhatsAppInput,
  WhatsAppProvider,
  WhatsAppSendResult,
} from "./whatsapp-provider.js";
import { NotConfiguredWhatsAppProvider } from "./whatsapp-provider.js";

export type CommunicationChannelKey = "email" | "sms" | "whatsapp" | "push";

export type ChannelDeliveryStatus = "not_configured" | "queued" | "sent" | "delivered" | "failed";

export type ChannelSendResult = {
  channel: CommunicationChannelKey;
  externalMessageId: string | null;
  status: ChannelDeliveryStatus;
  providerKey: string;
};

export type ChannelSendInput = {
  channel: CommunicationChannelKey;
  email?: SendEmailInput;
  sms?: SendSmsInput;
  whatsapp?: SendWhatsAppInput;
  push?: SendPushInput;
  signal?: AbortSignal;
};

export type ChannelHealth = {
  channel: CommunicationChannelKey;
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export interface CommunicationChannelAdapter {
  readonly channel: CommunicationChannelKey;
  send(input: ChannelSendInput): Promise<ChannelSendResult>;
  getStatus(externalMessageId: string, signal?: AbortSignal): Promise<ChannelSendResult>;
  healthCheck(): Promise<ChannelHealth>;
  supportsTemplate(): boolean;
  supportsAttachments(): boolean;
}

function normalizeChannelStatus(status: string): ChannelDeliveryStatus {
  if (status === "not_configured") return "not_configured";
  if (status === "queued" || status === "sent" || status === "delivered" || status === "failed") {
    return status;
  }
  if (status === "bounced" || status === "read") return "failed";
  return "failed";
}

function mapEmailResult(result: EmailSendResult): ChannelSendResult {
  return {
    channel: "email",
    externalMessageId: result.externalMessageId,
    status: normalizeChannelStatus(result.status),
    providerKey: result.providerKey,
  };
}

function mapSmsResult(result: SmsSendResult): ChannelSendResult {
  return {
    channel: "sms",
    externalMessageId: result.externalMessageId,
    status: normalizeChannelStatus(result.status),
    providerKey: result.providerKey,
  };
}

function mapWhatsAppResult(result: WhatsAppSendResult): ChannelSendResult {
  return {
    channel: "whatsapp",
    externalMessageId: result.externalMessageId,
    status: normalizeChannelStatus(result.status),
    providerKey: result.providerKey,
  };
}

function mapPushResult(result: PushSendResult): ChannelSendResult {
  return {
    channel: "push",
    externalMessageId: result.externalMessageId,
    status: normalizeChannelStatus(result.status),
    providerKey: result.providerKey,
  };
}

export class EmailCommunicationChannel implements CommunicationChannelAdapter {
  readonly channel = "email" as const;

  constructor(private readonly provider: EmailProvider = new NotConfiguredEmailProvider()) {}

  send(input: ChannelSendInput): Promise<ChannelSendResult> {
    if (!input.email) {
      return Promise.reject(new Error("Payload de e-mail ausente."));
    }
    return this.provider.send(input.email).then(mapEmailResult);
  }

  getStatus(externalMessageId: string, signal?: AbortSignal): Promise<ChannelSendResult> {
    return this.provider.getStatus(externalMessageId, signal).then(mapEmailResult);
  }

  healthCheck(): Promise<ChannelHealth> {
    return this.provider.healthCheck().then((h) => ({
      channel: "email",
      status: h.status,
      detail: h.detail,
      checkedAt: h.checkedAt,
    }));
  }

  supportsTemplate(): boolean {
    return this.provider.supportsTemplate();
  }

  supportsAttachments(): boolean {
    return this.provider.supportsAttachments();
  }
}

export class SmsCommunicationChannel implements CommunicationChannelAdapter {
  readonly channel = "sms" as const;

  constructor(private readonly provider: SmsProvider = new NotConfiguredSmsProvider()) {}

  send(input: ChannelSendInput): Promise<ChannelSendResult> {
    if (!input.sms) {
      return Promise.reject(new Error("Payload de SMS ausente."));
    }
    return this.provider.send(input.sms).then(mapSmsResult);
  }

  getStatus(externalMessageId: string, signal?: AbortSignal): Promise<ChannelSendResult> {
    return this.provider.getStatus(externalMessageId, signal).then(mapSmsResult);
  }

  healthCheck(): Promise<ChannelHealth> {
    return this.provider.healthCheck().then((h) => ({
      channel: "sms",
      status: h.status,
      detail: h.detail,
      checkedAt: h.checkedAt,
    }));
  }

  supportsTemplate(): boolean {
    return this.provider.supportsTemplate();
  }

  supportsAttachments(): boolean {
    return this.provider.supportsAttachments();
  }
}

export class WhatsAppCommunicationChannel implements CommunicationChannelAdapter {
  readonly channel = "whatsapp" as const;

  constructor(private readonly provider: WhatsAppProvider = new NotConfiguredWhatsAppProvider()) {}

  send(input: ChannelSendInput): Promise<ChannelSendResult> {
    if (!input.whatsapp) {
      return Promise.reject(new Error("Payload de WhatsApp ausente."));
    }
    return this.provider.send(input.whatsapp).then(mapWhatsAppResult);
  }

  getStatus(externalMessageId: string, signal?: AbortSignal): Promise<ChannelSendResult> {
    return this.provider.getStatus(externalMessageId, signal).then(mapWhatsAppResult);
  }

  healthCheck(): Promise<ChannelHealth> {
    return this.provider.healthCheck().then((h) => ({
      channel: "whatsapp",
      status: h.status,
      detail: h.detail,
      checkedAt: h.checkedAt,
    }));
  }

  supportsTemplate(): boolean {
    return this.provider.supportsTemplate();
  }

  supportsAttachments(): boolean {
    return this.provider.supportsAttachments();
  }
}

export class PushCommunicationChannel implements CommunicationChannelAdapter {
  readonly channel = "push" as const;

  constructor(private readonly provider: PushProvider = new NotConfiguredPushProvider()) {}

  send(input: ChannelSendInput): Promise<ChannelSendResult> {
    if (!input.push) {
      return Promise.reject(new Error("Payload de push ausente."));
    }
    return this.provider.send(input.push).then(mapPushResult);
  }

  getStatus(externalMessageId: string, signal?: AbortSignal): Promise<ChannelSendResult> {
    return this.provider.getStatus(externalMessageId, signal).then(mapPushResult);
  }

  healthCheck(): Promise<ChannelHealth> {
    return this.provider.healthCheck().then((h) => ({
      channel: "push",
      status: h.status,
      detail: h.detail,
      checkedAt: h.checkedAt,
    }));
  }

  supportsTemplate(): boolean {
    return this.provider.supportsTemplate();
  }

  supportsAttachments(): boolean {
    return this.provider.supportsAttachments();
  }
}

export function createDefaultCommunicationChannels(): Record<
  CommunicationChannelKey,
  CommunicationChannelAdapter
> {
  return {
    email: new EmailCommunicationChannel(),
    sms: new SmsCommunicationChannel(),
    whatsapp: new WhatsAppCommunicationChannel(),
    push: new PushCommunicationChannel(),
  };
}
