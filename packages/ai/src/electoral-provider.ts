import { AppError } from "@verasjuris/types";

/**
 * Provedor futuro de dados eleitorais oficiais (TSE / APIs).
 * Default: not_configured.
 */

export type ElectoralDataHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type ElectoralRegistrationRecord = {
  externalId: string;
  voterId: string | null;
  zone: string | null;
  section: string | null;
  status: string | null;
  provider: string;
};

export type ElectoralCandidateRecord = {
  externalId: string;
  office: string | null;
  electionYear: number | null;
  ballotNumber: string | null;
  status: string | null;
  provider: string;
};

export interface ElectoralDataProvider {
  readonly id: string;
  fetchRegistration(query: {
    voterId?: string;
    signal?: AbortSignal;
  }): Promise<ElectoralRegistrationRecord | null>;
  fetchCandidate(
    externalId: string,
    signal?: AbortSignal,
  ): Promise<ElectoralCandidateRecord | null>;
  healthCheck(): Promise<ElectoralDataHealth>;
}

const MESSAGE =
  "Nenhum provedor de dados eleitorais está configurado. Nenhum dado oficial foi sincronizado.";

export class NotConfiguredElectoralDataProvider implements ElectoralDataProvider {
  readonly id = "not_configured";

  fetchRegistration(_query: {
    voterId?: string;
    signal?: AbortSignal;
  }): Promise<ElectoralRegistrationRecord | null> {
    return Promise.reject(new AppError("ELECTORAL_DATA_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  fetchCandidate(
    _externalId: string,
    _signal?: AbortSignal,
  ): Promise<ElectoralCandidateRecord | null> {
    return Promise.reject(new AppError("ELECTORAL_DATA_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  healthCheck(): Promise<ElectoralDataHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor de dados eleitorais não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
