import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AIGateway } from "@verasjuris/ai";
import { DeterministicTestAIProvider } from "@verasjuris/ai/testing";
import { aiJobs, auditEvents, seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { createMalwareScanner, LocalPrivateStorageProvider } from "@verasjuris/storage";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import {
  bootstrapEtapa6,
  createDocumentWithFile,
  type Etapa6Setup,
  validLegalAnalysisOutput,
} from "./etapa6.fixtures.js";
import { call } from "./test-helpers.js";

describe("Etapa 6 — módulo de IA (gateway, uso, jobs, orçamentos)", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  const provider = new DeterministicTestAIProvider({
    structured: validLegalAnalysisOutput(),
    usage: { inputTokens: 1000, outputTokens: 500 },
  });
  let app: FastifyInstance;
  let appNoAi: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let storageRoot: string;
  let s: Etapa6Setup;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    storageRoot = await mkdtemp(path.join(tmpdir(), "vj-ai-"));
    const common = {
      db: database.db,
      logger: false as const,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
      storage: new LocalPrivateStorageProvider(storageRoot),
      malwareScanner: createMalwareScanner(),
    };
    app = await buildApp({
      ...common,
      aiGateway: new AIGateway(
        { ai: true },
        {
          provider,
          pricing: {
            "*": { inputCostPerMillionMicros: 3_000_000, outputCostPerMillionMicros: 15_000_000 },
          },
        },
      ),
    });
    appNoAi = await buildApp(common);
    s = await bootstrapEtapa6(app, email, "ai");
  });

  afterAll(async () => {
    await app.close();
    await appNoAi.close();
    await database.close();
    await rm(storageRoot, { recursive: true, force: true });
  });

  const url = (org: string, suffix: string) => `/v1/organizations/${org}/ai/${suffix}`;

  it("sem provedor: status é not_configured, sem capacidades e sem conteúdo inventado", async () => {
    const response = await call(appNoAi, "GET", url(s.orgA, "status"), undefined, s.ownerA);
    expect(response.statusCode).toBe(200);
    const body = response.json<{
      ai: {
        status: string;
        capabilities: unknown[];
        outputPolicy: { autoApply: boolean; requiresReview: boolean };
      };
      ocr: { status: string };
      publicOpportunityProvider: { status: string };
      budget: { remainingMicros: number | null };
    }>();
    expect(body.ai.status).toBe("not_configured");
    expect(body.ai.capabilities).toEqual([]);
    expect(body.ai.outputPolicy).toMatchObject({ autoApply: false, requiresReview: true });
    expect(body.ocr.status).toBe("not_configured");
    expect(body.publicOpportunityProvider.status).toBe("not_configured");

    // listagens funcionam e permanecem vazias/honestas
    for (const suffix of ["models", "prompts", "requests", "jobs", "budgets", "usage"]) {
      const list = await call(appNoAi, "GET", url(s.orgA, suffix), undefined, s.ownerA);
      expect(list.statusCode, suffix).toBe(200);
    }
    const usage = await call(appNoAi, "GET", url(s.orgA, "usage"), undefined, s.ownerA);
    expect(
      usage.json<{ totals: { requests: number; estimatedCostMicros: number } }>().totals,
    ).toMatchObject({
      requests: 0,
      estimatedCostMicros: 0,
    });
  });

  it("com gateway de teste o status reflete configured (sem expor segredos)", async () => {
    const response = await call(app, "GET", url(s.orgA, "status"), undefined, s.ownerA);
    expect(response.statusCode).toBe(200);
    const body = response.json<{ ai: { status: string; provider: string } }>();
    expect(body.ai.status).toBe("configured");
    expect(response.payload).not.toMatch(/api[_-]?key|secret|token/i);
  });

  describe("tráfego de IA e isolamento entre organizações", () => {
    let requestId: string;
    let jobId: string;

    beforeAll(async () => {
      const file = await createDocumentWithFile(app, s.ownerA, s.orgA, s.matterAId, {
        title: "Contrato",
        fileName: "contrato.txt",
        content: Buffer.from("Cláusula 1. O contratante pagará R$ 5.000,00.", "utf8"),
        mime: "text/plain",
      });
      const processed = await call(
        app,
        "POST",
        `/v1/organizations/${s.orgA}/documents/${file.documentId}/versions/${file.versionId}/process`,
        {},
        s.ownerA,
      );
      expect(processed.statusCode).toBe(201);
      const analysis = await call(
        app,
        "POST",
        `/v1/organizations/${s.orgA}/legal-analyses`,
        { documentId: file.documentId, analysisType: "document_analysis" },
        s.ownerA,
      );
      expect(analysis.statusCode).toBe(201);
      const requests = await call(
        app,
        "GET",
        url(s.orgA, "requests?feature=legal_analysis"),
        undefined,
        s.ownerA,
      );
      requestId = requests.json<{ items: Array<{ id: string }> }>().items[0]?.id as string;
      const jobs = await call(app, "GET", url(s.orgA, "jobs"), undefined, s.ownerA);
      jobId = jobs.json<{ items: Array<{ id: string }> }>().items[0]?.id as string;
    });

    it("registra uso em micros inteiros e executa jobs como local_in_process", async () => {
      const usage = await call(app, "GET", url(s.orgA, "usage"), undefined, s.ownerA);
      const body = usage.json<{
        totals: { requests: number; estimatedCostMicros: number; totalTokens: number };
        byFeature: Array<{ feature: string }>;
      }>();
      expect(body.totals.requests).toBe(1);
      expect(body.totals.totalTokens).toBe(1500);
      expect(Number.isInteger(body.totals.estimatedCostMicros)).toBe(true);
      expect(body.totals.estimatedCostMicros).toBe(10_500);
      expect(body.byFeature.map((row) => row.feature)).toContain("legal_analysis");

      const job = await call(app, "GET", url(s.orgA, `jobs/${jobId}`), undefined, s.ownerA);
      expect(job.statusCode).toBe(200);
      expect(job.json<{ job: { runtime: string } }>().job.runtime).toBe("local_in_process");

      const detail = await call(
        app,
        "GET",
        url(s.orgA, `requests/${requestId}`),
        undefined,
        s.ownerA,
      );
      expect(detail.statusCode).toBe(200);
      const request = detail.json<{
        request: {
          sources: Array<{ sourceHash: string | null }>;
          usage: { estimatedCostMicros: number } | null;
        };
      }>().request;
      expect(request.usage?.estimatedCostMicros).toBe(10_500);
      expect(request.sources.length).toBeGreaterThan(0);
      // nenhuma carga com conteúdo bruto do documento
      expect(detail.payload).not.toContain("Cláusula 1");
    });

    it("AIRequest, uso e jobs de outra organização retornam 404 / vazio", async () => {
      expect(
        (await call(app, "GET", url(s.orgA, `requests/${requestId}`), undefined, s.ownerB))
          .statusCode,
      ).toBe(404);
      expect(
        (await call(app, "GET", url(s.orgB, `requests/${requestId}`), undefined, s.ownerB))
          .statusCode,
      ).toBe(404);
      expect(
        (await call(app, "GET", url(s.orgB, `jobs/${jobId}`), undefined, s.ownerB)).statusCode,
      ).toBe(404);
      expect(
        (await call(app, "POST", url(s.orgB, `jobs/${jobId}/cancel`), {}, s.ownerB)).statusCode,
      ).toBe(404);
      expect((await call(app, "GET", url(s.orgA, "usage"), undefined, s.ownerB)).statusCode).toBe(
        404,
      );
      expect((await call(app, "GET", url(s.orgA, "jobs"), undefined, s.outsider)).statusCode).toBe(
        404,
      );

      const usageB = await call(app, "GET", url(s.orgB, "usage"), undefined, s.ownerB);
      expect(usageB.json<{ totals: { requests: number }; items: unknown[] }>()).toMatchObject({
        totals: { requests: 0 },
        items: [],
      });
      const requestsB = await call(app, "GET", url(s.orgB, "requests"), undefined, s.ownerB);
      expect(requestsB.json<{ total: number }>().total).toBe(0);
      const jobsB = await call(app, "GET", url(s.orgB, "jobs"), undefined, s.ownerB);
      expect(jobsB.json<{ total: number }>().total).toBe(0);
    });
  });

  it("jobs: cancela job enfileirado (auditado) e recusa cancelar o que não está pendente", async () => {
    const [queued] = await database.db
      .insert(aiJobs)
      .values({
        organizationId: s.orgA,
        jobType: "legal_analysis",
        resourceType: "legal_matter",
        resourceId: randomUUID(),
        status: "queued",
      })
      .returning();
    const jobId = queued?.id as string;

    const memberAttempt = await call(
      app,
      "POST",
      url(s.orgA, `jobs/${jobId}/cancel`),
      {},
      s.memberA,
    );
    expect(memberAttempt.statusCode).toBe(403);

    const cancelled = await call(app, "POST", url(s.orgA, `jobs/${jobId}/cancel`), {}, s.ownerA);
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json<{ job: { status: string } }>().job.status).toBe("cancelled");
    const again = await call(app, "POST", url(s.orgA, `jobs/${jobId}/cancel`), {}, s.ownerA);
    expect(again.statusCode).toBe(409);

    const audit = await database.db.query.auditEvents.findMany({
      where: eq(auditEvents.organizationId, s.orgA),
    });
    expect(
      audit.some((event) => event.action === "ai.job_cancelled" && event.resourceId === jobId),
    ).toBe(true);

    const filtered = await call(
      app,
      "GET",
      url(s.orgA, "jobs?status=cancelled"),
      undefined,
      s.ownerA,
    );
    expect(filtered.json<{ items: Array<{ id: string }> }>().items.map((j) => j.id)).toContain(
      jobId,
    );
  });

  it("orçamentos: micros inteiros, soft ≤ hard e permissão de gerenciamento", async () => {
    const created = await call(
      app,
      "PUT",
      url(s.orgA, "budgets"),
      { period: "daily", softLimitMicros: 1_000_000, hardLimitMicros: 5_000_000 },
      s.ownerA,
    );
    expect(created.statusCode).toBe(200);
    expect(
      created.json<{ budget: { softLimitMicros: number; hardLimitMicros: number } }>().budget,
    ).toMatchObject({
      softLimitMicros: 1_000_000,
      hardLimitMicros: 5_000_000,
    });
    const fractional = await call(
      app,
      "PUT",
      url(s.orgA, "budgets"),
      { period: "daily", hardLimitMicros: 10.5 },
      s.ownerA,
    );
    expect(fractional.statusCode).toBe(400);
    const inverted = await call(
      app,
      "PUT",
      url(s.orgA, "budgets"),
      { period: "daily", softLimitMicros: 9, hardLimitMicros: 3 },
      s.ownerA,
    );
    expect(inverted.statusCode).toBe(400);
    const negative = await call(
      app,
      "PUT",
      url(s.orgA, "budgets"),
      { period: "monthly", hardLimitMicros: -1 },
      s.ownerA,
    );
    expect(negative.statusCode).toBe(400);

    const denied = await call(
      app,
      "PUT",
      url(s.orgA, "budgets"),
      { period: "daily", hardLimitMicros: 7 },
      s.memberA,
    );
    expect(denied.statusCode).toBe(403);
    const crossTenant = await call(
      app,
      "PUT",
      url(s.orgA, "budgets"),
      { period: "daily", hardLimitMicros: 7 },
      s.ownerB,
    );
    expect(crossTenant.statusCode).toBe(404);

    // orçamento da org A não aparece na org B
    const listB = await call(app, "GET", url(s.orgB, "budgets"), undefined, s.ownerB);
    expect(listB.json<{ items: unknown[] }>().items).toHaveLength(0);
    const listA = await call(app, "GET", url(s.orgA, "budgets"), undefined, s.ownerA);
    expect(
      listA.json<{ items: Array<{ period: string }> }>().items.some((b) => b.period === "daily"),
    ).toBe(true);
  });

  it("prompts: versões imutáveis, ativação auditada e restrita a quem gerencia", async () => {
    const payload = {
      key: "teste.resumo",
      name: "Resumo de teste",
      feature: "legal_analysis",
      systemTemplate: "Você é um assistente jurídico assistivo.",
    };
    const denied = await call(app, "POST", url(s.orgA, "prompts"), payload, s.memberA);
    expect(denied.statusCode).toBe(403);
    const unknownFeature = await call(
      app,
      "POST",
      url(s.orgA, "prompts"),
      { ...payload, feature: "inexistente" },
      s.ownerA,
    );
    expect(unknownFeature.statusCode).toBe(400);

    const v1 = await call(app, "POST", url(s.orgA, "prompts"), payload, s.ownerA);
    expect(v1.statusCode).toBe(201);
    const v2 = await call(
      app,
      "POST",
      url(s.orgA, "prompts"),
      { ...payload, changelog: "ajuste" },
      s.ownerA,
    );
    expect(v2.json<{ version: { version: number; status: string } }>().version).toMatchObject({
      version: 2,
      status: "draft",
    });

    const memberActivate = await call(
      app,
      "POST",
      url(s.orgA, "prompts/teste.resumo/versions/1/activate"),
      {},
      s.memberA,
    );
    expect(memberActivate.statusCode).toBe(403);
    expect(
      (
        await call(
          app,
          "POST",
          url(s.orgA, "prompts/teste.resumo/versions/1/activate"),
          {},
          s.ownerA,
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await call(
          app,
          "POST",
          url(s.orgA, "prompts/teste.resumo/versions/2/activate"),
          {},
          s.ownerA,
        )
      ).statusCode,
    ).toBe(200);
    // versão antiga ficou depreciada e não pode ser reativada
    expect(
      (
        await call(
          app,
          "POST",
          url(s.orgA, "prompts/teste.resumo/versions/1/activate"),
          {},
          s.ownerA,
        )
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await call(
          app,
          "POST",
          url(s.orgA, "prompts/teste.resumo/versions/99/activate"),
          {},
          s.ownerA,
        )
      ).statusCode,
    ).toBe(404);

    const listed = await call(app, "GET", url(s.orgA, "prompts"), undefined, s.memberA);
    expect(listed.statusCode).toBe(200);
    const item = listed
      .json<{ items: Array<{ key: string; activeVersion: number | null }> }>()
      .items.find((prompt) => prompt.key === "teste.resumo");
    expect(item?.activeVersion).toBe(2);

    const audit = await database.db.query.auditEvents.findMany({
      where: eq(auditEvents.organizationId, s.orgA),
    });
    expect(audit.filter((event) => event.action === "ai.prompt_version_activated")).toHaveLength(2);
  });

  it("exige autenticação e membership", async () => {
    expect((await app.inject({ method: "GET", url: url(s.orgA, "status") })).statusCode).toBe(401);
    expect((await call(app, "GET", url(s.orgA, "status"), undefined, s.outsider)).statusCode).toBe(
      404,
    );
    expect(
      (await call(app, "GET", url("not-a-uuid", "status"), undefined, s.ownerA)).statusCode,
    ).toBe(400);
  });
});
