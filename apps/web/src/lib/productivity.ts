import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { ApiFailure } from "./types";
import { getActiveMembership, getActiveOrgId, isApiFailure, apiErrorMessage } from "./crm";

export { getActiveMembership, getActiveOrgId, isApiFailure, apiErrorMessage };

async function api<T>(path: string, init?: RequestInit): Promise<T | ApiFailure> {
  const response = await fetch(path, {
    ...init,
    headers: {
      [CSRF_HEADER]: "1",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as T & ApiFailure;
  if (!response.ok) {
    return {
      error: {
        code: (body as ApiFailure).error?.code ?? "INTERNAL_ERROR",
        message: (body as ApiFailure).error?.message ?? "Falha na requisição.",
        details: (body as ApiFailure).error?.details,
      },
    };
  }
  return body;
}

export type TaskStatus =
  | "todo"
  | "in_progress"
  | "waiting"
  | "blocked"
  | "done"
  | "cancelled"
  | "archived";

export type TaskSummary = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: string;
  dueAt: string | null;
  responsibleMembershipId: string | null;
  updatedAt: string;
};

export type CalendarEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  eventType: string;
  timezone: string;
  externalSync?: string;
};

export type DeadlineSummary = {
  id: string;
  title: string;
  status: string;
  calculatedDueAt: string | null;
  confirmedDueAt: string | null;
  timezone: string;
  microcopy?: string;
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "A fazer",
  in_progress: "Em andamento",
  waiting: "Aguardando",
  blocked: "Bloqueada",
  done: "Concluída",
  cancelled: "Cancelada",
  archived: "Arquivada",
};

export function hasPermission(permissions: string[] | undefined, key: string): boolean {
  return Boolean(permissions?.includes(key));
}

export async function fetchTasks(
  orgId: string,
  query: { status?: string; q?: string; limit?: number; offset?: number } = {},
) {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.q) params.set("q", query.q);
  if (query.limit) params.set("limit", String(query.limit));
  if (query.offset) params.set("offset", String(query.offset));
  return api<{ tasks: TaskSummary[]; total: number }>(
    `/api/v1/organizations/${orgId}/tasks?${params}`,
  );
}

export async function fetchTask(orgId: string, taskId: string) {
  return api<{
    task: TaskSummary & { description: string | null };
    comments: Array<{ id: string; body: string; createdAt: string }>;
    checklist: Array<{ id: string; title: string; completed: boolean }>;
    dependencies: Array<{ id: string; dependsOnTaskId: string }>;
    sla: { status: string; note: string } | null;
  }>(`/api/v1/organizations/${orgId}/tasks/${taskId}`);
}

export async function createTask(
  orgId: string,
  body: { title: string; description?: string; priority?: string; dueAt?: string },
) {
  return api<{ task: TaskSummary }>(`/api/v1/organizations/${orgId}/tasks`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateTaskStatus(orgId: string, taskId: string, status: TaskStatus) {
  return api<{ task: TaskSummary }>(`/api/v1/organizations/${orgId}/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function addTaskComment(orgId: string, taskId: string, body: string) {
  return api<{ comment: { id: string; body: string } }>(
    `/api/v1/organizations/${orgId}/tasks/${taskId}/comments`,
    { method: "POST", body: JSON.stringify({ body }) },
  );
}

export async function fetchCalendarEvents(
  orgId: string,
  query: { from?: string; to?: string; limit?: number } = {},
) {
  const params = new URLSearchParams();
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.limit) params.set("limit", String(query.limit));
  return api<{ events: CalendarEvent[]; total: number; externalSync: string }>(
    `/api/v1/organizations/${orgId}/calendar/events?${params}`,
  );
}

export async function createCalendarEvent(
  orgId: string,
  body: { title: string; startsAt: string; endsAt: string; timezone?: string },
) {
  return api<{ event: CalendarEvent; conflictWarning: string | null }>(
    `/api/v1/organizations/${orgId}/calendar/events`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function fetchDeadlines(
  orgId: string,
  query: { status?: string; q?: string; limit?: number; offset?: number } = {},
) {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.q) params.set("q", query.q);
  if (query.limit) params.set("limit", String(query.limit));
  if (query.offset) params.set("offset", String(query.offset));
  return api<{ deadlines: DeadlineSummary[]; total: number; holidayCalendar: string }>(
    `/api/v1/organizations/${orgId}/deadlines?${params}`,
  );
}

export async function fetchDeadline(orgId: string, deadlineId: string) {
  return api<{
    deadline: DeadlineSummary & { description: string | null; ruleType: string };
    history: Array<{ id: string; title: string; eventAt: string; reason: string | null }>;
  }>(`/api/v1/organizations/${orgId}/deadlines/${deadlineId}`);
}

export async function createDeadline(
  orgId: string,
  body: {
    title: string;
    baseDate: string;
    ruleType?: string;
    ruleDays?: number;
    timezone?: string;
    calculate?: boolean;
  },
) {
  return api<{ deadline: DeadlineSummary }>(`/api/v1/organizations/${orgId}/deadlines`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function confirmDeadline(orgId: string, deadlineId: string) {
  return api<{ deadline: DeadlineSummary }>(
    `/api/v1/organizations/${orgId}/deadlines/${deadlineId}/confirm`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function fetchMatterDossier(orgId: string, matterId: string) {
  return api<{
    dossier: {
      documents: Array<{
        id: string;
        title: string;
        documentKind: string;
        legalContext: string;
        evidentiaryRole: string;
        status: string;
      }>;
      total: number;
      note: string;
    };
  }>(`/api/v1/organizations/${orgId}/matters/${matterId}/dossier`);
}

export async function fetchClientDossier(orgId: string, clientId: string) {
  return api<{
    dossier: {
      documents: Array<{ id: string; title: string; documentKind: string; status: string }>;
      total: number;
      note: string;
    };
  }>(`/api/v1/organizations/${orgId}/crm/clients/${clientId}/dossier`);
}

export async function fetchProductivityOverview(orgId: string) {
  const [tasks, calendar, deadlines] = await Promise.all([
    api<{ total: number; byStatus: Record<string, number> }>(
      `/api/v1/organizations/${orgId}/tasks/overview`,
    ),
    api<{ upcomingWeek: number; externalSync: string }>(
      `/api/v1/organizations/${orgId}/calendar/overview`,
    ),
    api<{
      total: number;
      suggested: number;
      confirmed: number;
      holidayCalendar: string;
    }>(`/api/v1/organizations/${orgId}/deadlines/overview`),
  ]);
  return { tasks, calendar, deadlines };
}
