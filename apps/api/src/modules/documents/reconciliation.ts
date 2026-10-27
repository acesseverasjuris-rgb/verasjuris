import { recordAudit } from "@verasjuris/audit";
import { policyDocumentACL, type SessionAccount } from "@verasjuris/auth";
import { type AppDatabase, documentVersions, documents } from "@verasjuris/database";
import type { JobQueue } from "@verasjuris/events";
import type { StorageProvider } from "@verasjuris/storage";
import { AppError } from "@verasjuris/types";
import { and, eq, inArray, lt } from "drizzle-orm";
import { authorize } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";

export const STORAGE_RECONCILIATION_JOB = "STORAGE_RECONCILIATION" as const;

export type ReconciliationFinding = {
  kind: "version_without_object" | "incomplete_upload" | "object_without_version" | "other";
  organizationId: string;
  documentId: string | null;
  versionId: string | null;
  storageKey: string | null;
  detail: string;
};

export type ReconciliationReport = {
  organizationId: string;
  scannedVersions: number;
  findings: ReconciliationFinding[];
  /** Nunca auto-delete — apenas detecção. */
  autoDelete: false;
  generatedAt: string;
};

/**
 * Detecta inconsistências DB ↔ object storage.
 * NUNCA remove objetos ou versões automaticamente.
 */
export async function reconcileOrganizationStorage(
  db: AppDatabase,
  storage: StorageProvider,
  organizationId: string,
  options: { incompleteOlderThanMs?: number } = {},
): Promise<ReconciliationReport> {
  const incompleteOlderThanMs = options.incompleteOlderThanMs ?? 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - incompleteOlderThanMs);
  const versions = await db.query.documentVersions.findMany({
    where: eq(documentVersions.organizationId, organizationId),
  });

  const findings: ReconciliationFinding[] = [];
  for (const version of versions) {
    if (version.status === "uploading" && version.createdAt < cutoff) {
      findings.push({
        kind: "incomplete_upload",
        organizationId,
        documentId: version.documentId,
        versionId: version.id,
        storageKey: version.storageKey,
        detail: `Versão em status uploading desde ${version.createdAt.toISOString()}.`,
      });
    }

    if (!version.storageKey) continue;
    let exists = false;
    try {
      exists = await storage.objectExists(version.storageKey);
    } catch {
      findings.push({
        kind: "other",
        organizationId,
        documentId: version.documentId,
        versionId: version.id,
        storageKey: version.storageKey,
        detail: "Falha ao consultar objectExists no storage.",
      });
      continue;
    }
    if (!exists && version.status !== "uploading" && version.status !== "failed") {
      findings.push({
        kind: "version_without_object",
        organizationId,
        documentId: version.documentId,
        versionId: version.id,
        storageKey: version.storageKey,
        detail: `Versão ${version.status} sem objeto em storage.`,
      });
    }
  }

  return {
    organizationId,
    scannedVersions: versions.length,
    findings,
    autoDelete: false,
    generatedAt: new Date().toISOString(),
  };
}

export async function runStorageReconciliation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  storage: StorageProvider,
  meta: RequestMeta,
): Promise<ReconciliationReport> {
  authorize(account, organizationId, (access) => policyDocumentACL(access, "document.manage_acl"));
  const report = await reconcileOrganizationStorage(db, storage, organizationId);
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "document.storage_reconciliation",
    resourceType: "organization",
    resourceId: organizationId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: {
      scannedVersions: report.scannedVersions,
      findingCount: report.findings.length,
      autoDelete: false,
    },
  });
  return report;
}

/** Handler para LocalInProcessQueueProvider — só detecta, nunca apaga. */
export function createStorageReconciliationHandler(deps: {
  db: AppDatabase;
  storage: StorageProvider;
}) {
  return async (job: { payload: unknown }) => {
    const payload = job.payload as { organizationId?: string } | null;
    const organizationId = payload?.organizationId;
    if (!organizationId) {
      throw new AppError("VALIDATION_ERROR", "STORAGE_RECONCILIATION exige organizationId.");
    }
    await reconcileOrganizationStorage(deps.db, deps.storage, organizationId);
  };
}

export async function enqueueStorageReconciliation(
  queue: JobQueue,
  organizationId: string,
): Promise<{ jobId: string; type: typeof STORAGE_RECONCILIATION_JOB }> {
  if (queue.status === "not_configured") {
    throw new AppError(
      "NOT_CONFIGURED",
      "A fila de trabalhos não está configurada. Nenhum job de reconciliação foi agendado.",
    );
  }
  const job = await queue.enqueue(
    STORAGE_RECONCILIATION_JOB,
    { organizationId },
    { idempotencyKey: `storage-reconciliation:${organizationId}` },
  );
  return { jobId: job.id, type: STORAGE_RECONCILIATION_JOB };
}

/** Utilitário de teste: marca versões órfãs sem apagar. */
export async function listIncompleteUploads(db: AppDatabase, organizationId: string) {
  return db.query.documentVersions.findMany({
    where: and(
      eq(documentVersions.organizationId, organizationId),
      eq(documentVersions.status, "uploading"),
      lt(documentVersions.createdAt, new Date(Date.now() - 60_000)),
    ),
  });
}

export async function assertDocumentsExist(
  db: AppDatabase,
  organizationId: string,
  documentIds: string[],
) {
  if (documentIds.length === 0) return;
  const rows = await db.query.documents.findMany({
    where: and(eq(documents.organizationId, organizationId), inArray(documents.id, documentIds)),
    columns: { id: true },
  });
  if (rows.length !== documentIds.length) {
    throw new AppError("NOT_FOUND", "Documento não encontrado no escopo da organização.");
  }
}
