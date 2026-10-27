import {
  legalDocumentTemplateVersions,
  legalDocumentTemplates,
  seedReferenceData,
} from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { bootstrapEtapa6, type Etapa6Setup } from "./etapa6.fixtures.js";
import { call } from "./test-helpers.js";

describe("Etapa 7 — modelos de documento jurídico (legal templates)", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let s: Etapa6Setup;
  let systemTemplateId: string;
  let systemVersionId: string;

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
    s = await bootstrapEtapa6(app, email, "templates");

    const [systemTemplate] = await database.db
      .insert(legalDocumentTemplates)
      .values({
        organizationId: null,
        scope: "system",
        templateType: "initial_petition",
        name: "Petição inicial institucional",
        description: "Modelo VerasJuris",
        documentKind: "petition",
        active: true,
      })
      .returning();
    const [systemVersion] = await database.db
      .insert(legalDocumentTemplateVersions)
      .values({
        templateId: systemTemplate!.id,
        version: 1,
        content: "Excelentíssimo. Parte: {{party.name}}. Valor: {{claim.amount}}.",
        contentFormat: "plain_text",
        variableSchema: {
          fields: [
            { key: "party.name", label: "Parte", type: "party", required: true },
            { key: "claim.amount", label: "Valor", type: "money", required: false },
          ],
        },
        status: "active",
        activatedAt: new Date(),
      })
      .returning();
    await database.db
      .update(legalDocumentTemplates)
      .set({ currentVersionId: systemVersion!.id })
      .where(eq(legalDocumentTemplates.id, systemTemplate!.id));
    systemTemplateId = systemTemplate!.id;
    systemVersionId = systemVersion!.id;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("lista system + org; cria modelo da organização", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-document-templates`,
      {
        name: "Contestação org",
        templateType: "defense",
        documentKind: "petition",
        content: "Contestação de {{party.name}}.",
        contentFormat: "plain_text",
        variableSchema: {
          fields: [{ key: "party.name", label: "Parte", type: "party", required: true }],
        },
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    const orgTemplate = created.json<{ template: { id: string; scope: string } }>().template;
    expect(orgTemplate.scope).toBe("organization");

    const list = await call(
      app,
      "GET",
      `/v1/organizations/${s.orgA}/legal-document-templates?includeSystem=true`,
      undefined,
      s.ownerA,
    );
    expect(list.statusCode).toBe(200);
    const templates = list.json<{ templates: Array<{ id: string; scope: string }> }>().templates;
    expect(templates.some((item) => item.id === systemTemplateId && item.scope === "system")).toBe(
      true,
    );
    expect(templates.some((item) => item.id === orgTemplate.id)).toBe(true);
  });

  it("versão é imutável — nova edição cria nova versão", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-document-templates`,
      {
        name: "Recurso",
        templateType: "appeal",
        documentKind: "petition",
        content: "Recurso v1 {{party.name}}",
        contentFormat: "plain_text",
        variableSchema: {
          fields: [{ key: "party.name", label: "Parte", type: "party", required: true }],
        },
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    const templateId = created.json<{ template: { id: string } }>().template.id;
    const v1 = created.json<{ version: { id: string; version: number; content: string } }>()
      .version;
    expect(v1.version).toBe(1);

    const v2 = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-document-templates/${templateId}/versions`,
      {
        content: "Recurso v2 {{party.name}}",
        contentFormat: "plain_text",
        variableSchema: {
          fields: [{ key: "party.name", label: "Parte", type: "party", required: true }],
        },
        changelog: "Ajuste de texto",
      },
      s.ownerA,
    );
    expect(v2.statusCode).toBe(201);
    expect(v2.json<{ version: { version: number } }>().version.version).toBe(2);

    const stillV1 = await database.db.query.legalDocumentTemplateVersions.findFirst({
      where: eq(legalDocumentTemplateVersions.id, v1.id),
    });
    expect(stillV1?.content).toBe("Recurso v1 {{party.name}}");
  });

  it("preview destaca variáveis faltantes e não muta", async () => {
    const preview = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-document-templates/${systemTemplateId}/versions/${systemVersionId}/preview`,
      { context: { party: { name: "Maria" } } },
      s.ownerA,
    );
    expect(preview.statusCode).toBe(200);
    const body = preview.json<{
      preview: {
        rendered: string;
        missingVariables: string[];
        mutated: boolean;
      };
    }>().preview;
    expect(body.rendered).toContain("Maria");
    expect(body.rendered).toContain("⟦MISSING_VARIABLE:claim.amount⟧");
    expect(body.missingVariables).toContain("claim.amount");
    expect(body.mutated).toBe(false);

    const version = await database.db.query.legalDocumentTemplateVersions.findFirst({
      where: eq(legalDocumentTemplateVersions.id, systemVersionId),
    });
    expect(version?.content).toContain("{{party.name}}");
  });

  it("rejeita expressão maliciosa", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-document-templates`,
      {
        name: "Malicioso",
        templateType: "other",
        documentKind: "other",
        content: "Hack {{__proto__.polluted}} e {{constructor}}",
        contentFormat: "plain_text",
        variableSchema: { fields: [] },
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(400);
    expect(created.json<{ error: { code: string } }>().error.code).toBe("VALIDATION_ERROR");
  });

  it("não permite editar template SYSTEM in-place; duplicate copia para org", async () => {
    const patch = await call(
      app,
      "PATCH",
      `/v1/organizations/${s.orgA}/legal-document-templates/${systemTemplateId}`,
      { name: "Tentativa de alteração" },
      s.ownerA,
    );
    expect(patch.statusCode).toBe(403);

    const duplicated = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-document-templates/${systemTemplateId}/duplicate`,
      {},
      s.ownerA,
    );
    expect(duplicated.statusCode).toBe(201);
    const copy = duplicated.json<{
      template: { id: string; scope: string; organizationId: string | null };
      version: { status: string };
    }>();
    expect(copy.template.scope).toBe("organization");
    expect(copy.template.organizationId).toBe(s.orgA);
    expect(copy.template.id).not.toBe(systemTemplateId);
    expect(copy.version.status).toBe("draft");

    const system = await database.db.query.legalDocumentTemplates.findFirst({
      where: eq(legalDocumentTemplates.id, systemTemplateId),
    });
    expect(system?.name).toBe("Petição inicial institucional");
  });

  it("fluxo review → approve → activate depreca active anterior", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-document-templates`,
      {
        name: "Ativação",
        templateType: "motion",
        documentKind: "petition",
        content: "Pedido {{party.name}}",
        contentFormat: "plain_text",
        variableSchema: {
          fields: [{ key: "party.name", label: "Parte", type: "text", required: true }],
        },
      },
      s.ownerA,
    );
    const templateId = created.json<{ template: { id: string } }>().template.id;
    const v1Id = created.json<{ version: { id: string } }>().version.id;

    await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-document-templates/${templateId}/versions/${v1Id}/submit-for-review`,
      {},
      s.ownerA,
    );
    await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-document-templates/${templateId}/versions/${v1Id}/approve`,
      {},
      s.ownerA,
    );
    const activated = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-document-templates/${templateId}/versions/${v1Id}/activate`,
      {},
      s.ownerA,
    );
    expect(activated.statusCode).toBe(200);
    expect(activated.json<{ version: { status: string } }>().version.status).toBe("active");

    const v2 = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-document-templates/${templateId}/versions`,
      {
        content: "Pedido novo {{party.name}}",
        contentFormat: "plain_text",
        variableSchema: {
          fields: [{ key: "party.name", label: "Parte", type: "text", required: true }],
        },
      },
      s.ownerA,
    );
    const v2Id = v2.json<{ version: { id: string } }>().version.id;
    await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-document-templates/${templateId}/versions/${v2Id}/submit-for-review`,
      {},
      s.ownerA,
    );
    await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-document-templates/${templateId}/versions/${v2Id}/approve`,
      {},
      s.ownerA,
    );
    await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-document-templates/${templateId}/versions/${v2Id}/activate`,
      {},
      s.ownerA,
    );

    const old = await database.db.query.legalDocumentTemplateVersions.findFirst({
      where: eq(legalDocumentTemplateVersions.id, v1Id),
    });
    expect(old?.status).toBe("deprecated");
  });

  it("isolamento cross-tenant: 404", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/legal-document-templates`,
      {
        name: "Privado A",
        templateType: "notice",
        documentKind: "correspondence",
        content: "Aviso {{party.name}}",
        contentFormat: "plain_text",
        variableSchema: {
          fields: [{ key: "party.name", label: "Parte", type: "text", required: true }],
        },
      },
      s.ownerA,
    );
    const templateId = created.json<{ template: { id: string } }>().template.id;

    const cross = await call(
      app,
      "GET",
      `/v1/organizations/${s.orgA}/legal-document-templates/${templateId}`,
      undefined,
      s.ownerB,
    );
    expect(cross.statusCode).toBe(404);

    const viaB = await call(
      app,
      "GET",
      `/v1/organizations/${s.orgB}/legal-document-templates/${templateId}`,
      undefined,
      s.ownerB,
    );
    expect(viaB.statusCode).toBe(404);
  });
});
