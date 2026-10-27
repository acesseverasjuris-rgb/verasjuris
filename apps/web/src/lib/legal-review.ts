import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure } from "./ai";
import { aiErrorMessage, formatDateTime, hasPermission, isApiFailure } from "./ai";
import { getActiveMembership, getActiveOrgId } from "./crm";

export { getActiveMembership, getActiveOrgId, isApiFailure, aiErrorMessage, formatDateTime };

/**
 * IA Revisora — /api/v1/organizations/:orgId
 *  - POST/GET /legal-review-sets
 *  - GET  /legal-review-sets/:setId
 *  - POST/GET /legal-reviews
 *  - GET  /legal-reviews/:reviewId
 *  - POST /legal-reviews/:reviewId/review
 *  - POST /legal-reviews/:reviewId/items/:section/:itemId/review
 */

export type LegalReviewType =
  | "formal_review"
  | "content_review"
  | "cross_document_review"
  | "procedural_risk_review"
  | "claims_review"
  | "evidence_review"
  | "contract_review"
  | "decision_response_review"
  | "administrative_review";

export type LegalReviewStatus =
  | "draft"
  | "processing"
  | "generated"
  | "human_review"
  | "reviewed"
  | "closed"
  | "failed"
  | "not_configured";

export type LegalReviewDocumentRole =
  | "initial_petition"
  | "defense"
  | "reply"
  | "expert_report"
  | "medical_report"
  | "decision"
  | "appeal"
  | "contract"
  | "evidence"
  | "administrative_request"
  | "administrative_decision"
  | "other";

export type LegalReviewItemStatus = "unreviewed" | "confirmed" | "rejected" | "corrected";

export type LegalReviewSection =
  | "formal_issues"
  | "missing_documents"
  | "unaddressed_claims"
  | "unanswered_grounds"
  | "risks"
  | "inconsistencies"
  | "contradictions";

export type LegalReviewItemAction = "confirm" | "reject" | "correct";

export const LEGAL_REVIEW_TYPE_LABELS: Record<LegalReviewType, string> = {
  formal_review: "Revisão formal",
  content_review: "Revisão de conteúdo",
  cross_document_review: "Revisão cruzada de documentos",
  procedural_risk_review: "Riscos procedimentais",
  claims_review: "Revisão de pedidos",
  evidence_review: "Revisão de provas",
  contract_review: "Revisão contratual",
  decision_response_review: "Resposta a decisão",
  administrative_review: "Revisão administrativa",
};

export const LEGAL_REVIEW_STATUS_LABELS: Record<LegalReviewStatus, string> = {
  draft: "Rascunho",
  processing: "Em processamento",
  generated: "Gerada",
  human_review: "Aguardando revisão humana",
  reviewed: "Revisada",
  closed: "Encerrada",
  failed: "Falhou",
  not_configured: "Não configurada",
};

export const LEGAL_REVIEW_ROLE_LABELS: Record<LegalReviewDocumentRole, string> = {
  initial_petition: "Petição inicial",
  defense: "Contestação / defesa",
  reply: "Réplica",
  expert_report: "Laudo pericial",
  medical_report: "Laudo médico",
  decision: "Decisão",
  appeal: "Recurso",
  contract: "Contrato",
  evidence: "Prova",
  administrative_request: "Requerimento administrativo",
  administrative_decision: "Decisão administrativa",
  other: "Outro",
};

export const LEGAL_REVIEW_SECTION_LABELS: Record<LegalReviewSection, string> = {
  formal_issues: "Erros formais",
  missing_documents: "Documentos ausentes",
  unaddressed_claims: "Pedidos",
  unanswered_grounds: "Teses",
  risks: "Riscos",
  inconsistencies: "Inconsistências",
  contradictions: "Contradições",
};

export const LEGAL_REVIEW_ITEM_STATUS_LABELS: Record<LegalReviewItemStatus, string> = {
  unreviewed: "IA · Não revisado",
  confirmed: "Confirmado",
  rejected: "Rejeitado",
  corrected: "Corrigido",
};

export const LEGAL_REVIEW_SECTIONS: LegalReviewSection[] = [
  "contradictions",
  "formal_issues",
  "missing_documents",
  "unaddressed_claims",
  "unanswered_grounds",
  "risks",
  "inconsistencies",
];

