import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { auditEvents, publicOpportunities, seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { createMalwareScanner, LocalPrivateStorageProvider } from "@verasjuris/storage";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { bootstrapEtapa6, createDocumentWithFile, type Etapa6Setup } from "./etapa6.fixtures.js";
import { call } from "./test-helpers.js";

type Opportunity = {
  id: string;
  scope: string;
  editable: boolean;
  title: string;
  status: string;
  source: {
    provider: string;
    url: string | null;
    badge: { kind: string; label: string; official: boolean };
  };
  interest: { status: string; notes: string | null } | null;
  contentFormat: string;
};

describe("Etapa 6 — oportunidades públicas (cadastro manual)", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let storageRoot: string;
  let s: Etapa6Setup;

  const root = (org = s.orgA) => `/v1/organizations/${org}`;
  const list = (org = s.orgA) => `${root(org)}/public-opportunities`;

  async function create(cookie: string, body: Record<string, unknown>, org = s.orgA) {
    return call(app, "POST", list(org), { object: "Objeto da oportunidade", ...body }, cookie);
  }

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    storageRoot = await mkdtemp(path.join(tmpdir(), "vj-opp-"));
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
      storage: new LocalPrivateStorageProvider(storageRoot),
      malwareScanner: createMalwareScanner(),
    });
    s = await bootstrapEtapa6(app, email, "opp");
  });

  afterAll(async () => {
    await app.close();
    await database.close();
    await rm(storageRoot, { recursive: true, force: true });
  });

  it("provedor externo: status NOT_CONFIGURED e busca recusada (nenhum resultado inventado)", async () => {
    const status = await call(
      app,
      "GET",
      `${root()}/public-opportunity-provider/status`,
      undefined,
      s.ownerA,
    );
    expect(status.statusCode).toBe(200);
    expect(status.json<{ status: string; manualEntryAvailable: boolean }>()).toMatchObject({
      status: "not_configured",
      manualEntryAvailable: true,
    });
    const search = await call(
      app,
      "POST",
      `${root()}/public-opportunity-provider/search`,
      { text: "pregão" },
      s.ownerA,
    );
    expect(search.statusCode).toBe(503);
    expect(search.json<{ error: { code: string } }>().error.code).toBe(
      "PUBLIC_OPPORTUNITY_PROVIDER_NOT_CONFIGURED",
    );
    expect(search.payload).not.toContain('"items"');
  });

  it("cadastro manual: selo 'manual', nunca fonte oficial, valores em centavos inteiros", async () => {
    const created = await create(s.ownerA, {
      title: "Pregão eletrônico 10/2026",
      opportunityType: "tender",
      status: "open",
      estimatedValueCents: 1_250_000,
      proposalDeadline: "2026-12-01T15:00:00-03:00",
      stateCode: "sp",
      municipality: "São Paulo",
      sourceUrl: "https://exemplo.gov.br/edital/10-2026",
      processNumber: "PROC-10/2026",
    });
    expect(created.statusCode).toBe(201);
    const opportunity = created.json<{
      opportunity: Opportunity & { estimatedValueCents: number; stateCode: string };
    }>().opportunity;
    expect(opportunity.scope).toBe("organization");
    expect(opportunity.editable).toBe(true);
    expect(opportunity.source.provider).toBe("manual");
    expect(opportunity.source.badge).toEqual({
      kind: "manual",
      label: "Cadastro manual",
      official: false,
    });
    expect(opportunity.estimatedValueCents).toBe(1_250_000);
    expect(opportunity.stateCode).toBe("SP");
    expect(created.payload).not.toMatch(/fonte oficial/i);

    const fractional = await create(s.ownerA, {
      title: "Valor quebrado",
      estimatedValueCents: 10.5,
    });
    expect(fractional.statusCode).toBe(400);
    const httpUrl = await create(s.ownerA, {
      title: "URL insegura",
      sourceUrl: "http://exemplo.gov.br/edital",
    });
    expect(httpUrl.statusCode).toBe(400);
    const jsUrl = await create(s.ownerA, { title: "URL js", sourceUrl: "javascript:alert(1)" });
    expect(jsUrl.statusCode).toBe(400);
    const spoof = await create(s.ownerA, {
      title: "Tentativa de falsa oficialidade",
      sourceProvider: "public_provider",
    });
    // campos desconhecidos não alteram a origem
    if (spoof.statusCode === 201) {
      expect(spoof.json<{ opportunity: Opportunity }>().opportunity.source.badge.official).toBe(
        false,
      );
    }

    const audit = await database.db.query.auditEvents.findMany({
      where: eq(auditEvents.organizationId, s.orgA),
    });
    const event = audit.find(
      (row) => row.action === "public_opportunity.created" && row.resourceId === opportunity.id,
    );
    expect(event).toBeDefined();
    expect(event?.after).toMatchObject({ sourceProvider: "manual" });
  });

  it("lista com filtros (tipo, status, UF, prazo, texto) e trata % literalmente", async () => {
    await create(s.ownerA, {
      title: "Credenciamento clínica",
      opportunityType: "accreditation",
      status: "published",
      stateCode: "RJ",
      proposalDeadline: "2027-03-10T12:00:00Z",
      object: "Credenciamento 100% digital",
    });
    await create(s.ownerA, {
      title: "Chamamento antigo",
      opportunityType: "public_call",
      status: "closed",
      stateCode: "RJ",
    });

    const all = await call(app, "GET", list(), undefined, s.ownerA);
    const titles = all.json<{ items: Opportunity[] }>().items.map((i) => i.title);
    expect(titles).toEqual(
      expect.arrayContaining([
        "Pregão eletrônico 10/2026",
        "Credenciamento clínica",
        "Chamamento antigo",
      ]),
    );

    const byType = await call(
      app,
      "GET",
      `${list()}?opportunityType=accreditation`,
      undefined,
      s.ownerA,
    );
    expect(byType.json<{ items: Opportunity[] }>().items.map((i) => i.title)).toEqual([
      "Credenciamento clínica",
    ]);

    const byState = await call(app, "GET", `${list()}?stateCode=rj`, undefined, s.ownerA);
    expect(byState.json<{ total: number }>().total).toBe(2);

    const byStatus = await call(app, "GET", `${list()}?status=closed`, undefined, s.ownerA);
    expect(byStatus.json<{ items: Opportunity[] }>().items.map((i) => i.title)).toEqual([
      "Chamamento antigo",
    ]);

    const byDeadline = await call(
      app,
      "GET",
      `${list()}?deadlineFrom=${encodeURIComponent("2027-01-01T00:00:00Z")}&deadlineTo=${encodeURIComponent("2027-12-31T00:00:00Z")}`,
      undefined,
      s.ownerA,
    );
    expect(byDeadline.json<{ items: Opportunity[] }>().items.map((i) => i.title)).toEqual([
      "Credenciamento clínica",
    ]);

    const byText = await call(
      app,
      "GET",
      `${list()}?q=${encodeURIComponent("clínica")}`,
      undefined,
      s.ownerA,
    );
    expect(byText.json<{ total: number }>().total).toBe(1);
    const percent = await call(
      app,
      "GET",
      `${list()}?q=${encodeURIComponent("100%")}`,
      undefined,
      s.ownerA,
    );
    expect(percent.json<{ items: Opportunity[] }>().items.map((i) => i.title)).toEqual([
      "Credenciamento clínica",
    ]);
    const wildcard = await call(
      app,
      "GET",
      `${list()}?q=${encodeURIComponent("%")}`,
      undefined,
      s.ownerA,
    );
    expect(wildcard.json<{ total: number }>().total).toBe(1);

    expect(
      (await call(app, "GET", `${list()}?opportunityType=invalido`, undefined, s.ownerA))
        .statusCode,
    ).toBe(400);
  });

  describe("detalhe, atualização, interesse, requisitos e documentos", () => {
    let id: string;

    beforeAll(async () => {
      const created = await create(s.ownerA, {
        title: "Edital de parceria",
        opportunityType: "partnership",
        status: "open",
      });
      id = created.json<{ opportunity: Opportunity }>().opportunity.id;
    });

    it("atualiza campos e registra auditoria", async () => {
      const updated = await call(
        app,
        "PATCH",
        `${list()}/${id}`,
        { title: "Edital de parceria (rev.)", modality: "chamamento" },
        s.ownerA,
      );
      expect(updated.statusCode).toBe(200);
      expect(updated.json<{ opportunity: Opportunity }>().opportunity.title).toBe(
        "Edital de parceria (rev.)",
      );
      expect((await call(app, "PATCH", `${list()}/${id}`, {}, s.ownerA)).statusCode).toBe(400);
      const audit = await database.db.query.auditEvents.findMany({
        where: eq(auditEvents.organizationId, s.orgA),
      });
      expect(
        audit.some((row) => row.action === "public_opportunity.updated" && row.resourceId === id),
      ).toBe(true);
    });

    it("salva interesse (upsert por organização), lista e remove", async () => {
      const saved = await call(app, "PUT", `${list()}/${id}/interest`, {}, s.memberA);
      expect(saved.statusCode).toBe(200);
      expect(saved.json<{ interest: { status: string } }>().interest.status).toBe("saved");
      const updated = await call(
        app,
        "PUT",
        `${list()}/${id}/interest`,
        { status: "preparing", notes: "Reunir certidões" },
        s.ownerA,
      );
      expect(
        updated.json<{ interest: { status: string; notes: string } }>().interest,
      ).toMatchObject({
        status: "preparing",
        notes: "Reunir certidões",
      });

      const interests = await call(
        app,
        "GET",
        `${root()}/public-opportunity-interests`,
        undefined,
        s.ownerA,
      );
      const items = interests.json<{
        items: Array<{ opportunityId: string; status: string }>;
        total: number;
      }>();
      expect(items.total).toBe(1);
      expect(items.items[0]).toMatchObject({ opportunityId: id, status: "preparing" });

      const saved2 = await call(app, "GET", `${list()}?onlySaved=true`, undefined, s.ownerA);
      expect(saved2.json<{ items: Opportunity[] }>().items.map((i) => i.id)).toEqual([id]);
      const byInterest = await call(
        app,
        "GET",
        `${list()}?interestStatus=preparing`,
        undefined,
        s.ownerA,
      );
      expect(byInterest.json<{ total: number }>().total).toBe(1);

      expect(
        (await call(app, "PUT", `${list()}/${id}/interest`, { status: "talvez" }, s.ownerA))
          .statusCode,
      ).toBe(400);
      expect(
        (await call(app, "DELETE", `${list()}/${id}/interest`, undefined, s.ownerA)).statusCode,
      ).toBe(204);
      expect(
        (await call(app, "DELETE", `${list()}/${id}/interest`, undefined, s.ownerA)).statusCode,
      ).toBe(404);
    });

    it("checklist de requisitos com obrigatórios em aberto", async () => {
      const first = await call(
        app,
        "POST",
        `${list()}/${id}/requirements`,
        {
          description: "Certidão negativa federal",
          category: "habilitação fiscal",
          mandatory: true,
          sortOrder: 1,
        },
        s.ownerA,
      );
      expect(first.statusCode).toBe(201);
      const second = await call(
        app,
        "POST",
        `${list()}/${id}/requirements`,
        { description: "Atestado de capacidade técnica", mandatory: false, sortOrder: 2 },
        s.ownerA,
      );
      expect(second.statusCode).toBe(201);
      const requirementId = first.json<{ requirement: { id: string; source: string } }>()
        .requirement.id;
      expect(first.json<{ requirement: { source: string } }>().requirement.source).toBe("manual");

      let checklist = await call(app, "GET", `${list()}/${id}/requirements`, undefined, s.ownerA);
      expect(
        checklist.json<{ checklist: { total: number; mandatoryOpen: number } }>().checklist,
      ).toMatchObject({
        total: 2,
        mandatoryOpen: 1,
      });

      const met = await call(
        app,
        "PATCH",
        `${list()}/${id}/requirements/${requirementId}`,
        { status: "met", reviewComment: "Emitida hoje" },
        s.ownerA,
      );
      expect(met.statusCode).toBe(200);
      expect(
        met.json<{ requirement: { status: string; reviewedAt: string | null } }>().requirement
          .reviewedAt,
      ).not.toBeNull();
      checklist = await call(app, "GET", `${list()}/${id}/requirements`, undefined, s.ownerA);
      expect(
        checklist.json<{ checklist: { mandatoryOpen: number } }>().checklist.mandatoryOpen,
      ).toBe(0);

      const detail = await call(app, "GET", `${list()}/${id}`, undefined, s.ownerA);
      expect(
        detail.json<{
          opportunity: { requirements: unknown[]; checklist: { byStatus: { met: number } } };
        }>().opportunity,
      ).toMatchObject({
        checklist: { byStatus: { met: 1 } },
      });
      expect(
        (
          await call(
            app,
            "PATCH",
            `${list()}/${id}/requirements/${requirementId}`,
            { status: "feito" },
            s.ownerA,
          )
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await call(
            app,
            "PATCH",
            `${list()}/${id}/requirements/11111111-1111-4111-8111-111111111111`,
            { status: "met" },
            s.ownerA,
          )
        ).statusCode,
      ).toBe(404);
    });

    it("vincula documentos via document_links, respeita ACL e impede duplicidade", async () => {
      const open = await createDocumentWithFile(app, s.ownerA, s.orgA, s.matterAId, {
        title: "Edital em PDF",
        fileName: "edital.txt",
        content: Buffer.from("Texto do edital.", "utf8"),
        mime: "text/plain",
      });
      const secret = await createDocumentWithFile(app, s.ownerA, s.orgA, s.matterAId, {
        title: "Proposta sigilosa",
        fileName: "proposta.txt",
        content: Buffer.from("Preço sigiloso.", "utf8"),
        mime: "text/plain",
        confidentialityLevel: "confidential",
      });
      const linked = await call(
        app,
        "POST",
        `${list()}/${id}/documents`,
        { documentId: open.documentId, linkType: "reference" },
        s.ownerA,
      );
      expect(linked.statusCode).toBe(201);
      const linkId = linked.json<{ link: { id: string } }>().link.id;
      expect(
        (
          await call(
            app,
            "POST",
            `${list()}/${id}/documents`,
            { documentId: open.documentId, linkType: "reference" },
            s.ownerA,
          )
        ).statusCode,
      ).toBe(409);
      expect(
        (
          await call(
            app,
            "POST",
            `${list()}/${id}/documents`,
            { documentId: secret.documentId },
            s.ownerA,
          )
        ).statusCode,
      ).toBe(201);

      // membro vê só o documento que pode ler
      const asMember = await call(app, "GET", `${list()}/${id}/documents`, undefined, s.memberA);
      expect(
        asMember.json<{ items: Array<{ title: string }> }>().items.map((i) => i.title),
      ).toEqual(["Edital em PDF"]);
      const asOwner = await call(app, "GET", `${list()}/${id}/documents`, undefined, s.ownerA);
      expect(asOwner.json<{ items: unknown[] }>().items).toHaveLength(2);
      // membro não consegue vincular documento sigiloso
      const denied = await call(
        app,
        "POST",
        `${list()}/${id}/documents`,
        { documentId: secret.documentId, linkType: "proposal" },
        s.memberA,
      );
      expect([403, 404]).toContain(denied.statusCode);

      expect(
        (await call(app, "DELETE", `${list()}/${id}/documents/${linkId}`, undefined, s.ownerA))
          .statusCode,
      ).toBe(204);
      expect(
        (await call(app, "DELETE", `${list()}/${id}/documents/${linkId}`, undefined, s.ownerA))
          .statusCode,
      ).toBe(404);
    });
  });

  describe("isolamento entre organizações", () => {
    let id: string;

    beforeAll(async () => {
      const created = await create(s.ownerA, {
        title: "Oportunidade privada da org A",
        status: "open",
      });
      id = created.json<{ opportunity: Opportunity }>().opportunity.id;
      await call(
        app,
        "POST",
        `${list()}/${id}/requirements`,
        { description: "Requisito privado" },
        s.ownerA,
      );
    });

    it("org B não vê, não lista, não altera e não salva oportunidade da org A (404)", async () => {
      const requests: Array<[string, string, unknown?]> = [
        ["GET", `${list(s.orgB)}/${id}`],
        ["PATCH", `${list(s.orgB)}/${id}`, { title: "invadida" }],
        ["DELETE", `${list(s.orgB)}/${id}`],
        ["PUT", `${list(s.orgB)}/${id}/interest`, {}],
        ["GET", `${list(s.orgB)}/${id}/requirements`],
        ["POST", `${list(s.orgB)}/${id}/requirements`, { description: "intruso" }],
        ["GET", `${list(s.orgB)}/${id}/documents`],
        // usuário da org B usando o caminho da org A
        ["GET", `${list(s.orgA)}/${id}`],
        ["PATCH", `${list(s.orgA)}/${id}`, { title: "invadida" }],
      ];
      for (const [method, url, body] of requests) {
        const response = await call(
          app,
          method as "GET",
          url,
          body as Record<string, unknown> | undefined,
          s.ownerB,
        );
        expect(response.statusCode, `${method} ${url}`).toBe(404);
      }
      const listB = await call(app, "GET", list(s.orgB), undefined, s.ownerB);
      expect(listB.json<{ items: unknown[] }>().items).toHaveLength(0);
      expect((await call(app, "GET", list(), undefined, s.outsider)).statusCode).toBe(404);
      // título intacto
      const row = await database.db.query.publicOpportunities.findFirst({
        where: eq(publicOpportunities.id, id),
      });
      expect(row?.title).toBe("Oportunidade privada da org A");
    });

    it("referência global é visível, somente leitura, e interesses são por organização", async () => {
      const [global] = await database.db
        .insert(publicOpportunities)
        .values({
          organizationId: null,
          sourceProvider: "manual",
          opportunityType: "program",
          title: "Programa nacional de referência (fixture de teste)",
          object: "Fixture global",
          status: "open",
        })
        .returning();
      const globalId = global?.id as string;

      const viewA = await call(app, "GET", `${list(s.orgA)}/${globalId}`, undefined, s.ownerA);
      expect(viewA.statusCode).toBe(200);
      expect(viewA.json<{ opportunity: Opportunity }>().opportunity).toMatchObject({
        scope: "global",
        editable: false,
      });
      expect(
        (await call(app, "GET", `${list(s.orgB)}/${globalId}`, undefined, s.ownerB)).statusCode,
      ).toBe(200);

      expect(
        (await call(app, "PATCH", `${list(s.orgA)}/${globalId}`, { title: "alterada" }, s.ownerA))
          .statusCode,
      ).toBe(403);
      expect(
        (await call(app, "DELETE", `${list(s.orgA)}/${globalId}`, undefined, s.ownerA)).statusCode,
      ).toBe(403);

      expect(
        (
          await call(
            app,
            "PUT",
            `${list(s.orgA)}/${globalId}/interest`,
            { status: "interested" },
            s.ownerA,
          )
        ).statusCode,
      ).toBe(200);
      const aItems = await call(app, "GET", `${list(s.orgA)}?onlySaved=true`, undefined, s.ownerA);
      expect(aItems.json<{ items: Opportunity[] }>().items.map((i) => i.id)).toEqual([globalId]);
      const bItems = await call(app, "GET", `${list(s.orgB)}?onlySaved=true`, undefined, s.ownerB);
      expect(bItems.json<{ items: unknown[] }>().items).toHaveLength(0);
      const bView = await call(app, "GET", `${list(s.orgB)}/${globalId}`, undefined, s.ownerB);
      expect(bView.json<{ opportunity: Opportunity }>().opportunity.interest).toBeNull();

      const row = await database.db.query.publicOpportunities.findFirst({
        where: eq(publicOpportunities.id, globalId),
      });
      expect(row?.title).toBe("Programa nacional de referência (fixture de teste)");
    });
  });

  describe("permissões", () => {
    it("membro comum cria/edita, mas não arquiva nem encerra (requer public_opportunity.manage)", async () => {
      const created = await create(s.memberA, { title: "Criada pelo membro", status: "open" });
      expect(created.statusCode).toBe(201);
      const id = created.json<{ opportunity: Opportunity }>().opportunity.id;
      expect(
        (await call(app, "PATCH", `${list()}/${id}`, { title: "Editada pelo membro" }, s.memberA))
          .statusCode,
      ).toBe(200);
      expect((await call(app, "DELETE", `${list()}/${id}`, undefined, s.memberA)).statusCode).toBe(
        403,
      );
      expect(
        (await call(app, "PATCH", `${list()}/${id}`, { status: "closed" }, s.memberA)).statusCode,
      ).toBe(403);
      expect(
        (await call(app, "PATCH", `${list()}/${id}`, { status: "cancelled" }, s.memberA))
          .statusCode,
      ).toBe(403);
      expect(
        (await create(s.memberA, { title: "Já encerrada", status: "closed" })).statusCode,
      ).toBe(403);

      const archived = await call(app, "DELETE", `${list()}/${id}`, undefined, s.ownerA);
      expect(archived.statusCode).toBe(200);
      expect(archived.json<{ opportunity: Opportunity }>().opportunity.status).toBe("archived");
      // arquivada some da listagem padrão, mas aparece com filtro de status
      const visible = await call(app, "GET", list(), undefined, s.ownerA);
      expect(visible.json<{ items: Opportunity[] }>().items.some((i) => i.id === id)).toBe(false);
      const filtered = await call(app, "GET", `${list()}?status=archived`, undefined, s.ownerA);
      expect(filtered.json<{ items: Opportunity[] }>().items.some((i) => i.id === id)).toBe(true);
      // membro não reabre oportunidade arquivada
      expect(
        (await call(app, "PATCH", `${list()}/${id}`, { status: "open" }, s.memberA)).statusCode,
      ).toBe(403);
    });

    it("exige autenticação e UUID válido", async () => {
      expect((await app.inject({ method: "GET", url: list() })).statusCode).toBe(401);
      expect((await call(app, "POST", list(), { title: "x", object: "y" })).statusCode).toBe(401);
      expect((await call(app, "GET", `${list()}/nao-e-uuid`, undefined, s.ownerA)).statusCode).toBe(
        400,
      );
    });
  });

  it("título/descrição com HTML são devolvidos como texto simples em JSON (nunca como HTML confiável)", async () => {
    const payload = '<img src=x onerror=alert(1)><script>alert("xss")</script>';
    const created = await create(s.ownerA, { title: `Título ${payload}`, description: payload });
    expect(created.statusCode).toBe(201);
    expect(String(created.headers["content-type"])).toContain("application/json");
    expect(created.headers["x-content-type-options"]).toBe("nosniff");
    const opportunity = created.json<{ opportunity: Opportunity }>().opportunity;
    expect(opportunity.contentFormat).toBe("plain_text");
    // dado preservado para exibição escapada pelo cliente; o transporte nunca é text/html
    const detail = await call(app, "GET", `${list()}/${opportunity.id}`, undefined, s.ownerA);
    expect(String(detail.headers["content-type"])).not.toContain("html");
    expect(detail.headers["x-content-type-options"]).toBe("nosniff");
  });
});
