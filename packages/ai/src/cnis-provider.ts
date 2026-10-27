import { AppError } from "@verasjuris/types";

/**
 * CNISProvider — API externa de CNIS (separado do parser/import local).
 * Default: not_configured.
 */

export type CNISHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type CNISEntryRecord = {
  externalId: string;
  competence: string | null;
  employerName: string | null;
  contributionCents: number | null;
  indicators: string[];
};

export type CNISFetchResult = {
  provider: string;
  retrievedAt: string;
  entries: CNISEntryRecord[];
};

export interface CNISProvider {
  readonly id: string;
  fetchCNIS(query: { nit?: string; signal?: AbortSignal }): Promise<CNISFetchResult>;
  healthCheck(): Promise<CNISHealth>;
}

const MESSAGE =
  "Nenhum provedor CNIS externo está configurado. Use importação/cadastro manual local; parsing local não é esta API.";

export class NotConfiguredCNISProvider implements CNISProvider {
  readonly id = "not_configured";

  fetchCNIS(_query: { nit?: string; signal?: AbortSignal }): Promise<CNISFetchResult> {
    return Promise.reject(new AppError("CNIS_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  healthCheck(): Promise<CNISHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor CNIS externo não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
