import { createHash } from "node:crypto";
import { AppError, type FieldIssue } from "@verasjuris/types";
import { z } from "zod";
import { AICapability } from "./capabilities.js";
import {
  type AiUsage,
  estimateCostFromPricing,
  estimateTokens,
  type ModelPricing,
} from "./cost.js";
import { AiNotConfiguredError, isRetryableAiError, toAiAppError } from "./errors.js";
import {
  type AIProvider,
  type AIProviderBaseRequest,
  type AIProviderHealth,
  type AIProviderUsage,
  NotConfiguredAIProvider,
} from "./provider.js";
import { buildSystemPrompt, wrapUntrustedContent } from "./safety.js";

/* -------------------------------------------------------------------------- */
/* Legado (compatibilidade): AiGateway.complete + AiUsageDraft                 */
/* -------------------------------------------------------------------------- */

export const aiCompletionRequestSchema = z.object({
  userId: z.string().uuid(),
  organizationId: z.string().uuid(),
  feature: z.string().trim().min(1).max(80),
  promptVersion: z.string().trim().min(1).max(40),
  input: z.string().trim().min(1).max(20_000),
});

export type AiCompletionRequest = z.infer<typeof aiCompletionRequestSchema>;

/** Rascunho de uso. Custos em micros inteiros — estimado e informado pelo fornecedor são distintos. */
export type AiUsageDraft = {
  userId: string;
  organizationId: string;
  provider: string | null;
  model: string | null;
  feature: string;
  promptVersion: string;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostMicros: number | null;
  providerReportedCostMicros: number | null;
  durationMs: number | null;
  outcome: "not_configured";
  recorded: false;
  occurredAt: string;
};

/* -------------------------------------------------------------------------- */
/* Features                                                                    */
/* -------------------------------------------------------------------------- */

export type AIOutputDisposition = "draft" | "assistive" | "requires_review";

export type AIFeatureDefinition = {
  /** Capacidades que o provedor precisa declarar para atender a funcionalidade. */
  requires: readonly AICapability[];
  /** Toda saída de IA é assistiva; o padrão exige revisão humana. */
  outputDisposition: AIOutputDisposition;
};

