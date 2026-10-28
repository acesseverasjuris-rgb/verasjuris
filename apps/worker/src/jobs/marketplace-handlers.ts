import type { AppDatabase } from "@verasjuris/database";
import type { JobHandler, JobRecord } from "@verasjuris/events";

export const JOB_MARKETPLACE_REQUEST_EXPIRATION = "MARKETPLACE_REQUEST_EXPIRATION" as const;
export const JOB_MARKETPLACE_PROPOSAL_EXPIRATION = "MARKETPLACE_PROPOSAL_EXPIRATION" as const;
export const JOB_MARKETPLACE_DELIVERY_REMINDER = "MARKETPLACE_DELIVERY_REMINDER" as const;
export const JOB_PROFESSIONAL_REVALIDATION_CHECK = "PROFESSIONAL_REVALIDATION_CHECK" as const;
export const JOB_PROFESSIONAL_VERIFICATION_PROVIDER_SYNC =
  "PROFESSIONAL_VERIFICATION_PROVIDER_SYNC" as const;
export const JOB_DILIGENCE_DEADLINE_REMINDER = "DILIGENCE_DEADLINE_REMINDER" as const;
export const JOB_DILIGENCE_EVIDENCE_REVIEW_REMINDER = "DILIGENCE_EVIDENCE_REVIEW_REMINDER" as const;
export const JOB_EXTRAJUDICIAL_STATUS_SYNC = "EXTRAJUDICIAL_STATUS_SYNC" as const;
export const JOB_EXTRAJUDICIAL_REQUIREMENT_REMINDER = "EXTRAJUDICIAL_REQUIREMENT_REMINDER" as const;
export const JOB_REGISTRY_PROVIDER_SYNC = "REGISTRY_PROVIDER_SYNC" as const;
export const JOB_PAYMENT_STATUS_SYNC_MARKETPLACE = "PAYMENT_STATUS_SYNC" as const;

type OrgPayload = {
  organizationId?: string;
  requestId?: string;
  engagementId?: string;
  caseId?: string;
  orderId?: string;
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

function createNotConfiguredSyncHandler(code: string, message: string): JobHandler {
  return async (job: JobRecord) => {
    requireOrganizationId(job);
    throw Object.assign(new Error(message), { code });
  };
}

function createNoOpHandler(_db: AppDatabase): JobHandler {
  return async (job: JobRecord) => {
    requireOrganizationId(job);
  };
}

/**
 * Handlers Etapas 17–19. Sync externo: NOT_CONFIGURED honesto.
 * Idempotentes: reexecução com mesmo payload não cria efeito colateral além do noop/erro estável.
 */
export function registerLocalMarketplaceHandlers(
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

  queue.registerHandler(JOB_MARKETPLACE_REQUEST_EXPIRATION, noOp);
  queue.registerHandler(JOB_MARKETPLACE_PROPOSAL_EXPIRATION, noOp);
  queue.registerHandler(JOB_MARKETPLACE_DELIVERY_REMINDER, noOp);
  queue.registerHandler(JOB_PROFESSIONAL_REVALIDATION_CHECK, noOp);
  queue.registerHandler(JOB_DILIGENCE_DEADLINE_REMINDER, noOp);
  queue.registerHandler(JOB_DILIGENCE_EVIDENCE_REVIEW_REMINDER, noOp);
  queue.registerHandler(JOB_EXTRAJUDICIAL_REQUIREMENT_REMINDER, noOp);

  queue.registerHandler(
    JOB_PROFESSIONAL_VERIFICATION_PROVIDER_SYNC,
    createNotConfiguredSyncHandler(
      "VERIFICATION_PROVIDER_NOT_CONFIGURED",
      "PROFESSIONAL_VERIFICATION_PROVIDER_SYNC: provedores OAB/CPF/documento/biometria não configurados.",
    ),
  );
  queue.registerHandler(
    JOB_EXTRAJUDICIAL_STATUS_SYNC,
    createNotConfiguredSyncHandler(
      "REGISTRY_PROVIDER_NOT_CONFIGURED",
      "EXTRAJUDICIAL_STATUS_SYNC: nenhum RegistryProvider configurado.",
    ),
  );
  queue.registerHandler(
    JOB_REGISTRY_PROVIDER_SYNC,
    createNotConfiguredSyncHandler(
      "REGISTRY_PROVIDER_NOT_CONFIGURED",
      "REGISTRY_PROVIDER_SYNC: nenhum RegistryProvider configurado.",
    ),
  );
  queue.registerHandler(
    JOB_PAYMENT_STATUS_SYNC_MARKETPLACE,
    createNotConfiguredSyncHandler(
      "PAYMENT_PROVIDER_NOT_CONFIGURED",
      "PAYMENT_STATUS_SYNC: nenhum provedor de pagamento configurado.",
    ),
  );
}
