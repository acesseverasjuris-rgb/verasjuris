import { AppError } from "@verasjuris/types";

/**
 * BI externo (Power BI / Looker / Tableau / Metabase).
 * Default: not_configured — nunca finge dataset sincronizado ou embed real.
 */

export type BIProviderHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type BIPushDatasetInput = {
  organizationId?: string;
  datasetKey: string;
  rows: readonly Record<string, unknown>[];
  replace?: boolean;
  signal?: AbortSignal;
};

export type BIPushDatasetResult = {
  providerKey: string;
  status: "pushed" | "accepted" | "failed" | "not_configured";
  externalDatasetId: string | null;
  rowCount: number;
  detail?: string;
};

export type BIRefreshInput = {
  organizationId?: string;
  datasetKey: string;
  signal?: AbortSignal;
};

export type BIRefreshResult = {
  providerKey: string;
  status: "started" | "completed" | "failed" | "not_configured";
  externalJobId: string | null;
  detail?: string;
};

export type BIEmbedConfigInput = {
  organizationId?: string;
  dashboardKey: string;
  signal?: AbortSignal;
};

export type BIEmbedConfigResult = {
  providerKey: string;
  status: "ok" | "unavailable" | "not_configured";
  embedUrl: string | null;
  token: string | null;
  expiresAt?: string | null;
  detail?: string;
};

export interface BIProvider {
  readonly id: string;
  pushDataset(input: BIPushDatasetInput): Promise<BIPushDatasetResult>;
  refresh(input: BIRefreshInput): Promise<BIRefreshResult>;
  getEmbedConfig(input: BIEmbedConfigInput): Promise<BIEmbedConfigResult>;
  healthCheck(): Promise<BIProviderHealth>;
}

const MESSAGE =
  "Nenhum provedor de BI externo está configurado. Dashboards internos usam AnalyticsService local.";

export class NotConfiguredBIProvider implements BIProvider {
  readonly id = "not_configured";

  pushDataset(input: BIPushDatasetInput): Promise<BIPushDatasetResult> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      externalDatasetId: null,
      rowCount: input.rows.length,
      detail: MESSAGE,
    });
  }

  refresh(_input: BIRefreshInput): Promise<BIRefreshResult> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      externalJobId: null,
      detail: MESSAGE,
    });
  }

  getEmbedConfig(_input: BIEmbedConfigInput): Promise<BIEmbedConfigResult> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      embedUrl: null,
      token: null,
      expiresAt: null,
      detail: MESSAGE,
    });
  }

  healthCheck(): Promise<BIProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: MESSAGE,
      checkedAt: new Date().toISOString(),
    });
  }
}

export function biProviderNotConfiguredError(): AppError {
  return new AppError("NOT_CONFIGURED", MESSAGE);
}
