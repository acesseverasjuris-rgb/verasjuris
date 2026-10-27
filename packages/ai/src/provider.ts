import type { AICapability } from "./capabilities.js";
import { AiNotConfiguredError } from "./errors.js";

/**
 * Contrato de provedor de IA. Domínios NUNCA chamam fornecedores diretamente:
 * toda chamada passa por `AIGateway`, que valida, aplica limites e normaliza erros.
 *
 * Nenhum provedor real está integrado. A única implementação de produção é `NotConfiguredAIProvider`.
 */

export type AIProviderUsage = {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  /** Custo informado pelo fornecedor, em micros inteiros. Diferente do custo estimado pelo gateway. */
  providerReportedCostMicros?: number;
};

export type AIProviderBaseRequest = {
  feature: string;
  /** Modelo solicitado; null = padrão do provedor. */
  model: string | null;
  /** Prompt de sistema JÁ composto pelo gateway (regras de segurança + tarefa). */
  system: string;
  /** Conteúdo JÁ isolado como dado não confiável pelo gateway. */
  input: string;
  maxOutputTokens?: number;
  temperature?: number;
  idempotencyKey?: string;
  /** Abortado quando o timeout do gateway expira. O provedor deve respeitá-lo. */
  signal: AbortSignal;
};

export type AIProviderStructuredRequest = AIProviderBaseRequest & {
  schemaName: string;
  schemaDescription?: string;
};

export type AIProviderImageRequest = AIProviderBaseRequest & {
  image: { data: Uint8Array; mimeType: string };
};

export type AIProviderEmbeddingRequest = {
  feature: string;
  model: string | null;
  inputs: readonly string[];
  idempotencyKey?: string;
  signal: AbortSignal;
};

export type AIProviderTextResult = {
  text: string;
  model: string;
  usage: AIProviderUsage;
  finishReason?: string;
};

export type AIProviderStructuredResult = {
  /** Dado bruto; o gateway valida com Zod. O provedor NÃO é confiável quanto ao formato. */
  data: unknown;
  model: string;
  usage: AIProviderUsage;
  finishReason?: string;
};

export type AIProviderEmbeddingResult = {
  embeddings: number[][];
  model: string;
  usage: AIProviderUsage;
};

export type AIProviderStreamChunk = {
  delta: string;
  usage?: AIProviderUsage;
  model?: string;
};

export type AIProviderHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export interface AIProvider {
  readonly id: string;
  readonly capabilities: readonly AICapability[];
  generateText(request: AIProviderBaseRequest): Promise<AIProviderTextResult>;
  generateStructured(request: AIProviderStructuredRequest): Promise<AIProviderStructuredResult>;
  generateEmbedding?(request: AIProviderEmbeddingRequest): Promise<AIProviderEmbeddingResult>;
  analyzeImage?(request: AIProviderImageRequest): Promise<AIProviderTextResult>;
  streamText?(request: AIProviderBaseRequest): AsyncIterable<AIProviderStreamChunk>;
  healthCheck(): Promise<AIProviderHealth>;
}

const NOT_CONFIGURED_MESSAGE =
  "Nenhum provedor de IA está configurado. Nenhum texto foi gerado e nenhum fornecedor foi chamado.";

/** Provedor padrão de produção: recusa tudo, sem rede e sem efeitos. */
export class NotConfiguredAIProvider implements AIProvider {
  readonly id = "not_configured";
  readonly capabilities: readonly AICapability[] = [];

  generateText(_request: AIProviderBaseRequest): Promise<AIProviderTextResult> {
    return Promise.reject(new AiNotConfiguredError(NOT_CONFIGURED_MESSAGE));
  }

  generateStructured(_request: AIProviderStructuredRequest): Promise<AIProviderStructuredResult> {
    return Promise.reject(new AiNotConfiguredError(NOT_CONFIGURED_MESSAGE));
  }

  generateEmbedding(_request: AIProviderEmbeddingRequest): Promise<AIProviderEmbeddingResult> {
    return Promise.reject(new AiNotConfiguredError(NOT_CONFIGURED_MESSAGE));
  }

  analyzeImage(_request: AIProviderImageRequest): Promise<AIProviderTextResult> {
    return Promise.reject(new AiNotConfiguredError(NOT_CONFIGURED_MESSAGE));
  }

  // biome-ignore lint/correctness/useYield: sempre recusa antes de produzir qualquer trecho.
  async *streamText(_request: AIProviderBaseRequest): AsyncGenerator<AIProviderStreamChunk> {
    throw new AiNotConfiguredError(NOT_CONFIGURED_MESSAGE);
  }

  healthCheck(): Promise<AIProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Nenhum provedor de IA configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
