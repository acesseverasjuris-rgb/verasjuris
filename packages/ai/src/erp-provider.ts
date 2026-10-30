import { AppError } from "@verasjuris/types";

/**
 * ERP externo.
 * Default: not_configured — capabilities vazias até adapter real.
 */

export type ERPProviderHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type ERPCapability =
  | "syncCustomers"
  | "syncVendors"
  | "syncInvoices"
  | "syncPayments"
  | "syncInventory";

export type ERPSyncInput = {
  organizationId?: string;
  capability: ERPCapability;
  since?: string;
  signal?: AbortSignal;
};

export type ERPSyncResult = {
  providerKey: string;
  status: "synced" | "partial" | "failed" | "not_configured";
  syncedCount: number;
  detail?: string;
};

export interface ERPProvider {
  readonly id: string;
  readonly capabilities: readonly ERPCapability[];
  sync(input: ERPSyncInput): Promise<ERPSyncResult>;
  healthCheck(): Promise<ERPProviderHealth>;
}

const MESSAGE = "Nenhum provedor de ERP está configurado.";

export class NotConfiguredERPProvider implements ERPProvider {
  readonly id = "not_configured";
  readonly capabilities: readonly ERPCapability[] = [];

  sync(_input: ERPSyncInput): Promise<ERPSyncResult> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      syncedCount: 0,
      detail: MESSAGE,
    });
  }

  healthCheck(): Promise<ERPProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: MESSAGE,
      checkedAt: new Date().toISOString(),
    });
  }
}

export function erpProviderNotConfiguredError(): AppError {
  return new AppError("NOT_CONFIGURED", MESSAGE);
}
