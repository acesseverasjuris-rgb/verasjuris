import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { ApiFailure } from "./types";
import {
  apiErrorMessage,
  getActiveMembership,
  getActiveOrgId,
  isApiFailure,
  type CrmClientSummary,
  type CrmTag,
} from "./crm";
import { fetchLegalAreas, type LegalArea } from "./intake";
import { fetchOrganizationMembers, type OrgMember } from "./pipeline";

export {
  apiErrorMessage,
  getActiveMembership,
  getActiveOrgId,
  isApiFailure,
  fetchLegalAreas,
  fetchOrganizationMembers,
  type LegalArea,
  type OrgMember,
  type CrmClientSummary,
  type CrmTag,
};

export type MatterStatus =
  | "draft"
  | "open"
  | "active"
  | "waiting"
  | "suspended"
  | "closed"
  | "archived";

export type MatterPriority = "normal" | "high" | "urgent";

export type MatterPartyPosition =
  | "client"
  | "opposing"
  | "interested"
  | "claimant"
  | "respondent"
  | "third_party"
  | "beneficiary"
  | "representative"
  | "other";

export type MatterPartyPersonType = "person" | "organization" | "public_body" | "other";

export type MatterTeamRole =
  | "responsible"
  | "lawyer"
  | "collaborator"
  | "intern"
  | "paralegal"
  | "reviewer"
  | "coordinator"
  | "other";

export type MatterFeeType =
  | "fixed"
  | "success"
  | "percentage"
  | "hourly"
  | "monthly"
  | "hybrid"
  | "pro_bono"
  | "other";

export type MatterFeeStatus = "draft" | "active" | "superseded" | "cancelled";

export type DemandType = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
};

export type LegalSubarea = {
  id: string;
  legalAreaId: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
};

export type MatterParty = {
  id: string;
  partyType: string;
  position: MatterPartyPosition;
  personType: MatterPartyPersonType;
  clientId: string | null;
  contactId: string | null;
  displayName: string;
  documentNormalized: string | null;
  roleDescription: string | null;
  isPrimary: boolean;
};

export type MatterTeamMember = {
  id: string;
  membershipId: string;
  teamRole: MatterTeamRole;
  isPrimary: boolean;
  assignedAt: string;
  removedAt: string | null;
  displayName?: string | null;
  membership?: { membershipId: string; displayName: string } | null;
};

export type MatterFeeArrangement = {
  id: string;
  type: MatterFeeType;
  fixedAmountCents: number | null;
  percentageBasisPoints: number | null;
  hourlyRateCents: number | null;
  successFeeBasisPoints: number | null;
  description: string | null;
  status: MatterFeeStatus;
  effectiveFrom: string;
  effectiveUntil: string | null;
};

export type MatterTimelineItem = {
  id: string;
  eventType: string;
  title: string;
  body: string | null;
  actorMembershipId: string | null;
  occurredAt: string;
  createdAt?: string;
};

export type MatterClientRef = {
  id: string;
  displayName: string;
  fullName?: string | null;
  legalName?: string | null;
  tradeName?: string | null;
  status?: string;
};

export type MatterSummary = {
  id: string;
  title: string;
  internalReference: string;
  status: MatterStatus;
  priority: MatterPriority;
  summary: string | null;
  clientId: string;
  client: MatterClientRef | null;
  demandType: Pick<DemandType, "id" | "name"> | null;
  legalArea: Pick<LegalArea, "id" | "name"> | null;
  legalSubarea: Pick<LegalSubarea, "id" | "name"> | null;
  responsibleMembershipId: string | null;
  responsible: { membershipId: string; displayName: string } | null;
  originatingOpportunityId: string | null;
  openedAt: string;
  updatedAt: string;
  createdAt: string;
};

export type MatterDetail = MatterSummary & {
  intakeId: string | null;
  demandTypeId: string | null;
  legalAreaId: string | null;
  legalSubareaId: string | null;
  closedAt: string | null;
  archivedAt: string | null;
  parties: MatterParty[];
  teamMembers: MatterTeamMember[];
  fees: MatterFeeArrangement[];
  tags: CrmTag[];
  timeline?: MatterTimelineItem[];
};

