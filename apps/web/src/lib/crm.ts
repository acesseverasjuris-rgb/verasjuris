import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { Account, ApiFailure, Membership } from "./types";

export type CrmPersonType = "person" | "organization";

export type CrmLeadStatus =
  | "new"
  | "contacted"
  | "qualifying"
  | "qualified"
  | "unqualified"
  | "converted"
  | "archived";

export type CrmClientStatus = "active" | "inactive" | "archived";

export type CrmTag = { id: string; name: string; color: string | null; slug?: string };

export type CrmSource = { id: string; name: string; key?: string };
export type CrmChannel = { id: string; name: string; key?: string };

export type CrmLeadSummary = {
  id: string;
  personType: CrmPersonType;
  name: string;
  tradeName: string | null;
  email: string | null;
  phone: string | null;
  status: CrmLeadStatus;
  summary: string | null;
  source: CrmSource | null;
  channel: CrmChannel | null;
  ownerMembershipId: string | null;
  tags: CrmTag[];
  createdAt: string;
  updatedAt: string;
  convertedAt: string | null;
};

export type CrmClientSummary = {
  id: string;
  personType: CrmPersonType;
  status: CrmClientStatus;
  displayName: string;
  email: string | null;
  phone: string | null;
  cpfMasked: string | null;
  cnpjMasked: string | null;
  ownerMembershipId: string | null;
  tags: CrmTag[];
  createdAt: string;
  updatedAt: string;
};

export type CrmContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  isPrimary: boolean;
  leadId: string | null;
  clientId: string | null;
  notes: string | null;
  createdAt?: string;
};

export type CrmTimelineItem = {
  kind: "interaction" | "note";
  id: string;
  type: string;
  title: string;
  body: string | null;
  occurredAt: string;
  origin: string;
};

export type CrmOverview = {
  leads: number;
  openLeads: number;
  clients: number;
};

export type CrmListResult<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type CrmListQuery = {
  q?: string;
  status?: string;
  sourceId?: string;
  channelId?: string;
  tagId?: string;
  personType?: CrmPersonType;
  limit?: number;
  offset?: number;
  sort?: "createdAt" | "updatedAt" | "name";
  order?: "asc" | "desc";
};

export const LEAD_STATUS_LABELS: Record<CrmLeadStatus, string> = {
  new: "Novo",
  contacted: "Contato feito",
  qualifying: "Qualificando",
  qualified: "Qualificado",
  unqualified: "Não qualificado",
  converted: "Convertido",
  archived: "Arquivado",
};

export const CLIENT_STATUS_LABELS: Record<CrmClientStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
  archived: "Arquivado",
};

export const PERSON_TYPE_LABELS: Record<CrmPersonType, string> = {
  person: "Pessoa física",
  organization: "Pessoa jurídica",
};

function jsonHeaders(): HeadersInit {
  return { "content-type": "application/json", [CSRF_HEADER]: "1" };
}

function buildQuery(query: CrmListQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export async function fetchSessionAccount(): Promise<Account | null> {
  const response = await fetch("/api/v1/auth/session", { cache: "no-store" });
  if (!response.ok) return null;
  const body = (await response.json()) as { account: Account };
  return body.account;
}

export async function getActiveOrgId(): Promise<string | null> {
  const response = await fetch("/session/organizacao", { cache: "no-store" });
  if (response.ok) {
    const body = (await response.json()) as { organizationId: string | null };
    if (body.organizationId) return body.organizationId;
  }
  const account = await fetchSessionAccount();
  if (!account) return null;
  const available = account.memberships.filter(
    (membership) => membership.membershipStatus === "active",
  );
  return available[0]?.organizationId ?? null;
}

export async function getActiveMembership(): Promise<Membership | null> {
  const orgId = await getActiveOrgId();
  if (!orgId) return null;
  const account = await fetchSessionAccount();
  if (!account) return null;
  return account.memberships.find((item) => item.organizationId === orgId) ?? null;
}

function orgPath(orgId: string, suffix: string): string {
  return `/api/v1/organizations/${orgId}/crm${suffix}`;
}

export async function fetchCrmOverview(orgId: string): Promise<CrmOverview | ApiFailure> {
  const response = await fetch(orgPath(orgId, "/overview"), { cache: "no-store" });
  const body = (await response.json()) as { overview?: CrmOverview } | ApiFailure;
  if (isApiFailure(body)) return body;
  if (body.overview) return body.overview;
  return { leads: 0, openLeads: 0, clients: 0 };
}

export async function fetchLeads(
  orgId: string,
  query: CrmListQuery = {},
): Promise<CrmListResult<CrmLeadSummary> | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/leads${buildQuery(query)}`), { cache: "no-store" });
  return (await response.json()) as CrmListResult<CrmLeadSummary> | ApiFailure;
}

export async function fetchLead(
  orgId: string,
  leadId: string,
): Promise<{ lead: Record<string, unknown> } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/leads/${leadId}`), { cache: "no-store" });
  return (await response.json()) as { lead: Record<string, unknown> } | ApiFailure;
}

