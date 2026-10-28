import { AppError } from "@verasjuris/types";

/**
 * Provedor futuro de dados ambientais/licenciamento oficiais.
 * Default: not_configured.
 */

export type EnvironmentalDataHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type EnvironmentalLicenseRecord = {
  externalId: string;
  licenseType: string | null;
  processNumber: string | null;
  status: string | null;
  validUntil: string | null;
  provider: string;
};

export type EnvironmentalInfractionRecord = {
  externalId: string;
  infractionCode: string | null;
  issuedAt: string | null;
  status: string | null;
  provider: string;
};

export interface EnvironmentalDataProvider {
  readonly id: string;
  fetchLicense(
    externalId: string,
    signal?: AbortSignal,
  ): Promise<EnvironmentalLicenseRecord | null>;
  fetchLicenses(query: {
    facilityId?: string;
    signal?: AbortSignal;
  }): Promise<EnvironmentalLicenseRecord[]>;
  fetchInfraction(
    externalId: string,
    signal?: AbortSignal,
  ): Promise<EnvironmentalInfractionRecord | null>;
  healthCheck(): Promise<EnvironmentalDataHealth>;
}

const MESSAGE =
  "Nenhum provedor de dados ambientais está configurado. Nenhum dado oficial foi sincronizado.";

export class NotConfiguredEnvironmentalDataProvider implements EnvironmentalDataProvider {
  readonly id = "not_configured";

  fetchLicense(
    _externalId: string,
    _signal?: AbortSignal,
  ): Promise<EnvironmentalLicenseRecord | null> {
    return Promise.reject(new AppError("ENVIRONMENTAL_DATA_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  fetchLicenses(_query: {
    facilityId?: string;
    signal?: AbortSignal;
  }): Promise<EnvironmentalLicenseRecord[]> {
    return Promise.reject(new AppError("ENVIRONMENTAL_DATA_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  fetchInfraction(
    _externalId: string,
    _signal?: AbortSignal,
  ): Promise<EnvironmentalInfractionRecord | null> {
    return Promise.reject(new AppError("ENVIRONMENTAL_DATA_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  healthCheck(): Promise<EnvironmentalDataHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor de dados ambientais não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
