import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AIGateway } from "@verasjuris/ai";
import { DeterministicTestAIProvider, legalComparisonFixture } from "@verasjuris/ai/testing";
import { auditEvents, legalComparisons, seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { createMalwareScanner, LocalPrivateStorageProvider } from "@verasjuris/storage";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { bootstrapEtapa6, createDocumentWithFile, type Etapa6Setup } from "./etapa6.fixtures.js";
import { call } from "./test-helpers.js";

const COMPARISON_TYPES = [
  "petition_vs_defense",
  "evidence_vs_allegations",
  "claim_vs_decision",
  "judgment_vs_appeal",
  "admin_process_vs_judicial_action",
] as const;

describe("Prompt 15 — legal comparisons", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  const script = {
    structured: legalComparisonFixture(),
    usage: { inputTokens: 100, outputTokens: 50, providerReportedCostMicros: 1_000 },
  };
  const provider = new DeterministicTestAIProvider(script);
  let app: FastifyInstance;
  let appNoAi: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let storageRoot: string;
  let s: Etapa6Setup;
  let docA: string;
  let docB: string;

  const root = (org = s.orgA) => `/v1/organizations/${org}/legal-comparisons`;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    storageRoot = await mkdtemp(path.join(tmpdir(), "vj-comparison-"));
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
            "*": { inputCostPerMillionMicros: 1_000_000, outputCostPerMillionMicros: 2_000_000 },
          },
        },
      ),
    });
    appNoAi = await buildApp(common);
    s = await bootstrapEtapa6(app, email, "cmp");
    const a = await createDocumentWithFile(app, s.ownerA, s.orgA, s.matterAId, {
      title: "Petição",
      fileName: "peticao.txt",
      content: Buffer.from("Petição inicial afirma fato X.\n", "utf8"),
      mime: "text/plain",
    });
    const b = await createDocumentWithFile(app, s.ownerA, s.orgA, s.matterAId, {
      title: "Contestação",
      fileName: "contestacao.txt",
      content: Buffer.from("Contestação impugna fato X.\n", "utf8"),
      mime: "text/plain",
    });
    docA = a.documentId;
    docB = b.documentId;
  });

  afterAll(async () => {
    await app.close();
    await appNoAi.close();
    await database.close();
    await rm(storageRoot, { recursive: true, force: true });
  });

  it("cria comparação para os 5 tipos", async () => {
    for (const comparisonType of COMPARISON_TYPES) {
      const created = await call(
        app,
        "POST",
        root(),
        {
          comparisonType,
          legalMatterId: s.matterAId,
          title: `Cmp ${comparisonType}`,
          sources: [
            { documentId: docA, roleInComparison: "side_a", sortOrder: 0 },
            { documentId: docB, roleInComparison: "side_b", sortOrder: 1 },
          ],
        },
        s.ownerA,
      );
      expect(created.statusCode).toBe(201);
      expect(
        created.json<{ comparison: { comparisonType: string; status: string } }>().comparison,
      ).toMatchObject({ comparisonType, status: "draft" });
    }
  });

  it("run com AI gera itens com provenance; review conclui", async () => {
    const created = await call(
      app,
      "POST",
      root(),
      {
        comparisonType: "petition_vs_defense",
        sources: [
          { documentId: docA, roleInComparison: "petition", sortOrder: 0 },
          { documentId: docB, roleInComparison: "defense", sortOrder: 1 },
        ],
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    const id = created.json<{ comparison: { id: string } }>().comparison.id;

    const ran = await call(app, "POST", `${root()}/${id}/run`, {}, s.ownerA);
    expect(ran.statusCode).toBe(200);
    const comparison = ran.json<{
      comparison: {
        status: string;
        items: Array<{
          id: string;
          unsupported: boolean;
          provenance: Record<string, unknown> | null;
          reviewStatus: string;
        }>;
      };
    }>().comparison;
    expect(comparison.status).toBe("human_review");
    expect(comparison.items.length).toBeGreaterThan(0);
    expect(comparison.items[0]?.unsupported).toBe(false);
    expect(comparison.items[0]?.provenance).toBeTruthy();

    const itemId = comparison.items[0]?.id as string;
    const itemReview = await call(
      app,
      "POST",
      `${root()}/${id}/items/${itemId}/review`,
      { reviewStatus: "confirmed", reviewerComment: "ok" },
      s.ownerA,
    );
    expect(itemReview.statusCode).toBe(200);

    const done = await call(
      app,
      "POST",
      `${root()}/${id}/review`,
      { status: "reviewed", reviewComment: "revisado" },
      s.ownerA,
    );
    expect(done.statusCode).toBe(200);
    expect(done.json<{ comparison: { status: string } }>().comparison.status).toBe("reviewed");
  });

  it("NOT_CONFIGURED no run preserva estrutura e responde honesto", async () => {
    const created = await call(
      appNoAi,
      "POST",
      root(),
      {
        comparisonType: "claim_vs_decision",
        sources: [
          { documentId: docA, roleInComparison: "claim", sortOrder: 0 },
          { documentId: docB, roleInComparison: "decision", sortOrder: 1 },
        ],
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    const id = created.json<{ comparison: { id: string } }>().comparison.id;

    const ran = await call(appNoAi, "POST", `${root()}/${id}/run`, {}, s.ownerA);
    expect(ran.statusCode).toBe(503);
    expect(ran.json<{ error: { code: string } }>().error.code).toBe("AI_PROVIDER_NOT_CONFIGURED");

    const row = await database.db.query.legalComparisons.findFirst({
      where: eq(legalComparisons.id, id),
    });
    expect(row?.status).toBe("not_configured");

    const get = await call(appNoAi, "GET", `${root()}/${id}`, undefined, s.ownerA);
    expect(get.statusCode).toBe(200);
    expect(get.json<{ comparison: { sources: unknown[] } }>().comparison.sources).toHaveLength(2);
  });

  it("cross-tenant retorna 404", async () => {
    const created = await call(
      app,
      "POST",
      root(),
      {
        comparisonType: "petition_vs_defense",
        sources: [
          { documentId: docA, roleInComparison: "side_a", sortOrder: 0 },
          { documentId: docB, roleInComparison: "side_b", sortOrder: 1 },
        ],
      },
      s.ownerA,
    );
    const id = created.json<{ comparison: { id: string } }>().comparison.id;
    const foreign = await call(app, "GET", `${root(s.orgB)}/${id}`, undefined, s.ownerB);
    expect(foreign.statusCode).toBe(404);
  });

  it("audita criação", async () => {
    const audit = await database.db.query.auditEvents.findMany({
      where: eq(auditEvents.organizationId, s.orgA),
    });
    expect(audit.some((row) => row.action === "legal_comparison.created")).toBe(true);
  });
});
