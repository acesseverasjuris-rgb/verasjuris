import { AppError } from "@verasjuris/types";

/**
 * TimeTrackingImportProvider — futuro import de ponto/jornada.
 * Default: not_configured. Cadastro manual de registros permanece disponível.
 */

export type TimeTrackingImportHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type TimeTrackingImportBatch = {
  externalId: string;
  recordCount: number;
  importedAt: string;
  provider: string;
};

export interface TimeTrackingImportProvider {
  readonly id: string;
  importBatch(query: {
    laborCaseId?: string;
    signal?: AbortSignal;
  }): Promise<TimeTrackingImportBatch>;
  healthCheck(): Promise<TimeTrackingImportHealth>;
}

const MESSAGE =
  "Nenhum provedor de importação de ponto está configurado. Use cadastro manual de registros de jornada.";

export class NotConfiguredTimeTrackingImportProvider implements TimeTrackingImportProvider {
  readonly id = "not_configured";

  importBatch(_query: {
    laborCaseId?: string;
    signal?: AbortSignal;
  }): Promise<TimeTrackingImportBatch> {
    return Promise.reject(new AppError("TIME_TRACKING_IMPORT_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  healthCheck(): Promise<TimeTrackingImportHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor de importação de ponto não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
