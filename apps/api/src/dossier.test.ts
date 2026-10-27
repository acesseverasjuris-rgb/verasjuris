import { createTestDatabase } from "@verasjuris/database/testing";
import { seedReferenceData } from "@verasjuris/database";
import { MemoryEmailProvider } from "@verasjuris/email";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified } from "./test-helpers.js";

describe("Etapa 4.2 — Dossier API", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let ownerA: string;
  let ownerB: string;
  let orgA: string;
  let orgB: string;
  let matterAId: string;
  let documentId: string;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
    });
    ownerA = await registerVerified(app, email, {
      displayName: "Owner A Dossier",
      email: "owner.a.dossier@exemplo.com",
    });
    ownerB = await registerVerified(app, email, {
      displayName: "Owner B Dossier",
      email: "owner.b.dossier@exemplo.com",
    });
    orgA = (await call(app, "POST", "/v1/organizations", { name: "Org Dossier A" }, ownerA)).json<{
      organization: { id: string };
    }>().organization.id;
    orgB = (await call(app, "POST", "/v1/organizations", { name: "Org Dossier B" }, ownerB)).json<{
      organization: { id: string };
    }>().organization.id;

    const client = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/crm/clients`,
      { personType: "person", fullName: "Cliente Dossier" },
      ownerA,
    );
    const clientId = client.json<{ client: { id: string } }>().client.id;
    const matter = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters`,
      { title: "Caso Dossier", clientId },
      ownerA,
    );
    matterAId = matter.json<{ matter: { id: string } }>().matter.id;

    const doc = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/documents`,
      {
        title: "Procuração",
        ownerType: "legal_matter",
        ownerId: matterAId,
        documentKind: "power_of_attorney",
        legalContext: "matter",
        evidentiaryRole: "supporting",
      },
      ownerA,
    );
    expect(doc.statusCode).toBe(201);
    documentId = doc.json<{ document: { id: string } }>().document.id;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("projeta dossiê do matter com documentos do owner", async () => {
    const dossier = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/matters/${matterAId}/dossier`,
      undefined,
      ownerA,
    );
    expect(dossier.statusCode).toBe(200);
    const body = dossier.json<{
      dossier: { documents: Array<{ id: string; documentKind: string }>; note: string };
    }>();
    expect(body.dossier.documents.some((d) => d.id === documentId)).toBe(true);
    expect(body.dossier.note).toMatch(/projeção/i);
  });

  it("classifica documento tipado", async () => {
    const classified = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/documents/${documentId}/classify`,
      {
        documentKind: "evidence",
        legalContext: "judicial",
        evidentiaryRole: "evidence",
      },
      ownerA,
    );
    expect(classified.statusCode).toBe(200);
    const document = classified.json<{
      document: { documentKind: string; evidentiaryRole: string };
    }>().document;
    expect(document.documentKind).toBe("evidence");
    expect(document.evidentiaryRole).toBe("evidence");
  });

  it("vincula e desvincula via document_links", async () => {
    const linked = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/dossier/links`,
      {
        documentId,
        linkType: "related_to",
        targetType: "legal_matter",
        targetId: matterAId,
      },
      ownerA,
    );
    expect(linked.statusCode).toBe(201);
    const linkId = linked.json<{ link: { id: string; relationType: string } }>().link.id;
    expect(linked.json<{ link: { relationType: string } }>().link.relationType).toBe("related_to");
    const unlinked = await call(
      app,
      "DELETE",
      `/v1/organizations/${orgA}/dossier/links/${linkId}`,
      undefined,
      ownerA,
    );
    expect(unlinked.statusCode).toBe(200);
  });

  it("retorna 404 cross-tenant no dossiê", async () => {
    const foreign = await call(
      app,
      "GET",
      `/v1/organizations/${orgB}/matters/${matterAId}/dossier`,
      undefined,
      ownerB,
    );
    expect(foreign.statusCode).toBe(404);
  });
});
