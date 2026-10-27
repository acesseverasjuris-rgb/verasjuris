import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AIGateway } from "@verasjuris/ai";
import { DeterministicTestAIProvider, legalDraftFixture } from "@verasjuris/ai/testing";
import { assertLegalDraftTransition, assertLegalDraftTransitionGuards } from "@verasjuris/auth";
import {
  aiRequests,
  auditEvents,
  legalDocumentDrafts,
  seedReferenceData,
} from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { createMalwareScanner, LocalPrivateStorageProvider } from "@verasjuris/storage";
import { AppError } from "@verasjuris/types";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { bootstrapEtapa6, createDocumentWithFile, type Etapa6Setup } from "./etapa6.fixtures.js";
import { call } from "./test-helpers.js";

type DraftBundle = {
  draft: {
    id: string;
    status: string;
    content: string | null;
    approvedByMembershipId: string | null;
    filedAt: string | null;
    currentDocumentId: string | null;
    filingMethodLabel: string | null;
  };
  checklists: Array<{
    items: Array<{ id: string; itemKey: string; status: string; required: boolean }>;
  }>;
  history: Array<{ fromStatus: string | null; toStatus: string }>;
  missingVariables: string[];
};

describe("Etapa 7 — minutas jurídicas + workflow", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  const script: {
    structured: unknown;
    usage: { inputTokens: number; outputTokens: number; providerReportedCostMicros?: number };
  } = {
    structured: legalDraftFixture({ feature: "legal_draft.initial_petition" }),
    usage: { inputTokens: 500, outputTokens: 300, providerReportedCostMicros: 5_000 },
  };
  const provider = new DeterministicTestAIProvider(script);
  let app: FastifyInstance;
  let appNoAi: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let storageRoot: string;
  let s: Etapa6Setup;
  let templateId: string;
  let templateVersionId: string;
  let evidenceDocId: string;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    storageRoot = await mkdtemp(path.join(tmpdir(), "vj-legal-drafts-"));
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
    s = await bootstrapEtapa6(app, email, "drafts");

    const created = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-document-templates`,
      {
        name: "Petição teste",
        templateType: "initial_petition",
        documentKind: "petition",
        content: "Petição de {{party.name}}. Pedido: {{claim.text}}.",
        contentFormat: "plain_text",
        variableSchema: {
          fields: [
            { key: "party.name", label: "Parte", type: "party", required: true },
            { key: "claim.text", label: "Pedido", type: "text", required: true },
          ],
        },
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    templateId = created.json<{ template: { id: string } }>().template.id;
    templateVersionId = created.json<{ version: { id: string } }>().version.id;

    // Ativa versão para uso em drafts
    await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-document-templates/${templateId}/versions/${templateVersionId}/submit-for-review`,
      {},
      s.ownerA,
    );
    await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-document-templates/${templateId}/versions/${templateVersionId}/approve`,
      {},
      s.ownerA,
    );
    await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-document-templates/${templateId}/versions/${templateVersionId}/activate`,
      {},
      s.ownerA,
    );

    const file = await createDocumentWithFile(app, s.ownerA, s.orgA, s.matterAId, {
      title: "Evidência de protocolo",
      fileName: "protocolo.txt",
      content: Buffer.from("Comprovante de protocolo", "utf8"),
      mime: "text/plain",
    });
    evidenceDocId = file.documentId;
  });

  afterAll(async () => {
    await app.close();
    await appNoAi.close();
    await database.close();
    await rm(storageRoot, { recursive: true, force: true });
  });

  async function completeChecklist(draftId: string) {
    const got = await call(
      app,
      "GET",
      `/v1/organizations/${s.orgA}/legal-drafts/${draftId}`,
      undefined,
      s.ownerA,
    );
    const items = got.json<DraftBundle>().checklists.flatMap((c) => c.items);
    for (const item of items) {
      const updated = await call(
        app,
        "PATCH",
        `/v1/organizations/${s.orgA}/legal-drafts/${draftId}/checklist-items/${item.id}`,
        { status: "done" },
        s.ownerA,
      );
      expect(updated.statusCode).toBe(200);
    }
  }

  it("gera minuta a partir de template SEM IA (resolve variáveis)", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-drafts/generate`,
      {
        title: "Minuta gerada",
        documentType: "initial_petition",
        legalMatterId: s.matterAId,
        templateId,
        templateVersionId,
        variableValues: {
          party: { name: "João Silva" },
          claim: { text: "indenização por danos" },
        },
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    const bundle = created.json<DraftBundle>();
    expect(bundle.draft.status).toBe("draft");
    expect(bundle.draft.content).toContain("João Silva");
    expect(bundle.draft.content).toContain("indenização por danos");
    expect(bundle.draft.content).not.toContain("{{");
    expect(bundle.missingVariables).toHaveLength(0);
    expect(bundle.checklists[0]?.items.length).toBeGreaterThanOrEqual(12);

    const requests = await database.db.query.aiRequests.findMany({
      where: eq(aiRequests.organizationId, s.orgA),
    });
    expect(
      requests.every((row) => !row.feature.startsWith("legal_draft.") || row.id === null),
    ).toBe(true);
  });

  it("destaca variável faltante na geração sem IA", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-drafts/generate`,
      {
        title: "Minuta incompleta",
        templateId,
        variableValues: { party: { name: "Ana" } },
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    const bundle = created.json<DraftBundle>();
    expect(bundle.draft.content).toContain("⟦MISSING_VARIABLE:claim.text⟧");
    expect(bundle.missingVariables).toContain("claim.text");
  });

  it("AI NOT_CONFIGURED: status permanece e erro honesto", async () => {
    const created = await call(
      appNoAi,
      "POST",
      `/v1/organizations/${s.orgA}/legal-drafts`,
      {
        title: "Sem IA",
        documentType: "initial_petition",
        content: "Texto base",
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    const draftId = created.json<DraftBundle>().draft.id;

    const assist = await call(
      appNoAi,
      "POST",
      `/v1/organizations/${s.orgA}/legal-drafts/${draftId}/ai-assist`,
      {},
      s.ownerA,
    );
    expect(assist.statusCode).toBe(503);
    expect(assist.json<{ error: { code: string } }>().error.code).toBe(
      "AI_PROVIDER_NOT_CONFIGURED",
    );

    const got = await call(
      appNoAi,
      "GET",
      `/v1/organizations/${s.orgA}/legal-drafts/${draftId}`,
      undefined,
      s.ownerA,
    );
    expect(got.json<DraftBundle>().draft.status).toBe("draft");
  });

  it("workflow inválido: DRAFT→FILED, APPROVED sem aprovador, READY com blocking, FILED sem filedAt, CONFIRMED sem evidência", () => {
    expect(() => assertLegalDraftTransition("draft", "filed")).toThrow(AppError);
    expect(() =>
      assertLegalDraftTransitionGuards("approved", { approvedByMembershipId: null }),
    ).toThrow(AppError);
    expect(() =>
      assertLegalDraftTransitionGuards("ready_to_file", { hasBlockingChecklistItems: true }),
    ).toThrow(AppError);
    expect(() => assertLegalDraftTransitionGuards("filed", { filingMethod: "manual" })).toThrow(
      AppError,
    );
    expect(() => assertLegalDraftTransitionGuards("confirmed", {})).toThrow(AppError);
  });

  it("API: draft→filed via workflow falha; ready com blocking falha; filed sem filedAt falha; confirm sem evidência falha", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-drafts`,
      {
        title: "Workflow fail",
        documentType: "initial_petition",
        content: "Conteúdo completo sem missing",
        legalMatterId: s.matterAId,
      },
      s.ownerA,
    );
    const draftId = created.json<DraftBundle>().draft.id;

    const jump = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-drafts/${draftId}/workflow`,
      { toStatus: "filed" },
      s.ownerA,
    );
    expect([400, 409]).toContain(jump.statusCode);

    await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-drafts/${draftId}/review`,
      {},
      s.ownerA,
    );
    await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-drafts/${draftId}/approve`,
      {},
      s.ownerA,
    );

    const got = await call(
      app,
      "GET",
      `/v1/organizations/${s.orgA}/legal-drafts/${draftId}`,
      undefined,
      s.ownerA,
    );
    const blockingItem = got.json<DraftBundle>().checklists[0]?.items[0];
    expect(blockingItem).toBeTruthy();
    await call(
      app,
      "PATCH",
      `/v1/organizations/${s.orgA}/legal-drafts/${draftId}/checklist-items/${blockingItem!.id}`,
      { status: "blocked" },
      s.ownerA,
    );

    const readyBlocked = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-drafts/${draftId}/ready-to-file`,
      {},
      s.ownerA,
    );
    expect(readyBlocked.statusCode).toBe(409);

    await call(
      app,
      "PATCH",
      `/v1/organizations/${s.orgA}/legal-drafts/${draftId}/checklist-items/${blockingItem!.id}`,
      { status: "pending" },
      s.ownerA,
    );
    await completeChecklist(draftId);

    const ready = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-drafts/${draftId}/ready-to-file`,
      {},
      s.ownerA,
    );
    expect(ready.statusCode).toBe(200);

    const fileNoDate = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-drafts/${draftId}/file`,
      { filingMethod: "manual" },
      s.ownerA,
    );
    expect(fileNoDate.statusCode).toBe(400);

    const filed = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-drafts/${draftId}/file`,
      { filedAt: new Date().toISOString(), filingMethod: "manual", protocolNumber: "2026.1" },
      s.ownerA,
    );
    expect(filed.statusCode).toBe(200);

    const confirmNoEvidence = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-drafts/${draftId}/confirm`,
      { confirmationMethod: "manual" },
      s.ownerA,
    );
    expect(confirmNoEvidence.statusCode).toBe(400);
  });

  it("happy path: draft→review→approve→ready→file manual→confirm com evidência", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-drafts/generate`,
      {
        title: "Happy path",
        legalMatterId: s.matterAId,
        templateId,
        variableValues: {
          party: { name: "Cliente X" },
          claim: { text: "tutela antecipada" },
        },
      },
      s.ownerA,
    );
    const draftId = created.json<DraftBundle>().draft.id;

    expect(
      (
        await call(
          app,
          "POST",
          `/v1/organizations/${s.orgA}/legal-drafts/${draftId}/review`,
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
          `/v1/organizations/${s.orgA}/legal-drafts/${draftId}/approve`,
          {},
          s.ownerA,
        )
      ).statusCode,
    ).toBe(200);

    await completeChecklist(draftId);

    expect(
      (
        await call(
          app,
          "POST",
          `/v1/organizations/${s.orgA}/legal-drafts/${draftId}/ready-to-file`,
          {},
          s.ownerA,
        )
      ).statusCode,
    ).toBe(200);

    const filed = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-drafts/${draftId}/file`,
      {
        filedAt: new Date().toISOString(),
        filingMethod: "manual",
        protocolNumber: "PROT-1",
        evidenceDocumentId: evidenceDocId,
      },
      s.ownerA,
    );
    expect(filed.statusCode).toBe(200);
    expect(filed.json<DraftBundle>().draft.status).toBe("filed");
    expect(filed.json<DraftBundle>().draft.filingMethodLabel).toBe(
      "Protocolo informado manualmente",
    );

    const confirmed = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-drafts/${draftId}/confirm`,
      {
        confirmationMethod: "manual",
        confirmationEvidenceDocumentId: evidenceDocId,
      },
      s.ownerA,
    );
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json<DraftBundle>().draft.status).toBe("confirmed");
    expect(confirmed.json<DraftBundle>().history.map((h) => h.toStatus)).toEqual(
      expect.arrayContaining([
        "draft",
        "human_review",
        "approved",
        "ready_to_file",
        "filed",
        "confirmed",
      ]),
    );

    const audit = await database.db.query.auditEvents.findMany({
      where: eq(auditEvents.organizationId, s.orgA),
    });
    const actions = new Set(audit.map((event) => event.action));
    expect(actions.has("legal_draft.created")).toBe(true);
    expect(actions.has("legal_draft.approved")).toBe(true);
    expect(actions.has("legal_draft.filed")).toBe(true);
    expect(actions.has("legal_draft.confirmed")).toBe(true);
  });

  it("converte minuta em Document", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-drafts`,
      {
        title: "Converter",
        documentType: "motion",
        content: "Texto da minuta para documento",
        legalMatterId: s.matterAId,
      },
      s.ownerA,
    );
    const draftId = created.json<DraftBundle>().draft.id;

    const converted = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-drafts/${draftId}/convert-to-document`,
      { format: "plain_text" },
      s.ownerA,
    );
    expect(converted.statusCode).toBe(201);
    const body = converted.json<{
      document: { id: string; title: string };
      draft: { currentDocumentId: string | null };
    }>();
    expect(body.document.title).toBe("Converter");
    expect(body.draft.currentDocumentId).toBe(body.document.id);

    const row = await database.db.query.legalDocumentDrafts.findFirst({
      where: eq(legalDocumentDrafts.id, draftId),
    });
    expect(row?.currentDocumentId).toBe(body.document.id);
  });

  it("ACL em documentos do source set", async () => {
    const doc = await createDocumentWithFile(app, s.ownerA, s.orgA, s.matterAId, {
      title: "Fonte restrita",
      fileName: "fonte.txt",
      content: Buffer.from("conteudo fonte", "utf8"),
      mime: "text/plain",
    });

    const ok = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-drafts/source-sets`,
      {
        name: "Fontes",
        items: [{ itemType: "document", documentId: doc.documentId, sortOrder: 0 }],
      },
      s.ownerA,
    );
    expect(ok.statusCode).toBe(201);

    const cross = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgB}/legal-drafts/source-sets`,
      {
        name: "Invasão",
        items: [{ itemType: "document", documentId: doc.documentId, sortOrder: 0 }],
      },
      s.ownerB,
    );
    expect(cross.statusCode).toBe(404);
  });

  it("ai-assist com provedor determinístico avança para ai_assisted", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-drafts`,
      {
        title: "Com IA",
        documentType: "initial_petition",
        content: "Base",
        legalMatterId: s.matterAId,
      },
      s.ownerA,
    );
    const draftId = created.json<DraftBundle>().draft.id;

    const assist = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-drafts/${draftId}/ai-assist`,
      {},
      s.ownerA,
    );
    expect(assist.statusCode).toBe(200);
    expect(assist.json<DraftBundle>().draft.status).toBe("ai_assisted");
    expect(assist.json<DraftBundle>().draft.content).toContain("Excelentíssimo");
  });

  it("export HTML ok; PDF NOT_CONFIGURED", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-drafts`,
      { title: "Export", documentType: "notice", content: "Texto export" },
      s.ownerA,
    );
    const draftId = created.json<DraftBundle>().draft.id;

    const html = await call(
      app,
      "GET",
      `/v1/organizations/${s.orgA}/legal-drafts/${draftId}/export?format=html`,
      undefined,
      s.ownerA,
    );
    expect(html.statusCode).toBe(200);
    expect(html.json<{ format: string }>().format).toBe("html");

    const pdf = await call(
      app,
      "GET",
      `/v1/organizations/${s.orgA}/legal-drafts/${draftId}/export?format=pdf`,
      undefined,
      s.ownerA,
    );
    expect(pdf.statusCode).toBe(503);
    expect(pdf.json<{ error: { code: string } }>().error.code).toBe("NOT_CONFIGURED");
  });

  it("cross-tenant: minuta de A é 404 em B", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-drafts`,
      { title: "Privada", documentType: "other", content: "x" },
      s.ownerA,
    );
    const draftId = created.json<DraftBundle>().draft.id;

    const cross = await call(
      app,
      "GET",
      `/v1/organizations/${s.orgB}/legal-drafts/${draftId}`,
      undefined,
      s.ownerB,
    );
    expect(cross.statusCode).toBe(404);
  });
});
