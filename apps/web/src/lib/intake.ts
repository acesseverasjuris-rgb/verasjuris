import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { ApiFailure } from "./types";
import {
  apiErrorMessage,
  getActiveOrgId,
  isApiFailure,
  type CrmChannel,
  type CrmClientSummary,
  type CrmLeadSummary,
  type CrmSource,
  type CrmTimelineItem,
} from "./crm";

export { apiErrorMessage, getActiveOrgId, isApiFailure };
export type { CrmChannel, CrmClientSummary, CrmLeadSummary, CrmSource, CrmTimelineItem };

export type IntakeStatus =
  | "open"
  | "triage"
  | "waiting_client"
  | "under_review"
  | "qualified"
  | "not_qualified"
  | "converted"
  | "closed"
  | "archived";

export type TriageStatus =
  | "draft"
  | "in_progress"
  | "waiting_information"
  | "ready_for_analysis"
  | "reviewed"
  | "closed";

export type IntakeUrgency = "normal" | "attention" | "urgent" | "critical";

export type IntakeServiceMode = "online" | "in_person" | "phone" | "video" | "message" | "other";

export type IntakeDocumentStatus = "pending" | "received" | "unavailable" | "rejected";

export type LegalArea = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
};

export type IntakePersonRef = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

export type IntakeSummary = {
  id: string;
  title: string;
  summary: string | null;
  status: IntakeStatus;
  urgency: IntakeUrgency;
  serviceMode: IntakeServiceMode;
  legalArea: Pick<LegalArea, "id" | "name"> | null;
  lead: IntakePersonRef | null;
  client: { id: string; displayName: string } | null;
  source: CrmSource | null;
  channel: CrmChannel | null;
  startedAt: string;
  updatedAt: string;
  convertedAt: string | null;
};

export type IntakeDetail = IntakeSummary & {
  contact: IntakePersonRef | null;
  preferredContactMethod: string | null;
  externalReference: string | null;
  responsibleMembershipId: string | null;
  leadId: string | null;
  clientId: string | null;
  contactId: string | null;
  legalAreaId: string | null;
  sourceId: string | null;
  channelId: string | null;
  closedAt: string | null;
  createdAt: string;
  triage: Triage | null;
};

export type Triage = {
  id: string;
  intakeId: string;
  legalAreaId: string | null;
  urgency: IntakeUrgency;
  summary: string | null;
  facts: string | null;
  requestNeed: string | null;
  relevantDates: string | null;
  riskNotes: string | null;
  missingInformation: string | null;
  nextAction: string | null;
  responsibleMembershipId: string | null;
  status: TriageStatus;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IntakeDocument = {
  id: string;
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  status: IntakeDocumentStatus;
  unavailableReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IntakeListResult = {
  items: IntakeSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type IntakeListQuery = {
  q?: string;
  status?: IntakeStatus;
  urgency?: IntakeUrgency;
  legalAreaId?: string;
  responsibleMembershipId?: string;
  sourceId?: string;
  channelId?: string;
  limit?: number;
  offset?: number;
  sort?: "createdAt" | "updatedAt" | "startedAt" | "urgency";
  order?: "asc" | "desc";
};

export const INTAKE_STATUS_LABELS: Record<IntakeStatus, string> = {
  open: "Aberto",
  triage: "Em triagem",
  waiting_client: "Aguardando cliente",
  under_review: "Em análise",
  qualified: "Qualificado",
  not_qualified: "Não qualificado",
  converted: "Convertido",
  closed: "Encerrado",
  archived: "Arquivado",
};

export const TRIAGE_STATUS_LABELS: Record<TriageStatus, string> = {
  draft: "Rascunho",
  in_progress: "Em andamento",
  waiting_information: "Aguardando informações",
  ready_for_analysis: "Pronto para análise",
  reviewed: "Revisado",
  closed: "Encerrado",
};

export const URGENCY_LABELS: Record<IntakeUrgency, string> = {
  normal: "Normal",
  attention: "Requer atenção",
  urgent: "Urgente",
  critical: "Alta urgência informada",
};

export const URGENCY_FIELD_LABEL = "Urgência informada na triagem";

export const SERVICE_MODE_LABELS: Record<IntakeServiceMode, string> = {
  online: "Online",
  in_person: "Presencial",
  phone: "Telefone",
  video: "Vídeo",
  message: "Mensagem",
  other: "Outro",
};

export const DOCUMENT_STATUS_LABELS: Record<IntakeDocumentStatus, string> = {
  pending: "Pendente",
  received: "Recebido",
  unavailable: "Indisponível",
  rejected: "Rejeitado",
};

function jsonHeaders(): HeadersInit {
  return { "content-type": "application/json", [CSRF_HEADER]: "1" };
}

function orgPath(orgId: string, suffix: string): string {
  return `/api/v1/organizations/${orgId}${suffix}`;
}

function buildQuery(query: IntakeListQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export async function fetchIntakes(
  orgId: string,
  query: IntakeListQuery = {},
): Promise<IntakeListResult | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/intakes${buildQuery(query)}`), {
    cache: "no-store",
  });
  return (await response.json()) as IntakeListResult | ApiFailure;
}

export async function fetchIntake(
  orgId: string,
  intakeId: string,
): Promise<{ intake: IntakeDetail } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/intakes/${intakeId}`), { cache: "no-store" });
  return (await response.json()) as { intake: IntakeDetail } | ApiFailure;
}

export async function createIntake(
  orgId: string,
  input: Record<string, unknown>,
): Promise<{ intake: { id: string } } | ApiFailure> {
  const response = await fetch(orgPath(orgId, "/intakes"), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  return (await response.json()) as { intake: { id: string } } | ApiFailure;
}

export async function updateIntake(
  orgId: string,
  intakeId: string,
  input: Record<string, unknown>,
): Promise<{ intake: IntakeDetail } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/intakes/${intakeId}`), {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  return (await response.json()) as { intake: IntakeDetail } | ApiFailure;
}

export async function fetchTriage(
  orgId: string,
  intakeId: string,
): Promise<{ triage: Triage | null } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/intakes/${intakeId}/triage`), {
    cache: "no-store",
  });
  return (await response.json()) as { triage: Triage | null } | ApiFailure;
}

