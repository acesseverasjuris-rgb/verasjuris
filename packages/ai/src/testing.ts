/**
 * SOMENTE PARA TESTES. Importe de "@verasjuris/ai/testing". Nunca exporte do índice do pacote nem use
 * como provedor de produção/desenvolvimento: ele devolve respostas fixas e não representa IA real.
 */
import type {
  AuctionDocumentRecord,
  AuctionHealth,
  AuctionListQuery,
  AuctionLotRecord,
  AuctionPage,
  AuctionProvider,
  AuctionRecord,
  AuctionUpdateRecord,
} from "./auction.js";
import { AICapability } from "./capabilities.js";
import type { LegalComparisonOutput } from "./legal-comparison.js";
import { LEGAL_COMPARISON_SCHEMA_VERSION } from "./legal-comparison.js";
import type { LegalDraftOutput } from "./legal-drafting.js";
import { LEGAL_DRAFT_SCHEMA_VERSION } from "./legal-drafting.js";
import type { LegalReviewOutput } from "./legal-review.js";
import { LEGAL_REVIEW_SCHEMA_VERSION } from "./legal-review.js";
import type { OCRProvider, OCRRequest, OCRResult } from "./ocr.js";
import type {
  AIProvider,
  AIProviderBaseRequest,
  AIProviderEmbeddingRequest,
  AIProviderEmbeddingResult,
  AIProviderHealth,
  AIProviderImageRequest,
  AIProviderStreamChunk,
  AIProviderStructuredRequest,
  AIProviderStructuredResult,
  AIProviderTextResult,
} from "./provider.js";
import type {
  LegalResearchPage,
  LegalResearchQuery,
  LegalSourceCapability,
  LegalSourceHealth,
  LegalSourceProvider,
  NormalizedLegalSourceResult,
} from "./research.js";

export type DeterministicProviderScript = {
  text?: string;
  structured?: unknown;
  /** Falhas a simular antes de responder com sucesso (ex.: transitórias para testar retry). */
  failuresBeforeSuccess?: number;
  failureError?: Error;
  /** Atraso artificial (ms) para testar timeout; respeita o AbortSignal. */
  delayMs?: number;
  usage?: { inputTokens?: number; outputTokens?: number; providerReportedCostMicros?: number };
  embeddingDimensions?: number;
  capabilities?: readonly AICapability[];
};

export type RecordedCall = {
  method:
    | "generateText"
    | "generateStructured"
    | "generateEmbedding"
    | "analyzeImage"
    | "streamText";
  request: unknown;
};

export class DeterministicTestAIProvider implements AIProvider {
  readonly id = "deterministic_test";
  readonly capabilities: readonly AICapability[];
  readonly calls: RecordedCall[] = [];
  private remainingFailures: number;

  constructor(private readonly script: DeterministicProviderScript = {}) {
    this.capabilities = script.capabilities ?? Object.values(AICapability);
    this.remainingFailures = script.failuresBeforeSuccess ?? 0;
  }

  private async gate(signal: AbortSignal): Promise<void> {
    if (this.script.delayMs) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, this.script.delayMs);
        signal.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(new Error("aborted"));
          },
          { once: true },
        );
      });
    }
    if (this.remainingFailures > 0) {
      this.remainingFailures -= 1;
      throw this.script.failureError ?? new Error("falha simulada");
    }
  }

  async generateText(request: AIProviderBaseRequest): Promise<AIProviderTextResult> {
    this.calls.push({ method: "generateText", request });
    await this.gate(request.signal);
    return {
      text: this.script.text ?? "resposta determinística de teste",
      model: request.model ?? "deterministic-model",
      usage: this.script.usage ?? { inputTokens: 10, outputTokens: 5 },
      finishReason: "stop",
    };
  }

  async generateStructured(
    request: AIProviderStructuredRequest,
  ): Promise<AIProviderStructuredResult> {
    this.calls.push({ method: "generateStructured", request });
    await this.gate(request.signal);
    return {
      data: this.script.structured ?? {},
      model: request.model ?? "deterministic-model",
      usage: this.script.usage ?? { inputTokens: 10, outputTokens: 5 },
      finishReason: "stop",
    };
  }

  async generateEmbedding(request: AIProviderEmbeddingRequest): Promise<AIProviderEmbeddingResult> {
    this.calls.push({ method: "generateEmbedding", request });
    await this.gate(request.signal);
    const dimensions = this.script.embeddingDimensions ?? 4;
    return {
      embeddings: request.inputs.map((_, index) =>
        Array.from({ length: dimensions }, (_, d) => (index + 1) / (d + 1)),
      ),
      model: request.model ?? "deterministic-embedding",
      usage: this.script.usage ?? { inputTokens: 10 },
    };
  }

  async analyzeImage(request: AIProviderImageRequest): Promise<AIProviderTextResult> {
    this.calls.push({ method: "analyzeImage", request });
    await this.gate(request.signal);
    return {
      text: this.script.text ?? "descrição determinística de imagem",
      model: request.model ?? "deterministic-model",
      usage: this.script.usage ?? { inputTokens: 10, outputTokens: 5 },
    };
  }

  async *streamText(request: AIProviderBaseRequest): AsyncGenerator<AIProviderStreamChunk> {
    this.calls.push({ method: "streamText", request });
    await this.gate(request.signal);
    const text = this.script.text ?? "resposta determinística de teste";
    for (const word of text.split(" ")) yield { delta: `${word} ` };
    yield { delta: "", usage: this.script.usage ?? { inputTokens: 10, outputTokens: 5 } };
  }

  healthCheck(): Promise<AIProviderHealth> {
    return Promise.resolve({ status: "ok", checkedAt: new Date(0).toISOString() });
  }
}

