import { auditEvents, caseLawRecords, legalSources, seedReferenceData } from "@verasjuris/database";
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

describe("Etapa 7 — pesquisa jurídica", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let storageRoot: string;
  let s: Etapa6Setup;

  const root = (org = s.orgA) => `/v1/organizations/${org}`;
  const research = (org = s.orgA) => `${root(org)}/legal-research`;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    storageRoot = await mkdtemp(path.join(tmpdir(), "vj-research-"));
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
      storage: new LocalPrivateStorageProvider(storageRoot),
      malwareScanner: createMalwareScanner(),
    });
    s = await bootstrapEtapa6(app, email, "research");
  });

  afterAll(async () => {
    await app.close();
    await database.close();
    await rm(storageRoot, { recursive: true, force: true });
  });

  it("provedor NOT_CONFIGURED: status honesto e busca local vazia sem inventar resultados", async () => {
    const status = await call(app, "GET", `${research()}/provider/status`, undefined, s.ownerA);
    expect(status.statusCode).toBe(200);
    expect(status.json<{ status: string; localCatalogAvailable: boolean }>()).toMatchObject({
      status: "not_configured",
      localCatalogAvailable: true,
      capabilities: [],
    });

    const emptyList = await call(app, "GET", `${research()}/legislation`, undefined, s.ownerA);
    expect(emptyList.statusCode).toBe(200);
    expect(emptyList.json<{ items: unknown[]; total: number }>()).toMatchObject({
      items: [],
      total: 0,
    });

    const executed = await call(
      app,
      "POST",
      research(),
      { query: "súmula vinculante inexistente" },
      s.ownerA,
    );
    expect(executed.statusCode).toBe(201);
    const body = executed.json<{
      status: string;
      provider: string;
      results: unknown[];
      message: string | null;
    }>();
    expect(body.status).toBe("not_configured");
    expect(body.provider).toBe("not_configured");
    expect(body.results).toEqual([]);
    expect(body.message).toMatch(/inventad/i);
    expect(executed.payload).not.toMatch(/REsp\s+\d+/i);

    const audits = await database.db.query.auditEvents.findMany({
      where: eq(auditEvents.organizationId, s.orgA),
    });
    expect(audits.some((row) => row.action === "legal_research.executed")).toBe(true);
  });

  it("salva pesquisa e vincula fonte a caso (org-scoped)", async () => {
    const created = await call(
      app,
      "POST",
      `${research()}/legislation`,
      {
        title: "Lei de Acesso à Informação",
        identifier: "Lei 12.527/2011",
        sourceUrl: "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12527.htm",
        sourceType: "legislation",
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    const legislationId = created.json<{ legislation: { id: string } }>().legislation.id;

    const incomplete = await call(
      app,
      "POST",
      `${research()}/case-law`,
      { court: "STJ", caseNumber: "REsp 1" },
      s.ownerA,
    );
    expect(incomplete.statusCode).toBe(400);

    const saved = await call(
      app,
      "POST",
      `${research()}/saved`,
      {
        name: "Pesquisa LAI",
        query: "acesso à informação",
        legalMatterId: s.matterAId,
      },
      s.ownerA,
    );
    expect(saved.statusCode).toBe(201);
    const savedId = saved.json<{ savedResearch: { id: string } }>().savedResearch.id;

    const got = await call(app, "GET", `${research()}/saved/${savedId}`, undefined, s.ownerA);
    expect(got.statusCode).toBe(200);
    expect(got.json<{ savedResearch: { name: string } }>().savedResearch.name).toBe("Pesquisa LAI");

    const link = await call(
      app,
      "POST",
      `${root()}/legal-matter-research-links`,
      {
        legalMatterId: s.matterAId,
        sourceType: "legislation",
        sourceId: legislationId,
        savedResearchId: savedId,
      },
      s.ownerA,
    );
    expect(link.statusCode).toBe(201);

    const audits = await database.db.query.auditEvents.findMany({
      where: eq(auditEvents.organizationId, s.orgA),
    });
    expect(audits.some((row) => row.action === "legal_research.saved")).toBe(true);
    expect(audits.some((row) => row.action === "legal_source.linked")).toBe(true);

    const cross = await call(app, "GET", `${research(s.orgB)}/saved`, undefined, s.ownerB);
    expect(cross.statusCode).toBe(200);
    expect(cross.json<{ items: unknown[] }>().items).toEqual([]);

    const leak = await call(app, "GET", `${research()}/saved/${savedId}`, undefined, s.ownerB);
    expect(leak.statusCode).toBe(404);

    const outsider = await call(app, "GET", research(), undefined, s.outsider);
    expect(outsider.statusCode).toBe(404);
  });

  it("busca local encontra legislação cadastrada e deduplica por sourceUrl", async () => {
    const again = await call(
      app,
      "POST",
      `${research()}/legislation`,
      {
        title: "LAI duplicada",
        identifier: "Lei 12.527/2011-dup",
        sourceUrl: "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12527.htm",
      },
      s.ownerA,
    );
    expect(again.statusCode).toBe(200);
    expect(again.json<{ deduplicated: boolean }>().deduplicated).toBe(true);

    const sources = await database.db.query.legalSources.findMany({
      where: eq(legalSources.organizationId, s.orgA),
    });
    expect(sources).toHaveLength(1);

    const executed = await call(
      app,
      "POST",
      research(),
      { query: "Acesso à Informação", sourceTypes: ["legislation"] },
      s.ownerA,
    );
    expect(executed.statusCode).toBe(201);
    const body = executed.json<{ status: string; results: Array<{ title: string }> }>();
    expect(body.status).toBe("not_configured");
    expect(body.results.some((row) => /acesso/i.test(row.title))).toBe(true);
  });

  it("cadastro de jurisprudência com proveniência e XSS no headnote sanitizado", async () => {
    const created = await call(
      app,
      "POST",
      `${research()}/case-law`,
      {
        court: "STJ",
        caseNumber: "REsp 1.234.567/SP",
        rapporteur: "Min. Exemplo",
        sourceUrl:
          "https://processo.stj.jus.br/processo/revista/documento/mediado/?componente=ITA&sequencial=1",
        headnote: "Trecho <script>alert(1)</script> da ementa javascript:alert(2)",
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    const caseLaw = created.json<{ caseLaw: { id: string; headnote: string | null } }>().caseLaw;
    expect(caseLaw.headnote).not.toMatch(/<script/i);
    expect(caseLaw.headnote).not.toMatch(/javascript:/i);

    const row = await database.db.query.caseLawRecords.findFirst({
      where: eq(caseLawRecords.id, caseLaw.id),
    });
    expect(row?.headnote).not.toMatch(/<script/i);
  });
});
