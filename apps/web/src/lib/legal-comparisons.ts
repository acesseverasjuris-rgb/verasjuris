import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure } from "./ai";
import { aiErrorMessage, formatDateTime, hasPermission, isApiFailure, isNotConfigured } from "./ai";
import { getActiveMembership, getActiveOrgId } from "./crm";

export {
  getActiveMembership,
  getActiveOrgId,
  isApiFailure,
  aiErrorMessage,
  formatDateTime,
  isNotConfigured,
};

/**
 * Comparador de peças — /api/v1/organizations/:orgId/legal-comparisons
 */

export type LegalComparisonType =
  | "petition_vs_defense"
  | "evidence_vs_allegations"
  | "claim_vs_decision"
  | "judgment_vs_appeal"
  | "admin_process_vs_judicial_action";

export type LegalComparisonStatus =
  | "draft"
  | "processing"
  | "generated"
  | "human_review"
  | "reviewed"
  | "closed"
  | "failed"
  | "not_configured";

export type LegalComparisonSourceRole =
  | "side_a"
  | "side_b"
  | "petition"
  | "defense"
  | "evidence"
  | "allegation"
  | "claim"
  | "decision"
  | "judgment"
  | "appeal"
  | "administrative_request"
  | "administrative_decision"
  | "other";

export type LegalComparisonItemReviewStatus = "unreviewed" | "confirmed" | "rejected" | "corrected";

export type LegalComparisonSource = {
  id?: string;
  documentId: string;
  documentVersionId?: string | null;
  roleInComparison: LegalComparisonSourceRole | string;
  sortOrder: number;
  documentTitle?: string | null;
};

export type LegalComparisonItem = {
  id: string;
  category?: string | null;
  sourceA?: string | null;
  sourceB?: string | null;
  finding: string;
  severity?: string | null;
  confidence?: number | null;
  provenance?: Record<string, unknown> | null;
  unsupported?: boolean;
  reviewStatus: LegalComparisonItemReviewStatus | string;
  reviewerComment?: string | null;
  reviewedAt?: string | null;
  sortOrder?: number;
};

