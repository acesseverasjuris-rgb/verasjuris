import type { AppDatabase } from "@verasjuris/database";
import type { JobHandler, JobRecord } from "@verasjuris/events";

export const JOB_ONLINE_MATCH_GENERATION = "ONLINE_MATCH_GENERATION" as const;
export const JOB_ONLINE_MATCH_EXPIRATION = "ONLINE_MATCH_EXPIRATION" as const;
export const JOB_CONSULTATION_REMINDER = "CONSULTATION_REMINDER" as const;
export const JOB_PAYMENT_STATUS_SYNC = "PAYMENT_STATUS_SYNC" as const;
export const JOB_OAB_VERIFICATION = "OAB_VERIFICATION" as const;
export const JOB_PUSH_DISPATCH = "PUSH_DISPATCH" as const;

type OrgPayload = {
  organizationId?: string;
  requestId?: string;
  consultationId?: string;
  outboxId?: string;
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
 * Handlers locais (LocalInProcessQueueProvider) — Etapas 14–16.
 * Jobs internos: noop idempotente. Sync externo: NOT_CONFIGURED honesto (ADR 070).
 */
export function registerLocalOnlineLawyerHandlers(
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

  queue.registerHandler(JOB_ONLINE_MATCH_GENERATION, noOp);
  queue.registerHandler(JOB_ONLINE_MATCH_EXPIRATION, noOp);
  queue.registerHandler(JOB_CONSULTATION_REMINDER, noOp);
  queue.registerHandler(
    JOB_PAYMENT_STATUS_SYNC,
    createNotConfiguredSyncHandler(
      "PAYMENT_PROVIDER_NOT_CONFIGURED",
      "PAYMENT_STATUS_SYNC: nenhum provedor de pagamento configurado.",
    ),
  );
  queue.registerHandler(
    JOB_OAB_VERIFICATION,
    createNotConfiguredSyncHandler(
      "OAB_VERIFICATION_PROVIDER_NOT_CONFIGURED",
      "OAB_VERIFICATION: nenhum provedor de verificação OAB configurado.",
    ),
  );
  queue.registerHandler(
    JOB_PUSH_DISPATCH,
    createNotConfiguredSyncHandler(
      "PUSH_PROVIDER_NOT_CONFIGURED",
      "PUSH_DISPATCH: nenhum provedor push configurado.",
    ),
  );
}
