import { AppError, type ErrorCode } from "@verasjuris/types";

/**
 * Nenhum provedor de IA configurado (ou IA desligada). Mapeia para o código
 * `AI_PROVIDER_NOT_CONFIGURED` (HTTP 503). Nada foi gerado e nenhum fornecedor foi chamado.
 */
export class AiNotConfiguredError extends AppError {
  readonly outcome = "not_configured" as const;
  readonly recorded = false as const;

  constructor(message: string) {
    super("AI_PROVIDER_NOT_CONFIGURED", message);
    this.name = "AiNotConfiguredError";
  }
}

export const RETRYABLE_AI_ERROR_CODES: readonly ErrorCode[] = [
  "AI_PROVIDER_UNAVAILABLE",
  "AI_PROVIDER_RATE_LIMITED",
  "AI_PROVIDER_TIMEOUT",
];

export function isRetryableAiError(error: unknown): boolean {
  return error instanceof AppError && RETRYABLE_AI_ERROR_CODES.includes(error.code);
}

/**
 * Normaliza qualquer falha de provedor em `AppError` com mensagem segura
 * (sem vazar detalhes internos, chaves ou trechos de documentos).
 */
export function toAiAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error && error.name === "AbortError") {
    return new AppError("AI_PROVIDER_TIMEOUT", "O provedor de IA não respondeu a tempo.");
  }
  return new AppError("AI_PROVIDER_UNAVAILABLE", "O provedor de IA está indisponível no momento.");
}
