import { AppError } from "@verasjuris/types";

/**
 * ESocialProvider — futuro vínculo empregatício / remuneração / rescisão / eventos.
 * Default: not_configured.
 */

export type ESocialHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type ESocialEmploymentRecord = {
  externalId: string;
  employerName: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string | null;
};

export type ESocialRemunerationRecord = {
  externalId: string;
  competence: string | null;
  amountCents: number | null;
};

export type ESocialTerminationRecord = {
  externalId: string;
  terminationDate: string | null;
  reason: string | null;
};

export type ESocialEventRecord = {
  externalId: string;
  eventType: string;
  occurredAt: string | null;
  summary: string | null;
};

export interface ESocialProvider {
  readonly id: string;
  fetchEmploymentRelationships(query: {
    workerId?: string;
    signal?: AbortSignal;
  }): Promise<ESocialEmploymentRecord[]>;
  fetchRemuneration(
    employmentExternalId: string,
    signal?: AbortSignal,
  ): Promise<ESocialRemunerationRecord[]>;
  fetchTermination(
    employmentExternalId: string,
    signal?: AbortSignal,
  ): Promise<ESocialTerminationRecord | null>;
  fetchEvents(employmentExternalId: string, signal?: AbortSignal): Promise<ESocialEventRecord[]>;
  healthCheck(): Promise<ESocialHealth>;
}

const MESSAGE =
  "Nenhum provedor eSocial está configurado. Nenhum vínculo ou remuneração oficial foi sincronizado nem inventado.";

export class NotConfiguredESocialProvider implements ESocialProvider {
  readonly id = "not_configured";

  fetchEmploymentRelationships(_query: {
    workerId?: string;
    signal?: AbortSignal;
  }): Promise<ESocialEmploymentRecord[]> {
    return Promise.reject(new AppError("ESOCIAL_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  fetchRemuneration(
    _employmentExternalId: string,
    _signal?: AbortSignal,
  ): Promise<ESocialRemunerationRecord[]> {
    return Promise.reject(new AppError("ESOCIAL_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  fetchTermination(
    _employmentExternalId: string,
    _signal?: AbortSignal,
  ): Promise<ESocialTerminationRecord | null> {
    return Promise.reject(new AppError("ESOCIAL_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  fetchEvents(_employmentExternalId: string, _signal?: AbortSignal): Promise<ESocialEventRecord[]> {
    return Promise.reject(new AppError("ESOCIAL_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  healthCheck(): Promise<ESocialHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor eSocial não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
