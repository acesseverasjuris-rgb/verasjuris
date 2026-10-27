import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { ApiFailure } from "./types";
import { apiErrorMessage, getActiveMembership, getActiveOrgId, isApiFailure } from "./crm";

export { apiErrorMessage, getActiveMembership, getActiveOrgId, isApiFailure };

export type AdministrativeProcessStatus =
  | "draft"
  | "active"
  | "waiting_body"
  | "waiting_client"
  | "requirement_open"
  | "under_analysis"
  | "decided"
  | "appeal"
  | "suspended"
  | "closed"
  | "archived";

export type AdministrativePriority = "low" | "normal" | "high" | "urgent";

export type AdministrativeDataSource = "manual" | "document" | "import" | "body_provider";

export type AdministrativeBodyType =
  | "federal"
  | "state"
  | "municipal"
  | "autarchy"
  | "council"
  | "regulatory"
  | "administrative_court"
  | "other";

export type AdministrativeRequestStatus =
  | "draft"
  | "review"
  | "approved"
  | "ready_to_submit"
  | "submitted"
  | "confirmed"
  | "rejected"
  | "cancelled";

export type AdministrativeRequirementStatus =
  | "open"
  | "in_progress"
  | "responded"
  | "accepted"
  | "not_applicable"
  | "cancelled"
  | "overdue";

export type AdministrativeDeadlineStatus =
  | "suggested"
  | "pending_confirmation"
  | "confirmed"
  | "completed"
  | "cancelled";

export type AdministrativeAppealStatus =
  | "draft"
  | "review"
  | "approved"
  | "ready_to_file"
  | "filed"
  | "confirmed"
  | "decided"
  | "withdrawn"
  | "cancelled";

export type CatalogRef = {
  id: string;
  name: string;
  acronym?: string | null;
  code?: string | null;
};

export type AdministrativeBody = {
  id: string;
  code?: string | null;
  name: string;
  acronym?: string | null;
  bodyType: AdministrativeBodyType;
  jurisdiction?: string;
  stateCode?: string | null;
  municipalityCode?: string | null;
  parentBodyId?: string | null;
  source?: string;
  active?: boolean;
};

export type AdministrativeRequest = {
  id: string;
  requestType: string;
  title: string;
  description: string;
  status: AdministrativeRequestStatus;
  requestedAt?: string | null;
  submittedAt?: string | null;
  protocolNumber?: string | null;
  protocolReference?: string | null;
  submitJustification?: string | null;
  source: AdministrativeDataSource;
};

export type AdministrativeRequirement = {
  id: string;
  title: string;
  description: string;
  issuedAt?: string | null;
  dueAt?: string | null;
  status: AdministrativeRequirementStatus;
  source: AdministrativeDataSource;
  sourceReference?: string | null;
  respondedAt?: string | null;
  responseSummary?: string | null;
  relatedRequestId?: string | null;
  responsibleMembershipId?: string | null;
};

export type AdministrativeDeadline = {
  id: string;
  title: string;
  dueAt: string;
  timezone?: string;
  status: AdministrativeDeadlineStatus;
  calculationSource?: string;
  calculationNotes?: string | null;
  confirmedAt?: string | null;
  requirementId?: string | null;
};

export type AdministrativeDecision = {
  id: string;
  decisionType: string;
  title: string;
  summary: string;
  outcome?: string | null;
  decidedAt?: string | null;
  notifiedAt?: string | null;
  source: AdministrativeDataSource;
  sourceReference?: string | null;
  documentId?: string | null;
  relatedRequestId?: string | null;
};

export type AdministrativeAppeal = {
  id: string;
  appealType: string;
  title: string;
  summary: string;
  status: AdministrativeAppealStatus;
  filedAt?: string | null;
  protocolNumber?: string | null;
  source: AdministrativeDataSource;
  documentId?: string | null;
  parentDecisionId?: string | null;
  deadlineId?: string | null;
};

export type AdministrativeTimelineItem = {
  id: string;
  eventType: string;
  title: string;
  summary?: string | null;
  source: AdministrativeDataSource;
  eventAt: string;
  createdAt?: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
};

export type AdministrativeProcessSummary = {
  id: string;
  legalMatterId: string;
  administrativeBodyId: string;
  administrativeBody?: CatalogRef | null;
  body?: CatalogRef | null;
  number: string;
  normalizedNumber?: string;
  protocolNumber?: string | null;
  protocolDate?: string | null;
  protocolSource?: AdministrativeDataSource | null;
  protocolReference?: string | null;
  externalReference?: string | null;
  subject: string;
  description?: string | null;
  status: AdministrativeProcessStatus;
  currentPhase?: string | null;
  priority: AdministrativePriority;
  filedAt?: string | null;
  startedAt?: string | null;
  lastActivityAt?: string | null;
  closedAt?: string | null;
  archivedAt?: string | null;
  source: AdministrativeDataSource;
  sourceReference?: string | null;
  sourceUpdatedAt?: string | null;
  responsibleMembershipId?: string | null;
  responsible?: { membershipId: string; displayName: string } | null;
  updatedAt: string;
  createdAt: string;
};

