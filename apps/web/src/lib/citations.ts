import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure } from "./ai";
import { aiErrorMessage, formatDateTime, hasPermission, isApiFailure } from "./ai";
import { getActiveMembership, getActiveOrgId } from "./crm";

export { getActiveMembership, getActiveOrgId, isApiFailure, aiErrorMessage, formatDateTime };

/**
 * Citações — /api/v1/organizations/:orgId/citations
 *  - GET/POST /
 *  - GET  /:citationId
 *  - POST /:citationId/verify
 */

export type CitationSourceType =
  | "legislation"
  | "case_law"
  | "summary"
  | "theme"
  | "precedent"
  | "doctrine"
  | "internal_document";

export type CitationVerificationStatus =
  | "unverified"
  | "source_available"
  | "verified"
  | "source_unavailable"
  | "invalid"
  | "stale";

/** Rótulos honestos — nunca “oficial” sem prova. */
export const CITATION_VERIFICATION_LABELS: Record<CitationVerificationStatus, string> = {
  verified: "Fonte verificada",
  source_available: "Fonte disponível",
  unverified: "Não verificada",
  source_unavailable: "Fonte indisponível",
  invalid: "Citação inválida",
  stale: "Verificação desatualizada",
};

export const CITATION_SOURCE_TYPE_LABELS: Record<CitationSourceType, string> = {
  legislation: "Legislação",
  case_law: "Jurisprudência",
  summary: "Súmula",
  theme: "Tema",
  precedent: "Precedente",
  doctrine: "Doutrina",
  internal_document: "Documento interno",
};

export type Citation = {
  id: string;
  sourceType: CitationSourceType | string;
  sourceId?: string | null;
  citationKind?: string;
  citationStyle?: string;
  formattedCitation: string;
  court?: string | null;
  caseNumber?: string | null;
  rapporteur?: string | null;
  judgingBody?: string | null;
  judgmentDate?: string | null;
  publicationDate?: string | null;
  sourceUrl?: string | null;
  excerpt?: string | null;
  excerptLocation?: string | null;
  pageNumber?: number | null;
  sourceHash?: string | null;
  verificationStatus: CitationVerificationStatus | string;
  verifiedAt?: string | null;
  copyText?: string;
  createdAt: string;
};

export type CreateCitationInput = {
  sourceType: CitationSourceType;
  sourceId?: string;
  citationStyle?: string;
  formattedCitation?: string;
  title?: string;
  legislationRef?: string;
  court?: string;
  caseNumber?: string;
  rapporteur?: string;
  judgingBody?: string;
  judgmentDate?: string;
  publicationDate?: string;
  sourceUrl?: string;
  excerpt?: string;
  excerptLocation?: string;
  pageNumber?: number;
  sourceHash?: string;
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
  return `/api/v1/organizations/${orgId}/citations${suffix}`;
}

function qs(query: Record<string, string | number | undefined | null>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function hasCitationPermission(
  permissions: readonly string[] | undefined,
  action: "read" | "create" | "verify" | "manage",
): boolean {
  return hasPermission(permissions, `citation.${action}`);
}

export function verificationLabel(status: string | null | undefined): string {
  if (!status) return CITATION_VERIFICATION_LABELS.unverified;
  return (
    CITATION_VERIFICATION_LABELS[status as CitationVerificationStatus] ??
    status.replaceAll("_", " ")
  );
}

export function verificationTone(
  status: string | null | undefined,
): "neutral" | "success" | "warning" | "error" {
  if (status === "verified") return "success";
  if (status === "source_available") return "neutral";
  if (status === "source_unavailable" || status === "invalid") return "error";
  if (status === "stale") return "warning";
  return "warning";
}

export async function fetchCitations(
  orgId: string,
  query: {
    sourceType?: string;
    sourceId?: string;
    verificationStatus?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  const data = await request<Record<string, unknown>>(orgPath(orgId, qs({ ...query })));
  if (isApiFailure(data)) return data;
  const items = (data.items ?? data.citations ?? []) as Citation[];
  return { items, total: typeof data.total === "number" ? data.total : items.length };
}

export async function fetchCitation(orgId: string, citationId: string) {
  const data = await request<Record<string, unknown>>(orgPath(orgId, `/${citationId}`));
  if (isApiFailure(data)) return data;
  return { citation: (data.citation ?? data) as Citation };
}

export async function createCitation(orgId: string, body: CreateCitationInput) {
  const data = await request<Record<string, unknown>>(orgPath(orgId, ""), {
    method: "POST",
    body: JSON.stringify({ citationStyle: "default", ...body }),
  });
  if (isApiFailure(data)) return data;
  return { citation: (data.citation ?? data) as Citation };
}

export async function verifyCitation(
  orgId: string,
  citationId: string,
  body: {
    verificationStatus: Exclude<CitationVerificationStatus, "unverified">;
    sourceUrl?: string;
    sourceHash?: string;
    notes?: string;
  },
) {
  const data = await request<Record<string, unknown>>(orgPath(orgId, `/${citationId}/verify`), {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (isApiFailure(data)) return data;
  return { citation: (data.citation ?? data) as Citation };
}
