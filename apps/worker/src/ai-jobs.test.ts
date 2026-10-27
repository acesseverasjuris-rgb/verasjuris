import { randomUUID } from "node:crypto";
import { aiJobs, organizations } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AI_JOB_TYPES, LocalInProcessAiJobExecutor } from "./ai-jobs.js";

describe("LocalInProcessAiJobExecutor (stub local, sem fila distribuída)", () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let organizationId: string;

  beforeAll(async () => {
    database = await createTestDatabase();
    const [org] = await database.db
      .insert(organizations)
      .values({ name: "Org Worker IA", slug: `org-worker-ia-${randomUUID().slice(0, 8)}` })
      .returning();
    organizationId = (org as { id: string }).id;
  });

  afterAll(async () => {
    await database.close();
  });

  async function enqueue(jobType: string) {
    const [row] = await database.db
      .insert(aiJobs)
      .values({
        organizationId,
        jobType,
        resourceType: "document_version",
        resourceId: randomUUID(),
        status: "queued",
      })
      .returning();
    return row as typeof aiJobs.$inferSelect;
  }

  it("marca o runtime padrão como local_in_process", async () => {
    const job = await enqueue("qualquer");
    expect(job.runtime).toBe("local_in_process");
  });

  it("sem handler registrado o job vira not_configured (nada é simulado)", async () => {
    const job = await enqueue("tipo_sem_handler");
    const executor = new LocalInProcessAiJobExecutor(database.db);
    const result = await executor.runOnce();
    expect(result.notConfigured).toBeGreaterThanOrEqual(1);
    const after = await database.db.query.aiJobs.findFirst({ where: eq(aiJobs.id, job.id) });
    expect(after?.status).toBe("not_configured");
    expect(after?.lastErrorCode).toBe("AI_JOB_HANDLER_NOT_REGISTERED");
  });

  it("LEGAL_REVIEW sem handler permanece not_configured (nada é simulado)", async () => {
    const job = await enqueue(AI_JOB_TYPES.LEGAL_REVIEW);
    const executor = new LocalInProcessAiJobExecutor(database.db);
    const result = await executor.runOnce();
    expect(result.notConfigured).toBeGreaterThanOrEqual(1);
    const after = await database.db.query.aiJobs.findFirst({ where: eq(aiJobs.id, job.id) });
    expect(after?.jobType).toBe(AI_JOB_TYPES.LEGAL_REVIEW);
    expect(after?.status).toBe("not_configured");
    expect(after?.lastErrorCode).toBe("AI_JOB_HANDLER_NOT_REGISTERED");
  });

  it("executa o handler registrado e conclui o job", async () => {
    const job = await enqueue("tipo_com_handler");
    const seen: string[] = [];
    const executor = new LocalInProcessAiJobExecutor(database.db, {
      tipo_com_handler: async (item) => {
        seen.push(item.id);
      },
    });
    const result = await executor.runOnce();
    expect(result.succeeded).toBe(1);
    expect(seen).toEqual([job.id]);
    const after = await database.db.query.aiJobs.findFirst({ where: eq(aiJobs.id, job.id) });
    expect(after?.status).toBe("succeeded");
    expect(after?.progress).toBe(100);
    expect(after?.attempts).toBe(1);
  });

  it("recoloca na fila até esgotar tentativas e então falha", async () => {
    const job = await enqueue("tipo_falha");
    await database.db.update(aiJobs).set({ maxAttempts: 2 }).where(eq(aiJobs.id, job.id));
    const executor = new LocalInProcessAiJobExecutor(database.db, {
      tipo_falha: async () => {
        throw Object.assign(new Error("boom"), { code: "AI_PROVIDER_UNAVAILABLE" });
      },
    });
    expect((await executor.runOnce()).requeued).toBe(1);
    expect((await executor.runOnce()).failed).toBe(1);
    const after = await database.db.query.aiJobs.findFirst({ where: eq(aiJobs.id, job.id) });
    expect(after?.status).toBe("failed");
    expect(after?.lastErrorCode).toBe("AI_PROVIDER_UNAVAILABLE");
  });

  it("não reivindica jobs que não estejam queued", async () => {
    const job = await enqueue("tipo_cancelado");
    await database.db.update(aiJobs).set({ status: "cancelled" }).where(eq(aiJobs.id, job.id));
    const executor = new LocalInProcessAiJobExecutor(database.db);
    await executor.runOnce();
    const after = await database.db.query.aiJobs.findFirst({ where: eq(aiJobs.id, job.id) });
    expect(after?.status).toBe("cancelled");
  });
});
