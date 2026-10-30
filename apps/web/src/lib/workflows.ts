import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure } from "./ai";
import { aiErrorMessage, formatDateTime, hasPermission, isApiFailure } from "./ai";
import { getActiveMembership, getActiveOrgId } from "./crm";

export { getActiveMembership, getActiveOrgId, isApiFailure, aiErrorMessage, formatDateTime };

export type WorkflowAction =
  | "read"
  | "create"
  | "update"
  | "publish"
  | "run"
  | "cancel"
  | "view_logs"
  | "admin";

const PERM: Record<WorkflowAction, string> = {
  read: "workflow.read",
  create: "workflow.create",
  update: "workflow.update",
  publish: "workflow.publish",
  run: "workflow.run",
  cancel: "workflow.cancel",
  view_logs: "workflow.view_logs",
  admin: "workflow.admin",
};

export function hasWorkflowPermission(permissions: string[], action: WorkflowAction): boolean {
  if (action !== "read" && hasPermission(permissions, PERM.admin)) return true;
  return hasPermission(permissions, PERM[action]);
}

export function canAccessWorkflowNav(permissions: string[]): boolean {
  return hasWorkflowPermission(permissions, "read");
}

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

export function workflowErrorMessage(failure: AiApiFailure): string {
  return aiErrorMessage(failure, "Falha em automações.");
}

export type WorkflowConditionNode = {
  operator: string;
  field?: string;
  value?: unknown;
  children?: WorkflowConditionNode[];
};

export type WorkflowActionConfig = {
  type: string;
  key?: string;
  params?: Record<string, unknown>;
  timeoutMs?: number;
  maxAttempts?: number;
  failurePolicy?: string;
  requiredPermission?: string;
};

export type WorkflowTriggerConfig = {
  type: string;
  eventName?: string;
  cron?: string;
  webhookKey?: string;
  thresholdMetricKey?: string;
  config?: Record<string, unknown>;
};

export type WorkflowDefinition = {
  id: string;
  organizationId?: string | null;
  key: string;
  name: string;
  description?: string | null;
  domain?: string | null;
  status: string;
  currentVersionId?: string | null;
  trigger?: WorkflowTriggerConfig | null;
  conditions?: WorkflowConditionNode | null;
  actions?: WorkflowActionConfig[];
  activeFrom?: string | null;
  activeUntil?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowVersion = {
  id: string;
  definitionId: string;
  version: number;
  immutable: boolean;
  publishedAt?: string | null;
  notes?: string | null;
  body?: Record<string, unknown> | null;
};

export type WorkflowRun = {
  id: string;
  definitionId: string;
  versionId?: string | null;
  status: string;
  triggerType?: string | null;
  dryRun?: boolean;
  startedAt?: string | null;
  completedAt?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  createdAt: string;
};

export type WorkflowStepRun = {
  id: string;
  runId: string;
  stepKey?: string | null;
  actionType?: string | null;
  status: string;
  attempt?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  errorMessage?: string | null;
};

export type WorkflowTemplate = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  domain?: string | null;
  body?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt?: string;
};

export type WorkflowLogEntry = {
  id: string;
  runId?: string | null;
  level?: string | null;
  message: string;
  createdAt: string;
};

export const WORKFLOW_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
  paused: "Pausado",
  archived: "Arquivado",
};

export const WORKFLOW_RUN_STATUS_LABELS: Record<string, string> = {
  queued: "Na fila",
  running: "Em execução",
  waiting: "Aguardando",
  completed: "Concluído",
  failed: "Falhou",
  cancelled: "Cancelado",
  timed_out: "Expirou",
  partially_completed: "Parcialmente concluído",
};

export const WORKFLOW_TRIGGER_LABELS: Record<string, string> = {
  domain_event: "Evento de domínio",
  schedule: "Agendamento",
  manual: "Manual",
  webhook: "Webhook",
  threshold: "Limiar",
  state_change: "Mudança de estado",
};

export const WORKFLOW_ACTION_TYPE_LABELS: Record<string, string> = {
  create_task: "Criar tarefa",
  create_notification: "Criar notificação",
  send_communication: "Enviar comunicação",
  request_approval: "Solicitar aprovação",
  create_deadline: "Criar prazo",
  update_allowed_field: "Atualizar campo permitido",
  create_document_request: "Solicitar documento",
  create_incident: "Abrir incidente",
  create_payable: "Criar conta a pagar",
  call_internal_service: "Chamar serviço interno",
  enqueue_job: "Enfileirar job",
  wait: "Aguardar",
  webhook_external: "Webhook externo",
};

export const WORKFLOW_BUILDER_PHASES = [
  { key: "when", label: "QUANDO (gatilho)" },
  { key: "if", label: "SE (condições)" },
  { key: "then_actions", label: "ENTÃO (ações)" },
  { key: "approval", label: "APROVAÇÃO" },
  { key: "on_failure", label: "EM FALHA" },
] as const;

export async function fetchWorkflowDefinitions(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: WorkflowDefinition[]; total?: number }>(
    orgPath(orgId, `/workflows${qs(query)}`),
  );
}

export async function fetchWorkflowDefinition(orgId: string, workflowId: string) {
  return request<{
    workflow: WorkflowDefinition;
    versions?: WorkflowVersion[];
  }>(orgPath(orgId, `/workflows/${workflowId}`));
}

export async function createWorkflowDefinition(orgId: string, body: Record<string, unknown>) {
  return request<{ workflow: WorkflowDefinition }>(orgPath(orgId, "/workflows"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateWorkflowDefinition(
  orgId: string,
  workflowId: string,
  body: Record<string, unknown>,
) {
  return request<{ workflow: WorkflowDefinition }>(orgPath(orgId, `/workflows/${workflowId}`), {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function publishWorkflowDefinition(
  orgId: string,
  workflowId: string,
  body: { notes?: string } = {},
) {
  return request<{ workflow: WorkflowDefinition; version: WorkflowVersion }>(
    orgPath(orgId, `/workflows/${workflowId}/publish`),
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function runWorkflow(
  orgId: string,
  workflowId: string,
  body: { dryRun?: boolean; payload?: Record<string, unknown>; idempotencyKey?: string } = {},
) {
  return request<{ run: WorkflowRun }>(orgPath(orgId, `/workflows/${workflowId}/runs`), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchWorkflowRuns(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: WorkflowRun[]; total?: number }>(
    orgPath(orgId, `/workflows/runs${qs(query)}`),
  );
}

export async function fetchWorkflowRun(orgId: string, runId: string) {
  return request<{ run: WorkflowRun; steps: WorkflowStepRun[] }>(
    orgPath(orgId, `/workflows/runs/${runId}`),
  );
}

export async function fetchWorkflowFailures(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: WorkflowRun[]; total?: number }>(
    orgPath(orgId, `/workflows/failures${qs(query)}`),
  );
}

export async function fetchWorkflowLogs(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: WorkflowLogEntry[]; total?: number }>(
    orgPath(orgId, `/workflows/logs${qs(query)}`),
  );
}

export async function fetchWorkflowTemplates(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: WorkflowTemplate[]; total?: number }>(
    orgPath(orgId, `/workflows/templates${qs(query)}`),
  );
}
