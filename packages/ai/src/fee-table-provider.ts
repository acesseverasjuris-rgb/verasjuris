import { AppError } from "@verasjuris/types";

/**
 * Tabela de emolumentos oficiais — NUNCA hardcode como verdade permanente.
 * Default: NOT_CONFIGURED. Estimativas manuais devem marcar MANUAL_ESTIMATE.
 */

export type FeeTableHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type FeeTableQuery = {
  serviceTypeKey: string;
  state?: string;
  city?: string;
  officeType?: string;
  signal?: AbortSignal;
};

export type FeeTableResult = {
  source: "provider" | "manual_estimate" | "not_configured";
  officialFeesCents: number | null;
  currency: "BRL";
  version?: string;
  effectiveAt?: string;
  providerKey: string;
  detail?: string;
};

export interface FeeTableProvider {
  readonly id: string;
  readonly key: string;
  readonly type: "fee_table";
  readonly status: "configured" | "not_configured" | "degraded" | "failed";
  lookup(query: FeeTableQuery): Promise<FeeTableResult>;
  healthCheck(): Promise<FeeTableHealth>;
}

const MESSAGE =
  "Nenhuma tabela oficial de emolumentos está configurada. Use MANUAL_ESTIMATE com disclaimer.";

export class NotConfiguredFeeTableProvider implements FeeTableProvider {
  readonly id = "not_configured";
  readonly key = "not_configured";
  readonly type = "fee_table" as const;
  readonly status = "not_configured" as const;

  lookup(_query: FeeTableQuery): Promise<FeeTableResult> {
    return Promise.reject(new AppError("FEE_TABLE_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  healthCheck(): Promise<FeeTableHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Tabela oficial de emolumentos não configurada.",
      checkedAt: new Date().toISOString(),
    });
  }
}
