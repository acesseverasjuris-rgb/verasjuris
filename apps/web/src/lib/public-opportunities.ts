import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure, LegalAnalysisSummary } from "./ai";
import { getActiveMembership, getActiveOrgId, isApiFailure } from "./crm";

export { getActiveMembership, getActiveOrgId, isApiFailure };

/**
 * Oportunidades públicas — premissas de caminhos (/api/v1/organizations/:orgId):
 *  - GET   /public-opportunities?q&opportunityType&status&stateCode&sourceProvider&deadlineFrom&deadlineTo&limit&offset
 *  - POST  /public-opportunities
 *  - GET   /public-opportunities/:id  → { opportunity, requirements, documents, interest, tasks, deadlines, analyses }
 *  - GET   /public-opportunity-interests?status=  (salvas)
 *  - PUT   /public-opportunities/:id/interest { status, notes? }
 *  - POST  /public-opportunities/:id/requirements { description, category?, mandatory? }
 *  - PATCH /public-opportunities/:id/requirements/:requirementId { status, reviewComment? }
 *  - POST  /public-opportunities/:id/analyses { analysisType }
 */

export type PublicOpportunityType =
  | "tender"
  | "public_call"
  | "accreditation"
  | "partnership"
  | "concession"
  | "grant"
  | "program"
  | "notice"
  | "other";

export type PublicOpportunityStatus =
  | "draft"
  | "published"
  | "open"
  | "closed"
  | "cancelled"
  | "archived";

export type PublicOpportunitySource = "manual" | "public_provider" | "import";

export type InterestStatus =
  | "saved"
  | "reviewing"
  | "interested"
  | "preparing"
  | "submitted"
  | "not_interested"
  | "won"
  | "lost"
  | "archived";

export type RequirementStatus = "pending" | "met" | "not_met" | "waived" | "unknown";

export const OPPORTUNITY_TYPE_LABELS: Record<PublicOpportunityType, string> = {
  tender: "Licitação",
  public_call: "Chamamento público",
  accreditation: "Credenciamento",
  partnership: "Parceria",
  concession: "Concessão",
  grant: "Fomento / subvenção",
  program: "Programa",
  notice: "Edital / aviso",
  other: "Outro",
};

export const OPPORTUNITY_STATUS_LABELS: Record<PublicOpportunityStatus, string> = {
  draft: "Rascunho",
  published: "Publicada",
  open: "Aberta",
  closed: "Encerrada",
  cancelled: "Cancelada",
  archived: "Arquivada",
};

export const OPPORTUNITY_SOURCE_LABELS: Record<PublicOpportunitySource, string> = {
  manual: "CADASTRO MANUAL",
  public_provider: "FONTE EXTERNA CONFIGURADA",
  import: "IMPORTAÇÃO",
};

export const INTEREST_STATUS_LABELS: Record<InterestStatus, string> = {
  saved: "Salva",
  reviewing: "Em análise interna",
  interested: "Com interesse",
  preparing: "Preparando proposta",
  submitted: "Proposta enviada",
  not_interested: "Sem interesse",
  won: "Ganha",
  lost: "Perdida",
  archived: "Arquivada",
};

export const REQUIREMENT_STATUS_LABELS: Record<RequirementStatus, string> = {
  pending: "Pendente",
  met: "Atendido",
  not_met: "Não atendido",
  waived: "Dispensado",
  unknown: "Não localizado nos documentos analisados",
};

export const BR_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export type PublicOpportunitySummary = {
  id: string;
  organizationId: string | null;
  sourceProvider: PublicOpportunitySource;
  sourceReference?: string | null;
  sourceUrl?: string | null;
  opportunityType: PublicOpportunityType;
  title: string;
  object: string;
  publicBodyName?: string | null;
  processNumber?: string | null;
  procurementNumber?: string | null;
  modality?: string | null;
  estimatedValueCents?: number | null;
  currency?: string;
  publicationDate?: string | null;
  proposalDeadline?: string | null;
  status: PublicOpportunityStatus;
  stateCode?: string | null;
  municipality?: string | null;
  interestStatus?: InterestStatus | null;
  updatedAt?: string;
};

export type OpportunityRequirement = {
  id: string;
  description: string;
  category?: string | null;
  mandatory: boolean;
  status: RequirementStatus;
  source?: string;
  reviewComment?: string | null;
};

export type OpportunityDocument = {
  id: string;
  title: string;
  documentKind?: string;
  status?: string;
};

export type OpportunityLink = { id: string; title: string; status?: string; dueAt?: string | null };

export type PublicOpportunityDetail = PublicOpportunitySummary & {
  description?: string | null;
  region?: string | null;
  timezone?: string;
  createdAt?: string;
};

export type OpportunityInterest = {
  id: string;
  opportunityId: string;
  status: InterestStatus;
  notes?: string | null;
  updatedAt?: string;
  opportunity?: PublicOpportunitySummary;
};

export type OpportunityListQuery = {
  q?: string;
  opportunityType?: string;
  status?: string;
  stateCode?: string;
  sourceProvider?: string;
  deadlineFrom?: string;
  deadlineTo?: string;
  limit?: number;
  offset?: number;
};

