import { AppError } from "@verasjuris/types";

/**
 * LaborCourtProvider — futuro processo/movimentações/audiências/decisões.
 * Sem scraping. Default: not_configured.
 */

export type LaborCourtHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type LaborCourtProcessRecord = {
  externalId: string;
  caseNumber: string | null;
  court: string | null;
  status: string | null;
  provider: string;
};

export type LaborCourtMovementRecord = {
  externalId: string;
  occurredAt: string | null;
  summary: string;
};

export type LaborCourtHearingRecord = {
  externalId: string;
  scheduledAt: string | null;
  hearingType: string | null;
  location: string | null;
};

export type LaborCourtDecisionRecord = {
  externalId: string;
  decidedAt: string | null;
  summary: string | null;
  outcome: string | null;
};

export interface LaborCourtProvider {
  readonly id: string;
  fetchProcess(externalId: string, signal?: AbortSignal): Promise<LaborCourtProcessRecord | null>;
  fetchMovements(
    processExternalId: string,
    signal?: AbortSignal,
  ): Promise<LaborCourtMovementRecord[]>;
  fetchHearings(
    processExternalId: string,
    signal?: AbortSignal,
  ): Promise<LaborCourtHearingRecord[]>;
  fetchDecisions(
    processExternalId: string,
    signal?: AbortSignal,
  ): Promise<LaborCourtDecisionRecord[]>;
  healthCheck(): Promise<LaborCourtHealth>;
}

const MESSAGE =
  "Nenhum provedor de tribunal trabalhista está configurado. Sem scraping e sem dados inventados.";

export class NotConfiguredLaborCourtProvider implements LaborCourtProvider {
  readonly id = "not_configured";

  fetchProcess(
    _externalId: string,
    _signal?: AbortSignal,
  ): Promise<LaborCourtProcessRecord | null> {
    return Promise.reject(new AppError("LABOR_COURT_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  fetchMovements(
    _processExternalId: string,
    _signal?: AbortSignal,
  ): Promise<LaborCourtMovementRecord[]> {
    return Promise.reject(new AppError("LABOR_COURT_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  fetchHearings(
    _processExternalId: string,
    _signal?: AbortSignal,
  ): Promise<LaborCourtHearingRecord[]> {
    return Promise.reject(new AppError("LABOR_COURT_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  fetchDecisions(
    _processExternalId: string,
    _signal?: AbortSignal,
  ): Promise<LaborCourtDecisionRecord[]> {
    return Promise.reject(new AppError("LABOR_COURT_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  healthCheck(): Promise<LaborCourtHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor de tribunal trabalhista não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