export type MatterListResult = {
  items: MatterSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type MatterListQuery = {
  q?: string;
  status?: MatterStatus;
  priority?: MatterPriority;
  clientId?: string;
  responsibleMembershipId?: string;
  teamMembershipId?: string;
  legalAreaId?: string;
  legalSubareaId?: string;
  demandTypeId?: string;
  tagId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export type CreateMatterInput = {
  clientId: string;
  title: string;
  summary?: string;
  demandTypeId?: string;
  legalAreaId?: string;
  legalSubareaId?: string;
  priority?: MatterPriority;
  responsibleMembershipId?: string;
  status?: "draft" | "open" | "active";
  originatingOpportunityId?: string;
  intakeId?: string;
};

export type UpdateMatterInput = {
  title?: string;
  summary?: string | null;
  demandTypeId?: string | null;
  legalAreaId?: string | null;
  legalSubareaId?: string | null;
  priority?: MatterPriority;
  responsibleMembershipId?: string | null;
  clientId?: string;
};

export const MATTER_STATUS_LABELS: Record<MatterStatus, string> = {
  draft: "Rascunho",
  open: "Aberto",
  active: "Em andamento",
  waiting: "Aguardando",
  suspended: "Suspenso",
  closed: "Encerrado",
  archived: "Arquivado",
};

export const MATTER_PRIORITY_LABELS: Record<MatterPriority, string> = {
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

export const PARTY_POSITION_LABELS: Record<MatterPartyPosition, string> = {
  client: "Cliente",
  opposing: "Parte contrária",
  interested: "Interessado",
  claimant: "Requerente",
  respondent: "Requerido",
  third_party: "Terceiro",
  beneficiary: "Beneficiário",
  representative: "Representante",
  other: "Outro",
};

export const PARTY_PERSON_TYPE_LABELS: Record<MatterPartyPersonType, string> = {
  person: "Pessoa física",
  organization: "Pessoa jurídica",
  public_body: "Órgão público",
  other: "Outro",
};

export const TEAM_ROLE_LABELS: Record<MatterTeamRole, string> = {
  responsible: "Responsável",
  lawyer: "Advogado(a)",
  collaborator: "Colaborador(a)",
  intern: "Estagiário(a)",
  paralegal: "Paralegal",
  reviewer: "Revisor(a)",
  coordinator: "Coordenador(a)",
  other: "Outro",
};

export const FEE_TYPE_LABELS: Record<MatterFeeType, string> = {
  fixed: "Fixo",
  success: "Êxito",
  percentage: "Percentual",
  hourly: "Por hora",
  monthly: "Mensal",
  hybrid: "Híbrido",
  pro_bono: "Pro bono",
  other: "Outro",
};

export const FEE_STATUS_LABELS: Record<MatterFeeStatus, string> = {
  draft: "Rascunho",
  active: "Ativa",
  superseded: "Substituída",
  cancelled: "Cancelada",
};

function jsonHeaders(): HeadersInit {
  return { "content-type": "application/json", [CSRF_HEADER]: "1" };
}

function orgPath(orgId: string, suffix: string): string {
  return `/api/v1/organizations/${orgId}${suffix}`;
}

function buildQuery(query: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export function hasMatterPermission(
  permissions: readonly string[] | undefined,
  action:
    | "read"
    | "create"
    | "update"
    | "assign"
    | "manage_team"
    | "manage_parties"
    | "manage_fees"
    | "manage_tags"
    | "close"
    | "archive",
): boolean {
  if (!permissions) return false;
  return permissions.includes(`matter.${action}`);
}

export function matterStatusTone(
  status: MatterStatus,
): "neutral" | "success" | "warning" | "error" {
  if (status === "active" || status === "open") return "success";
  if (status === "waiting" || status === "suspended" || status === "draft") return "warning";
  if (status === "archived" || status === "closed") return "neutral";
  return "neutral";
}

export function matterPriorityTone(
  priority: MatterPriority,
): "neutral" | "success" | "warning" | "error" {
  if (priority === "urgent") return "error";
  if (priority === "high") return "warning";
  return "neutral";
}

export function formatCents(cents: number | null | undefined, currency = "BRL"): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

export function formatBasisPoints(bps: number | null | undefined): string {
  if (bps == null) return "—";
  return `${(bps / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

export function teamMemberLabel(member: MatterTeamMember): string {
  return member.displayName ?? member.membership?.displayName ?? member.membershipId.slice(0, 8);
}

export function clientDisplayName(client: MatterClientRef | null | undefined): string {
  if (!client) return "—";
  if (client.displayName) return client.displayName;
  return client.tradeName || client.legalName || client.fullName || "Cliente";
}

export async function fetchMatters(
  orgId: string,
  query: MatterListQuery = {},
): Promise<MatterListResult | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/matters${buildQuery(query)}`), {
    cache: "no-store",
  });
  const body = (await response.json()) as
    | MatterListResult
    | {
        matters?: MatterSummary[];
        items?: MatterSummary[];
        total?: number;
        limit?: number;
        offset?: number;
      }
    | ApiFailure;
  if (isApiFailure(body)) return body;
  if ("items" in body && Array.isArray(body.items)) {
    return {
      items: body.items,
      total: body.total ?? body.items.length,
      limit: body.limit ?? 20,
      offset: body.offset ?? 0,
    };
  }
  if ("matters" in body && Array.isArray(body.matters)) {
    return {
      items: body.matters,
      total: body.total ?? body.matters.length,
      limit: body.limit ?? body.matters.length,
      offset: body.offset ?? 0,
    };
  }
  return { items: [], total: 0, limit: 20, offset: 0 };
}

export async function fetchMatter(
  orgId: string,
  matterId: string,
): Promise<{ matter: MatterDetail } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/matters/${matterId}`), { cache: "no-store" });
  const body = (await response.json()) as
    | { matter?: MatterDetail; case?: MatterDetail }
    | MatterDetail
    | ApiFailure;
  if (isApiFailure(body)) return body;
  if ("matter" in body && body.matter) return { matter: normalizeMatterDetail(body.matter) };
  if ("case" in body && body.case) return { matter: normalizeMatterDetail(body.case) };
  if ("id" in body && typeof body.id === "string") {
    return { matter: normalizeMatterDetail(body as MatterDetail) };
  }
  return { error: { code: "NOT_FOUND", message: "Caso não encontrado." } };
}

function normalizeMatterDetail(raw: MatterDetail): MatterDetail {
  const tags = (raw.tags ?? []).map((item) => {
    if (item && typeof item === "object" && "tag" in item) {
      return (item as { tag: CrmTag }).tag;
    }
    return item as CrmTag;
  });
  return {
    ...raw,
    parties: raw.parties ?? [],
    teamMembers: raw.teamMembers ?? [],
    fees: raw.fees ?? [],
    tags,
    timeline: raw.timeline ?? [],
  };
}

export async function createMatter(
  orgId: string,
  input: CreateMatterInput,
): Promise<{ matter: { id: string } & Partial<MatterDetail> } | ApiFailure> {
  const response = await fetch(orgPath(orgId, "/matters"), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as
    | { matter?: { id: string }; case?: { id: string } }
    | ApiFailure;
  if (isApiFailure(body)) return body;
  if (body.matter) return { matter: body.matter };
  if (body.case) return { matter: body.case };
  return { error: { code: "INTERNAL_ERROR", message: "Resposta inválida ao criar o caso." } };
}

export async function updateMatter(
  orgId: string,
  matterId: string,
  input: UpdateMatterInput,
): Promise<{ matter: MatterDetail } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/matters/${matterId}`), {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as { matter?: MatterDetail } | ApiFailure;
  if (isApiFailure(body)) return body;
  if (body.matter) return { matter: normalizeMatterDetail(body.matter) };
  return { error: { code: "INTERNAL_ERROR", message: "Resposta inválida ao atualizar o caso." } };
}

export async function changeMatterStatus(
  orgId: string,
  matterId: string,
  status: MatterStatus,
): Promise<{ matter: MatterDetail } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/matters/${matterId}/status`), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ status }),
  });
  const body = (await response.json()) as { matter?: MatterDetail } | ApiFailure;
  if (isApiFailure(body)) return body;
  if (body.matter) return { matter: normalizeMatterDetail(body.matter) };
  return { error: { code: "INTERNAL_ERROR", message: "Resposta inválida ao alterar o status." } };
}

export async function closeMatter(
  orgId: string,
  matterId: string,
): Promise<{ matter: MatterDetail } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/matters/${matterId}/close`), {
    method: "POST",
    headers: jsonHeaders(),
  });
  return (await response.json()) as { matter: MatterDetail } | ApiFailure;
}

