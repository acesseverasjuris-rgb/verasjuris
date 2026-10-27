import { CSRF_HEADER } from "@verasjuris/security/constants";
import { apiErrorMessage, getActiveMembership, getActiveOrgId, isApiFailure } from "./crm";
import type { ApiFailure } from "./types";

export { getActiveMembership, getActiveOrgId, isApiFailure };

/**
 * Cliente das capacidades assistidas (Prompt 13).
 *
 * Premissas de caminhos (relativos a /api/v1/organizations/:orgId):
 *  - GET  /ai/status | /ai/usage | /ai/jobs | /ai/models | /ai/prompts | /ai/budgets
 *  - GET  /legal-analyses?legalMatterId=&documentId=&status=&limit=&offset=
 *  - GET  /legal-analyses/:id
 *  - POST /legal-analyses            { legalMatterId?, documentId?, analysisType }
 *  - POST /legal-analyses/:id/review { disposition: "reviewed" | "corrected", comment? }
 *  - GET  /documents/:id/intelligence
 *  - POST /documents/:id/versions/:versionId/process  { strategy?, idempotencyKey? }
 *  - GET  /documents/:id/versions/:versionId/pages
 *  - POST /documents/:id/metadata/:metadataId/review
 *  - POST /documents/:id/classification/:classificationId/review
 *
 * Os normalizadores aceitam variações de envelope (`{ items }`, `{ jobs }`, `{ status }` …)
 * para que a interface funcione quando a API for registrada.
 */

export type AiApiFailure = ApiFailure & { httpStatus?: number };

async function request<T>(path: string, init?: RequestInit): Promise<T | AiApiFailure> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        [CSRF_HEADER]: "1",
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    return {
      error: {
        code: "NETWORK_ERROR",
        message: "Não foi possível falar com o serviço VerasJuris. Nenhuma alteração foi feita.",
      },
    };
  }
  const body = (await response.json().catch(() => ({}))) as T & ApiFailure;
  if (!response.ok) {
    return {
      httpStatus: response.status,
      error: {
        code: body.error?.code ?? (response.status === 404 ? "NOT_FOUND" : "INTERNAL_ERROR"),
        message: body.error?.message ?? "Falha na requisição.",
        details: body.error?.details,
      },
    };
  }
  return body;
}

export const NOT_CONFIGURED_CODES = [
  "AI_PROVIDER_NOT_CONFIGURED",
  "OCR_PROVIDER_NOT_CONFIGURED",
  "PUBLIC_OPPORTUNITY_PROVIDER_NOT_CONFIGURED",
  "NOT_CONFIGURED",
] as const;

export const AI_NOT_CONFIGURED_MESSAGE = "Não há provedor de IA configurado neste ambiente.";
export const OCR_NOT_CONFIGURED_MESSAGE = "Não há provedor de OCR configurado neste ambiente.";
export const UNAVAILABLE_MESSAGE =
  "Este recurso ainda não está disponível neste ambiente. Nenhum dado foi alterado.";

export function isNotConfigured(value: unknown): boolean {
  if (!isApiFailure(value)) return false;
  const code = value.error?.code ?? "";
  return (NOT_CONFIGURED_CODES as readonly string[]).includes(code);
}

/** Mensagem segura para o usuário — nunca "Erro inesperado" para NOT_CONFIGURED. */
export function aiErrorMessage(failure: AiApiFailure, fallback: string): string {
  const code = failure.error?.code ?? "";
  if (code === "OCR_PROVIDER_NOT_CONFIGURED") return OCR_NOT_CONFIGURED_MESSAGE;
  if (code === "PUBLIC_OPPORTUNITY_PROVIDER_NOT_CONFIGURED") {
    return "Não há fonte externa de oportunidades configurada neste ambiente. O cadastro manual continua disponível.";
  }
  if ((NOT_CONFIGURED_CODES as readonly string[]).includes(code)) return AI_NOT_CONFIGURED_MESSAGE;
  if (code === "AI_BUDGET_EXCEEDED") {
    return "O limite de uso de IA da organização foi atingido. Nenhuma análise foi gerada.";
  }
  if (code === "AI_PROVIDER_UNAVAILABLE" || code === "AI_PROVIDER_TIMEOUT") {
    return "O provedor de IA está indisponível no momento. Tente novamente mais tarde.";
  }
  if (code === "AI_PROVIDER_RATE_LIMITED") {
    return "O provedor de IA recusou novas solicitações por excesso de uso. Tente novamente em instantes.";
  }
  if (
    failure.httpStatus === 404 &&
    code === "NOT_FOUND" &&
    failure.error?.message === "Falha na requisição."
  ) {
    return UNAVAILABLE_MESSAGE;
  }
  return apiErrorMessage(failure, fallback);
}