export async function createLead(
  orgId: string,
  input: Record<string, unknown>,
): Promise<{ lead: { id: string } } | ApiFailure> {
  const response = await fetch(orgPath(orgId, "/leads"), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  return (await response.json()) as { lead: { id: string } } | ApiFailure;
}

export async function updateLead(
  orgId: string,
  leadId: string,
  input: Record<string, unknown>,
): Promise<ApiFailure | { lead: Record<string, unknown> }> {
  const response = await fetch(orgPath(orgId, `/leads/${leadId}`), {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  return (await response.json()) as ApiFailure | { lead: Record<string, unknown> };
}

export async function convertLead(
  orgId: string,
  leadId: string,
): Promise<{ leadId: string; clientId: string } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/leads/${leadId}/convert`), {
    method: "POST",
    headers: jsonHeaders(),
  });
  return (await response.json()) as { leadId: string; clientId: string } | ApiFailure;
}

export async function fetchLeadTimeline(
  orgId: string,
  leadId: string,
): Promise<{ items: CrmTimelineItem[] } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/leads/${leadId}/timeline`), { cache: "no-store" });
  return (await response.json()) as { items: CrmTimelineItem[] } | ApiFailure;
}

export async function fetchClients(
  orgId: string,
  query: CrmListQuery = {},
): Promise<CrmListResult<CrmClientSummary> | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/clients${buildQuery(query)}`), {
    cache: "no-store",
  });
  return (await response.json()) as CrmListResult<CrmClientSummary> | ApiFailure;
}

export async function fetchClient(
  orgId: string,
  clientId: string,
): Promise<{ client: Record<string, unknown> } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/clients/${clientId}`), { cache: "no-store" });
  return (await response.json()) as { client: Record<string, unknown> } | ApiFailure;
}

export async function fetchClientTimeline(
  orgId: string,
  clientId: string,
): Promise<{ items: CrmTimelineItem[] } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/clients/${clientId}/timeline`), {
    cache: "no-store",
  });
  return (await response.json()) as { items: CrmTimelineItem[] } | ApiFailure;
}

export async function fetchContacts(
  orgId: string,
  query: CrmListQuery = {},
): Promise<CrmListResult<CrmContact> | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/contacts${buildQuery(query)}`), {
    cache: "no-store",
  });
  return (await response.json()) as CrmListResult<CrmContact> | ApiFailure;
}

export async function fetchTags(orgId: string): Promise<{ tags: CrmTag[] } | ApiFailure> {
  const response = await fetch(orgPath(orgId, "/tags"), { cache: "no-store" });
  const body = (await response.json()) as { tags?: CrmTag[]; items?: CrmTag[] } | ApiFailure;
  if ("error" in body && body.error) return body;
  if ("tags" in body && body.tags) return { tags: body.tags };
  if ("items" in body && body.items) return { tags: body.items };
  return { tags: body as CrmTag[] };
}

export async function createTag(
  orgId: string,
  input: { name: string; color?: string },
): Promise<{ tag: CrmTag } | ApiFailure> {
  const response = await fetch(orgPath(orgId, "/tags"), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  return (await response.json()) as { tag: CrmTag } | ApiFailure;
}

export async function fetchSources(orgId: string): Promise<{ sources: CrmSource[] } | ApiFailure> {
  const response = await fetch(orgPath(orgId, "/sources"), { cache: "no-store" });
  return (await response.json()) as { sources: CrmSource[] } | ApiFailure;
}

export async function fetchChannels(
  orgId: string,
): Promise<{ channels: CrmChannel[] } | ApiFailure> {
  const response = await fetch(orgPath(orgId, "/channels"), { cache: "no-store" });
  return (await response.json()) as { channels: CrmChannel[] } | ApiFailure;
}

export async function createNote(
  orgId: string,
  input: {
    resourceType: "lead" | "client" | "contact" | "intake";
    resourceId: string;
    content: string;
    visibility?: "organization" | "internal" | "private";
  },
): Promise<ApiFailure | { note: { id: string } }> {
  const response = await fetch(orgPath(orgId, "/notes"), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  return (await response.json()) as ApiFailure | { note: { id: string } };
}

export function apiErrorMessage(data: ApiFailure, fallback: string): string {
  return data.error?.message ?? fallback;
}

export function isApiFailure(value: unknown): value is ApiFailure {
  return Boolean(
    value && typeof value === "object" && "error" in value && (value as ApiFailure).error,
  );
}
