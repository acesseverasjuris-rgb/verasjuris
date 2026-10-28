import type { AppDatabase } from "@verasjuris/database";
import type { JobHandler, JobRecord } from "@verasjuris/events";

export const JOB_TAX_CALCULATION = "TAX_CALCULATION" as const;
export const JOB_TAX_IMPORT = "TAX_IMPORT" as const;
export const JOB_TAX_PROVIDER_SYNC = "TAX_PROVIDER_SYNC" as const;
export const JOB_CONTRACT_ALERT = "CONTRACT_ALERT" as const;
export const JOB_CONTRACT_RENEWAL_ALERT = "CONTRACT_RENEWAL_ALERT" as const;
export const JOB_SIGNATURE_STATUS_SYNC = "SIGNATURE_STATUS_SYNC" as const;
export const JOB_CONTRACT_AI_REVIEW = "CONTRACT_AI_REVIEW" as const;
export const JOB_AREA_DOCUMENT_ANALYSIS = "AREA_DOCUMENT_ANALYSIS" as const;

type OrgPayload = {
  organizationId?: string;
};

function requireOrganizationId(job: JobRecord): string {
  const payload = job.payload as OrgPayload | null;
  const organizationId = payload?.organizationId?.trim();
  if (!organizationId) {
    throw Object.assign(new Error(`${job.type} exige organizationId`), {
      code: "VALIDATION_ERROR",
    });
  }
  return organizationId;
}

/** Sync externo: falha explícita — nenhum dado fiscal inventado. */
function createNotConfiguredSyncHandler(code: string, message: string): JobHandler {
  return async (job: JobRecord) => {
    requireOrganizationId(job);
    throw Object.assign(new Error(message), { code });
  };
}

/** Stub idempotente: valida payload e conclui sem efeito colateral. */
function createNoOpHandler(_db: AppDatabase): JobHandler {
  return async (job: JobRecord) => {
    requireOrganizationId(job);
  };
}

/**
 * Handlers locais (LocalInProcessQueueProvider) para tributário, contratos e áreas.
 * Fila distribuída / broker ausente permanece NOT_CONFIGURED (ADR 098).
 */
export function registerLocalTaxContractHandlers(
  queue: {
    status: string;
    registerHandler?: (type: string, handler: JobHandler) => void;
  },
  db: AppDatabase,
): void {
  if (queue.status !== "local_in_process" || typeof queue.registerHandler !== "function") {
    return;
  }

  const noOp = createNoOpHandler(db);

  queue.registerHandler(JOB_TAX_CALCULATION, noOp);
  queue.registerHandler(JOB_TAX_IMPORT, noOp);
  queue.registerHandler(
    JOB_TAX_PROVIDER_SYNC,
    createNotConfiguredSyncHandler(
      "FEDERAL_TAX_PROVIDER_NOT_CONFIGURED",
      "TAX_PROVIDER_SYNC: nenhum provedor tributário configurado.",
    ),
  );
  queue.registerHandler(JOB_CONTRACT_ALERT, noOp);
  queue.registerHandler(JOB_CONTRACT_RENEWAL_ALERT, noOp);
  queue.registerHandler(
    JOB_SIGNATURE_STATUS_SYNC,
    createNotConfiguredSyncHandler(
      "SIGNATURE_PROVIDER_NOT_CONFIGURED",
      "SIGNATURE_STATUS_SYNC: nenhum provedor de assinatura configurado.",
    ),
  );
  queue.registerHandler(JOB_CONTRACT_AI_REVIEW, noOp);
  queue.registerHandler(JOB_AREA_DOCUMENT_ANALYSIS, noOp);
}
