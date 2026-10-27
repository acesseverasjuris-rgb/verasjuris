import { auditEvents, seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { createMalwareScanner, LocalPrivateStorageProvider } from "@verasjuris/storage";
import { eq } from "drizzle-orm";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { bootstrapEtapa6, type Etapa6Setup } from "./etapa6.fixtures.js";
import { call } from "./test-helpers.js";

describe("Etapa 7.1 — citações jurídicas", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let storageRoot: string;
  let s: Etapa6Setup;
  let legislationId: string;

  const root = (org = s.orgA) => `/v1/organizations/${org}`;
  const citations = (org = s.orgA) => `${root(org)}/citations`;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    storageRoot = await mkdtemp(path.join(tmpdir(), "vj-cite-"));
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
      storage: new LocalPrivateStorageProvider(storageRoot),
      malwareScanner: createMalwareScanner(),
    });
    s = await bootstrapEtapa6(app, email, "cite");

    const legislation = await call(
      app,
      "POST",
      `${root()}/legal-research/legislation`,
      {
        title: "Código de Processo Civil",
        identifier: "Lei 13.105/2015",
        sourceUrl: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm",
      },
      s.ownerA,
    );
    expect(legislation.statusCode).toBe(201);
    legislationId = legislation.json<{ legislation: { id: string } }>().legislation.id;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
    await rm(storageRoot, { recursive: true, force: true });
  });

  it("rejeita citação de jurisprudência incompleta/alucinada", async () => {
    const hallucinated = await call(
      app,
      "POST",
      citations(),
      {
        sourceType: "case_law",
        court: "STF",
        caseNumber: "RE 9999999",
        // sem sourceUrl → alucinação / incompleta
      },
      s.ownerA,
    );
    expect(hallucinated.statusCode).toBe(400);
    expect(hallucinated.json<{ error: { message: string } }>().error.message).toMatch(
      /fonte não verificada/i,
    );

    const incomplete = await call(
      app,
      "POST",
      citations(),
      {
        sourceType: "case_law",
        formattedCitation: "Acórdão inventado pela IA",
      },
      s.ownerA,
    );
    expect(incomplete.statusCode).toBe(400);
  });

  it("cria citação a partir de fonte local e sanitiza excerpt XSS", async () => {
    const created = await call(
      app,
      "POST",
      citations(),
      {
        sourceType: "legislation",
        sourceId: legislationId,
        excerpt: "Art. 1º <img src=x onerror=alert(1)> texto javascript:void(0)",
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    const citation = created.json<{
      citation: {
        id: string;
        citationKind: string;
        formattedCitation: string;
        excerpt: string | null;
        verificationStatus: string;
        copyText: string;
      };
    }>().citation;
    expect(citation.citationKind).toBe("SOURCE_DOCUMENT_CITATION");
    expect(citation.verificationStatus).not.toBe("verified");
    expect(citation.formattedCitation).not.toBe("Fonte não verificada.");
    expect(citation.copyText).toBe(citation.formattedCitation);
    expect(citation.excerpt).not.toMatch(/<img/i);
    expect(citation.excerpt).not.toMatch(/javascript:/i);
    expect(citation.excerpt).not.toMatch(/onerror/i);

    const got = await call(app, "GET", `${citations()}/${citation.id}`, undefined, s.ownerA);
    expect(got.statusCode).toBe(200);

    const audits = await database.db.query.auditEvents.findMany({
      where: eq(auditEvents.organizationId, s.orgA),
    });
    expect(audits.some((row) => row.action === "citation.created")).toBe(true);
  });

  it("cria citação externa completa e verifica sem provedor permanece não verificada", async () => {
    const created = await call(
      app,
      "POST",
      citations(),
      {
        sourceType: "case_law",
        court: "STJ",
        caseNumber: "REsp 1.111.111/RJ",
        rapporteur: "Min. Teste",
        sourceUrl:
          "https://processo.stj.jus.br/processo/revista/documento/mediado/?componente=ITA&sequencial=2",
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    const citation = created.json<{
      citation: { id: string; citationKind: string; verificationStatus: string };
    }>().citation;
    expect(citation.citationKind).toBe("EXTERNAL_LEGAL_CITATION");
    expect(citation.verificationStatus).toBe("source_available");

    const verify = await call(
      app,
      "POST",
      `${citations()}/${citation.id}/verify`,
      { verificationStatus: "verified" },
      s.ownerA,
    );
    expect(verify.statusCode).toBe(200);
    const body = verify.json<{
      status: string;
      citation: { verificationStatus: string };
      message?: string;
    }>();
    expect(body.status).toBe("not_configured");
    expect(body.citation.verificationStatus).not.toBe("verified");
    expect(body.message).toMatch(/não verificad/i);

    const invalidate = await call(
      app,
      "POST",
      `${citations()}/${citation.id}/verify`,
      { verificationStatus: "invalid", notes: "Fonte indisponível na consulta manual" },
      s.ownerA,
    );
    expect(invalidate.statusCode).toBe(200);
    expect(
      invalidate.json<{ citation: { verificationStatus: string } }>().citation.verificationStatus,
    ).toBe("invalid");

    const audits = await database.db.query.auditEvents.findMany({
      where: eq(auditEvents.organizationId, s.orgA),
    });
    expect(audits.some((row) => row.action === "citation.invalidated")).toBe(true);
  });

  it("isolamento cross-tenant de citações", async () => {
    const listed = await call(app, "GET", citations(s.orgB), undefined, s.ownerB);
    expect(listed.statusCode).toBe(200);
    expect(listed.json<{ items: unknown[] }>().items).toEqual([]);

    const mine = await call(app, "GET", citations(), undefined, s.ownerA);
    expect(mine.json<{ total: number }>().total).toBeGreaterThan(0);

    const foreignId = mine.json<{ items: Array<{ id: string }> }>().items[0]?.id;
    expect(foreignId).toBeTruthy();
    const leak = await call(app, "GET", `${citations(s.orgB)}/${foreignId}`, undefined, s.ownerB);
    expect(leak.statusCode).toBe(404);
  });
});
