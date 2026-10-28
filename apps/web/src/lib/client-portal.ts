import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure } from "./ai";
import { aiErrorMessage, formatDateTime, isApiFailure } from "./ai";
import { getActiveOrgId } from "./crm";

export { getActiveOrgId, isApiFailure, aiErrorMessage, formatDateTime };

/**
 * Portal do Cliente — /api/v1/organizations/:orgId/portal/…
 */

export type ClientPortalContext = {
  userId: string;
  clientId: string;
  organizationId: string;
  organizationClientUserId: string;
};

export type PortalDashboard = {
  caseCount: number;
  openRequests: number;
  openDocumentRequests: number;
  openThreads: number;
  pendingPayments: number;
};

export type PortalMatterSummary = {
  id: string;
  title: string;
  internalReference?: string | null;
  summary?: string | null;
  status: string;
  priority?: string | null;
  openedAt?: string | null;
  closedAt?: string | null;
  updatedAt?: string | null;
};

export type PortalDocument = {
  id: string;
  title: string;
  status: string;
  documentKind?: string | null;
  updatedAt?: string | null;
  versionLabel?: string | null;
};

export type PortalThread = {
  id: string;
  subject: string;
  status: string;
  legalMatterId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type PortalMessage = {
  id: string;
  body: string;
  senderType: string;
  createdAt?: string | null;
};

export type PortalContract = {
  id: string;
  title: string;
  status: string;
  contractType: string;
  effectiveDate?: string | null;
  expirationDate?: string | null;
  legalMatterId?: string | null;
  updatedAt?: string | null;
};

export type PortalPayment = {
  id: string;
  description: string;
  amountCents: number;
  dueAt?: string | null;
  paidAt?: string | null;
  status: string;
  paymentMethod?: string | null;
  legalMatterId?: string | null;
  contractId?: string | null;
  createdAt?: string | null;
};

export type PortalClientRequest = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  legalMatterId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type PortalNotification = {
  id: string;
  title: string;
  body?: string | null;
  readAt?: string | null;
  createdAt?: string | null;
};

export type PortalCalendarEvent = {
  id: string;
  title: string;
  startsAt?: string | null;
  endsAt?: string | null;
  locationText?: string | null;
  legalMatterId?: string | null;
};

export const PORTAL_ACCESS_DENIED_MESSAGE =
  "Você não está vinculado como cliente desta organização. Peça ao escritório para liberar o acesso ao portal.";

export const PORTAL_MATTER_STATUS_LABELS: Record<string, string> = {
  open: "Em andamento",
  on_hold: "Em espera",
  closed: "Encerrado",
  archived: "Arquivado",
};

export const PORTAL_THREAD_STATUS_LABELS: Record<string, string> = {
  open: "Aberta",
  waiting_client: "Aguardando você",
  waiting_staff: "Aguardando escritório",
  closed: "Encerrada",
};

export const PORTAL_REQUEST_STATUS_LABELS: Record<string, string> = {
  open: "Aberta",
  in_review: "Em análise",
  assigned: "Atribuída",
  waiting_client: "Aguardando você",
  resolved: "Resolvida",
  cancelled: "Cancelada",
};

async function request<T>(path: string, init?: RequestInit): Promise<T | AiApiFailure> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        [CSRF_HEADER]: "1",
        ...(init?.body && !(init.body instanceof FormData)
          ? { "content-type": "application/json" }
          : {}),
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

function orgPortalPath(orgId: string, suffix: string): string {
  return `/api/v1/organizations/${orgId}/portal${suffix}`;
}

function qs(query: Record<string, string | number | boolean | undefined | null>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function portalErrorMessage(failure: AiApiFailure, fallback: string): string {
  const code = failure.error?.code ?? "";
  if (code === "NOT_FOUND" || failure.httpStatus === 404) {
    return PORTAL_ACCESS_DENIED_MESSAGE;
  }
  return aiErrorMessage(failure, fallback);
}

export function isPortalAccessDenied(failure: AiApiFailure): boolean {
  return failure.httpStatus === 404 || failure.error?.code === "NOT_FOUND";
}

export async function fetchPortalMe(orgId: string) {
  return request<{
    context: ClientPortalContext;
    dashboard: PortalDashboard;
  }>(orgPortalPath(orgId, "/me"));
}

export async function fetchPortalCases(
  orgId: string,
  query: { limit?: number; offset?: number } = {},
) {
  const data = await request<{
    cases: PortalMatterSummary[];
    total: number;
  }>(orgPortalPath(orgId, `/cases${qs(query)}`));
  if (isApiFailure(data)) return data;
  return data;
}

export async function fetchPortalCase(orgId: string, matterId: string) {
  return request<{
    case: PortalMatterSummary;
    timeline: Array<{
      id: string;
      eventType?: string;
      title?: string;
      body?: string | null;
      occurredAt?: string | null;
    }>;
  }>(orgPortalPath(orgId, `/cases/${matterId}`));
}

export async function fetchPortalCaseProcesses(orgId: string, matterId: string) {
  return request<{
    judicial: Array<Record<string, unknown>>;
    administrative: Array<Record<string, unknown>>;
  }>(orgPortalPath(orgId, `/cases/${matterId}/processes`));
}

export async function fetchPortalDocuments(
  orgId: string,
  query: { limit?: number; offset?: number; legalMatterId?: string } = {},
) {
  const data = await request<{ documents: PortalDocument[] }>(
    orgPortalPath(orgId, `/documents${qs(query)}`),
  );
  if (isApiFailure(data)) return data;
  return data;
}

export async function fetchPortalThreads(
  orgId: string,
  query: { limit?: number; offset?: number } = {},
) {
  const data = await request<{ threads: PortalThread[] }>(
    orgPortalPath(orgId, `/threads${qs(query)}`),
  );
  if (isApiFailure(data)) return data;
  return data;
}

export async function createPortalThread(
  orgId: string,
  body: { subject: string; legalMatterId?: string },
) {
  return request<{ thread: PortalThread }>(orgPortalPath(orgId, "/threads"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchPortalMessages(
  orgId: string,
  threadId: string,
  query: { limit?: number; offset?: number } = {},
) {
  const data = await request<{ messages: PortalMessage[] }>(
    orgPortalPath(orgId, `/threads/${threadId}/messages${qs(query)}`),
  );
  if (isApiFailure(data)) return data;
  return data;
}

export async function sendPortalMessage(orgId: string, threadId: string, body: string) {
  return request<{ message: PortalMessage }>(
    orgPortalPath(orgId, `/threads/${threadId}/messages`),
    {
      method: "POST",
      body: JSON.stringify({ body }),
    },
  );
}

export async function fetchPortalContracts(
  orgId: string,
  query: { limit?: number; offset?: number } = {},
) {
  const data = await request<{ contracts: PortalContract[] }>(
    orgPortalPath(orgId, `/contracts${qs(query)}`),
  );
  if (isApiFailure(data)) return data;
  return data;
}

export async function fetchPortalPayments(
  orgId: string,
  query: { limit?: number; offset?: number } = {},
) {
  const data = await request<{ payments: PortalPayment[] }>(
    orgPortalPath(orgId, `/payments${qs(query)}`),
  );
  if (isApiFailure(data)) return data;
  return data;
}

export async function fetchPortalRequests(
  orgId: string,
  query: { limit?: number; offset?: number } = {},
) {
  const data = await request<{ requests: PortalClientRequest[] }>(
    orgPortalPath(orgId, `/requests${qs(query)}`),
  );
  if (isApiFailure(data)) return data;
  return data;
}

export async function createPortalRequest(
  orgId: string,
  body: { title: string; description?: string; legalMatterId?: string },
) {
  return request<{ request: PortalClientRequest }>(orgPortalPath(orgId, "/requests"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchPortalCalendar(
  orgId: string,
  query: { from?: string; to?: string; limit?: number; offset?: number } = {},
) {
  const data = await request<{ events: PortalCalendarEvent[] }>(
    orgPortalPath(orgId, `/calendar${qs(query)}`),
  );
  if (isApiFailure(data)) return data;
  return data;
}

export async function fetchPortalNotifications(
  orgId: string,
  query: { limit?: number; offset?: number } = {},
) {
  const data = await request<{ notifications: PortalNotification[] }>(
    orgPortalPath(orgId, `/notifications${qs(query)}`),
  );
  if (isApiFailure(data)) return data;
  return data;
}
