import type { AppDatabase } from "@verasjuris/database";
import type { JobHandler, JobRecord } from "@verasjuris/events";
import {
  createCommunicationDispatchDeps,
  processCommunicationOutboxEntry,
  processDueCommunicationOutbox,
} from "@verasjuris/api/communication/dispatch";

export const JOB_COMMUNICATION_DISPATCH = "COMMUNICATION_DISPATCH" as const;
export const JOB_COMMUNICATION_RETRY = "COMMUNICATION_RETRY" as const;

type CommunicationJobPayload = {
  organizationId: string;
  outboxId?: string;
  messageId?: string;
};

function requireOrganizationId(job: JobRecord): string {
  const payload = job.payload as CommunicationJobPayload | null;
  const organizationId = payload?.organizationId?.trim();
  if (!organizationId) {
    throw Object.assign(new Error(`${job.type} exige organizationId`), {
      code: "VALIDATION_ERROR",
    });
  }
  return organizationId;
}

/**
 * Handlers locais (LocalInProcessQueueProvider) para outbox de comunicação.
 */
export function registerLocalCommunicationHandlers(
  queue: {
    status: string;
    registerHandler?: (type: string, handler: JobHandler) => void;
  },
  db: AppDatabase,
): void {
  if (queue.status !== "local_in_process" || typeof queue.registerHandler !== "function") {
    return;
  }

  const deps = createCommunicationDispatchDeps();

  queue.registerHandler(JOB_COMMUNICATION_DISPATCH, async (job: JobRecord) => {
    const organizationId = requireOrganizationId(job);
    const payload = job.payload as CommunicationJobPayload;
    if (payload.outboxId) {
      await processCommunicationOutboxEntry(db, deps, payload.outboxId);
      return;
    }
    await processDueCommunicationOutbox(db, deps, organizationId);
  });

  queue.registerHandler(JOB_COMMUNICATION_RETRY, async (job: JobRecord) => {
    const organizationId = requireOrganizationId(job);
    const payload = job.payload as CommunicationJobPayload;
    if (payload.outboxId) {
      await processCommunicationOutboxEntry(db, deps, payload.outboxId);
      return;
    }
    await processDueCommunicationOutbox(db, deps, organizationId, 50);
  });
}