export async function archiveMatter(
  orgId: string,
  matterId: string,
): Promise<{ matter: MatterDetail } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/matters/${matterId}/archive`), {
    method: "POST",
    headers: jsonHeaders(),
  });
  return (await response.json()) as { matter: MatterDetail } | ApiFailure;
}

export async function fetchMatterParties(
  orgId: string,
  matterId: string,
): Promise<{ parties: MatterParty[] } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/matters/${matterId}/parties`), {
    cache: "no-store",
  });
  const body = (await response.json()) as
    | { parties?: MatterParty[]; items?: MatterParty[] }
    | ApiFailure;
  if (isApiFailure(body)) return body;
  return { parties: body.parties ?? body.items ?? [] };
}

export async function createMatterParty(
  orgId: string,
  matterId: string,
  input: {
    displayName: string;
    position?: MatterPartyPosition;
    personType?: MatterPartyPersonType;
    clientId?: string;
    contactId?: string;
    roleDescription?: string;
    isPrimary?: boolean;
    documentNormalized?: string;
  },
): Promise<{ party: MatterParty } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/matters/${matterId}/parties`), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  return (await response.json()) as { party: MatterParty } | ApiFailure;
}

export async function updateMatterParty(
  orgId: string,
  matterId: string,
  partyId: string,
  input: Record<string, unknown>,
): Promise<{ party: MatterParty } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/matters/${matterId}/parties/${partyId}`), {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  return (await response.json()) as { party: MatterParty } | ApiFailure;
}