export const DEFAULT_AI_FEATURES: Readonly<Record<string, AIFeatureDefinition>> = {
  "foundation-check": { requires: [AICapability.TEXT], outputDisposition: "assistive" },
  document_summary: { requires: [AICapability.TEXT], outputDisposition: "requires_review" },
  document_classification: {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  document_metadata_extraction: {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  legal_analysis: {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  legal_review: {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "auction.notice_analysis": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "auction.risk_extraction": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "auction.document_summary": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "auction.due_diligence_assist": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "legal_draft.initial_petition": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "legal_draft.defense": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "legal_draft.reply": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "legal_draft.motion": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "legal_draft.appeal": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "legal_draft.counter_arguments": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "legal_draft.opinion": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "legal_draft.admin_request": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "legal_draft.contract": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "legal_draft.notice": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  legal_comparison: {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "previdentiary.document_analysis": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "previdentiary.cnis_review": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "previdentiary.missing_documents": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "previdentiary.benefit_comparison_explanation": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "previdentiary.calculation_review": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "previdentiary.admin_request_draft": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "labor.contract_analysis": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "labor.time_record_analysis": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "labor.payroll_analysis": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "labor.claim_analysis": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "labor.evidence_matrix": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "labor.calculation_review": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "labor.draft_assist": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "contract.generate_assist": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "contract.review": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "contract.compare": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "contract.risk_analysis": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "contract.obligation_extract": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "civil.damage_analysis": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "consumer.contract_analysis": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "family.case_summary": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "criminal.evidence_review": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "medical.record_analysis": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "environmental.notice_analysis": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "digital.lgpd_review": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "international.choice_of_law_assist": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "arbitration.award_review": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "requires_review",
  },
  "tax.case_summary": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "assistive",
  },
  "tax.assessment_review": {
    requires: [AICapability.STRUCTURED_OUTPUT],
    outputDisposition: "assistive",
  },
  document_embedding: { requires: [AICapability.EMBEDDINGS], outputDisposition: "assistive" },
  document_vision: { requires: [AICapability.VISION], outputDisposition: "requires_review" },
};

/* -------------------------------------------------------------------------- */
/* Requisições e resultados do gateway                                        */
/* -------------------------------------------------------------------------- */

const baseRequestFields = {
  userId: z.string().uuid(),
  organizationId: z.string().uuid(),
  feature: z.string().trim().min(1).max(80),
  promptVersion: z.string().trim().min(1).max(40),
  model: z.string().trim().min(1).max(200).optional(),
  maxOutputTokens: z.number().int().positive().max(1_000_000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  /** Habilita retentativa segura e deduplicação (cache de idempotência) quando fornecido. */
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
  /** Declara que repetir a chamada é seguro mesmo sem chave de idempotência. */
  retrySafe: z.boolean().optional(),
  /** Orçamento restante em micros inteiros; o gateway recusa se a estimativa exceder. */
  remainingBudgetMicros: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
};

export const aiTextRequestSchema = z.object({
  ...baseRequestFields,
  /** Instruções da TAREFA (confiáveis, escritas pelo sistema). */
  instructions: z.string().trim().min(1).max(20_000),
  /** Conteúdo NÃO confiável (texto de documento). Sempre tratado como dado. */
  input: z.string().trim().min(1),
  /** Rótulo opcional do conteúdo (ex.: nome do arquivo); também é neutralizado. */
  inputLabel: z.string().trim().max(200).optional(),
});

export type AITextRequest = z.input<typeof aiTextRequestSchema>;

export type AIStructuredRequest<T> = AITextRequest & {
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  schemaName: string;
  schemaDescription?: string;
};

export type AIImageRequest = AITextRequest & {
  image: { data: Uint8Array; mimeType: string };
};

export const aiEmbeddingRequestSchema = z.object({
  userId: z.string().uuid(),
  organizationId: z.string().uuid(),
  feature: z.string().trim().min(1).max(80),
  promptVersion: z.string().trim().min(1).max(40),
  model: z.string().trim().min(1).max(200).optional(),
  inputs: z.array(z.string().min(1)).min(1).max(256),
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
  retrySafe: z.boolean().optional(),
  remainingBudgetMicros: baseRequestFields.remainingBudgetMicros,
});

export type AIEmbeddingRequest = z.input<typeof aiEmbeddingRequestSchema>;

export type AIResult<T> = {
  data: T;
  provider: string;
  model: string;
  feature: string;
  promptVersion: string;
  usage: AiUsage;
  durationMs: number;
  attempts: number;
  outputDisposition: AIOutputDisposition;
  idempotencyKey: string | null;
  fromIdempotencyCache: boolean;
  finishReason: string | null;
};

export type AIStreamEvent =
  | { type: "delta"; delta: string }
  | {
      type: "done";
      provider: string;
      model: string;
      usage: AiUsage;
      durationMs: number;
      outputDisposition: AIOutputDisposition;
    };

export interface AIIdempotencyCache {
  get(key: string): Promise<{ fingerprint: string; result: AIResult<unknown> } | undefined>;
  set(key: string, value: { fingerprint: string; result: AIResult<unknown> }): Promise<void>;
}

export class InMemoryAIIdempotencyCache implements AIIdempotencyCache {
  private readonly entries = new Map<string, { fingerprint: string; result: AIResult<unknown> }>();

  get(key: string) {
    return Promise.resolve(this.entries.get(key));
  }

  set(key: string, value: { fingerprint: string; result: AIResult<unknown> }) {
    this.entries.set(key, value);
    return Promise.resolve();
  }
}

export type AIGatewayOptions = {
  /** Instância do provedor. Sem ela (ou com NotConfigured) a IA recusa chamadas. */
  provider?: AIProvider;
  /** Alternativa: registro de provedores + id selecionado (ex.: vindo de AI_PROVIDER). */
  providers?: Readonly<Record<string, AIProvider>>;
  providerId?: string;
  defaultModel?: string;
  timeoutMs?: number;
  /** Retentativas adicionais; só aplicadas quando seguro (idempotencyKey ou retrySafe). */
  maxRetries?: number;
  maxInputTokens?: number;
  /** Preços por modelo (chave "*" = padrão). Micros por milhão de tokens. */
  pricing?: Readonly<Record<string, ModelPricing>>;
  features?: Readonly<Record<string, AIFeatureDefinition>>;
  idempotencyCache?: AIIdempotencyCache;
  /** Injetáveis para teste. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

export type AIGatewayDescription =
  | { status: "not_configured"; provider: null; recorded: false }
  | {
      status: "configured";
      provider: string;
      recorded: false;
      capabilities: readonly AICapability[];
    };

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_MAX_INPUT_TOKENS = 100_000;
const MAX_BACKOFF_MS = 5_000;
const BASE_BACKOFF_MS = 200;
const ALLOWED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/tiff",
];
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

type Kind = "text" | "structured" | "image" | "embedding" | "stream";

type Prepared = {
  provider: AIProvider;
  feature: string;
  definition: AIFeatureDefinition;
  promptVersion: string;
  model: string | null;
  system: string;
  input: string;
  inputTokens: number;
  idempotencyKey: string | undefined;
  retrySafe: boolean;
  maxOutputTokens: number | undefined;
  temperature: number | undefined;
  organizationId: string;
  userId: string;
};

type RawCall = {
  data: unknown;
  model: string;
  usage: AIProviderUsage;
  finishReason?: string;
  outputText: string;
};

/**
 * Mensagens do Zod para tipo/enum/limites ecoam o valor recebido (que pode vir do documento ou da IA).
 * Por isso usamos mensagens genéricas por código; só `custom`/`invalid_string` mantêm a mensagem
 * estática definida nos nossos esquemas.
 */
const GENERIC_ISSUE_MESSAGES: Partial<Record<z.ZodIssueCode, string>> = {
  invalid_type: "Tipo de valor inválido.",
  invalid_literal: "Valor diferente do literal esperado.",
  invalid_enum_value: "Valor fora do conjunto permitido.",
  unrecognized_keys: "Chave não reconhecida.",
  invalid_union: "Nenhuma variante válida.",
  too_small: "Valor abaixo do limite mínimo.",
  too_big: "Valor acima do limite máximo.",
  not_multiple_of: "Valor não é múltiplo do esperado.",
  not_finite: "Número não finito.",
};

function zodIssues(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message:
      GENERIC_ISSUE_MESSAGES[issue.code] ??
      (issue.code === "custom" ? issue.message : "Valor inválido."),
  }));
}

function parseRequest<S extends z.ZodTypeAny>(schema: S, raw: unknown): z.output<S> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Pedido de IA inválido.", zodIssues(parsed.error));
  }
  return parsed.data;
}

