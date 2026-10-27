import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure } from "./ai";
import { aiErrorMessage, formatDateTime, hasPermission, isApiFailure } from "./ai";
import { getActiveMembership, getActiveOrgId } from "./crm";

export { getActiveMembership, getActiveOrgId, isApiFailure, aiErrorMessage, formatDateTime };

/**
 * Modelos de documentos jurídicos — /api/v1/organizations/:orgId/legal-document-templates
 */

export type LegalTemplateType =
  | "initial_petition"
  | "defense"
  | "reply"
  | "motion"
  | "appeal"
  | "counter_arguments"
  | "legal_opinion"
  | "administrative_request"
  | "contract"
  | "notice"
  | "power_of_attorney"
  | "declaration"
  | "settlement"
  | "other";

export type LegalTemplateDocumentKind =
  | "identification"
  | "evidence"
  | "contract"
  | "petition"
  | "decision"
  | "report"
  | "power_of_attorney"
  | "administrative"
  | "correspondence"
  | "other";

export type LegalTemplateVersionStatus =
  | "draft"
  | "review"
  | "approved"
  | "active"
  | "deprecated"
  | "archived";

export type LegalTemplateContentFormat = "html" | "markdown" | "plain_text" | "structured";

export type TemplateVariableField = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  default?: unknown;
  validation?: Record<string, unknown>;
  source?: string;
  helpText?: string;
};

export type LegalTemplateSummary = {
  id: string;
  organizationId?: string | null;
  scope: "system" | "organization" | string;
  templateType: LegalTemplateType | string;
  name: string;
  description?: string | null;
  legalAreaId?: string | null;
  jurisdiction?: string | null;
  documentKind: LegalTemplateDocumentKind | string;
  currentVersionId?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type LegalTemplateVersion = {
  id: string;
  templateId: string;
  version: number;
  content: string;
  contentFormat: LegalTemplateContentFormat | string;
  variableSchema?: { fields?: TemplateVariableField[] } | Record<string, unknown> | null;
  sectionSchema?: Record<string, unknown> | null;
  status: LegalTemplateVersionStatus | string;
  changelog?: string | null;
  createdAt: string;
  activatedAt?: string | null;
};

export type LegalTemplateDetail = {
  template: LegalTemplateSummary;
  currentVersion: LegalTemplateVersion | null;
  versions: LegalTemplateVersion[];
};

export type TemplatePreviewResult = {
  rendered: string;
  missingVariables: string[];
  requiredMissing: string[];
  blockedExpressions?: string[];
  missingVariableMarkerExample?: string;
  mutated?: boolean;
};

export type CreateLegalTemplateInput = {
  name: string;
  description?: string;
  templateType?: LegalTemplateType;
  documentKind?: LegalTemplateDocumentKind;
  legalAreaId?: string;
  jurisdiction?: string;
  content: string;
  contentFormat?: LegalTemplateContentFormat;
  variableSchema?: { fields: TemplateVariableField[] };
  sectionSchema?: Record<string, unknown>;
  changelog?: string;
};

export type UpdateLegalTemplateInput = {
  name?: string;
  description?: string | null;
  templateType?: LegalTemplateType;
  documentKind?: LegalTemplateDocumentKind;
  legalAreaId?: string | null;
  jurisdiction?: string | null;
  active?: boolean;
};

export type CreateLegalTemplateVersionInput = {
  content: string;
  contentFormat?: LegalTemplateContentFormat;
  variableSchema?: { fields: TemplateVariableField[] };
  sectionSchema?: Record<string, unknown>;
  changelog?: string;
};

export const LEGAL_TEMPLATE_TYPE_LABELS: Record<LegalTemplateType, string> = {
  initial_petition: "Petição inicial",
  defense: "Contestação / defesa",
  reply: "Réplica",
  motion: "Petição intermediária",
  appeal: "Recurso",
  counter_arguments: "Contrarrazões",
  legal_opinion: "Parecer",
  administrative_request: "Requerimento administrativo",
  contract: "Contrato",
  notice: "Notificação",
  power_of_attorney: "Procuração",
  declaration: "Declaração",
  settlement: "Acordo",
  other: "Outro",
};

export const LEGAL_TEMPLATE_KIND_LABELS: Record<LegalTemplateDocumentKind, string> = {
  identification: "Identificação",
  evidence: "Prova",
  contract: "Contrato",
  petition: "Petição",
  decision: "Decisão",
  report: "Relatório / laudo",
  power_of_attorney: "Procuração",
  administrative: "Administrativo",
  correspondence: "Correspondência",
  other: "Outro",
};

export const LEGAL_TEMPLATE_VERSION_STATUS_LABELS: Record<LegalTemplateVersionStatus, string> = {
  draft: "Rascunho",
  review: "Em revisão",
  approved: "Aprovado",
  active: "Ativo",
  deprecated: "Depreciado",
  archived: "Arquivado",
};

export const LEGAL_TEMPLATE_CONTENT_FORMAT_LABELS: Record<LegalTemplateContentFormat, string> = {
  html: "HTML",
  markdown: "Markdown",
  plain_text: "Texto simples",
  structured: "Estruturado",
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

function qs(query: Record<string, string | number | boolean | undefined | null>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function hasLegalTemplatePermission(
  permissions: readonly string[] | undefined,
  action: "read" | "create" | "update" | "approve" | "activate" | "archive",
): boolean {
  return hasPermission(permissions, `legal_template.${action}`);
}

export function templateTypeLabel(key: string): string {
  return LEGAL_TEMPLATE_TYPE_LABELS[key as LegalTemplateType] ?? key.replaceAll("_", " ");
}

export function templateKindLabel(key: string): string {
  return LEGAL_TEMPLATE_KIND_LABELS[key as LegalTemplateDocumentKind] ?? key.replaceAll("_", " ");
}

export function templateVersionStatusLabel(key: string): string {
  return (
    LEGAL_TEMPLATE_VERSION_STATUS_LABELS[key as LegalTemplateVersionStatus] ??
    key.replaceAll("_", " ")
  );
}

export function variableFieldsFromSchema(
  schema: LegalTemplateVersion["variableSchema"],
): TemplateVariableField[] {
  if (!schema || typeof schema !== "object") return [];
  const fields = (schema as { fields?: unknown }).fields;
  if (!Array.isArray(fields)) return [];
  return fields.filter(
    (item): item is TemplateVariableField =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as TemplateVariableField).key === "string",
  );
}

export async function fetchLegalTemplates(
  orgId: string,
  query: {
    q?: string;
    scope?: string;
    templateType?: string;
    documentKind?: string;
    legalAreaId?: string;
    active?: boolean;
    includeSystem?: boolean;
    limit?: number;
    offset?: number;
  } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(
      orgId,
      `/legal-document-templates${qs({
        ...query,
        active: query.active === undefined ? undefined : query.active ? "true" : "false",
        includeSystem:
          query.includeSystem === undefined ? undefined : query.includeSystem ? "true" : "false",
      })}`,
    ),
  );
  if (isApiFailure(data)) return data;
  const items = (data.templates ?? data.items ?? []) as LegalTemplateSummary[];
  return { items, total: typeof data.total === "number" ? data.total : items.length };
}

export async function fetchLegalTemplate(orgId: string, templateId: string) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-document-templates/${templateId}`),
  );
  if (isApiFailure(data)) return data;
  return {
    template: (data.template ?? data) as LegalTemplateSummary,
    currentVersion: (data.currentVersion ?? null) as LegalTemplateVersion | null,
    versions: (data.versions ?? []) as LegalTemplateVersion[],
  } satisfies LegalTemplateDetail;
}

export async function createLegalTemplate(orgId: string, body: CreateLegalTemplateInput) {
  const data = await request<Record<string, unknown>>(orgPath(orgId, "/legal-document-templates"), {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (isApiFailure(data)) return data;
  return {
    template: (data.template ?? data) as LegalTemplateSummary,
    version: (data.version ?? null) as LegalTemplateVersion | null,
  };
}

export async function updateLegalTemplate(
  orgId: string,
  templateId: string,
  body: UpdateLegalTemplateInput,
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-document-templates/${templateId}`),
    { method: "PATCH", body: JSON.stringify(body) },
  );
  if (isApiFailure(data)) return data;
  return { template: (data.template ?? data) as LegalTemplateSummary };
}