export type CreateOpportunityInput = {
  title: string;
  object: string;
  description?: string;
  opportunityType: PublicOpportunityType;
  status: PublicOpportunityStatus;
  publicBodyName?: string;
  processNumber?: string;
  procurementNumber?: string;
  modality?: string;
  estimatedValueCents?: number;
  publicationDate?: string;
  proposalDeadline?: string;
  stateCode?: string;
  municipality?: string;
  sourceReference?: string;
  sourceUrl?: string;
  sourceProvider: "manual";
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
  return `/api/v1/organizations/${orgId}/public-opportunities${suffix}`;
}

function qs(query: Record<string, string | number | undefined | null>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function hasOpportunityPermission(
  permissions: readonly string[] | undefined,
  action:
    | "read"
    | "create"
    | "update"
    | "manage"
    | "save"
    | "manage_requirements"
    | "manage_documents",
): boolean {
  return Boolean(permissions?.includes(`public_opportunity.${action}`));
}

export function formatOpportunityValue(cents: number | null | undefined, currency = "BRL"): string {
  if (cents == null) return "Não informado";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

/** "1.234,56" / "1234.56" → centavos inteiros; null se inválido. */
export function parseMoneyToCents(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes(",")
    ? trimmed.replaceAll(".", "").replace(",", ".")
    : trimmed;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function opportunityStatusTone(
  status: PublicOpportunityStatus,
): "neutral" | "success" | "warning" | "error" {
  if (status === "open" || status === "published") return "success";
  if (status === "draft") return "warning";
  if (status === "cancelled") return "error";
  return "neutral";
}

export async function fetchOpportunities(orgId: string, query: OpportunityListQuery = {}) {
  const data = await request<Record<string, unknown>>(orgPath(orgId, qs({ ...query })));
  if (isApiFailure(data)) return data;
  const items = (data.items ?? data.opportunities ?? []) as PublicOpportunitySummary[];
  return {
    items,
    total: typeof data.total === "number" ? data.total : items.length,
    providerNotice: (data.providerNotice as string | undefined) ?? null,
  };
}

export async function fetchOpportunity(orgId: string, opportunityId: string) {
  const data = await request<Record<string, unknown>>(orgPath(orgId, `/${opportunityId}`));
  if (isApiFailure(data)) return data;
  const opportunity = (data.opportunity ?? data) as PublicOpportunityDetail & {
    interest?: OpportunityInterest | null;
    requirements?: OpportunityRequirement[];
  };
  const nestedInterest = opportunity.interest ?? null;
  const nestedRequirements = opportunity.requirements ?? [];
  return {
    opportunity,
    requirements: (data.requirements ?? nestedRequirements) as OpportunityRequirement[],
    documents: (data.documents ?? []) as OpportunityDocument[],
    interest: (data.interest ?? nestedInterest) as OpportunityInterest | null,
    tasks: (data.tasks ?? []) as OpportunityLink[],
    deadlines: (data.deadlines ?? []) as OpportunityLink[],
    analyses: (data.analyses ?? []) as LegalAnalysisSummary[],
  };
}

export async function createOpportunity(orgId: string, body: CreateOpportunityInput) {
  const data = await request<Record<string, unknown>>(orgPath(orgId, ""), {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (isApiFailure(data)) return data;
  return { opportunity: (data.opportunity ?? data) as PublicOpportunitySummary };
}

export async function fetchSavedInterests(orgId: string, query: { status?: string } = {}) {
  const data = await request<Record<string, unknown>>(
    `/api/v1/organizations/${orgId}/public-opportunity-interests${qs(query)}`,
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? data.interests ?? []) as OpportunityInterest[];
  return { items, total: typeof data.total === "number" ? data.total : items.length };
}

export async function saveInterest(
  orgId: string,
  opportunityId: string,
  body: { status: InterestStatus; notes?: string },
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/${opportunityId}/interest`),
    {
      method: "PUT",
      body: JSON.stringify(body),
    },
  );
  if (isApiFailure(data)) return data;
  return { interest: (data.interest ?? data) as OpportunityInterest };
}

export async function addRequirement(
  orgId: string,
  opportunityId: string,
  body: { description: string; category?: string; mandatory?: boolean },
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/${opportunityId}/requirements`),
    { method: "POST", body: JSON.stringify(body) },
  );
  if (isApiFailure(data)) return data;
  return { requirement: (data.requirement ?? data) as OpportunityRequirement };
}

export async function updateRequirement(
  orgId: string,
  opportunityId: string,
  requirementId: string,
  body: { status: RequirementStatus; reviewComment?: string },
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/${opportunityId}/requirements/${requirementId}`),
    { method: "PATCH", body: JSON.stringify(body) },
  );
  if (isApiFailure(data)) return data;
  return { requirement: (data.requirement ?? data) as OpportunityRequirement };
}

export async function runOpportunityAnalysis(
  orgId: string,
  opportunityId: string,
  body: { analysisType: string } = { analysisType: "public_opportunity" },
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/${opportunityId}/analyses`),
    { method: "POST", body: JSON.stringify(body) },
  );
  if (isApiFailure(data)) return data;
  return { analysis: (data.analysis ?? data) as LegalAnalysisSummary };
}