export type LegalComparisonSummary = {
  id: string;
  comparisonType: LegalComparisonType | string;
  status: LegalComparisonStatus | string;
  title?: string | null;
  summary?: string | null;
  legalMatterId?: string | null;
  aiRequestId?: string | null;
  assistive?: boolean;
  appliedToDomain?: boolean;
  reviewComment?: string | null;
  completedAt?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type LegalComparisonDetail = LegalComparisonSummary & {
  sources?: LegalComparisonSource[];
  items?: LegalComparisonItem[];
  pendingReviewItems?: number;
};

export type CreateLegalComparisonInput = {
  comparisonType: LegalComparisonType;
  legalMatterId?: string;
  title?: string;
  sources: Array<{
    documentId: string;
    documentVersionId?: string;
    roleInComparison?: LegalComparisonSourceRole;
    sortOrder?: number;
  }>;
  idempotencyKey?: string;
};

export const LEGAL_COMPARISON_TYPE_LABELS: Record<LegalComparisonType, string> = {
  petition_vs_defense: "Petição × defesa",
  evidence_vs_allegations: "Provas × alegações",
  claim_vs_decision: "Pedidos × decisão",
  judgment_vs_appeal: "Sentença × recurso",
  admin_process_vs_judicial_action: "Administrativo × judicial",
};

export const LEGAL_COMPARISON_STATUS_LABELS: Record<LegalComparisonStatus, string> = {
  draft: "Rascunho",
  processing: "Em processamento",
  generated: "Gerada",
  human_review: "Aguardando revisão humana",
  reviewed: "Revisada",
  closed: "Encerrada",
  failed: "Falhou",
  not_configured: "Não configurada",
};

export const LEGAL_COMPARISON_ROLE_LABELS: Record<LegalComparisonSourceRole, string> = {
  side_a: "Lado A",
  side_b: "Lado B",
  petition: "Petição",
  defense: "Defesa",
  evidence: "Prova",
  allegation: "Alegação",
  claim: "Pedido",
  decision: "Decisão",
  judgment: "Sentença",
  appeal: "Recurso",
  administrative_request: "Requerimento administrativo",
  administrative_decision: "Decisão administrativa",
  other: "Outro",
};

export const LEGAL_COMPARISON_ITEM_STATUS_LABELS: Record<LegalComparisonItemReviewStatus, string> =
  {
    unreviewed: "IA · Não revisado",
    confirmed: "Confirmado",
    rejected: "Rejeitado",
    corrected: "Corrigido",
  };

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
  const body = (await response.json().catch(() => ({}))) as T & AiApiFailure;
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

export function hasLegalComparisonPermission(
  permissions: readonly string[] | undefined,
  action: "read" | "create" | "run" | "review",
): boolean {
  return hasPermission(permissions, `legal_comparison.${action}`);
}

export function comparisonTypeLabel(key: string): string {
  return LEGAL_COMPARISON_TYPE_LABELS[key as LegalComparisonType] ?? key.replaceAll("_", " ");
}

export function comparisonStatusLabel(key: string): string {
  return LEGAL_COMPARISON_STATUS_LABELS[key as LegalComparisonStatus] ?? key.replaceAll("_", " ");
}

export function comparisonRoleLabel(key: string): string {
  return LEGAL_COMPARISON_ROLE_LABELS[key as LegalComparisonSourceRole] ?? key.replaceAll("_", " ");
}

export async function fetchLegalComparisons(
  orgId: string,
  query: {
    legalMatterId?: string;
    comparisonType?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-comparisons${qs({ ...query })}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? data.comparisons ?? []) as LegalComparisonSummary[];
  return { items, total: typeof data.total === "number" ? data.total : items.length };
}

export async function fetchLegalComparison(orgId: string, comparisonId: string) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-comparisons/${comparisonId}`),
  );
  if (isApiFailure(data)) return data;
  return { comparison: (data.comparison ?? data) as LegalComparisonDetail };
}

export async function createLegalComparison(orgId: string, body: CreateLegalComparisonInput) {
  const headers: Record<string, string> = {};
  if (body.idempotencyKey) headers["Idempotency-Key"] = body.idempotencyKey;
  const data = await request<Record<string, unknown>>(orgPath(orgId, "/legal-comparisons"), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (isApiFailure(data)) return data;
  return {
    comparison: (data.comparison ?? data) as LegalComparisonDetail,
    replayed: Boolean(data.replayed),
  };
}

export async function runLegalComparison(
  orgId: string,
  comparisonId: string,
  body: { idempotencyKey?: string } = {},
) {
  const headers: Record<string, string> = {};
  if (body.idempotencyKey) headers["Idempotency-Key"] = body.idempotencyKey;
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-comparisons/${comparisonId}/run`),
    { method: "POST", headers, body: JSON.stringify(body) },
  );
  if (isApiFailure(data)) return data;
  return { comparison: (data.comparison ?? data) as LegalComparisonDetail };
}

export async function reviewLegalComparison(
  orgId: string,
  comparisonId: string,
  body: { reviewComment?: string; status?: "human_review" | "reviewed" | "closed" } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-comparisons/${comparisonId}/review`),
    { method: "POST", body: JSON.stringify(body) },
  );
  if (isApiFailure(data)) return data;
  return { comparison: (data.comparison ?? data) as LegalComparisonSummary };
}

export async function reviewLegalComparisonItem(
  orgId: string,
  comparisonId: string,
  itemId: string,
  body: { reviewStatus: LegalComparisonItemReviewStatus; reviewerComment?: string },
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-comparisons/${comparisonId}/items/${itemId}/review`),
    { method: "POST", body: JSON.stringify(body) },
  );
  if (isApiFailure(data)) return data;
  return { item: (data.item ?? data) as LegalComparisonItem };
}
