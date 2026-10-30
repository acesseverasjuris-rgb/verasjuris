import { AppError } from "@verasjuris/types";

/**
 * Contabilidade externa (exportação de lançamentos / plano de contas).
 * Default: not_configured — nunca afirma sync concluído.
 */

export type AccountingProviderHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type AccountingSyncStatus = "idle" | "running" | "succeeded" | "failed" | "not_configured";

export type AccountingAccountRecord = {
  externalAccountId: string;
  code: string | null;
  name: string;
  type?: string | null;
};

export type AccountingCostCenterRecord = {
  externalCostCenterId: string;
  code: string | null;
  name: string;
};

export type AccountingDocumentRecord = {
  externalDocumentId: string;
  documentType: string | null;
  issuedAt: string | null;
  amountCents: number | null;
  currency: string;
};

export type ExportAccountingEntriesInput = {
  organizationId?: string;
  from?: string;
  to?: string;
  signal?: AbortSignal;
};

export type AccountingExportResult = {
  providerKey: string;
  status: AccountingSyncStatus;
  exportedCount: number;
  detail?: string;
};

export interface AccountingProvider {
  readonly id: string;
  exportEntries(input: ExportAccountingEntriesInput): Promise<AccountingExportResult>;
  listAccounts(
    organizationId?: string,
    signal?: AbortSignal,
  ): Promise<readonly AccountingAccountRecord[]>;
  listCostCenters(
    organizationId?: string,
    signal?: AbortSignal,
  ): Promise<readonly AccountingCostCenterRecord[]>;
  listFinancialDocuments(
    organizationId?: string,
    signal?: AbortSignal,
  ): Promise<readonly AccountingDocumentRecord[]>;
  getSyncStatus(organizationId?: string, signal?: AbortSignal): Promise<AccountingExportResult>;
  healthCheck(): Promise<AccountingProviderHealth>;
}

const MESSAGE = "Nenhum provedor contábil externo está configurado.";

export class NotConfiguredAccountingProvider implements AccountingProvider {
  readonly id = "not_configured";

  exportEntries(_input: ExportAccountingEntriesInput): Promise<AccountingExportResult> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      exportedCount: 0,
      detail: MESSAGE,
    });
  }

  listAccounts(
    _organizationId?: string,
    _signal?: AbortSignal,
  ): Promise<readonly AccountingAccountRecord[]> {
    return Promise.resolve([]);
  }

  listCostCenters(
    _organizationId?: string,
    _signal?: AbortSignal,
  ): Promise<readonly AccountingCostCenterRecord[]> {
    return Promise.resolve([]);
  }

  listFinancialDocuments(
    _organizationId?: string,
    _signal?: AbortSignal,
  ): Promise<readonly AccountingDocumentRecord[]> {
    return Promise.resolve([]);
  }

  getSyncStatus(_organizationId?: string, _signal?: AbortSignal): Promise<AccountingExportResult> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      exportedCount: 0,
      detail: MESSAGE,
    });
  }

  healthCheck(): Promise<AccountingProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: MESSAGE,
      checkedAt: new Date().toISOString(),
    });
  }
}

export function accountingProviderNotConfiguredError(): AppError {
  return new AppError("NOT_CONFIGURED", MESSAGE);
}