export async function upsertTriage(
  orgId: string,
  intakeId: string,
  input: Record<string, unknown>,
): Promise<{ triage: Triage } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/intakes/${intakeId}/triage`), {
    method: "PUT",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  return (await response.json()) as { triage: Triage } | ApiFailure;
}

export async function fetchIntakeDocuments(
  orgId: string,
  intakeId: string,
): Promise<{ documents: IntakeDocument[] } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/intakes/${intakeId}/documents`), {
    cache: "no-store",
  });
  return (await response.json()) as { documents: IntakeDocument[] } | ApiFailure;
}

export async function registerIntakeDocument(
  orgId: string,
  intakeId: string,
  input: Record<string, unknown>,
): Promise<{ document: IntakeDocument } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/intakes/${intakeId}/documents`), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  return (await response.json()) as { document: IntakeDocument } | ApiFailure;
}

export async function convertIntake(
  orgId: string,
  intakeId: string,
): Promise<{ intakeId: string; clientId: string } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/intakes/${intakeId}/convert`), {
    method: "POST",
    headers: jsonHeaders(),
  });
  return (await response.json()) as { intakeId: string; clientId: string } | ApiFailure;
}

export async function fetchIntakeTimeline(
  orgId: string,
  intakeId: string,
): Promise<{ items: CrmTimelineItem[] } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/intakes/${intakeId}/timeline`), {
    cache: "no-store",
  });
  return (await response.json()) as { items: CrmTimelineItem[] } | ApiFailure;
}

export async function fetchLegalAreas(
  orgId: string,
): Promise<{ legalAreas: LegalArea[] } | ApiFailure> {
  const response = await fetch(orgPath(orgId, "/legal-areas"), { cache: "no-store" });
  const body = (await response.json()) as
    | { legalAreas?: LegalArea[]; items?: LegalArea[] }
    | ApiFailure;
  if (isApiFailure(body)) return body;
  if ("legalAreas" in body && body.legalAreas) return { legalAreas: body.legalAreas };
  if ("items" in body && body.items) return { legalAreas: body.items };
  return { legalAreas: [] };
}

export async function createLegalArea(
  orgId: string,
  input: { name: string; slug?: string; description?: string; sortOrder?: number },
): Promise<{ legalArea: LegalArea } | ApiFailure> {
  const response = await fetch(orgPath(orgId, "/legal-areas"), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  return (await response.json()) as { legalArea: LegalArea } | ApiFailure;
}

export async function createIntakeNote(
  orgId: string,
  input: {
    resourceId: string;
    content: string;
    visibility?: "organization" | "internal" | "private";
  },
): Promise<ApiFailure | { note: { id: string } }> {
  const response = await fetch(`/api/v1/organizations/${orgId}/crm/notes`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ ...input, resourceType: "intake" }),
  });
  return (await response.json()) as ApiFailure | { note: { id: string } };
}

export function urgencyBadgeTone(urgency: IntakeUrgency): "neutral" | "warning" | "success" {
  if (urgency === "critical" || urgency === "urgent") return "warning";
  if (urgency === "attention") return "neutral";
  return "neutral";
}

export function isNotConfiguredError(data: ApiFailure): boolean {
  return data.error?.code === "NOT_CONFIGURED";
}
