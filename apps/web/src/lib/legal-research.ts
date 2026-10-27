import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure } from "./ai";
import {
  aiErrorMessage,
  formatDateTime,
  hasPermission,
  isApiFailure,
  isNotConfigured,
  NOT_CONFIGURED_CODES,
} from "./ai";
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
 * Pesquisa jurídica — /api/v1/organizations/:orgId
 *  - GET  /legal-research/provider/status
 *  - POST/GET /legal-research
 *  - GET  /legal-research/legislation | case-law | summaries | themes | precedents | doctrine
 *  - GET/POST /legal-research/saved
 *  - GET  /legal-research/:sourceType/:sourceId
 *  - POST /legal-matter-research-links
 */

export type ResearchSourceType =
  | "legislation"
  | "case_law"
  | "summary"
  | "theme"
  | "general_repercussion"
  | "precedent"
  | "doctrine"
  | "internal_document";

export type ResearchQueryStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "empty"
  | "not_configured";

export const RESEARCH_SOURCE_TYPE_LABELS: Record<ResearchSourceType, string> = {
  legislation: "Legislação",
  case_law: "Jurisprudência",
  summary: "Súmulas",
  theme: "Temas",
  general_repercussion: "Repercussão geral",
  precedent: "Precedentes",
  doctrine: "Doutrina",
  internal_document: "Documento interno",
};

export const RESEARCH_STATUS_LABELS: Record<ResearchQueryStatus, string> = {
  pending: "Pendente",
  running: "Em execução",
  succeeded: "Concluída",
  failed: "Falhou",
  empty: "Sem resultados",
  not_configured: "Provedor não configurado",
};

export const RESEARCH_PROVIDER_NOT_CONFIGURED_MESSAGE =
  "Nenhum provedor de fontes jurídicas está configurado neste ambiente. O catálogo local continua disponível; nada foi inventado.";

export type ResearchProviderStatus = {
  provider: string;
  status: string;
  health?: { status?: string; message?: string | null };
  capabilities?: string[];
  localCatalogAvailable?: boolean;
};

export type ResearchQuery = {
  id: string;
  query: string;
  filters?: Record<string, unknown> | null;
  status: ResearchQueryStatus | string;
  provider: string;
  resultCount: number;
  completedAt?: string | null;
  createdAt: string;
};

export type ResearchHit = {
  rank?: number;
  sourceType: ResearchSourceType | string;
  sourceId: string;
  title: string;
  excerpt?: string | null;
  sourceUrl?: string | null;
  provider?: string | null;
};

export type ExecuteResearchResult = {
  status: ResearchQueryStatus | string;
  provider: string;
  query: ResearchQuery;
  results: ResearchHit[];
  message?: string | null;
};

