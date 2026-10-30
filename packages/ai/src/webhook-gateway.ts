import { AppError } from "@verasjuris/types";

/**
 * Helpers de WebhookGateway — timestamp, idempotência, tamanho e allowlist.
 * NÃO inclui verificação de assinatura falsa: o caller deve fornecer o verificador real do provedor.
 */

export const WEBHOOK_SIZE_LIMITS = {
  maxBodyBytes: 1_048_576,
  maxHeaderBytes: 16_384,
  maxEventIdLength: 200,
} as const;

export type WebhookTimestampOptions = {
  /** Epoch seconds do header (ex.: Stripe-Signature t=). */
  timestampSeconds: number;
  /** Agora em ms (default Date.now()). */
  nowMs?: number;
  /** Tolerância absoluta em segundos (default 300). */
  toleranceSeconds?: number;
};

export function verifyTimestamp(options: WebhookTimestampOptions): void {
  const nowMs = options.nowMs ?? Date.now();
  const tolerance = options.toleranceSeconds ?? 300;
  if (!Number.isFinite(options.timestampSeconds) || options.timestampSeconds <= 0) {
    throw new AppError("VALIDATION_ERROR", "Timestamp do webhook inválido.");
  }
  const ageSeconds = Math.abs(nowMs / 1000 - options.timestampSeconds);
  if (ageSeconds > tolerance) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Timestamp do webhook fora da janela permitida (possível replay).",
    );
  }
}

export type EventIdStore = {
  has(eventId: string): boolean | Promise<boolean>;
  add(eventId: string): void | Promise<void>;
};

export async function assertUniqueEventId(store: EventIdStore, eventId: string): Promise<void> {
  const trimmed = eventId.trim();
  if (!trimmed || trimmed.length > WEBHOOK_SIZE_LIMITS.maxEventIdLength) {
    throw new AppError("VALIDATION_ERROR", "Identificador de evento do webhook inválido.");
  }
  if (await store.has(trimmed)) {
    throw new AppError("CONFLICT", "Evento de webhook já processado (idempotência).");
  }
  await store.add(trimmed);
}

export function assertBodySize(
  byteLength: number,
  maxBodyBytes: number = WEBHOOK_SIZE_LIMITS.maxBodyBytes,
): void {
  if (byteLength < 0 || byteLength > maxBodyBytes) {
    throw new AppError("VALIDATION_ERROR", "Payload de webhook excede o limite de tamanho.");
  }
}

export function assertHeaderSize(
  byteLength: number,
  maxHeaderBytes: number = WEBHOOK_SIZE_LIMITS.maxHeaderBytes,
): void {
  if (byteLength < 0 || byteLength > maxHeaderBytes) {
    throw new AppError("VALIDATION_ERROR", "Headers de webhook excedem o limite de tamanho.");
  }
}

export function assertProviderAllowed(providerKey: string, allowlist: readonly string[]): void {
  const key = providerKey.trim();
  if (!key || !allowlist.includes(key)) {
    throw new AppError("AUTHORIZATION_ERROR", "Provedor de webhook não está na allowlist.");
  }
}

export type WebhookSignatureVerifier = (input: {
  rawBody: Uint8Array;
  signatureHeader: string;
  secret: string;
  timestampSeconds?: number;
}) => boolean | Promise<boolean>;

/**
 * Exige um verificador real injetado. Recusa se a função estiver ausente —
 * nunca retorna sucesso sem verificação criptográfica.
 */
export async function verifyWebhookSignature(input: {
  verifier: WebhookSignatureVerifier | null | undefined;
  rawBody: Uint8Array;
  signatureHeader: string;
  secret: string;
  timestampSeconds?: number;
}): Promise<void> {
  if (!input.verifier) {
    throw new AppError(
      "NOT_CONFIGURED",
      "Verificador de assinatura de webhook não configurado. Nenhuma assinatura foi aceita.",
    );
  }
  if (!input.signatureHeader || !input.secret) {
    throw new AppError("AUTHENTICATION_ERROR", "Assinatura ou segredo de webhook ausente.");
  }
  const ok = await input.verifier({
    rawBody: input.rawBody,
    signatureHeader: input.signatureHeader,
    secret: input.secret,
    timestampSeconds: input.timestampSeconds,
  });
  if (!ok) {
    throw new AppError("AUTHENTICATION_ERROR", "Assinatura de webhook inválida.");
  }
}

export type WebhookGatewayOptions = {
  allowlist: readonly string[];
  eventIdStore: EventIdStore;
  maxBodyBytes?: number;
  maxHeaderBytes?: number;
  toleranceSeconds?: number;
  verifier?: WebhookSignatureVerifier | null;
};

export class WebhookGateway {
  constructor(private readonly options: WebhookGatewayOptions) {}

  assertProvider(providerKey: string): void {
    assertProviderAllowed(providerKey, this.options.allowlist);
  }

  assertSizes(bodyBytes: number, headerBytes: number): void {
    assertBodySize(bodyBytes, this.options.maxBodyBytes);
    assertHeaderSize(headerBytes, this.options.maxHeaderBytes);
  }

  verifyTimestamp(timestampSeconds: number, nowMs?: number): void {
    verifyTimestamp({
      timestampSeconds,
      nowMs,
      toleranceSeconds: this.options.toleranceSeconds,
    });
  }

  assertUniqueEventId(eventId: string): Promise<void> {
    return assertUniqueEventId(this.options.eventIdStore, eventId);
  }

  verifySignature(input: {
    rawBody: Uint8Array;
    signatureHeader: string;
    secret: string;
    timestampSeconds?: number;
  }): Promise<void> {
    return verifyWebhookSignature({
      verifier: this.options.verifier,
      ...input,
    });
  }
}

/** Store em memória para testes / processo único. */
export class InMemoryWebhookEventIdStore implements EventIdStore {
  private readonly ids = new Set<string>();
  has(eventId: string): boolean {
    return this.ids.has(eventId);
  }
  add(eventId: string): void {
    this.ids.add(eventId);
  }
}
