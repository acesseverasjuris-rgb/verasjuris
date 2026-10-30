import { AppError } from "@verasjuris/types";

/**
 * Integração com tribunais (consulta/peticionamento quando suportado).
 * Default: not_configured — nunca finge peticionamento ou inventa processo.
 */

export type CourtIntegrationHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type CourtIntegrationCapability =
  | "searchProcess"
  | "getProcess"
  | "getMovements"
  | "getHearings"
  | "getDecisions"
  | "getDocuments"
  | "submitFiling"
  | "filingStatus";

export type CourtProcessSearchInput = {
  organizationId?: string;
  query: string;
  tribunal?: string;
  signal?: AbortSignal;
};

export type CourtProcessRecord = {
  externalId: string;
  caseNumber: string | null;
  tribunal: string | null;
  status: string | null;
  providerKey: string;
};

export type CourtMovementRecord = {
  externalId: string;
  occurredAt: string | null;
  summary: string;
};

export type CourtHearingRecord = {
  externalId: string;
  scheduledAt: string | null;
  hearingType: string | null;
  location: string | null;
};

export type CourtDecisionRecord = {
  externalId: string;
  decidedAt: string | null;
  summary: string | null;
  outcome: string | null;
};

export type CourtDocumentRecord = {
  externalId: string;
  title: string | null;
  mimeType: string | null;
  fetchedAt: string | null;
};

export type CourtFilingInput = {
  organizationId?: string;
  tribunal: string;
  caseNumber?: string;
  documentReferences: readonly string[];
  metadata?: Record<string, string>;
  signal?: AbortSignal;
};

export type CourtFilingResult = {
  providerKey: string;
  status: "accepted" | "queued" | "rejected" | "failed" | "not_configured";
  externalFilingId: string | null;
  detail?: string;
};

export interface CourtIntegrationProvider {
  readonly id: string;
  readonly capabilities: readonly CourtIntegrationCapability[];
  searchProcess(input: CourtProcessSearchInput): Promise<readonly CourtProcessRecord[]>;
  getProcess(externalId: string, signal?: AbortSignal): Promise<CourtProcessRecord | null>;
  getMovements(
    processExternalId: string,
    signal?: AbortSignal,
  ): Promise<readonly CourtMovementRecord[]>;
  getHearings(
    processExternalId: string,
    signal?: AbortSignal,
  ): Promise<readonly CourtHearingRecord[]>;
  getDecisions(
    processExternalId: string,
    signal?: AbortSignal,
  ): Promise<readonly CourtDecisionRecord[]>;
  getDocuments(
    processExternalId: string,
    signal?: AbortSignal,
  ): Promise<readonly CourtDocumentRecord[]>;
  submitFiling?(input: CourtFilingInput): Promise<CourtFilingResult>;
  filingStatus?(externalFilingId: string, signal?: AbortSignal): Promise<CourtFilingResult>;
  healthCheck(): Promise<CourtIntegrationHealth>;
}

const MESSAGE =
  "Nenhum provedor de integração com tribunais está configurado. Sem scraping e sem peticionamento simulado.";

export class NotConfiguredCourtIntegrationProvider implements CourtIntegrationProvider {
  readonly id = "not_configured";
  readonly capabilities: readonly CourtIntegrationCapability[] = [];

  searchProcess(_input: CourtProcessSearchInput): Promise<readonly CourtProcessRecord[]> {
    return Promise.resolve([]);
  }

  getProcess(_externalId: string, _signal?: AbortSignal): Promise<CourtProcessRecord | null> {
    return Promise.resolve(null);
  }

  getMovements(
    _processExternalId: string,
    _signal?: AbortSignal,
  ): Promise<readonly CourtMovementRecord[]> {
    return Promise.resolve([]);
  }

  getHearings(
    _processExternalId: string,
    _signal?: AbortSignal,
  ): Promise<readonly CourtHearingRecord[]> {
    return Promise.resolve([]);
  }

  getDecisions(
    _processExternalId: string,
    _signal?: AbortSignal,
  ): Promise<readonly CourtDecisionRecord[]> {
    return Promise.resolve([]);
  }

  getDocuments(
    _processExternalId: string,
    _signal?: AbortSignal,
  ): Promise<readonly CourtDocumentRecord[]> {
    return Promise.resolve([]);
  }

  submitFiling(_input: CourtFilingInput): Promise<CourtFilingResult> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      externalFilingId: null,
      detail: MESSAGE,
    });
  }

  filingStatus(_externalFilingId: string, _signal?: AbortSignal): Promise<CourtFilingResult> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      externalFilingId: null,
      detail: MESSAGE,
    });
  }

  healthCheck(): Promise<CourtIntegrationHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: MESSAGE,
      checkedAt: new Date().toISOString(),
    });
  }
}

export function courtIntegrationProviderNotConfiguredError(): AppError {
  return new AppError("NOT_CONFIGURED", MESSAGE);
}
