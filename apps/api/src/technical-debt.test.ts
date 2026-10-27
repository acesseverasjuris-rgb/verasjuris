import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  documentVersions,
  notifications,
  organizationMembers,
  seedReferenceData,
} from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { LocalInProcessQueueProvider } from "@verasjuris/events";
import { InAppNotificationProvider } from "@verasjuris/notifications";
import { createMalwareScanner, LocalPrivateStorageProvider } from "@verasjuris/storage";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { bootstrapEtapa6, createDocumentWithFile, type Etapa6Setup } from "./etapa6.fixtures.js";
import {
  reconcileOrganizationStorage,
  STORAGE_RECONCILIATION_JOB,
} from "./modules/documents/reconciliation.js";
import { call } from "./test-helpers.js";

describe("Prompt 15 — technical debt closure", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let storage: LocalPrivateStorageProvider;
  let storageRoot: string;
  let s: Etapa6Setup;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    storageRoot = await mkdtemp(path.join(tmpdir(), "vj-debt-"));
    storage = new LocalPrivateStorageProvider(storageRoot);
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
      storage,
      malwareScanner: createMalwareScanner(),
      notifications: new InAppNotificationProvider(),
    });
    s = await bootstrapEtapa6(app, email, "debt");
  });

  afterAll(async () => {
    await app.close();
    await database.close();
    await rm(storageRoot, { recursive: true, force: true });
  });

  it("local queue enqueue → process STORAGE_RECONCILIATION", async () => {
    const seen: string[] = [];
    const queue = new LocalInProcessQueueProvider({
      handlers: {
        [STORAGE_RECONCILIATION_JOB]: async (job) => {
          seen.push((job.payload as { organizationId: string }).organizationId);
        },
      },
    });
    const job = await queue.enqueue(STORAGE_RECONCILIATION_JOB, { organizationId: s.orgA });
    expect(job.status).toBe("queued");
    const processed = await queue.processNext();
    expect(processed?.status).toBe("succeeded");
    expect(seen).toEqual([s.orgA]);
  });

  it("reconciliation detecta versão sem objeto (sem auto-delete)", async () => {
    const file = await createDocumentWithFile(app, s.ownerA, s.orgA, s.matterAId, {
      title: "Para reconciliar",
      fileName: "rec.txt",
      content: Buffer.from("conteudo", "utf8"),
      mime: "text/plain",
    });
    const version = await database.db.query.documentVersions.findFirst({
      where: eq(documentVersions.id, file.versionId),
    });
    expect(version?.storageKey).toBeTruthy();
    if (version?.storageKey) {
      await storage.deleteObject(version.storageKey);
    }

    const report = await reconcileOrganizationStorage(database.db, storage, s.orgA);
    expect(report.autoDelete).toBe(false);
    expect(report.findings.some((f) => f.kind === "version_without_object")).toBe(true);

    const stillThere = await database.db.query.documentVersions.findFirst({
      where: eq(documentVersions.id, file.versionId),
    });
    expect(stillThere).toBeTruthy();

    const viaApi = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/documents/storage-reconciliation`,
      {},
      s.ownerA,
    );
    expect(viaApi.statusCode).toBe(200);
    expect(viaApi.json<{ autoDelete: boolean }>().autoDelete).toBe(false);
  });

  it("alert job local cria notificação in-app", async () => {
    const member = await database.db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.organizationId, s.orgA),
        eq(organizationMembers.status, "active"),
      ),
    });
    expect(member?.userId).toBeTruthy();
    const userId = member?.userId as string;

    const queue = new LocalInProcessQueueProvider({
      handlers: {
        AUCTION_ALERT_CHECK: async (job) => {
          const payload = job.payload as { organizationId: string };
          const provider = new InAppNotificationProvider();
          await provider.send({
            organizationId: payload.organizationId,
            userId,
            channel: "in_app",
            type: "auction.alert",
            title: "Alerta teste",
            message: "Job local criou notificação in-app.",
          });
          await database.db.insert(notifications).values({
            organizationId: payload.organizationId,
            userId,
            type: "auction.alert",
            title: "Alerta teste",
            message: "Job local criou notificação in-app.",
          });
        },
      },
    });
    await queue.enqueue("AUCTION_ALERT_CHECK", { organizationId: s.orgA });
    const processed = await queue.processNext();
    expect(processed?.status).toBe("succeeded");

    const notes = await database.db.query.notifications.findMany({
      where: eq(notifications.organizationId, s.orgA),
    });
    expect(notes.some((n) => n.type === "auction.alert")).toBe(true);
  });
});