/** OCR fixo para testes: devolve o texto roteirizado, sem reconhecer nada de verdade. */
export class DeterministicTestOCRProvider implements OCRProvider {
  readonly id = "deterministic_test_ocr";

  constructor(private readonly text = "texto ocr de teste") {}

  recognize(_request: OCRRequest): Promise<OCRResult> {
    return Promise.resolve({
      provider: this.id,
      pages: [{ pageNumber: 1, text: this.text, confidence: 90 }],
      text: this.text,
      providerReportedCostMicros: null,
    });
  }

  healthCheck() {
    return Promise.resolve({ status: "ok" as const, checkedAt: new Date(0).toISOString() });
  }
}

/**
 * Fonte jurídica de teste: somente dados locais/vazios fornecidos no construtor.
 * Nunca inventa jurisprudência, súmula ou URL oficial.
 */
export class DeterministicTestLegalSourceProvider implements LegalSourceProvider {
  readonly id = "deterministic_test_legal_source";
  readonly capabilities: readonly LegalSourceCapability[];

  constructor(
    private readonly options: {
      capabilities?: readonly LegalSourceCapability[];
      items?: readonly NormalizedLegalSourceResult[];
    } = {},
  ) {
    this.capabilities = options.capabilities ?? [];
  }

  search(query: LegalResearchQuery): Promise<LegalResearchPage> {
    const items = [...(this.options.items ?? [])].filter((item) => {
      if (!query.filters?.capabilities?.length) return true;
      return query.filters.capabilities.includes(item.capability);
    });
    return Promise.resolve({
      provider: this.id,
      items,
      nextCursor: null,
      provenance: {
        queryText: query.text,
        filters: query.filters ?? {},
        retrievedAt: new Date(0).toISOString(),
      },
    });
  }

  fetchById(
    externalId: string,
    _signal?: AbortSignal,
  ): Promise<NormalizedLegalSourceResult | null> {
    const found = (this.options.items ?? []).find((item) => item.externalId === externalId) ?? null;
    return Promise.resolve(found);
  }

  healthCheck(): Promise<LegalSourceHealth> {
    return Promise.resolve({
      status: "ok",
      detail: "Provedor determinístico de teste (somente dados locais).",
      checkedAt: new Date(0).toISOString(),
      capabilities: this.capabilities,
    });
  }
}

/**
 * Leilão de teste: somente registros locais fornecidos. Não simula portais reais.
 */
export class DeterministicTestAuctionProvider implements AuctionProvider {
  readonly id = "deterministic_test_auction";

  constructor(
    private readonly options: {
      auctions?: readonly AuctionRecord[];
      lots?: readonly AuctionLotRecord[];
      documents?: readonly AuctionDocumentRecord[];
      updates?: readonly AuctionUpdateRecord[];
    } = {},
  ) {}

  listAuctions(_query: AuctionListQuery): Promise<AuctionPage> {
    return Promise.resolve({
      provider: this.id,
      items: [...(this.options.auctions ?? [])],
      nextCursor: null,
    });
  }

  fetchAuction(externalId: string, _signal?: AbortSignal): Promise<AuctionRecord | null> {
    return Promise.resolve(
      (this.options.auctions ?? []).find((item) => item.externalId === externalId) ?? null,
    );
  }