function orgPath(orgId: string, suffix: string): string {
  return `/api/v1/organizations/${orgId}${suffix}`;
}

function qs(query: Record<string, string | number | undefined | null>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function hasPermission(permissions: readonly string[] | undefined, key: string): boolean {
  return Boolean(permissions?.includes(key));
}

export function hasAnyPermission(
  permissions: readonly string[] | undefined,
  keys: readonly string[],
): boolean {
  return keys.some((key) => hasPermission(permissions, key));
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR");
}

/** Micros da moeda (1_000_000 = 1 unidade) → texto monetário. */
export function formatMicros(micros: number | null | undefined, currency = "BRL"): string {
  if (micros == null || Number.isNaN(micros)) return "—";
  return (micros / 1_000_000).toLocaleString("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("pt-BR");
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`;
}

// ---------------------------------------------------------------------------
// Rótulos
// ---------------------------------------------------------------------------

export const AI_FEATURE_LABELS: Record<string, string> = {
  document_classification: "Classificação de documentos",
  document_extraction: "Extração de metadados",
  legal_analysis: "Análise assistida de caso",
  legal_matter_analysis: "Análise assistida de caso",
  public_opportunity_analysis: "Análise de oportunidade pública",
  ocr: "OCR",
  text_extraction: "Extração de texto",
};

export function featureLabel(key: string): string {
  return AI_FEATURE_LABELS[key] ?? key.replaceAll("_", " ");
}

export const JOB_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  queued: "Na fila",
  running: "Em execução",
  succeeded: "Concluído",
  failed: "Falhou",
  cancelled: "Cancelado",
  not_configured: "Não configurado",
};

export const JOB_TYPE_LABELS: Record<string, string> = {
  document_processing: "Processamento de documento",
  document_text_extraction: "Extração de texto",
  document_ocr: "OCR",
  document_classification: "Classificação de documento",
  legal_analysis: "Análise assistida",
  public_opportunity_analysis: "Análise de oportunidade pública",
};

export function jobTypeLabel(key: string): string {
  return JOB_TYPE_LABELS[key] ?? featureLabel(key);
}

export const ANALYSIS_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  running: "Em execução",
  succeeded: "Gerada",
  failed: "Falhou",
  cancelled: "Cancelada",
  not_configured: "Não configurada",
  requires_review: "Aguardando revisão",
  reviewed: "Revisada",
};

export const ANALYSIS_TYPE_LABELS: Record<string, string> = {
  case_summary: "Resumo do caso",
  legal_matter: "Análise do caso",
  document: "Análise de documento",
  facts_and_claims: "Fatos e pedidos",
  contradictions: "Possíveis inconsistências",
  full: "Análise assistida completa",
};

export function analysisTypeLabel(key: string): string {
  return ANALYSIS_TYPE_LABELS[key] ?? key.replaceAll("_", " ");
}

export const PROCESSING_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  queued: "Na fila",
  running: "Em execução",
  succeeded: "Concluído",
  failed: "Falhou",
  cancelled: "Cancelado",
  not_configured: "Não configurado",
};

export const EXTRACTION_METHOD_LABELS: Record<string, string> = {
  native_text: "Texto nativo do arquivo",
  plain_text: "Texto simples",
  ocr: "OCR",
  manual: "Manual",
  unavailable: "Indisponível",
};

export const METADATA_FIELD_LABELS: Record<string, string> = {
  title: "Título",
  document_date: "Data do documento",
  parties: "Partes",
  process_number: "Número do processo",
  court: "Órgão",
  document_type: "Tipo de documento",
  author: "Autor",
  amount: "Valor",
};

export function metadataFieldLabel(key: string): string {
  return METADATA_FIELD_LABELS[key] ?? key.replaceAll("_", " ");
}

export const DOCUMENT_KIND_LABELS: Record<string, string> = {
  petition: "Petição",
  decision: "Decisão",
  contract: "Contrato",
  procuration: "Procuração",
  evidence: "Prova",
  identification: "Documento de identificação",
  notice: "Edital / aviso",
  other: "Outro",
};

export function documentKindLabel(key: string | null | undefined): string {
  if (!key) return "—";
  return DOCUMENT_KIND_LABELS[key] ?? key.replaceAll("_", " ");
}

// ---------------------------------------------------------------------------
// Revisão humana
// ---------------------------------------------------------------------------

export type ReviewState = "unreviewed" | "reviewed" | "corrected" | "rejected";

/** Normaliza estados de revisão de diferentes tabelas (accepted → reviewed). */
export function normalizeReview(value: string | null | undefined): ReviewState {
  if (value === "reviewed" || value === "accepted") return "reviewed";
  if (value === "corrected") return "corrected";
  if (value === "rejected") return "rejected";
  return "unreviewed";
}

export const REVIEW_BADGE_LABELS: Record<ReviewState, string> = {
  unreviewed: "IA · Não revisado",
  reviewed: "IA · Revisado",
  corrected: "IA · Corrigido",
  rejected: "IA · Rejeitado",
};

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type AiStatusState = "configured" | "not_configured" | "degraded" | "unavailable";

export type AiProviderStatus = {
  key?: string | null;
  label?: string | null;
  configured: boolean;
  state?: AiStatusState;
  message?: string | null;
};

export type AiFeatureStatus = {
  key: string;
  label?: string;
  enabled: boolean;
  configured?: boolean;
  requiredPermission?: string | null;
};

export type AiStatus = {
  provider: AiProviderStatus;
  ocr: AiProviderStatus;
  publicOpportunityProvider?: AiProviderStatus | null;
  features: AiFeatureStatus[];
  budget?: AiBudgetSummary | null;
};

export type AiBudgetSummary = {
  period?: "daily" | "monthly" | string;
  limitMicros?: number | null;
  usedMicros?: number | null;
  currency?: string;
};

export type AiJob = {
  id: string;
  jobType: string;
  resourceType: string;
  resourceId: string;
  status: string;
  progress: number;
  attempts?: number;
  maxAttempts?: number;
  lastErrorCode?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
};

export type AiUsageItem = {
  id?: string;
  feature: string;
  provider?: string;
  modelExternalId?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  tokensAreEstimate?: boolean;
  estimatedCostMicros?: number;
  providerReportedCostMicros?: number | null;
  currency?: string;
  durationMs?: number | null;
  recordedAt: string;
};

export type AiUsageTotals = {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostMicros: number;
  currency: string;
};

export type AiUsageQuery = {
  from?: string;
  to?: string;
  feature?: string;
  model?: string;
  limit?: number;
  offset?: number;
};

export type AiModel = {
  id: string;
  providerKey: string;
  externalModelId: string;
  displayName: string;
  capabilities: string[];
  contextWindow?: number | null;
  inputCostPerMillionMicros: number;
  outputCostPerMillionMicros: number;
  currency: string;
  active: boolean;
  configured: boolean;
};

export type AiPrompt = {
  id: string;
  key: string;
  name: string;
  feature: string;
  description?: string | null;
  active: boolean;
  activeVersion?: number | null;
  versions?: Array<{ id: string; version: number; status: string; activatedAt?: string | null }>;
};

export type AiBudget = {
  id: string;
  period: string;
  limitMicros: number;
  usedMicros?: number;
  currency: string;
  feature?: string | null;
  active?: boolean;
};

export type LegalAnalysisSummary = {
  id: string;
  analysisType: string;
  status: string;
  version: number;
  disposition?: string;
  summary: string | null;
  legalMatterId?: string | null;
  legalMatterTitle?: string | null;
  documentId?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  reviewComment?: string | null;
};

export type AnalysisItem = {
  id: string;
  text: string;
  category?: string | null;
  sourceLabel?: string | null;
  documentId?: string | null;
  pageNumber?: number | null;
  confidence?: number | null;
  reviewStatus: string;
  correctedText?: string | null;
};

export type AnalysisContradiction = {
  id: string;
  statementA: string;
  sourceA?: string | null;
  statementB: string;
  sourceB?: string | null;
  explanation?: string | null;
  severity?: string;
  confidence?: number | null;
  reviewStatus: string;
};

export type LegalAnalysisDetail = LegalAnalysisSummary & {
  facts?: AnalysisItem[];
  claims?: AnalysisItem[];
  grounds?: Array<AnalysisItem & { kind: string }>;
  contradictions?: AnalysisContradiction[];
  missingInformation?: Array<{ id?: string; text: string }>;
  modelLabel?: string | null;
};

export type ProcessingRun = {
  id: string;
  documentVersionId: string;
  status: string;
  ocrRequired: boolean;
  ocrProvider?: string | null;
  extractionMethod?: string | null;
  pageCount?: number | null;
  charCount?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  errorCode?: string | null;
  errorSafeMessage?: string | null;
};

export type ExtractedMetadata = {
  id: string;
  fieldKey: string;
  originalValue: string | null;
  correctedValue: string | null;
  confidence?: number | null;
  sourcePage?: number | null;
  reviewStatus: string;
};

export type DocumentClassification = {
  id: string;
  suggestedKind: string | null;
  appliedKind: string | null;
  confidence?: number | null;
  method?: string;
  status?: string;
  reviewStatus: string;
};

export type DocumentSegment = {
  id: string;
  startPage: number;
  endPage: number;
  detectedType?: string | null;
  confidence?: number | null;
  status: string;
  reviewStatus: string;
};

export type DocumentPage = {
  id: string;
  pageNumber: number;
  text: string;
  extractionMethod: string;
  confidence?: number | null;
  charCount: number;
};

export type DocumentProcessing = {
  run: ProcessingRun | null;
  classification: DocumentClassification | null;
  metadata: ExtractedMetadata[];
  segments: DocumentSegment[];
  pageCount: number;
  providers: { ai: AiProviderStatus | null; ocr: AiProviderStatus | null };
};

// ---------------------------------------------------------------------------
// Normalizadores
// ---------------------------------------------------------------------------

type Loose = Record<string, unknown>;

function asArray<T>(...candidates: unknown[]): T[] {
  for (const candidate of candidates) if (Array.isArray(candidate)) return candidate as T[];
  return [];
}

function normalizeProvider(raw: unknown, fallbackConfigured = false): AiProviderStatus {
  const value = (raw ?? {}) as Loose;
  const configured = Boolean(value.configured ?? value.isConfigured ?? fallbackConfigured);
  const state = (value.state ?? value.status) as string | undefined;
  return {
    key: (value.key ?? value.provider ?? null) as string | null,
    label: (value.label ?? value.name ?? null) as string | null,
    configured,
    state:
      state === "degraded" || state === "unavailable"
        ? state
        : configured
          ? "configured"
          : "not_configured",
    message: (value.message as string | undefined) ?? null,
  };
}

export function normalizeAiStatus(body: Loose): AiStatus {
  const raw = (body.status && typeof body.status === "object" ? body.status : body) as Loose;
  const provider = normalizeProvider(raw.provider ?? raw.ai);
  const ocr = normalizeProvider(raw.ocr);
  return {
    provider,
    ocr,
    publicOpportunityProvider: raw.publicOpportunityProvider
      ? normalizeProvider(raw.publicOpportunityProvider)
      : null,
    features: asArray<AiFeatureStatus>(raw.features).map((feature) => ({
      ...feature,
      enabled: Boolean(feature.enabled),
    })),
    budget: (raw.budget as AiBudgetSummary | undefined) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Chamadas — visão geral e administração
// ---------------------------------------------------------------------------

export async function fetchAiStatus(orgId: string): Promise<AiStatus | AiApiFailure> {
  const data = await request<Loose>(orgPath(orgId, "/ai/status"));
  if (isApiFailure(data)) return data;
  return normalizeAiStatus(data);
}

export async function fetchAiJobs(
  orgId: string,
  query: { status?: string; jobType?: string; limit?: number; offset?: number } = {},
): Promise<{ items: AiJob[]; total: number } | AiApiFailure> {
  const data = await request<Loose>(orgPath(orgId, `/ai/jobs${qs(query)}`));
  if (isApiFailure(data)) return data;
  const items = asArray<AiJob>(data.items, data.jobs);
  return { items, total: typeof data.total === "number" ? data.total : items.length };
}

export async function fetchAiUsage(
  orgId: string,
  query: AiUsageQuery = {},
): Promise<{ items: AiUsageItem[]; totals: AiUsageTotals; total: number } | AiApiFailure> {
  const data = await request<Loose>(orgPath(orgId, `/ai/usage${qs({ ...query })}`));
  if (isApiFailure(data)) return data;
  const wrapper = (data.usage && typeof data.usage === "object" ? data.usage : data) as Loose;
  const items = asArray<AiUsageItem>(wrapper.items, wrapper.records, data.items);
  const rawTotals = (wrapper.totals ?? data.totals) as Partial<AiUsageTotals> | undefined;
  const totals: AiUsageTotals = rawTotals
    ? {
        requests: rawTotals.requests ?? items.length,
        inputTokens: rawTotals.inputTokens ?? 0,
        outputTokens: rawTotals.outputTokens ?? 0,
        estimatedCostMicros: rawTotals.estimatedCostMicros ?? 0,
        currency: rawTotals.currency ?? "BRL",
      }
    : {
        requests: items.length,
        inputTokens: items.reduce((sum, item) => sum + (item.inputTokens ?? 0), 0),
        outputTokens: items.reduce((sum, item) => sum + (item.outputTokens ?? 0), 0),
        estimatedCostMicros: items.reduce((sum, item) => sum + (item.estimatedCostMicros ?? 0), 0),
        currency: items[0]?.currency ?? "BRL",
      };
  return { items, totals, total: typeof wrapper.total === "number" ? wrapper.total : items.length };
}

export async function fetchAiModels(orgId: string): Promise<{ models: AiModel[] } | AiApiFailure> {
  const data = await request<Loose>(orgPath(orgId, "/ai/models"));
  if (isApiFailure(data)) return data;
  return { models: asArray<AiModel>(data.models, data.items) };
}

export async function fetchAiPrompts(
  orgId: string,
): Promise<{ prompts: AiPrompt[] } | AiApiFailure> {
  const data = await request<Loose>(orgPath(orgId, "/ai/prompts"));
  if (isApiFailure(data)) return data;
  return { prompts: asArray<AiPrompt>(data.prompts, data.items) };
}

export async function fetchAiBudgets(
  orgId: string,
): Promise<{ budgets: AiBudget[] } | AiApiFailure> {
  const data = await request<Loose>(orgPath(orgId, "/ai/budgets"));
  if (isApiFailure(data)) return data;
  return { budgets: asArray<AiBudget>(data.budgets, data.items) };
}

// ---------------------------------------------------------------------------
// Análises jurídicas
// ---------------------------------------------------------------------------

export async function fetchLegalAnalyses(
  orgId: string,
  query: {
    legalMatterId?: string;
    documentId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ items: LegalAnalysisSummary[]; total: number } | AiApiFailure> {
  const data = await request<Loose>(orgPath(orgId, `/legal-analyses${qs(query)}`));
  if (isApiFailure(data)) return data;
  const items = asArray<LegalAnalysisSummary>(data.items, data.analyses);
  return { items, total: typeof data.total === "number" ? data.total : items.length };
}

export async function fetchLegalAnalysis(
  orgId: string,
  analysisId: string,
): Promise<{ analysis: LegalAnalysisDetail } | AiApiFailure> {
  const data = await request<Loose>(orgPath(orgId, `/legal-analyses/${analysisId}`));
  if (isApiFailure(data)) return data;
  const analysis = (data.analysis ?? data) as LegalAnalysisDetail;
  return { analysis };
}

export async function runLegalAnalysis(
  orgId: string,
  body: { legalMatterId?: string; documentId?: string; analysisType: string },
): Promise<{ analysis: LegalAnalysisSummary } | AiApiFailure> {
  const data = await request<Loose>(orgPath(orgId, "/legal-analyses"), {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (isApiFailure(data)) return data;
  return { analysis: (data.analysis ?? data) as LegalAnalysisSummary };
}

export async function reviewLegalAnalysis(
  orgId: string,
  analysisId: string,
  body: { disposition: "reviewed" | "corrected"; comment?: string },
): Promise<{ analysis: LegalAnalysisSummary } | AiApiFailure> {
  const data = await request<Loose>(orgPath(orgId, `/legal-analyses/${analysisId}/review`), {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (isApiFailure(data)) return data;
  return { analysis: (data.analysis ?? data) as LegalAnalysisSummary };
}

// ---------------------------------------------------------------------------
// Processamento de documentos
// ---------------------------------------------------------------------------

export async function fetchDocumentProcessing(
  orgId: string,
  documentId: string,
): Promise<DocumentProcessing | AiApiFailure> {
  const data = await request<Loose>(orgPath(orgId, `/documents/${documentId}/intelligence`));
  if (isApiFailure(data)) return data;
  const raw = (
    data.intelligence && typeof data.intelligence === "object" ? data.intelligence : data
  ) as Loose;
  const run = (raw.latestRun ?? raw.run ?? null) as ProcessingRun | null;
  const providers = (raw.providers ?? data.providers ?? {}) as Loose;
  return {
    run,
    classification: (raw.classification ?? null) as DocumentClassification | null,
    metadata: asArray<ExtractedMetadata>(raw.metadata),
    segments: asArray<DocumentSegment>(raw.segments),
    pageCount: Number(raw.storedPages ?? raw.pageCount ?? run?.pageCount ?? 0),
    providers: {
      ai: providers.ai ? normalizeProvider(providers.ai) : null,
      ocr: providers.ocr ? normalizeProvider(providers.ocr) : null,
    },
  };
}

export async function runDocumentProcessing(
  orgId: string,
  documentId: string,
  body: { documentVersionId?: string; strategy?: "auto" | "text" | "ocr" } = {},
): Promise<{ run: ProcessingRun } | AiApiFailure> {
  const versionId = body.documentVersionId;
  if (!versionId) {
    return {
      httpStatus: 400,
      error: {
        code: "VALIDATION_ERROR",
        message: "Informe a versão do documento para processar.",
      },
    };
  }
  const data = await request<Loose>(
    orgPath(orgId, `/documents/${documentId}/versions/${versionId}/process`),
    {
      method: "POST",
      body: JSON.stringify({ strategy: body.strategy ?? "auto" }),
    },
  );
  if (isApiFailure(data)) return data;
  return { run: (data.run ?? data.processingRun ?? data) as ProcessingRun };
}

export async function fetchDocumentPages(
  orgId: string,
  documentId: string,
  versionId?: string,
): Promise<{ pages: DocumentPage[] } | AiApiFailure> {
  if (!versionId) {
    return { pages: [] };
  }
  const data = await request<Loose>(
    orgPath(orgId, `/documents/${documentId}/versions/${versionId}/pages`),
  );
  if (isApiFailure(data)) return data;
  return { pages: asArray<DocumentPage>(data.pages, data.items) };
}

export async function reviewDocumentProcessing(
  orgId: string,
  documentId: string,
  body: {
    target: "metadata" | "classification";
    targetId: string;
    reviewStatus: "reviewed" | "corrected" | "rejected";
    correctedValue?: string;
  },
): Promise<{ ok: true } | AiApiFailure> {
  const path =
    body.target === "metadata"
      ? `/documents/${documentId}/metadata/${body.targetId}/review`
      : `/documents/${documentId}/classification/${body.targetId}/review`;
  const payload =
    body.target === "metadata"
      ? {
          action: body.reviewStatus,
          correctedValue: body.correctedValue,
        }
      : {
          action:
            body.reviewStatus === "reviewed"
              ? "accept"
              : body.reviewStatus === "rejected"
                ? "reject"
                : "correct",
          kind: body.correctedValue,
        };
  const data = await request<Loose>(orgPath(orgId, path), {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (isApiFailure(data)) return data;
  return { ok: true };
}
