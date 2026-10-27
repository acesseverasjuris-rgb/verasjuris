import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AIGateway } from "@verasjuris/ai";
import { DeterministicTestAIProvider, legalReviewFixture } from "@verasjuris/ai/testing";
import {
  aiRequests,
  auditEvents,
  documents,
  legalAiReviews,
  legalMatters,
  seedReferenceData,
} from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { createMalwareScanner, LocalPrivateStorageProvider } from "@verasjuris/storage";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { bootstrapEtapa6, createDocumentWithFile, type Etapa6Setup } from "./etapa6.fixtures.js";
import { call } from "./test-helpers.js";

type Review = {
  id: string;
  status: string;
  version: number;
  assistive: boolean;
  appliedToDomain: boolean;
  summary: string | null;
  pendingReviewItems: number;
  formalIssues: Array<{ id: string; reviewStatus: string }>;
  missingDocuments: Array<{ id: string; message: string; reviewStatus: string }>;
  unaddressedClaims: unknown[];
  unansweredGrounds: unknown[];
  risks: Array<{ id: string; requiresHumanReview: boolean; reviewStatus: string }>;
  inconsistencies: unknown[];
  contradictions: Array<{
    id: string;
    possibleContradiction: boolean;
    reviewStatus: string;
  }>;
  suggestedCorrections: Array<{ autoEdit: boolean }>;
};