export async function deleteMatterParty(
  orgId: string,
  matterId: string,
  partyId: string,
): Promise<{ ok: true } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/matters/${matterId}/parties/${partyId}`), {
    method: "DELETE",
    headers: jsonHeaders(),
  });
  if (response.status === 204) return { ok: true };
  return (await response.json()) as { ok: true } | ApiFailure;
}

export async function fetchMatterTeam(
  orgId: string,
  matterId: string,
): Promise<{ teamMembers: MatterTeamMember[] } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/matters/${matterId}/team`), {
    cache: "no-store",
  });
  const body = (await response.json()) as
    | { teamMembers?: MatterTeamMember[]; items?: MatterTeamMember[]; team?: MatterTeamMember[] }
    | ApiFailure;
  if (isApiFailure(body)) return body;
  return { teamMembers: body.teamMembers ?? body.team ?? body.items ?? [] };
}

export async function addMatterTeamMember(
  orgId: string,
  matterId: string,
  input: {
    membershipId: string;
    teamRole?: MatterTeamRole;
    isPrimary?: boolean;
  },
): Promise<{ teamMember: MatterTeamMember } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/matters/${matterId}/team`), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  return (await response.json()) as { teamMember: MatterTeamMember } | ApiFailure;
}

export async function removeMatterTeamMember(
  orgId: string,
  matterId: string,
  teamMemberId: string,
): Promise<{ ok: true } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/matters/${matterId}/team/${teamMemberId}`), {
    method: "DELETE",
    headers: jsonHeaders(),
  });
  if (response.status === 204) return { ok: true };
  return (await response.json()) as { ok: true } | ApiFailure;
}

