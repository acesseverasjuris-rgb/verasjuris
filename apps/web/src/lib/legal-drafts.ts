import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure } from "./ai";
import { aiErrorMessage, formatDateTime, hasPermission, isApiFailure, isNotConfigured } from "./ai";
import { getActiveMembership, getActiveOrgId } from "./crm";
import type { LegalTemplateType } from "./legal-templates";
import { LEGAL_TEMPLATE_TYPE_LABELS } from "./legal-templates";

export {
  getActiveMembership,
  getActiveOrgId,
  isApiFailure,
  aiErrorMessage,
  formatDateTime,
  isNotConfigured,
};

/**
 * Minutas / workflow — /api/v1/organizations/:orgId/legal-drafts
 */

export type LegalDraftStatus =
  | "draft"
  | "ai_assisted"
  | "human_review"
  | "approved"
  | "ready_to_file"
  | "filed"
  | "confirmed"
  | "rejected"
  | "cancelled"
  | "archived"
  | "failed";

export type LegalDraftFilingMethod = "manual" | "electronic" | "provider" | "not_configured";
export type LegalDraftConfirmationMethod = "manual" | "provider";
export type LegalDraftChecklistItemStatus = "pending" | "done" | "not_applicable" | "blocked";

export type LegalDraftSummary = {
  id: string;
  organizationId?: string;
  legalMatterId?: string | null;
  judicialProcessId?: string | null;
  administrativeProcessId?: string | null;
  clientId?: string | null;
  templateId?: string | null;
  templateVersionId?: string | null;
  documentType: LegalTemplateType | string;
  title: string;
  status: LegalDraftStatus | string;
  content?: string | null;
  structuredData?: Record<string, unknown> | null;
  aiRequestId?: string | null;
  sourceSetId?: string | null;
  currentDocumentId?: string | null;
  reviewedByMembershipId?: string | null;
  reviewedAt?: string | null;
  reviewComment?: string | null;
  approvedByMembershipId?: string | null;
  approvedAt?: string | null;
  filedAt?: string | null;
  filedByMembershipId?: string | null;
  filingMethod?: LegalDraftFilingMethod | string | null;
  filingMethodLabel?: string | null;
  protocolNumber?: string | null;
  evidenceDocumentId?: string | null;
  filingNotes?: string | null;
  confirmationEvidenceDocumentId?: string | null;
  confirmedAt?: string | null;
  confirmedByMembershipId?: string | null;
  confirmationMethod?: LegalDraftConfirmationMethod | string | null;
  createdAt: string;
  updatedAt?: string;
};

export type LegalDraftVersion = {
  id: string;
  draftId: string;
  version: number;
  content?: string | null;
  structuredData?: Record<string, unknown> | null;
  status?: string;
  changeSummary?: string | null;
  createdAt: string;
};

export type LegalDraftHistoryItem = {
  id: string;
  draftId: string;
  fromStatus: string | null;
  toStatus: string;
  actorMembershipId?: string | null;
  reason?: string | null;
  evidenceDocumentId?: string | null;
  createdAt: string;
};

export type LegalDraftChecklistItem = {
  id: string;
  checklistId: string;
  itemKey: string;
  label: string;
  category?: string | null;
  required: boolean;
  status: LegalDraftChecklistItemStatus | string;
  sortOrder: number;
  notes?: string | null;
  completedAt?: string | null;
};

export type LegalDraftChecklist = {
  id: string;
  name: string;
  isTemplate?: boolean;
  active?: boolean;
  items: LegalDraftChecklistItem[];
};

export type LegalDraftSourceItem = {
  id: string;
  sourceSetId: string;
  itemType: string;
  referenceId?: string | null;
  documentId?: string | null;
  documentVersionId?: string | null;
  instructionText?: string | null;
  sortOrder: number;
};

export type LegalDraftSourceSet = {
  id: string;
  draftId?: string | null;
  name?: string | null;
  items?: LegalDraftSourceItem[];
  createdAt?: string;
};

export type LegalDraftDetail = {
  draft: LegalDraftSummary;
  versions: LegalDraftVersion[];
  history: LegalDraftHistoryItem[];
  checklists: LegalDraftChecklist[];
  sourceSet: LegalDraftSourceSet | null;
  missingVariables?: string[];
};

export type CreateLegalDraftInput = {
  title: string;
  documentType?: LegalTemplateType;
  legalMatterId?: string;
  judicialProcessId?: string;
  administrativeProcessId?: string;
  clientId?: string;
  templateId?: string;
  templateVersionId?: string;
  content?: string;
  structuredData?: Record<string, unknown>;
  variableValues?: Record<string, unknown>;
  sourceSetId?: string;
  idempotencyKey?: string;
};

export type UpdateLegalDraftInput = {
  title?: string;
  documentType?: LegalTemplateType;
  content?: string | null;
  structuredData?: Record<string, unknown> | null;
  variableValues?: Record<string, unknown>;
  reviewComment?: string | null;
};