  fetchLots(auctionExternalId: string, _signal?: AbortSignal): Promise<AuctionLotRecord[]> {
    return Promise.resolve(
      (this.options.lots ?? []).filter((lot) => lot.auctionExternalId === auctionExternalId),
    );
  }

  fetchDocuments(
    auctionExternalId: string,
    _signal?: AbortSignal,
  ): Promise<AuctionDocumentRecord[]> {
    return Promise.resolve(
      (this.options.documents ?? []).filter((doc) => doc.auctionExternalId === auctionExternalId),
    );
  }

  fetchUpdates(auctionExternalId: string, _signal?: AbortSignal): Promise<AuctionUpdateRecord[]> {
    return Promise.resolve(
      (this.options.updates ?? []).filter(
        (update) => update.auctionExternalId === auctionExternalId,
      ),
    );
  }

  healthCheck(): Promise<AuctionHealth> {
    return Promise.resolve({
      status: "ok",
      detail: "Provedor determinístico de teste (somente dados locais).",
      checkedAt: new Date(0).toISOString(),
    });
  }
}

/** Fixture mínima válida para saída estruturada de legal_review em testes. */
export function legalReviewFixture(overrides: Partial<LegalReviewOutput> = {}): LegalReviewOutput {
  return {
    schemaVersion: LEGAL_REVIEW_SCHEMA_VERSION,
    reviewType: "formal_review",
    summary: "Revisão assistiva de teste (fixture).",
    contradictions: [
      {
        statementA: "Afirmação A no documento de teste.",
        sourceA: "doc-a.pdf",
        pageA: 1,
        statementB: "Afirmação B conflitante no documento de teste.",
        sourceB: "doc-b.pdf",
        pageB: 2,
        explanation: "Possível contradição entre as peças.",
        severity: "medium",
        confidence: 70,
      },
    ],
    formalIssues: [],
    missingDocuments: [
      {
        description: "Documento não localizado no conjunto analisado.",
        expectedDocument: "procuração",
        confidence: 60,
      },
    ],
    unaddressedClaims: [],
    unansweredGrounds: [],
    risks: [
      {
        category: "deadline",
        description: "Possível risco de prazo não observado no conjunto analisado.",
        source: "doc-a.pdf",
        relatedDocuments: ["doc-a.pdf"],
        severity: "high",
        confidence: 55,
        recommendation: "Verificar prazo com o profissional responsável.",
        requiresHumanReview: true,
      },
    ],
    inconsistencies: [],
    suggestedCorrections: [],
    ...overrides,
  };
}

/** Fixture mínima válida para saída estruturada de legal_draft.* em testes. */
export function legalDraftFixture(overrides: Partial<LegalDraftOutput> = {}): LegalDraftOutput {
  return {
    schemaVersion: LEGAL_DRAFT_SCHEMA_VERSION,
    feature: "legal_draft.initial_petition",
    sections: {
      addressing: "Excelentíssimo Senhor Doutor Juiz de Direito.",
      qualification: "Autor: Parte A. Réu: Parte B.",
      facts: "Fatos narrados a partir do conjunto fornecido (fixture de teste).",
      grounds: "Fundamentos assistivos sem jurisprudência inventada.",
      provisional_relief: "",
      claims: "Pedidos assistivos de teste.",
      evidence: "Provas referenciadas no source set de teste.",
      final_requests: "Requerimentos finais de teste.",
      closing: "Nestes termos, pede deferimento.",
      signature_metadata: "Advogado teste — OAB 00000.",
    },
    suggestedCitations: [],
    unresolvedPoints: ["Confirmar valor da causa com o responsável."],
    confidence: 65,
    ...overrides,
  };
}

/** Fixture mínima válida para saída estruturada de legal_comparison em testes. */
export function legalComparisonFixture(
  overrides: Partial<LegalComparisonOutput> = {},
): LegalComparisonOutput {
  return {
    schemaVersion: LEGAL_COMPARISON_SCHEMA_VERSION,
    comparisonType: "petition_vs_defense",
    summary: "Comparação assistiva de teste entre peças.",
    items: [
      {
        category: "divergence",
        sourceA: "Petição: afirma fato X.",
        sourceB: "Contestação: impugna fato X.",
        finding: "Possível divergência sobre o fato X no conjunto analisado.",
        severity: "medium",
        confidence: 70,
        provenance: {
          sourceALabel: "peticao.pdf",
          sourceBLabel: "contestacao.pdf",
          pageA: 2,
          pageB: 1,
        },
      },
    ],
    requiresHumanReview: ["Verificar se a impugnação cobre todos os pedidos."],
    ...overrides,
  };
}
