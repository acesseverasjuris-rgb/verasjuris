import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure } from "./ai";
import { aiErrorMessage, formatDateTime, hasPermission, isApiFailure, isNotConfigured } from "./ai";
import { getActiveMembership, getActiveOrgId } from "./crm";

export {
  getActiveMembership,
  getActiveOrgId,
  isApiFailure,
  aiErrorMessage,
  formatDateTime,
  isNotConfigured,
};

/**
 * Comunicação — /api/v1/organizations/:orgId/communication/…
 */

export type ProviderHealthStatus = "ok" | "degraded" | "unavailable" | "not_configured";

export type ChannelHealth = {
  status: ProviderHealthStatus;
  channel?: string;
  providerKey?: string;
  detail?: string;
  checkedAt?: string;
};

export type CommunicationProvidersStatus = {
  inApp: ChannelHealth;
  email: ChannelHealth;
  sms: ChannelHealth;
  whatsapp: ChannelHealth;
  push: ChannelHealth;
};

export type CommunicationTemplate = {
  id: string;
  channel: string;
  key: string;
  name: string;
  subjectTemplate?: string | null;
  bodyTemplate: string;
  category: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CommunicationTemplateVersion = {
  id: string;
  templateId: string;
  version: number;
  subjectTemplate?: string | null;
  bodyTemplate: string;
  locked: boolean;
  createdAt: string;
};

export type CommunicationMessage = {
  id: string;
  channel: string;
  category: string;
  status: string;
  recipientType: string;
  recipientId: string;
  subject?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommunicationPreference = {
  id: string;
  userId: string;
  channel: string;
  category: string;
  enabled: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  language: string;
};

export const COMMUNICATION_NOT_CONFIGURED_MESSAGE =
  "Canal de comunicação não configurado (NOT_CONFIGURED). A mensagem pode ficar em fila ou falhar — não simulamos entrega bem-sucedida.";

export const COMMUNICATION_CHANNEL_LABELS: Record<string, string> = {
  in_app: "No aplicativo",
  email: "E-mail",
  sms: "SMS",
  whatsapp: "WhatsApp",
  push: "Push",
};

export const COMMUNICATION_CATEGORY_LABELS: Record<string, string> = {
  transactional: "Transacional",
  case_update: "Atualização de caso",
  appointment: "Agendamento",
  document: "Documento",
  payment: "Pagamento",
  contract: "Contrato",
  marketing: "Marketing",
  security: "Segurança",
  system: "Sistema",
};

export const COMMUNICATION_MESSAGE_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  queued: "Na fila",
  sending: "Enviando",
  sent: "Enviada",
  delivered: "Entregue",
  failed: "Falhou",
  cancelled: "Cancelada",
  not_configured: "Não configurado",
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

export type CommunicationAction =
  | "read"
  | "send"
  | "manage_templates"
  | "manage_preferences"
  | "manage_consents"
  | "admin";

export function hasCommunicationPermission(
  permissions: readonly string[] | undefined,
  action: CommunicationAction,
): boolean {
  return hasPermission(permissions, `communication.${action}`);
}

export function communicationErrorMessage(failure: AiApiFailure, fallback: string): string {
  if (isNotConfigured(failure) || failure.error?.code === "NOT_CONFIGURED") {
    return COMMUNICATION_NOT_CONFIGURED_MESSAGE;
  }
  return aiErrorMessage(failure, fallback);
}

export function isChannelNotConfigured(health: ChannelHealth | undefined): boolean {
  return !health || health.status === "not_configured" || health.status === "unavailable";
}

export function anyOutboundChannelNotConfigured(status: CommunicationProvidersStatus): boolean {
  return (
    isChannelNotConfigured(status.email) ||
    isChannelNotConfigured(status.sms) ||
    isChannelNotConfigured(status.whatsapp) ||
    isChannelNotConfigured(status.push)
  );
}

export async function fetchCommunicationProvidersStatus(orgId: string) {
  return request<CommunicationProvidersStatus>(orgPath(orgId, "/communication/providers/status"));
}

export async function fetchCommunicationTemplates(
  orgId: string,
  query: { channel?: string; limit?: number; offset?: number } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/communication/templates${qs(query)}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? []) as CommunicationTemplate[];
  return { items, total: Number(data.total ?? items.length) };
}

export async function fetchCommunicationTemplate(orgId: string, templateId: string) {
  return request<{ template: CommunicationTemplate }>(
    orgPath(orgId, `/communication/templates/${templateId}`),
  );
}

export async function fetchCommunicationTemplateVersions(orgId: string, templateId: string) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/communication/templates/${templateId}/versions`),
  );
  if (isApiFailure(data)) return data;
  return { items: (data.items ?? data.versions ?? []) as CommunicationTemplateVersion[] };
}

export async function fetchCommunicationMessages(
  orgId: string,
  query: {
    channel?: string;
    category?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/communication/messages${qs(query)}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? []) as CommunicationMessage[];
  return { items, total: Number(data.total ?? items.length) };
}

export async function fetchCommunicationMessageHistory(orgId: string, messageId: string) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/communication/messages/${messageId}/history`),
  );
  if (isApiFailure(data)) return data;
  return { items: (data.items ?? data.history ?? []) as Array<Record<string, unknown>> };
}

export async function sendCommunicationMessage(
  orgId: string,
  body: {
    recipientType: string;
    recipientId: string;
    channel: string;
    category?: string;
    templateVersionId?: string;
    subject?: string;
    bodySnapshot?: string;
    variables?: Record<string, string>;
  },
) {
  return request<{ message: CommunicationMessage }>(orgPath(orgId, "/communication/messages"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function retryCommunicationMessage(orgId: string, messageId: string) {
  return request<{ message: CommunicationMessage }>(
    orgPath(orgId, `/communication/messages/${messageId}/retry`),
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function fetchCommunicationPreferences(
  orgId: string,
  query: { userId?: string } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/communication/preferences${qs(query)}`),
  );
  if (isApiFailure(data)) return data;
  return { items: (data.items ?? data.preferences ?? []) as CommunicationPreference[] };
}

export async function createCommunicationPreference(
  orgId: string,
  body: {
    userId: string;
    channel: string;
    category: string;
    enabled?: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    language?: string;
  },
) {
  return request<{ preference: CommunicationPreference }>(
    orgPath(orgId, "/communication/preferences"),
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function updateCommunicationPreference(
  orgId: string,
  preferenceId: string,
  body: Partial<{
    enabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
    language: string;
  }>,
) {
  return request<{ preference: CommunicationPreference }>(
    orgPath(orgId, `/communication/preferences/${preferenceId}`),
    { method: "PATCH", body: JSON.stringify(body) },
  );
}