export type CatalogItem = {
  id: string;
  title?: string | null;
  sourceUrl?: string | null;
  court?: string | null;
  caseNumber?: string | null;
  number?: string | null;
  themeNumber?: string | number | null;
  author?: string | null;
  subject?: string | null;
  headnote?: string | null;
  text?: string | null;
  thesis?: string | null;
  identifier?: string | null;
  jurisdiction?: string | null;
  authority?: string | null;
  sourceProvider?: string | null;
  provider?: string | null;
  status?: string | null;
  bindingStatus?: string | null;
  applicabilityNotes?: string | null;
  decisionReference?: string | null;
  licensed?: boolean;
  fullTextAvailable?: boolean;
  scope?: string;
  editable?: boolean;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type SavedResearch = {
  id: string;
  name: string;
  query: string;
  filters?: Record<string, unknown> | null;
  queryId?: string | null;
  legalMatterId?: string | null;
  selectedResultIds?: string[] | null;
  notes?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type ResearchFilters = {
  sourceType?: ResearchSourceType;
  court?: string;
  jurisdiction?: string;
  subject?: string;
  proceduralClass?: string;
  rapporteur?: string;
  status?: string;
  from?: string;
  to?: string;
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

export function hasResearchPermission(
  permissions: readonly string[] | undefined,
  action: "read" | "execute" | "save" | "manage" | "link",
): boolean {
  if (action === "execute") return hasPermission(permissions, "legal_research.execute");
  if (action === "save" || action === "link") {
    return hasPermission(permissions, "legal_research.save");
  }
  return hasPermission(permissions, `legal_research.${action}`);
}

export function researchErrorMessage(failure: AiApiFailure, fallback: string): string {
  const code = failure.error?.code ?? "";
  if (
    code === "LEGAL_SOURCE_PROVIDER_NOT_CONFIGURED" ||
    (NOT_CONFIGURED_CODES as readonly string[]).includes(code)
  ) {
    return RESEARCH_PROVIDER_NOT_CONFIGURED_MESSAGE;
  }
  return aiErrorMessage(failure, fallback);
}

export function catalogTitle(item: CatalogItem, sourceType: ResearchSourceType | string): string {
  if (item.title) return item.title;
  if (sourceType === "case_law" && item.court && item.caseNumber) {
    return `${item.court} — ${item.caseNumber}`;
  }
  if (sourceType === "summary" && item.court && item.number) {
    return `${item.court} — Súmula ${item.number}`;
  }
  if (sourceType === "theme" && item.themeNumber != null) {
    return `Tema ${item.themeNumber}${item.court ? ` (${item.court})` : ""}`;
  }
  if (item.identifier) return String(item.identifier);
  return "Registro sem título";
}

export function sourceProviderLabel(provider: string | null | undefined): string {
  if (!provider || provider === "not_configured") return "FONTE · Não configurada";
  if (provider === "manual") return "FONTE · Cadastro manual";
  if (provider === "official_provider" || provider === "public_provider") {
    return "FONTE · Provedor configurado";
  }
  if (provider === "import") return "FONTE · Importação";
  return `FONTE · ${provider}`;
}

export async function fetchResearchProviderStatus(orgId: string) {
  const data = await request<ResearchProviderStatus>(
    orgPath(orgId, "/legal-research/provider/status"),
  );
  if (isApiFailure(data)) return data;
  return data;
}

export async function executeResearch(
  orgId: string,
  body: {
    query: string;
    filters?: ResearchFilters;
    sourceTypes?: ResearchSourceType[];
  },
) {
  const data = await request<ExecuteResearchResult>(orgPath(orgId, "/legal-research"), {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (isApiFailure(data)) return data;
  return data;
}

export async function fetchResearchQueries(
  orgId: string,
  query: { q?: string; status?: string; limit?: number; offset?: number } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-research${qs({ ...query })}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? []) as ResearchQuery[];
  return { items, total: typeof data.total === "number" ? data.total : items.length };
}

async function fetchCatalog(
  orgId: string,
  path: string,
  query: { q?: string; court?: string; limit?: number; offset?: number } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-research/${path}${qs({ ...query })}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? []) as CatalogItem[];
  return { items, total: typeof data.total === "number" ? data.total : items.length };
}

export function fetchLegislation(
  orgId: string,
  query: { q?: string; limit?: number; offset?: number } = {},
) {
  return fetchCatalog(orgId, "legislation", query);
}

export function fetchCaseLaw(
  orgId: string,
  query: { q?: string; court?: string; limit?: number; offset?: number } = {},
) {
  return fetchCatalog(orgId, "case-law", query);
}

export function fetchSummaries(
  orgId: string,
  query: { q?: string; limit?: number; offset?: number } = {},
) {
  return fetchCatalog(orgId, "summaries", query);
}

export function fetchThemes(
  orgId: string,
  query: { q?: string; limit?: number; offset?: number } = {},
) {
  return fetchCatalog(orgId, "themes", query);
}

export function fetchPrecedents(
  orgId: string,
  query: { q?: string; limit?: number; offset?: number } = {},
) {
  return fetchCatalog(orgId, "precedents", query);
}

export function fetchDoctrine(
  orgId: string,
  query: { q?: string; limit?: number; offset?: number } = {},
) {
  return fetchCatalog(orgId, "doctrine", query);
}

export async function fetchResearchRecord(
  orgId: string,
  sourceType: ResearchSourceType,
  sourceId: string,
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-research/${sourceType}/${sourceId}`),
  );
  if (isApiFailure(data)) return data;
  return { record: (data.record ?? data.item ?? data) as CatalogItem };
}

export async function saveResearch(
  orgId: string,
  body: {
    name: string;
    query: string;
    filters?: ResearchFilters;
    queryId?: string;
    legalMatterId?: string;
    selectedResultIds?: string[];
    notes?: string;
  },
) {
  const data = await request<Record<string, unknown>>(orgPath(orgId, "/legal-research/saved"), {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (isApiFailure(data)) return data;
  return { saved: (data.saved ?? data.research ?? data) as SavedResearch };
}

export async function fetchSavedResearchList(
  orgId: string,
  query: { q?: string; limit?: number; offset?: number } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-research/saved${qs({ ...query })}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? []) as SavedResearch[];
  return { items, total: typeof data.total === "number" ? data.total : items.length };
}

export async function linkMatterResearch(
  orgId: string,
  body: {
    legalMatterId: string;
    sourceType: ResearchSourceType;
    sourceId: string;
    savedResearchId?: string;
    notes?: string;
  },
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, "/legal-matter-research-links"),
    { method: "POST", body: JSON.stringify(body) },
  );
  if (isApiFailure(data)) return data;
  return { link: data.link ?? data };
}