export type AdministrativeProcessDetail = AdministrativeProcessSummary & {
  requests?: AdministrativeRequest[];
  requirements?: AdministrativeRequirement[];
  deadlines?: AdministrativeDeadline[];
  decisions?: AdministrativeDecision[];
  appeals?: AdministrativeAppeal[];
  timeline?: AdministrativeTimelineItem[];
};

export type AdministrativeProcessListResult = {
  items: AdministrativeProcessSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type AdministrativeProcessListQuery = {
  q?: string;
  status?: AdministrativeProcessStatus;
  limit?: number;
  offset?: number;
};

export type CreateAdministrativeProcessInput = {
  administrativeBodyId: string;
  number: string;
  subject: string;
  description?: string;
  protocolNumber?: string;
  protocolDate?: string;
  externalReference?: string;
  priority?: AdministrativePriority;
  currentPhase?: string;
  responsibleMembershipId?: string;
  filedAt?: string;
  startedAt?: string;
};

export const ADMIN_STATUS_LABELS: Record<AdministrativeProcessStatus, string> = {
  draft: "Rascunho",
  active: "Em andamento",
  waiting_body: "Aguardando órgão",
  waiting_client: "Aguardando cliente",
  requirement_open: "Exigência em aberto",
  under_analysis: "Em análise",
  decided: "Decidido",
  appeal: "Em recurso",
  suspended: "Suspenso",
  closed: "Encerrado",
  archived: "Arquivado",
};

export const ADMIN_PRIORITY_LABELS: Record<AdministrativePriority, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

export const ADMIN_DATA_SOURCE_LABELS: Record<AdministrativeDataSource, string> = {
  manual: "Cadastro manual",
  document: "Documento",
  import: "Importação",
  body_provider: "Provedor do órgão",
};

export const ADMIN_BODY_TYPE_LABELS: Record<AdministrativeBodyType, string> = {
  federal: "Federal",
  state: "Estadual",
  municipal: "Municipal",
  autarchy: "Autarquia",
  council: "Conselho",
  regulatory: "Regulador",
  administrative_court: "Tribunal administrativo",
  other: "Outro",
};

export const ADMIN_REQUEST_STATUS_LABELS: Record<AdministrativeRequestStatus, string> = {
  draft: "Rascunho",
  review: "Em revisão",
  approved: "Aprovado",
  ready_to_submit: "Pronto para protocolo",
  submitted: "Protocolado",
  confirmed: "Confirmado pelo órgão",
  rejected: "Recusado",
  cancelled: "Cancelado",
};

export const ADMIN_REQUIREMENT_STATUS_LABELS: Record<AdministrativeRequirementStatus, string> = {
  open: "Aberta",
  in_progress: "Em atendimento",
  responded: "Respondida",
  accepted: "Aceita",
  not_applicable: "Não aplicável",
  cancelled: "Cancelada",
  overdue: "Em atraso",
};

export const ADMIN_DEADLINE_STATUS_LABELS: Record<AdministrativeDeadlineStatus, string> = {
  suggested: "Sugerido",
  pending_confirmation: "Pendente de confirmação",
  confirmed: "Confirmado",
  completed: "Cumprido",
  cancelled: "Cancelado",
};

export const ADMIN_APPEAL_STATUS_LABELS: Record<AdministrativeAppealStatus, string> = {
  draft: "Rascunho",
  review: "Em revisão",
  approved: "Aprovado",
  ready_to_file: "Pronto para interposição",
  filed: "Interposto",
  confirmed: "Confirmado pelo órgão",
  decided: "Julgado",
  withdrawn: "Desistido",
  cancelled: "Cancelado",
};

function jsonHeaders(): HeadersInit {
  return { "content-type": "application/json", [CSRF_HEADER]: "1" };
}

function orgPath(orgId: string, suffix: string): string {
  return `/api/v1/organizations/${orgId}${suffix}`;
}

function matterProcessPath(orgId: string, matterId: string, suffix = ""): string {
  return orgPath(orgId, `/matters/${matterId}/administrative-processes${suffix}`);
}

function processPath(orgId: string, processId: string, suffix = ""): string {
  return orgPath(orgId, `/administrative-processes/${processId}${suffix}`);
}

function buildQuery(query: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

function asList<T>(body: { items?: T[]; [key: string]: unknown }, keys: string[]): T[] {
  for (const key of keys) {
    const value = body[key];
    if (Array.isArray(value)) return value as T[];
  }
  return body.items ?? [];
}

export function hasAdministrativePermission(
  permissions: readonly string[] | undefined,
  action:
    | "read"
    | "create"
    | "update"
    | "assign"
    | "manage_requests"
    | "manage_requirements"
    | "manage_deadlines"
    | "manage_decisions"
    | "manage_appeals"
    | "close"
    | "reopen",
): boolean {
  if (!permissions) return false;
  return permissions.includes(`administrative_process.${action}`);
}

export function administrativeStatusTone(
  status: AdministrativeProcessStatus,
): "neutral" | "success" | "warning" | "error" {
  if (status === "active" || status === "under_analysis" || status === "decided") return "success";
  if (
    status === "waiting_body" ||
    status === "waiting_client" ||
    status === "requirement_open" ||
    status === "appeal" ||
    status === "suspended" ||
    status === "draft"
  ) {
    return "warning";
  }
  return "neutral";
}

export function administrativeDataSourceLabel(
  source: AdministrativeDataSource | string | null | undefined,
): string {
  if (!source) return "—";
  return ADMIN_DATA_SOURCE_LABELS[source as AdministrativeDataSource] ?? source;
}

export function bodyLabel(process: AdministrativeProcessSummary): string {
  const ref = process.administrativeBody ?? process.body;
  if (!ref) return "—";
  if (ref.acronym) return `${ref.acronym} — ${ref.name}`;
  return ref.name;
}

/** Protocol microcopy: never claim body confirmation unless status is confirmed. */
export function protocolStatusLabel(options: {
  protocolNumber?: string | null;
  status?: string | null;
}): string | null {
  if (!options.protocolNumber) return null;
  if (options.status === "confirmed") return "Protocolo confirmado pelo órgão.";
  return "Protocolo informado manualmente.";
}

export async function fetchAdministrativeBodies(
  orgId: string,
  query: { q?: string } = {},
): Promise<{ bodies: AdministrativeBody[] } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/administrative-bodies${buildQuery(query)}`), {
    cache: "no-store",
  });
  const body = (await response.json()) as
    | {
        bodies?: AdministrativeBody[];
        administrativeBodies?: AdministrativeBody[];
        items?: AdministrativeBody[];
      }
    | ApiFailure;
  if (isApiFailure(body)) return body;
  return {
    bodies: body.bodies ?? body.administrativeBodies ?? body.items ?? [],
  };
}

export async function fetchAdministrativeProcesses(
  orgId: string,
  matterId: string,
  query: AdministrativeProcessListQuery = {},
): Promise<AdministrativeProcessListResult | ApiFailure> {
  const response = await fetch(matterProcessPath(orgId, matterId, buildQuery(query)), {
    cache: "no-store",
  });
  const body = (await response.json()) as
    | {
        items?: AdministrativeProcessSummary[];
        administrativeProcesses?: AdministrativeProcessSummary[];
        processes?: AdministrativeProcessSummary[];
        total?: number;
        limit?: number;
        offset?: number;
      }
    | ApiFailure;
  if (isApiFailure(body)) return body;
  const items = body.items ?? body.administrativeProcesses ?? body.processes ?? [];
  return {
    items,
    total: body.total ?? items.length,
    limit: body.limit ?? 20,
    offset: body.offset ?? 0,
  };
}

function normalizeProcessDetail(raw: AdministrativeProcessDetail): AdministrativeProcessDetail {
  return {
    ...raw,
    requests: raw.requests ?? [],
    requirements: raw.requirements ?? [],
    deadlines: raw.deadlines ?? [],
    decisions: raw.decisions ?? [],
    appeals: raw.appeals ?? [],
    timeline: raw.timeline ?? [],
  };
}

export async function fetchAdministrativeProcess(
  orgId: string,
  processId: string,
): Promise<{ process: AdministrativeProcessDetail } | ApiFailure> {
  const response = await fetch(processPath(orgId, processId), { cache: "no-store" });
  const body = (await response.json()) as
    | {
        process?: AdministrativeProcessDetail;
        administrativeProcess?: AdministrativeProcessDetail;
      }
    | AdministrativeProcessDetail
    | ApiFailure;
  if (isApiFailure(body)) return body;
  if ("administrativeProcess" in body && body.administrativeProcess) {
    return { process: normalizeProcessDetail(body.administrativeProcess) };
  }
  if ("process" in body && body.process) {
    return { process: normalizeProcessDetail(body.process) };
  }
  if ("id" in body && typeof body.id === "string") {
    return { process: normalizeProcessDetail(body as AdministrativeProcessDetail) };
  }
  return { error: { code: "NOT_FOUND", message: "Processo administrativo não encontrado." } };
}

export async function createAdministrativeProcess(
  orgId: string,
  matterId: string,
  input: CreateAdministrativeProcessInput,
): Promise<{ process: { id: string } & Partial<AdministrativeProcessDetail> } | ApiFailure> {
  const response = await fetch(matterProcessPath(orgId, matterId), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as
    | { process?: { id: string }; administrativeProcess?: { id: string } }
    | ApiFailure;
  if (isApiFailure(body)) return body;
  if (body.administrativeProcess) return { process: body.administrativeProcess };
  if (body.process) return { process: body.process };
  return {
    error: { code: "INTERNAL_ERROR", message: "Resposta inválida ao cadastrar o processo." },
  };
}

export async function updateAdministrativeProcess(
  orgId: string,
  processId: string,
  input: Partial<CreateAdministrativeProcessInput> & {
    status?: AdministrativeProcessStatus;
    description?: string | null;
  },
): Promise<{ process: AdministrativeProcessDetail } | ApiFailure> {
  const response = await fetch(processPath(orgId, processId), {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as
    | { process?: AdministrativeProcessDetail; administrativeProcess?: AdministrativeProcessDetail }
    | ApiFailure;
  if (isApiFailure(body)) return body;
  if (body.administrativeProcess) {
    return { process: normalizeProcessDetail(body.administrativeProcess) };
  }
  if (body.process) return { process: normalizeProcessDetail(body.process) };
  return {
    error: { code: "INTERNAL_ERROR", message: "Resposta inválida ao atualizar o processo." },
  };
}

async function fetchSubresource<T>(
  orgId: string,
  processId: string,
  suffix: string,
  keys: string[],
): Promise<{ items: T[] } | ApiFailure> {
  const response = await fetch(processPath(orgId, processId, suffix), { cache: "no-store" });
  const body = (await response.json()) as ({ items?: T[] } & Record<string, unknown>) | ApiFailure;
  if (isApiFailure(body)) return body;
  return { items: asList<T>(body, keys) };
}

export async function fetchAdministrativeRequests(
  orgId: string,
  processId: string,
): Promise<{ requests: AdministrativeRequest[] } | ApiFailure> {
  const result = await fetchSubresource<AdministrativeRequest>(orgId, processId, "/requests", [
    "requests",
  ]);
  if (isApiFailure(result)) return result;
  return { requests: result.items };
}

export async function fetchAdministrativeRequirements(
  orgId: string,
  processId: string,
): Promise<{ requirements: AdministrativeRequirement[] } | ApiFailure> {
  const result = await fetchSubresource<AdministrativeRequirement>(
    orgId,
    processId,
    "/requirements",
    ["requirements"],
  );
  if (isApiFailure(result)) return result;
  return { requirements: result.items };
}

export async function fetchAdministrativeDeadlines(
  orgId: string,
  processId: string,
): Promise<{ deadlines: AdministrativeDeadline[] } | ApiFailure> {
  const result = await fetchSubresource<AdministrativeDeadline>(orgId, processId, "/deadlines", [
    "deadlines",
  ]);
  if (isApiFailure(result)) return result;
  return { deadlines: result.items };
}

export async function fetchAdministrativeDecisions(
  orgId: string,
  processId: string,
): Promise<{ decisions: AdministrativeDecision[] } | ApiFailure> {
  const result = await fetchSubresource<AdministrativeDecision>(orgId, processId, "/decisions", [
    "decisions",
  ]);
  if (isApiFailure(result)) return result;
  return { decisions: result.items };
}

export async function fetchAdministrativeAppeals(
  orgId: string,
  processId: string,
): Promise<{ appeals: AdministrativeAppeal[] } | ApiFailure> {
  const result = await fetchSubresource<AdministrativeAppeal>(orgId, processId, "/appeals", [
    "appeals",
  ]);
  if (isApiFailure(result)) return result;
  return { appeals: result.items };
}

export async function fetchAdministrativeTimeline(
  orgId: string,
  processId: string,
): Promise<{ items: AdministrativeTimelineItem[] } | ApiFailure> {
  const result = await fetchSubresource<AdministrativeTimelineItem>(orgId, processId, "/timeline", [
    "events",
    "timeline",
  ]);
  if (isApiFailure(result)) return result;
  return { items: result.items };
}
