import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure } from "./ai";
import { aiErrorMessage, formatDateTime, hasPermission, isApiFailure, isNotConfigured } from "./ai";
import { formatMoneyCents } from "./auctions";
import { getActiveMembership, getActiveOrgId } from "./crm";

export {
  getActiveMembership,
  getActiveOrgId,
  isApiFailure,
  aiErrorMessage,
  formatDateTime,
  isNotConfigured,
  formatMoneyCents,
};

/**
 * Advogado Online — /api/v1/organizations/:orgId/online-…
 */

export type ProviderHealthStatus = "ok" | "degraded" | "unavailable" | "not_configured";

export type ProviderHealth = {
  status: ProviderHealthStatus;
  providerKey?: string;
  detail?: string;
  checkedAt?: string;
};

export type OnlineLawyerProvidersStatus = {
  payment: ProviderHealth;
  oab: ProviderHealth;
  conflict: ProviderHealth;
  video: ProviderHealth;
};

export type OnlineLegalRequest = {
  id: string;
  organizationId: string;
  requesterUserId: string;
  clientId?: string | null;
  legalAreaId?: string | null;
  urgency: string;
  stateCode: string;
  summary?: string;
  preferredMode: string;
  status: string;
  acceptedMatchId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OnlineMatchCandidate = {
  id: string;
  requestId: string;
  lawyerProfileId: string;
  totalScore: number;
  scoreBreakdown?: Record<string, unknown> | null;
  status: string;
  offeredAt?: string | null;
  expiresAt?: string | null;
  respondedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OnlineConsultation = {
  id: string;
  organizationId: string;
  requestId: string;
  clientId?: string | null;
  lawyerProfileId: string;
  matchCandidateId?: string | null;
  status: string;
  mode: string;
  scheduledAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  timezone?: string | null;
  priceCents?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type LawyerAvailabilitySlot = {
  id: string;
  lawyerProfileId: string;
  dayOfWeek?: number | null;
  startTime: string;
  endTime: string;
  timezone: string;
  mode?: string;
  active: boolean;
};

export const ONLINE_LAWYER_NOT_CONFIGURED_MESSAGE =
  "Provedor não configurado (NOT_CONFIGURED). Pagamento automático, vídeo ou verificação OAB não serão simulados como concluídos.";

export const ONLINE_REQUEST_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  submitted: "Enviada",
  matching: "Em match",
  matched: "Com advogado",
  cancelled: "Cancelada",
  expired: "Expirada",
  converted: "Convertida",
};

export const ONLINE_MATCH_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  offered: "Ofertada",
  accepted: "Aceita",
  declined: "Recusada",
  expired: "Expirada",
  cancelled: "Cancelada",
};

export const ONLINE_CONSULTATION_STATUS_LABELS: Record<string, string> = {
  matched: "Match feito",
  awaiting_payment: "Aguardando pagamento",
  scheduled: "Agendada",
  ready: "Pronta",
  in_progress: "Em andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
  no_show: "Não compareceu",
  disputed: "Em disputa",
};

export const ONLINE_URGENCY_LABELS: Record<string, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

export const ONLINE_MODE_LABELS: Record<string, string> = {
  text: "Texto",
  audio: "Áudio",
  video: "Vídeo",
  in_person: "Presencial",
  other: "Outro",
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

export type OnlineLawyerAction =
  | "request"
  | "match.read"
  | "match.respond"
  | "consultation.read"
  | "consultation.manage"
  | "availability.manage"
  | "review.moderate";

export function hasOnlineLawyerPermission(
  permissions: readonly string[] | undefined,
  action: OnlineLawyerAction,
): boolean {
  return hasPermission(permissions, `online_lawyer.${action}`);
}

export function onlineLawyerErrorMessage(failure: AiApiFailure, fallback: string): string {
  if (isNotConfigured(failure) || failure.error?.code === "NOT_CONFIGURED") {
    return ONLINE_LAWYER_NOT_CONFIGURED_MESSAGE;
  }
  return aiErrorMessage(failure, fallback);
}

export function isProviderNotConfigured(health: ProviderHealth | undefined): boolean {
  return !health || health.status === "not_configured" || health.status === "unavailable";
}

export function anyOnlineProviderNotConfigured(status: OnlineLawyerProvidersStatus): boolean {
  return (
    isProviderNotConfigured(status.payment) ||
    isProviderNotConfigured(status.video) ||
    isProviderNotConfigured(status.oab)
  );
}

export async function fetchOnlineLawyerProvidersStatus(orgId: string) {
  return request<OnlineLawyerProvidersStatus>(orgPath(orgId, "/online-lawyer/providers/status"));
}

export async function fetchOnlineLegalRequests(
  orgId: string,
  query: { status?: string; stateCode?: string; limit?: number; offset?: number } = {},
) {
  const data = await request<{ items: OnlineLegalRequest[]; total: number }>(
    orgPath(orgId, `/online-legal-requests${qs(query)}`),
  );
  if (isApiFailure(data)) return data;
  return data;
}

export async function fetchOnlineLegalRequest(orgId: string, requestId: string) {
  return request<{ request: OnlineLegalRequest; documentIds: string[] }>(
    orgPath(orgId, `/online-legal-requests/${requestId}`),
  );
}

export async function createOnlineLegalRequest(
  orgId: string,
  body: {
    clientId?: string;
    legalAreaId?: string;
    urgency?: string;
    stateCode: string;
    summary: string;
    preferredMode?: string;
    status?: string;
  },
) {
  return request<{ request: OnlineLegalRequest }>(orgPath(orgId, "/online-legal-requests"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function cancelOnlineLegalRequest(orgId: string, requestId: string) {
  return request<{ request: OnlineLegalRequest }>(
    orgPath(orgId, `/online-legal-requests/${requestId}/cancel`),
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function fetchRequestMatchCandidates(orgId: string, requestId: string) {
  const data = await request<{ items: OnlineMatchCandidate[] }>(
    orgPath(orgId, `/online-legal-requests/${requestId}/matches`),
  );
  if (isApiFailure(data)) return data;
  return data;
}

export async function fetchLawyerOfferedMatches(
  orgId: string,
  query: { limit?: number; offset?: number } = {},
) {
  const data = await request<{ items: OnlineMatchCandidate[] }>(
    orgPath(orgId, `/online-lawyer/matches${qs(query)}`),
  );
  if (isApiFailure(data)) return data;
  return data;
}

export async function acceptLawyerMatch(orgId: string, matchId: string) {
  return request<Record<string, unknown>>(
    orgPath(orgId, `/online-lawyer/matches/${matchId}/accept`),
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export async function declineLawyerMatch(orgId: string, matchId: string) {
  return request<Record<string, unknown>>(
    orgPath(orgId, `/online-lawyer/matches/${matchId}/decline`),
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export async function fetchOnlineConsultations(
  orgId: string,
  query: { status?: string; limit?: number; offset?: number } = {},
) {
  const data = await request<{ items: OnlineConsultation[] }>(
    orgPath(orgId, `/online-consultations${qs(query)}`),
  );
  if (isApiFailure(data)) return data;
  return data;
}

export async function fetchOnlineConsultation(orgId: string, consultationId: string) {
  return request<{
    consultation: OnlineConsultation;
    videoProvider: ProviderHealth | null;
  }>(orgPath(orgId, `/online-consultations/${consultationId}`));
}

export async function createOnlineConsultationReview(
  orgId: string,
  consultationId: string,
  body: { rating: number; comment?: string },
) {
  return request<Record<string, unknown>>(
    orgPath(orgId, `/online-consultations/${consultationId}/review`),
    { method: "POST", body: JSON.stringify({ ...body, consultationId }) },
  );
}

export async function fetchLawyerAvailability(orgId: string, lawyerProfileId?: string) {
  const data = await request<{ items: LawyerAvailabilitySlot[] }>(
    orgPath(orgId, `/online-lawyer/availability${qs({ lawyerProfileId })}`),
  );
  if (isApiFailure(data)) return data;
  return {
    items: data.items ?? (data as unknown as { slots?: LawyerAvailabilitySlot[] }).slots ?? [],
  };
}

export async function createLawyerAvailabilitySlot(
  orgId: string,
  body: {
    lawyerProfileId: string;
    dayOfWeek?: number | null;
    startTime: string;
    endTime: string;
    timezone?: string;
    mode?: string;
    active?: boolean;
  },
) {
  return request<{ slot: LawyerAvailabilitySlot }>(orgPath(orgId, "/online-lawyer/availability"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deleteLawyerAvailabilitySlot(orgId: string, availabilityId: string) {
  const response = await fetch(orgPath(orgId, `/online-lawyer/availability/${availabilityId}`), {
    method: "DELETE",
    headers: { [CSRF_HEADER]: "1" },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as AiApiFailure;
    return body as AiApiFailure;
  }
  return { ok: true as const };
}