export const LEGAL_DRAFT_STATUS_LABELS: Record<LegalDraftStatus, string> = {
  draft: "Rascunho",
  ai_assisted: "IA gerou",
  human_review: "Humano revisando",
  approved: "Aprovada",
  ready_to_file: "Pronta para protocolo",
  filed: "Protocolo manual registrado",
  confirmed: "Protocolo confirmado",
  rejected: "Rejeitada",
  cancelled: "Cancelada",
  archived: "Arquivada",
  failed: "Falhou",
};

export const LEGAL_DRAFT_FILING_METHOD_LABELS: Record<LegalDraftFilingMethod, string> = {
  manual: "Protocolo manual",
  electronic: "Eletrônico",
  provider: "Provedor",
  not_configured: "Não configurado",
};

export const LEGAL_DRAFT_CHECKLIST_STATUS_LABELS: Record<LegalDraftChecklistItemStatus, string> = {
  pending: "Pendente",
  done: "Concluído",
  not_applicable: "Não se aplica",
  blocked: "Bloqueado",
};

export const LEGAL_DRAFT_DOCUMENT_TYPE_LABELS = LEGAL_TEMPLATE_TYPE_LABELS;

export const WORKFLOW_MILESTONE_HINTS: Array<{
  key: LegalDraftStatus;
  label: string;
  layer: "FONTE" | "ANÁLISE" | "AÇÃO";
}> = [
  { key: "ai_assisted", label: "IA gerou", layer: "ANÁLISE" },
  { key: "human_review", label: "Humano revisou", layer: "AÇÃO" },
  { key: "approved", label: "Aprovada", layer: "AÇÃO" },
  { key: "ready_to_file", label: "Pronta para protocolo", layer: "AÇÃO" },
  { key: "filed", label: "Protocolo manual", layer: "AÇÃO" },
  { key: "confirmed", label: "Confirmação", layer: "AÇÃO" },
];

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

export function hasLegalDraftPermission(
  permissions: readonly string[] | undefined,
  action:
    | "read"
    | "create"
    | "update"
    | "ai_assist"
    | "review"
    | "approve"
    | "ready_to_file"
    | "file"
    | "confirm",
): boolean {
  return hasPermission(permissions, `legal_draft.${action}`);
}

export function draftStatusLabel(key: string): string {
  return LEGAL_DRAFT_STATUS_LABELS[key as LegalDraftStatus] ?? key.replaceAll("_", " ");
}

export function draftDocumentTypeLabel(key: string): string {
  return LEGAL_DRAFT_DOCUMENT_TYPE_LABELS[key as LegalTemplateType] ?? key.replaceAll("_", " ");
}

export async function fetchLegalDrafts(
  orgId: string,
  query: {
    q?: string;
    status?: string;
    documentType?: string;
    legalMatterId?: string;
    judicialProcessId?: string;
    administrativeProcessId?: string;
    clientId?: string;
    templateId?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-drafts${qs({ ...query })}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.drafts ?? data.items ?? []) as LegalDraftSummary[];
  return { items, total: typeof data.total === "number" ? data.total : items.length };
}

export async function fetchLegalDraft(orgId: string, draftId: string) {
  const data = await request<Record<string, unknown>>(orgPath(orgId, `/legal-drafts/${draftId}`));
  if (isApiFailure(data)) return data;
  return {
    draft: (data.draft ?? data) as LegalDraftSummary,
    versions: (data.versions ?? []) as LegalDraftVersion[],
    history: (data.history ?? []) as LegalDraftHistoryItem[],
    checklists: (data.checklists ?? []) as LegalDraftChecklist[],
    sourceSet: (data.sourceSet ?? null) as LegalDraftSourceSet | null,
    missingVariables: (data.missingVariables ?? []) as string[],
  } satisfies LegalDraftDetail;
}

