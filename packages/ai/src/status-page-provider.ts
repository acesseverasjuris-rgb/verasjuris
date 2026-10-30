import { AppError } from "@verasjuris/types";

/**
 * Status page externa.
 * Default: not_configured — página interna /status usa dados locais.
 */

export type StatusPageProviderHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type StatusComponent = {
  key: string;
  name: string;
  status: "operational" | "degraded" | "partial_outage" | "major_outage" | "unknown";
};

export type StatusIncidentInput = {
  title: string;
  body: string;
  impact: "none" | "minor" | "major" | "critical";
  componentKeys?: readonly string[];
  signal?: AbortSignal;
};

export type StatusIncidentResult = {
  providerKey: string;
  status: "published" | "failed" | "not_configured";
  externalIncidentId: string | null;
  detail?: string;
};

export interface StatusPageProvider {
  readonly id: string;
  listComponents(signal?: AbortSignal): Promise<readonly StatusComponent[]>;
  publishIncident(input: StatusIncidentInput): Promise<StatusIncidentResult>;
  healthCheck(): Promise<StatusPageProviderHealth>;
}

const MESSAGE = "Nenhum provedor de status page está configurado.";

export class NotConfiguredStatusPageProvider implements StatusPageProvider {
  readonly id = "not_configured";

  listComponents(_signal?: AbortSignal): Promise<readonly StatusComponent[]> {
    return Promise.resolve([]);
  }

  publishIncident(_input: StatusIncidentInput): Promise<StatusIncidentResult> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      externalIncidentId: null,
      detail: MESSAGE,
    });
  }

  healthCheck(): Promise<StatusPageProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: MESSAGE,
      checkedAt: new Date().toISOString(),
    });
  }
}

export function statusPageProviderNotConfiguredError(): AppError {
  return new AppError("NOT_CONFIGURED", MESSAGE);
}
