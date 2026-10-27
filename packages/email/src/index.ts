export type EmailKind = "email_verification" | "password_reset" | "organization_invitation";

export type EmailDeliveryStatus = "sent" | "not_configured" | "captured";

export type OutboundEmail = {
  kind: EmailKind;
  to: string;
  subject: string;
  text: string;
  /** Presente apenas no adapter de memória (testes/dev). Nunca expor via API pública. */
  token?: string;
  metadata?: Record<string, string>;
};

export type SendEmailResult = {
  status: EmailDeliveryStatus;
};

export interface EmailProvider {
  readonly status: "not_configured" | "memory";
  send(message: OutboundEmail): Promise<SendEmailResult>;
}

export class NotConfiguredEmailProvider implements EmailProvider {
  readonly status = "not_configured" as const;

  async send(_message: OutboundEmail): Promise<SendEmailResult> {
    return { status: "not_configured" };
  }
}

export class MemoryEmailProvider implements EmailProvider {
  readonly status = "memory" as const;
  readonly outbox: OutboundEmail[] = [];

  async send(message: OutboundEmail): Promise<SendEmailResult> {
    this.outbox.push(message);
    return { status: "captured" };
  }

  latest(kind?: EmailKind, to?: string): OutboundEmail | undefined {
    for (let index = this.outbox.length - 1; index >= 0; index -= 1) {
      const item = this.outbox[index];
      if (!item) continue;
      if (kind && item.kind !== kind) continue;
      if (to && item.to !== to) continue;
      return item;
    }
    return undefined;
  }

  clear(): void {
    this.outbox.length = 0;
  }
}

export type EmailProviderMode = "not_configured" | "memory";

export function createEmailProvider(mode: EmailProviderMode = "not_configured"): EmailProvider {
  if (mode === "memory") return new MemoryEmailProvider();
  return new NotConfiguredEmailProvider();
}

export function publicEmailDeliveryMessage(status: EmailDeliveryStatus): string {
  if (status === "not_configured") {
    return "O envio por e-mail ainda não está configurado neste ambiente.";
  }
  if (status === "captured") {
    return "A mensagem foi capturada pelo adaptador de desenvolvimento. Nenhum e-mail real foi enviado.";
  }
  return "Se existir uma conta elegível para este e-mail, enviaremos as próximas instruções.";
}