describe("Etapa 6.3 — revisão jurídica assistida (IA Revisora)", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  const script: {
    structured: unknown;
    usage: { inputTokens: number; outputTokens: number; providerReportedCostMicros?: number };
  } = {
    structured: legalReviewFixture({ reviewType: "content_review" }),
    usage: { inputTokens: 800, outputTokens: 400, providerReportedCostMicros: 9_000 },
  };
  const provider = new DeterministicTestAIProvider(script);
  let app: FastifyInstance;
  let appNoAi: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let storageRoot: string;
  let s: Etapa6Setup;
  let docId: string;
  let versionId: string;

  async function processDoc(cookie: string, org: string, documentId: string, verId: string) {
    const response = await call(
      app,
      "POST",
      `/v1/organizations/${org}/documents/${documentId}/versions/${verId}/process`,
      {},
      cookie,
    );
    expect(response.statusCode).toBe(201);
  }

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    storageRoot = await mkdtemp(path.join(tmpdir(), "vj-legal-review-"));
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
    s = await bootstrapEtapa6(app, email, "review");
    const file = await createDocumentWithFile(app, s.ownerA, s.orgA, s.matterAId, {
      title: "Peça para revisão",
      fileName: "peca.txt",
      content: Buffer.from(
        "Petição inicial. Autor alega dano moral. Documento anexo citando procuração.\n",
        "utf8",
      ),
      mime: "text/plain",
    });
    docId = file.documentId;
    versionId = file.versionId;
    await processDoc(s.ownerA, s.orgA, file.documentId, file.versionId);
  });

  afterAll(async () => {
    await app.close();
    await appNoAi.close();
    await database.close();
    await rm(storageRoot, { recursive: true, force: true });
  });

  it("cria conjunto e revisão com provedor determinístico — seções persistidas", async () => {
    const setCreated = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-review-sets`,
      {
        name: "Conjunto inicial",
        legalMatterId: s.matterAId,
        documents: [{ documentId: docId, roleInReview: "initial_petition", sortOrder: 0 }],
      },
      s.ownerA,
    );
    expect(setCreated.statusCode).toBe(201);
    const setId = setCreated.json<{ reviewSet: { id: string; documents: unknown[] } }>().reviewSet
      .id;
    expect(
      setCreated.json<{ reviewSet: { documents: unknown[] } }>().reviewSet.documents,
    ).toHaveLength(1);

    const docBefore = await database.db.query.documents.findFirst({
      where: eq(documents.id, docId),
    });

    const created = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-reviews`,
      {
        reviewType: "content_review",
        reviewSetId: setId,
        legalMatterId: s.matterAId,
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    const review = created.json<{ review: Review }>().review;
    expect(review.status).toBe("human_review");
    expect(review.assistive).toBe(true);
    expect(review.appliedToDomain).toBe(false);
    expect(review.version).toBe(1);
    expect(review.contradictions).toHaveLength(1);
    expect(review.contradictions[0]?.possibleContradiction).toBe(true);
    expect(review.missingDocuments).toHaveLength(1);
    expect(review.missingDocuments[0]?.message).toBe(
      "Documento não localizado no conjunto analisado.",
    );
    expect(review.risks).toHaveLength(1);
    expect(review.risks[0]?.requiresHumanReview).toBe(true);
    expect(review.pendingReviewItems).toBeGreaterThan(0);
    expect(review.suggestedCorrections.every((item) => item.autoEdit === false)).toBe(true);

    const docAfter = await database.db.query.documents.findFirst({
      where: eq(documents.id, docId),
    });
    expect(docAfter).toEqual(docBefore);

    const audit = await database.db.query.auditEvents.findMany({
      where: eq(auditEvents.organizationId, s.orgA),
    });
    const actions = new Set(audit.map((event) => event.action));
    expect(actions.has("legal_review.created")).toBe(true);
    expect(actions.has("legal_review.generated")).toBe(true);
  });

  it("NOT_CONFIGURED: erro honesto, status not_configured, sem conteúdo gerado", async () => {
    const response = await call(
      appNoAi,
      "POST",
      `/v1/organizations/${s.orgA}/legal-reviews`,
      { primaryDocumentId: docId, reviewType: "formal_review" },
      s.ownerA,
    );
    expect(response.statusCode).toBe(503);
    expect(response.json<{ error: { code: string } }>().error.code).toBe(
      "AI_PROVIDER_NOT_CONFIGURED",
    );

    const requests = await database.db.query.aiRequests.findMany({
      where: eq(aiRequests.organizationId, s.orgA),
    });
    const attempt = requests.find((row) => row.status === "not_configured");
    expect(attempt?.feature).toBe("legal_review");
    expect(attempt?.provider).toBe("not_configured");

    const reviews = await database.db.query.legalAiReviews.findMany({
      where: eq(legalAiReviews.organizationId, s.orgA),
    });
    const notConfigured = reviews.find((row) => row.status === "not_configured");
    expect(notConfigured).toBeTruthy();
    expect(notConfigured?.structuredResult).toBeNull();
    expect(notConfigured?.summary).toBeNull();
  });

  it("revisão humana por item (confirm/reject) e fechamento — nunca muta o documento", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-reviews`,
      { primaryDocumentId: docId, reviewType: "claims_review" },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    const review = created.json<{ review: Review }>().review;
    const base = `/v1/organizations/${s.orgA}/legal-reviews/${review.id}`;
    const contradictionId = review.contradictions[0]?.id as string;
    const missingId = review.missingDocuments[0]?.id as string;

    const docBefore = await database.db.query.documents.findFirst({
      where: eq(documents.id, docId),
    });
    const matterBefore = await database.db.query.legalMatters.findFirst({
      where: eq(legalMatters.id, s.matterAId),
    });

    const confirmed = await call(
      app,
      "POST",
      `${base}/items/contradictions/${contradictionId}/review`,
      { action: "confirm" },
      s.ownerA,
    );
    expect(confirmed.statusCode).toBe(200);
    expect(
      confirmed
        .json<{ review: Review }>()
        .review.contradictions.find((item) => item.id === contradictionId)?.reviewStatus,
    ).toBe("confirmed");

    const rejected = await call(
      app,
      "POST",
      `${base}/items/missing_documents/${missingId}/review`,
      { action: "reject", comment: "Documento localizado em outro volume." },
      s.ownerA,
    );
    expect(rejected.statusCode).toBe(200);
    expect(
      rejected
        .json<{ review: Review }>()
        .review.missingDocuments.find((item) => item.id === missingId)?.reviewStatus,
    ).toBe("rejected");

    const closed = await call(
      app,
      "POST",
      `${base}/review`,
      { comment: "Revisão humana concluída." },
      s.ownerA,
    );
    expect(closed.statusCode).toBe(200);
    expect(closed.json<{ review: Review }>().review.status).toBe("closed");
    expect(closed.json<{ review: Review }>().review.appliedToDomain).toBe(false);

    const docAfter = await database.db.query.documents.findFirst({
      where: eq(documents.id, docId),
    });
    const matterAfter = await database.db.query.legalMatters.findFirst({
      where: eq(legalMatters.id, s.matterAId),
    });
    expect(docAfter).toEqual(docBefore);
    expect(matterAfter).toEqual(matterBefore);

    const audit = await database.db.query.auditEvents.findMany({
      where: eq(auditEvents.organizationId, s.orgA),
    });
    const actions = new Set(audit.map((event) => event.action));
    expect(actions.has("legal_review.item_confirmed")).toBe(true);
    expect(actions.has("legal_review.item_rejected")).toBe(true);
    expect(actions.has("legal_review.reviewed")).toBe(true);

    const again = await call(app, "POST", `${base}/review`, {}, s.ownerA);
    expect(again.statusCode).toBe(409);
  });

  it("versiona revisões do mesmo caso+tipo", async () => {
    const first = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-reviews`,
      { primaryDocumentId: docId, reviewType: "evidence_review", legalMatterId: s.matterAId },
      s.ownerA,
    );
    expect(first.statusCode).toBe(201);
    expect(first.json<{ review: Review }>().review.version).toBe(1);

    const second = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-reviews`,
      { primaryDocumentId: docId, reviewType: "evidence_review", legalMatterId: s.matterAId },
      s.ownerA,
    );
    expect(second.statusCode).toBe(201);
    expect(second.json<{ review: Review }>().review.version).toBe(2);
  });

  it("isolamento entre organizações: 404 cross-tenant", async () => {
    const list = await call(
      app,
      "GET",
      `/v1/organizations/${s.orgA}/legal-reviews`,
      undefined,
      s.ownerA,
    );
    const reviewId = list.json<{ items: Array<{ id: string }> }>().items[0]?.id as string;

    const crossOrg = await call(
      app,
      "GET",
      `/v1/organizations/${s.orgA}/legal-reviews/${reviewId}`,
      undefined,
      s.ownerB,
    );
    expect(crossOrg.statusCode).toBe(404);

    const viaOwnOrg = await call(
      app,
      "GET",
      `/v1/organizations/${s.orgB}/legal-reviews/${reviewId}`,
      undefined,
      s.ownerB,
    );
    expect(viaOwnOrg.statusCode).toBe(404);

    const createB = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgB}/legal-reviews`,
      { primaryDocumentId: docId, reviewType: "content_review" },
      s.ownerB,
    );
    expect(createB.statusCode).toBe(404);

    const setB = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgB}/legal-review-sets`,
      {
        name: "Conjunto invasor",
        documents: [{ documentId: docId, roleInReview: "other", sortOrder: 0 }],
      },
      s.ownerB,
    );
    expect(setB.statusCode).toBe(404);

    const outsider = await call(
      app,
      "GET",
      `/v1/organizations/${s.orgA}/legal-reviews`,
      undefined,
      s.outsider,
    );
    expect(outsider.statusCode).toBe(404);
  });

  it("nunca muta o documento-fonte (conteúdo/metadados estáveis após revisão)", async () => {
    const before = await database.db.query.documents.findFirst({
      where: eq(documents.id, docId),
    });
    expect(before?.currentVersionId).toBe(versionId);

    await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-reviews`,
      { primaryDocumentId: docId, reviewType: "contract_review" },
      s.ownerA,
    );

    const after = await database.db.query.documents.findFirst({
      where: eq(documents.id, docId),
    });
    expect(after).toEqual(before);
  });

  it("exige autenticação", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/v1/organizations/${s.orgA}/legal-reviews`,
    });
    expect(response.statusCode).toBe(401);
  });
});
