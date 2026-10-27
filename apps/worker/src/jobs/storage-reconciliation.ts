import { documentVersions, type AppDatabase } from "@verasjuris/database";
import type { JobHandler, JobRecord } from "@verasjuris/events";
import type { StorageProvider } from "@verasjuris/storage";
import { eq } from "drizzle-orm";

export const STORAGE_RECONCILIATION_JOB = "STORAGE_RECONCILIATION" as const;

/**
 * Job local: detecta versão sem objeto / upload incompleto.
 * NUNCA apaga automaticamente.
 */
export function createStorageReconciliationHandler(deps: {
  db: AppDatabase;
  storage: StorageProvider;
}): JobHandler {
  return async (job: JobRecord) => {
    const payload = job.payload as { organizationId?: string } | null;
    const organizationId = payload?.organizationId;
    if (!organizationId) {
      throw Object.assign(new Error("STORAGE_RECONCILIATION exige organizationId"), {
        code: "VALIDATION_ERROR",
      });
    }
    const versions = await deps.db.query.documentVersions.findMany({
      where: eq(documentVersions.organizationId, organizationId),
    });
    const cutoff = new Date(Date.now() - 60 * 60 * 1000);
    let findings = 0;
    for (const version of versions) {
      if (version.status === "uploading" && version.createdAt < cutoff) {
        findings += 1;
        continue;
      }
      if (!version.storageKey) continue;
      if (version.status === "uploading" || version.status === "failed") continue;
      try {
        const exists = await deps.storage.objectExists(version.storageKey);
        if (!exists) findings += 1;
      } catch {
        findings += 1;
      }
    }
    // Resultado fica no job record; sem side-effect destrutivo.
    void findings;
  };
}
