import { AppError } from "@verasjuris/types";

/**
 * Órgãos administrativos (consulta/protocolo quando suportado).
 * Default: not_configured — nunca inventa protocolo ou decisão.
 */

export type AdministrativeAgencyHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type AdministrativeAgencyCapability =
  | "search"
  | "processStatus"
  | "requirements"
  | "decisions"
  | "documents"
  | "protocol";

export type AgencySearchInput = {
  organizationId?: string;
  agency?: string;
  query: string;
  signal?: AbortSignal;
};

export type AgencyProcessRecord = {
  externalId: string;
  protocolNumber: string | null;
  agency: string | null;
  status: string | null;
  providerKey: string;
};

export type AgencyRequirementRecord = {
  externalId: string;
  description: string;
  dueAt: string | null;
  status: string | null;
};

export type AgencyDecisionRecord = {
  externalId: string;
  decidedAt: string | null;
  summary: string | null;
  outcome: string | null;
};

export type AgencyDocumentRecord = {
  externalId: string;
  title: string | null;
  mimeType: string | null;
};

export type AgencyProtocolInput = {
  organizationId?: string;
  agency: string;
  documentReferences: readonly string[];
  metadata?: Record<string, string>;
  signal?: AbortSignal;
};

export type AgencyProtocolResult = {
  providerKey: string;
  status: "accepted" | "queued" | "rejected" | "failed" | "not_configured";
  externalProtocolId: string | null;
  detail?: string;
};

export interface AdministrativeAgencyProvider {
  readonly id: string;
  readonly capabilities: readonly AdministrativeAgencyCapability[];
  search(input: AgencySearchInput): Promise<readonly AgencyProcessRecord[]>;
  getProcessStatus(externalId: string, signal?: AbortSignal): Promise<AgencyProcessRecord | null>;
  getRequirements(
    processExternalId: string,
    signal?: AbortSignal,
  ): Promise<readonly AgencyRequirementRecord[]>;
  getDecisions(
    processExternalId: string,
    signal?: AbortSignal,
  ): Promise<readonly AgencyDecisionRecord[]>;
  getDocuments(
    processExternalId: string,
    signal?: AbortSignal,
  ): Promise<readonly AgencyDocumentRecord[]>;
  protocol?(input: AgencyProtocolInput): Promise<AgencyProtocolResult>;
  healthCheck(): Promise<AdministrativeAgencyHealth>;
}

const MESSAGE =
  "Nenhum provedor de órgão administrativo está configurado. Sem protocolo simulado e sem dados inventados.";

export class NotConfiguredAdministrativeAgencyProvider implements AdministrativeAgencyProvider {
  readonly id = "not_configured";
  readonly capabilities: readonly AdministrativeAgencyCapability[] = [];

  search(_input: AgencySearchInput): Promise<readonly AgencyProcessRecord[]> {
    return Promise.resolve([]);
  }

  getProcessStatus(
    _externalId: string,
    _signal?: AbortSignal,
  ): Promise<AgencyProcessRecord | null> {
    return Promise.resolve(null);
  }

  getRequirements(
    _processExternalId: string,
    _signal?: AbortSignal,
  ): Promise<readonly AgencyRequirementRecord[]> {
    return Promise.resolve([]);
  }

  getDecisions(
    _processExternalId: string,
    _signal?: AbortSignal,
  ): Promise<readonly AgencyDecisionRecord[]> {
    return Promise.resolve([]);
  }

  getDocuments(
    _processExternalId: string,
    _signal?: AbortSignal,
  ): Promise<readonly AgencyDocumentRecord[]> {
    return Promise.resolve([]);
  }

  protocol(_input: AgencyProtocolInput): Promise<AgencyProtocolResult> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      externalProtocolId: null,
      detail: MESSAGE,
    });
  }

  healthCheck(): Promise<AdministrativeAgencyHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: MESSAGE,
      checkedAt: new Date().toISOString(),
    });
  }
}

export function administrativeAgencyProviderNotConfiguredError(): AppError {
  return new AppError("NOT_CONFIGURED", MESSAGE);
}