export async function fetchMatterFees(
  orgId: string,
  matterId: string,
): Promise<{ fees: MatterFeeArrangement[] } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/matters/${matterId}/fees`), {
    cache: "no-store",
  });
  const body = (await response.json()) as
    | { fees?: MatterFeeArrangement[]; items?: MatterFeeArrangement[] }
    | ApiFailure;
  if (isApiFailure(body)) return body;
  return { fees: body.fees ?? body.items ?? [] };
}

export async function createMatterFee(
  orgId: string,
  matterId: string,
  input: {
    type: MatterFeeType;
    fixedAmountCents?: number;
    percentageBasisPoints?: number;
    hourlyRateCents?: number;
    successFeeBasisPoints?: number;
    description?: string;
    status?: MatterFeeStatus;
  },
): Promise<{ fee: MatterFeeArrangement } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/matters/${matterId}/fees`), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  return (await response.json()) as { fee: MatterFeeArrangement } | ApiFailure;
}

export async function updateMatterFee(
  orgId: string,
  matterId: string,
  feeId: string,
  input: Record<string, unknown>,
): Promise<{ fee: MatterFeeArrangement } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/matters/${matterId}/fees/${feeId}`), {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  return (await response.json()) as { fee: MatterFeeArrangement } | ApiFailure;
}

export async function fetchMatterTags(
  orgId: string,
  matterId: string,
): Promise<{ tags: CrmTag[] } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/matters/${matterId}/tags`), {
    cache: "no-store",
  });
  const body = (await response.json()) as { tags?: CrmTag[]; items?: CrmTag[] } | ApiFailure;
  if (isApiFailure(body)) return body;
  return { tags: body.tags ?? body.items ?? [] };
}

export async function setMatterTags(
  orgId: string,
  matterId: string,
  tagIds: string[],
): Promise<{ tags: CrmTag[] } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/matters/${matterId}/tags`), {
    method: "PUT",
    headers: jsonHeaders(),
    body: JSON.stringify({ tagIds }),
  });
  const body = (await response.json()) as { tags?: CrmTag[]; items?: CrmTag[] } | ApiFailure;
  if (isApiFailure(body)) return body;
  return { tags: body.tags ?? body.items ?? [] };
}

export async function fetchMatterTimeline(
  orgId: string,
  matterId: string,
): Promise<{ items: MatterTimelineItem[] } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/matters/${matterId}/timeline`), {
    cache: "no-store",
  });
  const body = (await response.json()) as
    | { items?: MatterTimelineItem[]; events?: MatterTimelineItem[] }
    | ApiFailure;
  if (isApiFailure(body)) return body;
  return { items: body.items ?? body.events ?? [] };
}

export async function fetchDemandTypes(
  orgId: string,
): Promise<{ demandTypes: DemandType[] } | ApiFailure> {
  const response = await fetch(orgPath(orgId, "/demand-types"), { cache: "no-store" });
  const body = (await response.json()) as
    | { demandTypes?: DemandType[]; items?: DemandType[] }
    | ApiFailure;
  if (isApiFailure(body)) return body;
  return { demandTypes: body.demandTypes ?? body.items ?? [] };
}

export async function fetchLegalSubareas(
  orgId: string,
  query: { legalAreaId?: string } = {},
): Promise<{ legalSubareas: LegalSubarea[] } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/legal-subareas${buildQuery(query)}`), {
    cache: "no-store",
  });
  const body = (await response.json()) as
    | { legalSubareas?: LegalSubarea[]; items?: LegalSubarea[]; subareas?: LegalSubarea[] }
    | ApiFailure;
  if (isApiFailure(body)) return body;
  return { legalSubareas: body.legalSubareas ?? body.subareas ?? body.items ?? [] };
}