export async function createLegalDraft(orgId: string, body: CreateLegalDraftInput) {
  const headers: Record<string, string> = {};
  if (body.idempotencyKey) headers["Idempotency-Key"] = body.idempotencyKey;
  const data = await request<Record<string, unknown>>(orgPath(orgId, "/legal-drafts"), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (isApiFailure(data)) return data;
  return { draft: (data.draft ?? data) as LegalDraftSummary };
}

export async function generateLegalDraft(orgId: string, body: CreateLegalDraftInput) {
  const headers: Record<string, string> = {};
  if (body.idempotencyKey) headers["Idempotency-Key"] = body.idempotencyKey;
  const data = await request<Record<string, unknown>>(orgPath(orgId, "/legal-drafts/generate"), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (isApiFailure(data)) return data;
  return { draft: (data.draft ?? data) as LegalDraftSummary };
}

export async function updateLegalDraft(
  orgId: string,
  draftId: string,
  body: UpdateLegalDraftInput,
) {
  const data = await request<Record<string, unknown>>(orgPath(orgId, `/legal-drafts/${draftId}`), {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (isApiFailure(data)) return data;
  return { draft: (data.draft ?? data) as LegalDraftSummary };
}

export async function createLegalDraftVersion(
  orgId: string,
  draftId: string,
  body: { content?: string; structuredData?: Record<string, unknown>; changeSummary?: string } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-drafts/${draftId}/versions`),
    { method: "POST", body: JSON.stringify(body) },
  );
  if (isApiFailure(data)) return data;
  return {
    version: (data.version ?? data) as LegalDraftVersion,
    draft: (data.draft ?? null) as LegalDraftSummary | null,
  };
}

export async function createLegalDraftSourceSet(
  orgId: string,
  body: {
    name?: string;
    draftId?: string;
    items?: Array<{
      itemType: string;
      referenceId?: string;
      documentId?: string;
      documentVersionId?: string;
      instructionText?: string;
      sortOrder?: number;
      metadata?: Record<string, unknown>;
    }>;
  },
) {
  const data = await request<Record<string, unknown>>(orgPath(orgId, "/legal-drafts/source-sets"), {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (isApiFailure(data)) return data;
  return { set: (data.set ?? data.sourceSet ?? data) as LegalDraftSourceSet };
}

export async function aiAssistLegalDraft(
  orgId: string,
  draftId: string,
  body: { instructions?: string; idempotencyKey?: string } = {},
) {
  const headers: Record<string, string> = {};
  if (body.idempotencyKey) headers["Idempotency-Key"] = body.idempotencyKey;
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-drafts/${draftId}/ai-assist`),
    { method: "POST", headers, body: JSON.stringify(body) },
  );
  if (isApiFailure(data)) return data;
  return { draft: (data.draft ?? data) as LegalDraftSummary };
}

export async function submitLegalDraftForReview(
  orgId: string,
  draftId: string,
  body: { reason?: string; reviewComment?: string | null } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-drafts/${draftId}/review`),
    { method: "POST", body: JSON.stringify(body) },
  );
  if (isApiFailure(data)) return data;
  return { draft: (data.draft ?? data) as LegalDraftSummary };
}

export async function approveLegalDraft(
  orgId: string,
  draftId: string,
  body: { reason?: string } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-drafts/${draftId}/approve`),
    { method: "POST", body: JSON.stringify(body) },
  );
  if (isApiFailure(data)) return data;
  return { draft: (data.draft ?? data) as LegalDraftSummary };
}

export async function markLegalDraftReadyToFile(
  orgId: string,
  draftId: string,
  body: { reason?: string } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-drafts/${draftId}/ready-to-file`),
    { method: "POST", body: JSON.stringify(body) },
  );
  if (isApiFailure(data)) return data;
  return { draft: (data.draft ?? data) as LegalDraftSummary };
}

export async function fileLegalDraft(
  orgId: string,
  draftId: string,
  body: {
    filedAt: string;
    filingMethod?: LegalDraftFilingMethod;
    protocolNumber?: string;
    evidenceDocumentId?: string;
    filingNotes?: string;
  },
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-drafts/${draftId}/file`),
    { method: "POST", body: JSON.stringify(body) },
  );
  if (isApiFailure(data)) return data;
  return { draft: (data.draft ?? data) as LegalDraftSummary };
}

export async function confirmLegalDraftFiling(
  orgId: string,
  draftId: string,
  body: {
    confirmedAt?: string;
    confirmationMethod?: LegalDraftConfirmationMethod;
    confirmationEvidenceDocumentId: string;
    notes?: string;
  },
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-drafts/${draftId}/confirm`),
    { method: "POST", body: JSON.stringify(body) },
  );
  if (isApiFailure(data)) return data;
  return { draft: (data.draft ?? data) as LegalDraftSummary };
}

export async function updateLegalDraftChecklistItem(
  orgId: string,
  draftId: string,
  itemId: string,
  body: { status?: LegalDraftChecklistItemStatus; notes?: string | null },
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-drafts/${draftId}/checklist-items/${itemId}`),
    { method: "PATCH", body: JSON.stringify(body) },
  );
  if (isApiFailure(data)) return data;
  return { item: (data.item ?? data) as LegalDraftChecklistItem };
}

export async function convertLegalDraftToDocument(
  orgId: string,
  draftId: string,
  body: { format?: "plain_text" | "html" } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-drafts/${draftId}/convert-to-document`),
    { method: "POST", body: JSON.stringify(body) },
  );
  if (isApiFailure(data)) return data;
  return {
    document: (data.document ?? data) as { id?: string; [key: string]: unknown },
    draft: (data.draft ?? null) as LegalDraftSummary | null,
  };
}

export async function exportLegalDraft(
  orgId: string,
  draftId: string,
  format: "html" | "pdf" | "docx" = "html",
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-drafts/${draftId}/export${qs({ format })}`),
  );
  if (isApiFailure(data)) return data;
  return data as {
    content?: string;
    format?: string;
    mimeType?: string;
    filename?: string;
    [key: string]: unknown;
  };
}