export type LegalReviewSummary = {
  id: string;
  reviewType: LegalReviewType | string;
  status: LegalReviewStatus | string;
  version: number;
  assistive?: boolean;
  appliedToDomain?: boolean;
  summary: string | null;
  legalMatterId?: string | null;
  judicialProcessId?: string | null;
  administrativeProcessId?: string | null;
  primaryDocumentId?: string | null;
  reviewSetId?: string | null;
  aiRequestId?: string | null;
  reviewedAt?: string | null;
  completedAt?: string | null;
  reviewComment?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type LegalReviewSet = {
  id: string;
  name: string;
  legalMatterId?: string | null;
  createdAt: string;
  documents?: Array<{
    documentId: string;
    documentVersionId?: string | null;
    roleInReview: LegalReviewDocumentRole | string;
    sortOrder: number;
  }>;
};

export type ReviewItemBase = {
  id: string;
  reviewStatus: LegalReviewItemStatus | string;
  unsupported?: boolean;
  confidence?: number | null;
  severity?: string | null;
  sourceLabel?: string | null;
  pageNumber?: number | null;
  correctedText?: string | null;
  reviewComment?: string | null;
};

export type FormalIssue = ReviewItemBase & {
  description: string;
  issueType?: string | null;
};

export type MissingDocument = ReviewItemBase & {
  description?: string | null;
  documentDescription?: string | null;
  message?: string;
};

export type UnaddressedClaim = ReviewItemBase & {
  claimText?: string | null;
  description?: string | null;
  sourcePage?: number | null;
};

export type UnansweredGround = ReviewItemBase & {
  groundText?: string | null;
  description?: string | null;
  juridicallyFounded?: boolean;
};

export type ReviewRisk = ReviewItemBase & {
  description: string;
  riskType?: string | null;
};

export type ReviewInconsistency = ReviewItemBase & {
  description: string;
};

export type ReviewContradiction = ReviewItemBase & {
  statementA: string;
  statementB: string;
  sourceA?: string | null;
  sourceB?: string | null;
  pageA?: number | null;
  pageB?: number | null;
  explanation?: string | null;
  possibleContradiction?: boolean;
};

export type LegalReviewDetail = LegalReviewSummary & {
  contentFormat?: string;
  provider?: string | null;
  pendingReviewItems?: number;
  formalIssues?: FormalIssue[];
  missingDocuments?: MissingDocument[];
  unaddressedClaims?: UnaddressedClaim[];
  unansweredGrounds?: UnansweredGround[];
  risks?: ReviewRisk[];
  inconsistencies?: ReviewInconsistency[];
  contradictions?: ReviewContradiction[];
  suggestedCorrections?: Array<{ text?: string; autoEdit?: boolean }>;
  sources?: Array<{
    documentId?: string | null;
    documentVersionId?: string | null;
    sourceLabel?: string | null;
  }>;
};

export type CreateReviewSetInput = {
  name: string;
  legalMatterId?: string;
  documents: Array<{
    documentId: string;
    documentVersionId?: string;
    roleInReview: LegalReviewDocumentRole;
    sortOrder?: number;
  }>;
};

export type CreateLegalReviewInput = {
  reviewType: LegalReviewType;
  legalMatterId?: string;
  judicialProcessId?: string;
  administrativeProcessId?: string;
  primaryDocumentId?: string;
  reviewSetId?: string;
  idempotencyKey?: string;
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

export function hasLegalReviewPermission(
  permissions: readonly string[] | undefined,
  action: "read" | "create" | "review" | "manage",
): boolean {
  return hasPermission(permissions, `legal_review.${action}`);
}

export function reviewTypeLabel(key: string): string {
  return LEGAL_REVIEW_TYPE_LABELS[key as LegalReviewType] ?? key.replaceAll("_", " ");
}

export function reviewStatusLabel(key: string): string {
  return LEGAL_REVIEW_STATUS_LABELS[key as LegalReviewStatus] ?? key.replaceAll("_", " ");
}

export function sectionLabel(key: LegalReviewSection | string): string {
  return LEGAL_REVIEW_SECTION_LABELS[key as LegalReviewSection] ?? key.replaceAll("_", " ");
}

export async function fetchLegalReviews(
  orgId: string,
  query: {
    legalMatterId?: string;
    primaryDocumentId?: string;
    reviewType?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-reviews${qs({ ...query })}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? data.reviews ?? []) as LegalReviewSummary[];
  return { items, total: typeof data.total === "number" ? data.total : items.length };
}

export async function fetchLegalReview(orgId: string, reviewId: string) {
  const data = await request<Record<string, unknown>>(orgPath(orgId, `/legal-reviews/${reviewId}`));
  if (isApiFailure(data)) return data;
  return { review: (data.review ?? data) as LegalReviewDetail };
}

export async function createLegalReviewSet(orgId: string, body: CreateReviewSetInput) {
  const data = await request<Record<string, unknown>>(orgPath(orgId, "/legal-review-sets"), {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (isApiFailure(data)) return data;
  return { set: (data.set ?? data.reviewSet ?? data) as LegalReviewSet };
}

export async function createLegalReview(orgId: string, body: CreateLegalReviewInput) {
  const headers: Record<string, string> = {};
  if (body.idempotencyKey) headers["Idempotency-Key"] = body.idempotencyKey;
  const data = await request<Record<string, unknown>>(orgPath(orgId, "/legal-reviews"), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (isApiFailure(data)) return data;
  return {
    review: (data.review ?? data) as LegalReviewSummary,
    replayed: Boolean(data.replayed),
  };
}

export async function reviewLegalReview(
  orgId: string,
  reviewId: string,
  body: { comment?: string } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-reviews/${reviewId}/review`),
    { method: "POST", body: JSON.stringify(body) },
  );
  if (isApiFailure(data)) return data;
  return { review: (data.review ?? data) as LegalReviewSummary };
}

export async function reviewLegalReviewItem(
  orgId: string,
  reviewId: string,
  section: LegalReviewSection,
  itemId: string,
  body: { action: LegalReviewItemAction; correctedText?: string; comment?: string },
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-reviews/${reviewId}/items/${section}/${itemId}/review`),
    { method: "POST", body: JSON.stringify(body) },
  );
  if (isApiFailure(data)) return data;
  return { item: (data.item ?? data) as ReviewItemBase };
}
