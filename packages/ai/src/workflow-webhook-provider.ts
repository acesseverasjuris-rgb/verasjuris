import { AppError } from "@verasjuris/types";

/**
 * Webhook externo para ações de workflow (WEBHOOK_EXTERNAL).
 *
 * SSRF — implementações reais DEVEM:
 * - allowlist de hosts / CIDR (nunca user-controlled raw URL sem gate);
 * - restringir scheme a https (http só em allowlist explícita de dev);
 * - validar DNS/IP (bloquear loopback, link-local, metadata cloud);
 * - timeout curto e limite de tamanho de resposta;
 * - nunca seguir redirects para hosts fora da allowlist;
 * - secrets por referência — nunca embutidos no JSON do workflow.
 *
 * Default: not_configured — não dispara HTTP.
 */

export type WorkflowWebhookHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type WorkflowWebhookDeliveryStatus =
  | "accepted"
  | "delivered"
  | "failed"
  | "blocked"
  | "not_configured";

export type WorkflowWebhookDispatchInput = {
  organizationId?: string;
  workflowRunId?: string;
  actionKey?: string;
  /** URL candidata — provider real aplica allowlist/scheme/DNS antes de fetch. */
  url: string;
  method?: "POST" | "PUT" | "PATCH";
  headers?: Record<string, string>;
  body?: unknown;
  /** Timeout em ms (provider real deve imponer teto). */
  timeoutMs?: number;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export type WorkflowWebhookDispatchResult = {
  providerKey: string;
  status: WorkflowWebhookDeliveryStatus;
  httpStatus?: number | null;
  responseSnippet?: string | null;
  blockedReason?: string | null;
  detail?: string;
};

export interface WorkflowWebhookProvider {
  readonly id: string;
  dispatch(input: WorkflowWebhookDispatchInput): Promise<WorkflowWebhookDispatchResult>;
  healthCheck(): Promise<WorkflowWebhookHealth>;
}

const MESSAGE =
  "Nenhum provedor de webhook externo para workflows está configurado. Ações WEBHOOK_EXTERNAL permanecem indisponíveis.";

export class NotConfiguredWorkflowWebhookProvider implements WorkflowWebhookProvider {
  readonly id = "not_configured";

  dispatch(_input: WorkflowWebhookDispatchInput): Promise<WorkflowWebhookDispatchResult> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      httpStatus: null,
      responseSnippet: null,
      blockedReason: null,
      detail: MESSAGE,
    });
  }

  healthCheck(): Promise<WorkflowWebhookHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: MESSAGE,
      checkedAt: new Date().toISOString(),
    });
  }
}

export function workflowWebhookProviderNotConfiguredError(): AppError {
  return new AppError("NOT_CONFIGURED", MESSAGE);
}
