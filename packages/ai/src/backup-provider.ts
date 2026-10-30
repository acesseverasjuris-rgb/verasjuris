import { AppError } from "@verasjuris/types";

/**
 * Backups e teste de restauração.
 * Default: not_configured — nunca afirma backup operacional.
 */

export type BackupProviderHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type BackupRecord = {
  externalBackupId: string | null;
  createdAt: string | null;
  status: "created" | "verified" | "failed" | "not_configured";
  sizeBytes: number | null;
  detail?: string;
};

export type CreateBackupInput = {
  scope: "database" | "storage" | "configs" | "full";
  label?: string;
  signal?: AbortSignal;
};

export type RestoreTestInput = {
  externalBackupId: string;
  signal?: AbortSignal;
};

export type RestoreTestResult = {
  providerKey: string;
  status: "passed" | "failed" | "not_configured";
  testedAt: string;
  detail?: string;
};

export interface BackupProvider {
  readonly id: string;
  create(input: CreateBackupInput): Promise<BackupRecord>;
  list(signal?: AbortSignal): Promise<readonly BackupRecord[]>;
  verify(externalBackupId: string, signal?: AbortSignal): Promise<BackupRecord>;
  restoreTest(input: RestoreTestInput): Promise<RestoreTestResult>;
  healthCheck(): Promise<BackupProviderHealth>;
}

const MESSAGE = "Nenhum provedor de backup está configurado.";

export class NotConfiguredBackupProvider implements BackupProvider {
  readonly id = "not_configured";

  create(_input: CreateBackupInput): Promise<BackupRecord> {
    return Promise.resolve({
      externalBackupId: null,
      createdAt: null,
      status: "not_configured",
      sizeBytes: null,
      detail: MESSAGE,
    });
  }

  list(_signal?: AbortSignal): Promise<readonly BackupRecord[]> {
    return Promise.resolve([]);
  }

  verify(_externalBackupId: string, _signal?: AbortSignal): Promise<BackupRecord> {
    return Promise.resolve({
      externalBackupId: null,
      createdAt: null,
      status: "not_configured",
      sizeBytes: null,
      detail: MESSAGE,
    });
  }

  restoreTest(_input: RestoreTestInput): Promise<RestoreTestResult> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      testedAt: new Date().toISOString(),
      detail: MESSAGE,
    });
  }

  healthCheck(): Promise<BackupProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: MESSAGE,
      checkedAt: new Date().toISOString(),
    });
  }
}

export function backupProviderNotConfiguredError(): AppError {
  return new AppError("NOT_CONFIGURED", MESSAGE);
}