function safeCount(value: number | undefined): number | undefined {
  return value !== undefined && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

export class AIGateway {
  private readonly provider: AIProvider | null;
  private readonly defaultModel: string | null;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly maxInputTokens: number;
  private readonly pricing: Readonly<Record<string, ModelPricing>>;
  private readonly features: Readonly<Record<string, AIFeatureDefinition>>;
  private readonly cache: AIIdempotencyCache | undefined;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;

  constructor(
    private readonly flags: { ai: boolean },
    options: AIGatewayOptions = {},
  ) {
    this.provider = AIGateway.selectProvider(options);
    this.defaultModel = options.defaultModel ?? null;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = Math.min(Math.max(options.maxRetries ?? DEFAULT_MAX_RETRIES, 0), 5);
    this.maxInputTokens = options.maxInputTokens ?? DEFAULT_MAX_INPUT_TOKENS;
    this.pricing = options.pricing ?? {};
    this.features = options.features ?? DEFAULT_AI_FEATURES;
    this.cache = options.idempotencyCache;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.now = options.now ?? (() => Date.now());
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs <= 0) {
      throw new RangeError("timeoutMs deve ser um inteiro positivo.");
    }
  }

  /** Seleção de provedor: instância explícita > registro + id > nenhum. NotConfigured conta como nenhum. */
  private static selectProvider(options: AIGatewayOptions): AIProvider | null {
    let chosen: AIProvider | undefined = options.provider;
    if (!chosen && options.providers && options.providerId) {
      chosen = options.providers[options.providerId];
      if (!chosen && options.providerId !== "not_configured") {
        throw new AppError(
          "VALIDATION_ERROR",
          `Provedor de IA desconhecido: ${options.providerId}.`,
        );
      }
    }
    if (!chosen || chosen instanceof NotConfiguredAIProvider) return null;
    return chosen;
  }

  describe(): AIGatewayDescription {
    if (!this.provider) return { status: "not_configured", provider: null, recorded: false };
    return {
      status: "configured",
      provider: this.provider.id,
      recorded: false,
      capabilities: this.provider.capabilities,
    };
  }

  async healthCheck(): Promise<AIProviderHealth> {
    if (!this.provider) {
      return {
        status: "not_configured",
        detail: "Nenhum provedor de IA configurado.",
        checkedAt: new Date(this.now()).toISOString(),
      };
    }
    const provider = this.provider;
    try {
      return await this.withTimeout(() => provider.healthCheck());
    } catch (error) {
      const mapped = toAiAppError(error);
      return {
        status: "unavailable",
        detail: mapped.message,
        checkedAt: new Date(this.now()).toISOString(),
      };
    }
  }

  /* ---------------------------------------------------------------------- */
  /* API legada                                                              */
  /* ---------------------------------------------------------------------- */

  /**
   * Compatibilidade: valida o pedido e recusa quando a IA está desligada ou sem provedor.
   * Com provedor configurado, delega a `generateText` e devolve o texto + uso.
   */
  async complete(input: unknown): Promise<AIResult<string>> {
    const request = parseRequest(aiCompletionRequestSchema, input);
    return this.generateText({
      ...request,
      instructions: "Responda de forma assistiva e objetiva ao conteúdo fornecido.",
    });
  }

  /* ---------------------------------------------------------------------- */
  /* API principal                                                           */
  /* ---------------------------------------------------------------------- */

  async generateText(raw: AITextRequest): Promise<AIResult<string>> {
    const request = parseRequest(aiTextRequestSchema, raw);
    const prepared = this.prepare("text", request, [AICapability.TEXT]);
    return this.execute(
      prepared,
      "text",
      {},
      async (signal, p) => {
        const result = await p.provider.generateText(this.baseRequest(p, signal));
        return {
          data: result.text,
          model: result.model,
          usage: result.usage,
          outputText: result.text,
          ...(result.finishReason ? { finishReason: result.finishReason } : {}),
        };
      },
      (data) => {
        if (typeof data !== "string" || data.length === 0) {
          throw new AppError(
            "AI_INVALID_RESPONSE",
            "O provedor de IA devolveu uma resposta vazia.",
          );
        }
        return data;
      },
    );
  }

  async generateStructured<T>(raw: AIStructuredRequest<T>): Promise<AIResult<T>> {
    const { schema, schemaName, schemaDescription, ...rest } = raw;
    const request = parseRequest(aiTextRequestSchema, rest);
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(schemaName)) {
      throw new AppError("VALIDATION_ERROR", "Nome de esquema de saída inválido.");
    }
    const prepared = this.prepare("structured", request, [AICapability.STRUCTURED_OUTPUT]);
    return this.execute(
      prepared,
      "structured",
      { schemaName },
      async (signal, p) => {
        const result = await p.provider.generateStructured({
          ...this.baseRequest(p, signal),
          schemaName,
          ...(schemaDescription ? { schemaDescription } : {}),
        });
        return {
          data: result.data,
          model: result.model,
          usage: result.usage,
          outputText: JSON.stringify(result.data) ?? "",
          ...(result.finishReason ? { finishReason: result.finishReason } : {}),
        };
      },
      (data) => {
        const parsed = schema.safeParse(data);
        if (!parsed.success) {
          throw new AppError(
            "AI_INVALID_RESPONSE",
            "A resposta estruturada do provedor de IA não segue o formato esperado e foi descartada.",
            zodIssues(parsed.error),
          );
        }
        return parsed.data;
      },
    );
  }

  async analyzeImage(raw: AIImageRequest): Promise<AIResult<string>> {
    const { image, ...rest } = raw;
    const request = parseRequest(aiTextRequestSchema, rest);
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(image.mimeType)) {
      throw new AppError("VALIDATION_ERROR", "Tipo de imagem não suportado para análise.");
    }
    if (image.data.byteLength === 0 || image.data.byteLength > MAX_IMAGE_BYTES) {
      throw new AppError("VALIDATION_ERROR", "Tamanho de imagem inválido para análise.");
    }
    const prepared = this.prepare("image", request, [AICapability.VISION], (provider) => {
      if (!provider.analyzeImage) return false;
      return true;
    });
    return this.execute(
      prepared,
      "image",
      { imageBytes: image.data.byteLength, mime: image.mimeType },
      async (signal, p) => {
        const analyze = p.provider.analyzeImage;
        if (!analyze)
          throw new AppError("NOT_CONFIGURED", "O provedor não suporta análise de imagem.");
        const result = await analyze.call(p.provider, { ...this.baseRequest(p, signal), image });
        return {
          data: result.text,
          model: result.model,
          usage: result.usage,
          outputText: result.text,
          ...(result.finishReason ? { finishReason: result.finishReason } : {}),
        };
      },
      (data) => {
        if (typeof data !== "string" || data.length === 0) {
          throw new AppError(
            "AI_INVALID_RESPONSE",
            "O provedor de IA devolveu uma resposta vazia.",
          );
        }
        return data;
      },
    );
  }

  async generateEmbedding(raw: AIEmbeddingRequest): Promise<AIResult<number[][]>> {
    const request = parseRequest(aiEmbeddingRequestSchema, raw);
    const definition = this.requireFeature(request.feature);
    const provider = this.requireProvider(definition, [AICapability.EMBEDDINGS]);
    const embed = provider.generateEmbedding;
    if (!embed) {
      throw new AppError("NOT_CONFIGURED", "O provedor de IA não suporta embeddings.");
    }
    const joined = request.inputs.join("\n");
    const inputTokens = estimateTokens(joined);
    this.assertInputLimit(inputTokens);
    const prepared: Prepared = {
      provider,
      feature: request.feature,
      definition,
      promptVersion: request.promptVersion,
      model: request.model ?? this.defaultModel,
      system: "",
      input: joined,
      inputTokens,
      idempotencyKey: request.idempotencyKey,
      retrySafe: request.retrySafe === true,
      maxOutputTokens: undefined,
      temperature: undefined,
      organizationId: request.organizationId,
      userId: request.userId,
    };
    this.assertBudget(prepared, request.remainingBudgetMicros);
    return this.execute(
      prepared,
      "embedding",
      { count: request.inputs.length },
      async (signal, p) => {
        const result = await embed.call(p.provider, {
          feature: p.feature,
          model: p.model,
          inputs: request.inputs,
          ...(p.idempotencyKey ? { idempotencyKey: p.idempotencyKey } : {}),
          signal,
        });
        return {
          data: result.embeddings,
          model: result.model,
          usage: result.usage,
          outputText: "",
        };
      },
      (data) => {
        const valid =
          Array.isArray(data) &&
          data.length === request.inputs.length &&
          data.every(
            (vector) =>
              Array.isArray(vector) &&
              vector.length > 0 &&
              vector.length === (data[0] as unknown[]).length &&
              vector.every((n) => typeof n === "number" && Number.isFinite(n)),
          );
        if (!valid) {
          throw new AppError(
            "AI_INVALID_RESPONSE",
            "Os embeddings devolvidos pelo provedor são inválidos.",
          );
        }
        return data as number[][];
      },
    );
  }

  /** Streaming: sem retentativa nem cache; timeout cobre o fluxo inteiro. */
  async *streamText(raw: AITextRequest): AsyncGenerator<AIStreamEvent> {
    const request = parseRequest(aiTextRequestSchema, raw);
    const prepared = this.prepare(
      "stream",
      request,
      [AICapability.TEXT, AICapability.STREAMING],
      (provider) => Boolean(provider.streamText),
    );
    const stream = prepared.provider.streamText;
    if (!stream) throw new AppError("NOT_CONFIGURED", "O provedor de IA não suporta streaming.");
    const startedAt = this.now();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new AppError("AI_PROVIDER_TIMEOUT", "O provedor de IA não respondeu a tempo."));
      }, this.timeoutMs);
    });
    // Evita rejeição não tratada caso o timeout dispare após o término do fluxo.
    timeout.catch(() => undefined);
    let outputText = "";
    let reportedUsage: AIProviderUsage = {};
    let model = prepared.model ?? this.provider?.id ?? "unknown";
    try {
      const iterator = stream
        .call(prepared.provider, this.baseRequest(prepared, controller.signal))
        [Symbol.asyncIterator]();
      while (true) {
        const next = await Promise.race([iterator.next(), timeout]);
        if (next.done) break;
        outputText += next.value.delta;
        if (next.value.usage) reportedUsage = next.value.usage;
        if (next.value.model) model = next.value.model;
        if (next.value.delta.length > 0) yield { type: "delta", delta: next.value.delta };
      }
    } catch (error) {
      throw toAiAppError(error);
    } finally {
      clearTimeout(timer);
    }
    yield {
      type: "done",
      provider: prepared.provider.id,
      model,
      usage: this.buildUsage(prepared, model, reportedUsage, outputText),
      durationMs: this.now() - startedAt,
      outputDisposition: prepared.definition.outputDisposition,
    };
  }

  /* ---------------------------------------------------------------------- */
  /* Internos                                                                */
  /* ---------------------------------------------------------------------- */

  private requireFeature(feature: string): AIFeatureDefinition {
    const definition = this.features[feature];
    if (!definition) {
      throw new AppError("VALIDATION_ERROR", `Funcionalidade de IA não permitida: ${feature}.`);
    }
    return definition;
  }

  private requireProvider(
    definition: AIFeatureDefinition,
    required: readonly AICapability[],
    extraCheck?: (provider: AIProvider) => boolean,
  ): AIProvider {
    if (!this.flags.ai) {
      throw new AiNotConfiguredError(
        "A inteligência artificial está desativada. Nenhum texto foi gerado e nenhum provedor foi chamado.",
      );
    }
    if (!this.provider) {
      throw new AiNotConfiguredError(
        "Nenhum provedor de IA está configurado. Nenhum texto foi gerado e nenhum fornecedor foi chamado.",
      );
    }
    const missing = [...definition.requires, ...required].filter(
      (capability) => !this.provider?.capabilities.includes(capability),
    );
    if (missing.length > 0 || (extraCheck && !extraCheck(this.provider))) {
      throw new AppError(
        "NOT_CONFIGURED",
        `O provedor de IA configurado não oferece a capacidade necessária: ${[...new Set(missing)].join(", ") || "método ausente"}.`,
      );
    }
    return this.provider;
  }

  private assertInputLimit(inputTokens: number): void {
    if (inputTokens > this.maxInputTokens) {
      throw new AppError(
        "VALIDATION_ERROR",
        "O conteúdo excede o limite de tokens de entrada permitido para IA.",
      );
    }
  }

  private pricingFor(model: string | null): ModelPricing | undefined {
    return (model ? this.pricing[model] : undefined) ?? this.pricing["*"];
  }

  private assertBudget(prepared: Prepared, remaining: number | undefined): void {
    if (remaining === undefined) return;
    const pricing = this.pricingFor(prepared.model);
    if (!pricing) return;
    const projected = estimateCostFromPricing(
      prepared.inputTokens,
      prepared.maxOutputTokens ?? 0,
      pricing,
    );
    if (projected > remaining) {
      throw new AppError(
        "AI_BUDGET_EXCEEDED",
        "O orçamento de IA disponível não comporta esta requisição.",
      );
    }
  }

  private prepare(
    kind: Kind,
    request: z.output<typeof aiTextRequestSchema>,
    required: readonly AICapability[],
    extraCheck?: (provider: AIProvider) => boolean,
  ): Prepared {
    const definition = this.requireFeature(request.feature);
    const provider = this.requireProvider(definition, required, extraCheck);
    const system = buildSystemPrompt(request.instructions);
    const input = wrapUntrustedContent(request.input, request.inputLabel);
    const inputTokens = estimateTokens(system) + estimateTokens(input);
    this.assertInputLimit(inputTokens);
    const prepared: Prepared = {
      provider,
      feature: request.feature,
      definition,
      promptVersion: request.promptVersion,
      model: request.model ?? this.defaultModel,
      system,
      input,
      inputTokens,
      idempotencyKey: request.idempotencyKey,
      retrySafe: request.retrySafe === true,
      maxOutputTokens: request.maxOutputTokens,
      temperature: request.temperature,
      organizationId: request.organizationId,
      userId: request.userId,
    };
    this.assertBudget(prepared, request.remainingBudgetMicros);
    void kind;
    return prepared;
  }

  private baseRequest(prepared: Prepared, signal: AbortSignal): AIProviderBaseRequest {
    return {
      feature: prepared.feature,
      model: prepared.model,
      system: prepared.system,
      input: prepared.input,
      signal,
      ...(prepared.maxOutputTokens !== undefined
        ? { maxOutputTokens: prepared.maxOutputTokens }
        : {}),
      ...(prepared.temperature !== undefined ? { temperature: prepared.temperature } : {}),
      ...(prepared.idempotencyKey ? { idempotencyKey: prepared.idempotencyKey } : {}),
    };
  }

  private async withTimeout<R>(fn: (signal: AbortSignal) => Promise<R>): Promise<R> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new AppError("AI_PROVIDER_TIMEOUT", "O provedor de IA não respondeu a tempo."));
      }, this.timeoutMs);
    });
    try {
      return await Promise.race([Promise.resolve().then(() => fn(controller.signal)), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  private buildUsage(
    prepared: Prepared,
    model: string,
    reported: AIProviderUsage,
    outputText: string,
  ): AiUsage {
    const reportedInput = safeCount(reported.inputTokens);
    const reportedOutput = safeCount(reported.outputTokens);
    const inputTokens = reportedInput ?? prepared.inputTokens;
    const outputTokens = reportedOutput ?? estimateTokens(outputText);
    const pricing = this.pricingFor(model) ?? this.pricingFor(prepared.model);
    return {
      inputTokens,
      outputTokens,
      cachedInputTokens: safeCount(reported.cachedInputTokens) ?? null,
      totalTokens: inputTokens + outputTokens,
      tokensAreEstimate: reportedInput === undefined || reportedOutput === undefined,
      estimatedCostMicros: pricing
        ? estimateCostFromPricing(inputTokens, outputTokens, pricing)
        : 0,
      providerReportedCostMicros: safeCount(reported.providerReportedCostMicros) ?? null,
      currency: pricing?.currency ?? "BRL",
    };
  }

  private fingerprint(prepared: Prepared, kind: Kind, extra: Record<string, unknown>): string {
    return createHash("sha256")
      .update(
        JSON.stringify({
          kind,
          feature: prepared.feature,
          promptVersion: prepared.promptVersion,
          model: prepared.model,
          system: prepared.system,
          input: prepared.input,
          extra,
        }),
      )
      .digest("hex");
  }

  /**
   * Executa com timeout e retentativa SEGURA: só repete falhas transitórias (indisponível, limite de taxa,
   * timeout) quando há chave de idempotência ou `retrySafe`. Falhas de formato/validação/orçamento
   * nunca são repetidas.
   */
  private async execute<T>(
    prepared: Prepared,
    kind: Kind,
    extra: Record<string, unknown>,
    call: (signal: AbortSignal, prepared: Prepared) => Promise<RawCall>,
    validate: (data: unknown) => T,
  ): Promise<AIResult<T>> {
    const cacheKey = prepared.idempotencyKey
      ? `${prepared.organizationId}:${prepared.feature}:${prepared.idempotencyKey}`
      : null;
    const fingerprint = this.fingerprint(prepared, kind, extra);
    if (cacheKey && this.cache) {
      const hit = await this.cache.get(cacheKey);
      if (hit) {
        if (hit.fingerprint !== fingerprint) {
          throw new AppError(
            "CONFLICT",
            "A chave de idempotência já foi usada com um conteúdo diferente.",
          );
        }
        return { ...(hit.result as AIResult<T>), fromIdempotencyCache: true };
      }
    }

    const retryAllowed = Boolean(prepared.idempotencyKey) || prepared.retrySafe;
    const maxAttempts = retryAllowed ? this.maxRetries + 1 : 1;
    const startedAt = this.now();
    let attempt = 0;
    let raw: RawCall | undefined;
    let lastError: AppError | undefined;
    while (attempt < maxAttempts && !raw) {
      attempt += 1;
      try {
        raw = await this.withTimeout((signal) => call(signal, prepared));
      } catch (error) {
        lastError = toAiAppError(error);
        const canRetry = attempt < maxAttempts && isRetryableAiError(lastError);
        if (!canRetry) throw lastError;
        await this.sleep(Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS));
      }
    }
    if (!raw)
      throw (
        lastError ??
        new AppError("AI_PROVIDER_UNAVAILABLE", "O provedor de IA está indisponível no momento.")
      );

    const data = validate(raw.data);
    const result: AIResult<T> = {
      data,
      provider: prepared.provider.id,
      model: raw.model,
      feature: prepared.feature,
      promptVersion: prepared.promptVersion,
      usage: this.buildUsage(prepared, raw.model, raw.usage, raw.outputText),
      durationMs: this.now() - startedAt,
      attempts: attempt,
      outputDisposition: prepared.definition.outputDisposition,
      idempotencyKey: prepared.idempotencyKey ?? null,
      fromIdempotencyCache: false,
      finishReason: raw.finishReason ?? null,
    };
    if (cacheKey && this.cache) {
      await this.cache.set(cacheKey, { fingerprint, result: result as AIResult<unknown> });
    }
    return result;
  }
}

/** Valor mínimo de configuração vindo do ambiente (ver apiEnvSchema). */
export type AIGatewayEnvConfig = {
  FEATURE_AI?: string | boolean;
  AI_PROVIDER?: string;
  AI_DEFAULT_MODEL?: string | undefined;
  AI_REQUEST_TIMEOUT_MS?: number | undefined;
  AI_MAX_RETRIES?: number | undefined;
  AI_MAX_INPUT_TOKENS?: number | undefined;
};

/**
 * Fábrica a partir do ambiente. Hoje só `not_configured` existe: provedores reais exigem
 * integração explícita futura e nunca devem ser instanciados dentro dos domínios.
 */
export function createAiGatewayFromEnv(
  env: AIGatewayEnvConfig,
  extra: Pick<AIGatewayOptions, "providers" | "pricing" | "idempotencyCache"> = {},
): AIGateway {
  const enabled = env.FEATURE_AI === true || env.FEATURE_AI === "1";
  return new AIGateway(
    { ai: enabled },
    {
      ...extra,
      providerId: env.AI_PROVIDER ?? "not_configured",
      providers: extra.providers ?? { not_configured: new NotConfiguredAIProvider() },
      ...(env.AI_DEFAULT_MODEL ? { defaultModel: env.AI_DEFAULT_MODEL } : {}),
      ...(env.AI_REQUEST_TIMEOUT_MS ? { timeoutMs: env.AI_REQUEST_TIMEOUT_MS } : {}),
      ...(env.AI_MAX_RETRIES !== undefined ? { maxRetries: env.AI_MAX_RETRIES } : {}),
      ...(env.AI_MAX_INPUT_TOKENS ? { maxInputTokens: env.AI_MAX_INPUT_TOKENS } : {}),
    },
  );
}

/** Mantém o nome legado exportado. */
export { AIGateway as AiGateway };