export async function archiveLegalTemplate(orgId: string, templateId: string) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-document-templates/${templateId}/archive`),
    { method: "POST", body: JSON.stringify({}) },
  );
  if (isApiFailure(data)) return data;
  return { template: (data.template ?? data) as LegalTemplateSummary };
}

export async function duplicateLegalTemplate(orgId: string, templateId: string) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-document-templates/${templateId}/duplicate`),
    { method: "POST", body: JSON.stringify({}) },
  );
  if (isApiFailure(data)) return data;
  return {
    template: (data.template ?? data) as LegalTemplateSummary,
    version: (data.version ?? null) as LegalTemplateVersion | null,
  };
}

export async function createLegalTemplateVersion(
  orgId: string,
  templateId: string,
  body: CreateLegalTemplateVersionInput,
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-document-templates/${templateId}/versions`),
    { method: "POST", body: JSON.stringify(body) },
  );
  if (isApiFailure(data)) return data;
  return { version: (data.version ?? data) as LegalTemplateVersion };
}

export async function listLegalTemplateVersions(orgId: string, templateId: string) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-document-templates/${templateId}/versions`),
  );
  if (isApiFailure(data)) return data;
  const versions = (data.versions ?? data.items ?? []) as LegalTemplateVersion[];
  return { versions };
}

export async function submitLegalTemplateVersionForReview(
  orgId: string,
  templateId: string,
  versionId: string,
) {
  const data = await request<Record<string, unknown>>(
    orgPath(
      orgId,
      `/legal-document-templates/${templateId}/versions/${versionId}/submit-for-review`,
    ),
    { method: "POST", body: JSON.stringify({}) },
  );
  if (isApiFailure(data)) return data;
  return { version: (data.version ?? data) as LegalTemplateVersion };
}

export async function approveLegalTemplateVersion(
  orgId: string,
  templateId: string,
  versionId: string,
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-document-templates/${templateId}/versions/${versionId}/approve`),
    { method: "POST", body: JSON.stringify({}) },
  );
  if (isApiFailure(data)) return data;
  return { version: (data.version ?? data) as LegalTemplateVersion };
}

export async function activateLegalTemplateVersion(
  orgId: string,
  templateId: string,
  versionId: string,
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-document-templates/${templateId}/versions/${versionId}/activate`),
    { method: "POST", body: JSON.stringify({}) },
  );
  if (isApiFailure(data)) return data;
  return { version: (data.version ?? data) as LegalTemplateVersion };
}

export async function previewLegalTemplateVersion(
  orgId: string,
  templateId: string,
  versionId: string,
  context: Record<string, unknown> = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-document-templates/${templateId}/versions/${versionId}/preview`),
    { method: "POST", body: JSON.stringify({ context }) },
  );
  if (isApiFailure(data)) return data;
  return {
    preview: (data.preview ?? data) as TemplatePreviewResult,
    version: (data.version ?? null) as LegalTemplateVersion | null,
  };
}
