import { AppError } from "@verasjuris/types";

/**
 * SIEM / security event forwarding.
 * Default: not_configured — não envia eventos para destino externo.
 */

export type SIEMProviderHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type SIEMEventInput = {
  eventType: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  occurredAt: string;
  organizationId?: string;
  userId?: string;
  payload: Record<string, unknown>;
  signal?: AbortSignal;
};

export type SIEMIngestResult = {
  providerKey: string;
  status: "accepted" | "rejected" | "not_configured";
  externalEventId: string | null;
  detail?: string;
};

export interface SIEMProvider {
  readonly id: string;
  ingest(input: SIEMEventInput): Promise<SIEMIngestResult>;
  healthCheck(): Promise<SIEMProviderHealth>;
}

const MESSAGE = "Nenhum provedor SIEM está configurado.";

export class NotConfiguredSIEMProvider implements SIEMProvider {
  readonly id = "not_configured";

  ingest(_input: SIEMEventInput): Promise<SIEMIngestResult> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      externalEventId: null,
      detail: MESSAGE,
    });
  }

  healthCheck(): Promise<SIEMProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: MESSAGE,
      checkedAt: new Date().toISOString(),
    });
  }
}

export function siemProviderNotConfiguredError(): AppError {
  return new AppError("NOT_CONFIGURED", MESSAGE);
}
