import { AppError } from "@verasjuris/types";

/**
 * Data warehouse externo para Analytics (BigQuery / Snowflake / Redshift / etc.).
 * Default: not_configured — não cria infra pesada nem finge sync.
 */

export type AnalyticsWarehouseHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type AnalyticsWarehouseQueryInput = {
  organizationId?: string;
  sqlKey: string;
  params?: Record<string, string | number | boolean | null>;
  signal?: AbortSignal;
};

export type AnalyticsWarehouseQueryResult = {
  providerKey: string;
  status: "ok" | "unavailable" | "not_configured";
  rows: readonly Record<string, unknown>[];
  detail?: string;
};

export type AnalyticsWarehouseLoadInput = {
  organizationId?: string;
  tableKey: string;
  rows: readonly Record<string, unknown>[];
  mode?: "append" | "replace";
  signal?: AbortSignal;
};

export type AnalyticsWarehouseLoadResult = {
  providerKey: string;
  status: "loaded" | "accepted" | "failed" | "not_configured";
  rowCount: number;
  detail?: string;
};

export interface AnalyticsWarehouseProvider {
  readonly id: string;
  query(input: AnalyticsWarehouseQueryInput): Promise<AnalyticsWarehouseQueryResult>;
  load(input: AnalyticsWarehouseLoadInput): Promise<AnalyticsWarehouseLoadResult>;
  healthCheck(): Promise<AnalyticsWarehouseHealth>;
}

const MESSAGE =
  "Nenhum data warehouse analítico externo está configurado. Snapshots locais permanecem no banco operacional.";

export class NotConfiguredAnalyticsWarehouseProvider implements AnalyticsWarehouseProvider {
  readonly id = "not_configured";

  query(_input: AnalyticsWarehouseQueryInput): Promise<AnalyticsWarehouseQueryResult> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      rows: [],
      detail: MESSAGE,
    });
  }

  load(input: AnalyticsWarehouseLoadInput): Promise<AnalyticsWarehouseLoadResult> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      rowCount: input.rows.length,
      detail: MESSAGE,
    });
  }

  healthCheck(): Promise<AnalyticsWarehouseHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: MESSAGE,
      checkedAt: new Date().toISOString(),
    });
  }
}

export function analyticsWarehouseProviderNotConfiguredError(): AppError {
  return new AppError("NOT_CONFIGURED", MESSAGE);
}
