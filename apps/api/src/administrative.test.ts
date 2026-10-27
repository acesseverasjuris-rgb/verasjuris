import { auditEvents } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { seedReferenceData } from "@verasjuris/database";
import { MemoryEmailProvider } from "@verasjuris/email";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified, sessionFrom, testPassword as password } from "./test-helpers.js";

describe("Etapa 3.2 — AdministrativeProcess API", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let ownerA: string;
  let ownerB: string;
  let memberA: string;
  let orgA: string;
  let orgB: string;
  let matterAId: string;
  let matterBId: string;
  let bodyId: string;

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
      displayName: "Owner A Admin",
      email: "owner.a.admin@exemplo.com",
    });
    ownerB = await registerVerified(app, email, {
      displayName: "Owner B Admin",
      email: "owner.b.admin@exemplo.com",
    });
    await registerVerified(app, email, {
      displayName: "Member A Admin",
      email: "member.a.admin@exemplo.com",
    });

    const createdA = await call(app, "POST", "/v1/organizations", { name: "Org Admin A" }, ownerA);
    expect(createdA.statusCode).toBe(201);
    orgA = createdA.json<{ organization: { id: string } }>().organization.id;

    const createdB = await call(app, "POST", "/v1/organizations", { name: "Org Admin B" }, ownerB);
    expect(createdB.statusCode).toBe(201);
    orgB = createdB.json<{ organization: { id: string } }>().organization.id;

    await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/members`,
      { email: "member.a.admin@exemplo.com" },
      ownerA,
    );
    const memberLogin = await call(app, "POST", "/v1/auth/login", {
      email: "member.a.admin@exemplo.com",
      password,
    });
    memberA = sessionFrom(memberLogin.headers);

    const clientA = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/crm/clients`,
      { personType: "person", fullName: "Cliente Admin A" },
      ownerA,
    );
    const clientAId = clientA.json<{ client: { id: string } }>().client.id;

    const clientB = await call(
      app,
      "POST",
      `/v1/organizations/${orgB}/crm/clients`,
      { personType: "person", fullName: "Cliente Admin B" },
      ownerB,
    );
    const clientBId = clientB.json<{ client: { id: string } }>().client.id;

    const matterA = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters`,
      { title: "Caso Admin A", clientId: clientAId },
      ownerA,
    );
    expect(matterA.statusCode).toBe(201);
    matterAId = matterA.json<{ matter: { id: string } }>().matter.id;

    const matterB = await call(
      app,
      "POST",
      `/v1/organizations/${orgB}/matters`,
      { title: "Caso Admin B", clientId: clientBId },
      ownerB,
    );
    matterBId = matterB.json<{ matter: { id: string } }>().matter.id;

    const bodies = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/administrative-bodies`,
      undefined,
      ownerA,
    );
    expect(bodies.statusCode).toBe(200);
    const bodyList = bodies.json<{
      administrativeBodies: Array<{ id: string; acronym: string | null }>;
    }>().administrativeBodies;
    expect(bodyList.length).toBeGreaterThan(0);
    bodyId = bodyList.find((item) => item.acronym === "INSS")!.id;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  function matterPath(matterId: string) {
    return `/v1/organizations/${orgA}/matters/${matterId}/administrative-processes`;
  }

  function processPath(processId: string) {
    return `/v1/organizations/${orgA}/administrative-processes/${processId}`;
  }

  it("cria processo com número normalizado e protocolo manual", async () => {
    const created = await call(
      app,
      "POST",
      matterPath(matterAId),
      {
        administrativeBodyId: bodyId,
        subject: "Revisão de benefício",
        number: "NB-123.456/2024",
        protocolNumber: "PROT-2024-001",
        protocolDate: new Date("2024-05-01T12:00:00.000Z").toISOString(),
        protocolSource: "manual",
        status: "active",
        priority: "high",
      },
      ownerA,
    );
    expect(created.statusCode).toBe(201);
    const process = created.json<{
      process: {
        id: string;
        number: string;
        normalizedNumber: string;
        protocolNumber: string;
        protocolSource: string;
        status: string;
        source: string;
      };
    }>().process;
    expect(process.number).toBe("NB-123.456/2024");
    expect(process.normalizedNumber).toBe("NB1234562024");
    expect(process.protocolNumber).toBe("PROT-2024-001");
    expect(process.protocolSource).toBe("manual");
    expect(process.status).toBe("active");
    expect(process.source).toBe("manual");

    const got = await call(app, "GET", processPath(process.id), undefined, ownerA);
    expect(got.statusCode).toBe(200);
    expect(got.json<{ process: { id: string } }>().process.id).toBe(process.id);

    const updated = await call(
      app,
      "PATCH",
      processPath(process.id),
      { status: "waiting_body", currentPhase: "análise preliminar" },
      ownerA,
    );
    expect(updated.statusCode).toBe(200);
    expect(updated.json<{ process: { status: string } }>().process.status).toBe("waiting_body");
  });

  it("conflita número duplicado na organização", async () => {
    const duplicate = await call(
      app,
      "POST",
      matterPath(matterAId),
      {
        administrativeBodyId: bodyId,
        subject: "Duplicado",
        number: "NB-123.456/2024",
      },
      ownerA,
    );
    expect(duplicate.statusCode).toBe(409);
  });

  it("retorna 404 cross-tenant / matter externo", async () => {
    const missingMatter = await call(
      app,
      "POST",
      matterPath("00000000-0000-4000-8000-000000000099"),
      { administrativeBodyId: bodyId, subject: "Inexistente" },
      ownerA,
    );
    expect(missingMatter.statusCode).toBe(404);

    const crossMatter = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters/${matterBId}/administrative-processes`,
      { administrativeBodyId: bodyId, subject: "Cross matter" },
      ownerA,
    );
    expect(crossMatter.statusCode).toBe(404);

    const list = await call(app, "GET", matterPath(matterAId), undefined, ownerA);
    const processId = list.json<{ items: Array<{ id: string }> }>().items[0]!.id;

    const crossOrg = await call(
      app,
      "GET",
      `/v1/organizations/${orgB}/administrative-processes/${processId}`,
      undefined,
      ownerB,
    );
    expect(crossOrg.statusCode).toBe(404);
  });

  it("exige regras de protocolo em requerimento SUBMITTED", async () => {
    const created = await call(
      app,
      "POST",
      matterPath(matterAId),
      {
        administrativeBodyId: bodyId,
        subject: "Requerimento protocol rules",
        number: "REQ-RULES-001",
      },
      ownerA,
    );
    const processId = created.json<{ process: { id: string } }>().process.id;

    const badSubmit = await call(
      app,
      "POST",
      `${processPath(processId)}/requests`,
      {
        requestType: "revisão",
        title: "Pedido sem protocolo",
        status: "submitted",
        submittedAt: new Date().toISOString(),
      },
      ownerA,
    );
    expect(badSubmit.statusCode).toBe(400);

    const withJustification = await call(
      app,
      "POST",
      `${processPath(processId)}/requests`,
      {
        requestType: "revisão",
        title: "Pedido com justificativa",
        status: "submitted",
        submittedAt: new Date().toISOString(),
        justification: "Protocolo oral no atendimento presencial",
        source: "manual",
      },
      ownerA,
    );
    expect(withJustification.statusCode).toBe(201);
    expect(withJustification.json<{ request: { source: string } }>().request.source).toBe("manual");

    const withProtocol = await call(
      app,
      "POST",
      `${processPath(processId)}/requests`,
      {
        requestType: "revisão",
        title: "Pedido com protocolo",
        status: "submitted",
        submittedAt: new Date().toISOString(),
        protocolNumber: "INSS-PROT-99",
        source: "manual",
      },
      ownerA,
    );
    expect(withProtocol.statusCode).toBe(201);

    const requestId = withProtocol.json<{ request: { id: string } }>().request.id;
    const confirmed = await call(
      app,
      "PATCH",
      `${processPath(processId)}/requests/${requestId}`,
      { status: "confirmed" },
      ownerA,
    );
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json<{ request: { status: string } }>().request.status).toBe("confirmed");
  });

  it("gerencia exigências, prazos, decisões, recursos e timeline", async () => {
    const created = await call(
      app,
      "POST",
      matterPath(matterAId),
      {
        administrativeBodyId: bodyId,
        subject: "Fluxo completo",
        number: "FLOW-001",
        status: "active",
      },
      ownerA,
    );
    const processId = created.json<{ process: { id: string } }>().process.id;

    const requirement = await call(
      app,
      "POST",
      `${processPath(processId)}/requirements`,
      { title: "Documentos pendentes", status: "open" },
      ownerA,
    );
    expect(requirement.statusCode).toBe(201);

    const deadline = await call(
      app,
      "POST",
      `${processPath(processId)}/deadlines`,
      {
        title: "Prazo para cumprimento",
        dueAt: new Date("2024-12-01T15:00:00.000Z").toISOString(),
        status: "suggested",
      },
      ownerA,
    );
    expect(deadline.statusCode).toBe(201);
    const deadlineId = deadline.json<{ deadline: { id: string } }>().deadline.id;

    const confirmDeadline = await call(
      app,
      "PATCH",
      `${processPath(processId)}/deadlines/${deadlineId}`,
      { status: "confirmed" },
      ownerA,
    );
    expect(confirmDeadline.statusCode).toBe(200);
    expect(confirmDeadline.json<{ deadline: { status: string } }>().deadline.status).toBe(
      "confirmed",
    );

    const decision = await call(
      app,
      "POST",
      `${processPath(processId)}/decisions`,
      {
        decisionType: "deferimento_parcial",
        title: "Decisão administrativa",
        decidedAt: new Date("2024-11-01T12:00:00.000Z").toISOString(),
      },
      ownerA,
    );
    expect(decision.statusCode).toBe(201);

    const appealNoProtocol = await call(
      app,
      "POST",
      `${processPath(processId)}/appeals`,
      { appealType: "recurso_hierárquico", title: "Recurso", status: "filed" },
      ownerA,
    );
    expect(appealNoProtocol.statusCode).toBe(400);

    const appeal = await call(
      app,
      "POST",
      `${processPath(processId)}/appeals`,
      {
        appealType: "recurso_hierárquico",
        title: "Recurso",
        status: "filed",
        protocolNumber: "REC-001",
        filedAt: new Date("2024-11-15T12:00:00.000Z").toISOString(),
      },
      ownerA,
    );
    expect(appeal.statusCode).toBe(201);

    const timeline = await call(
      app,
      "GET",
      `${processPath(processId)}/timeline`,
      undefined,
      ownerA,
    );
    expect(timeline.statusCode).toBe(200);
    expect(timeline.json<{ timeline: unknown[] }>().timeline.length).toBeGreaterThan(0);
  });

  it("close/reopen e permissão de member", async () => {
    const created = await call(
      app,
      "POST",
      matterPath(matterAId),
      {
        administrativeBodyId: bodyId,
        subject: "Para encerrar",
        number: "CLOSE-001",
        status: "active",
      },
      ownerA,
    );
    const processId = created.json<{ process: { id: string } }>().process.id;

    const memberClose = await call(
      app,
      "POST",
      `${processPath(processId)}/close`,
      { closureReason: "Arquivado no órgão" },
      memberA,
    );
    expect(memberClose.statusCode).toBe(403);

    const closed = await call(
      app,
      "POST",
      `${processPath(processId)}/close`,
      { closureReason: "Arquivado no órgão", closureNotes: "Baixa manual" },
      ownerA,
    );
    expect(closed.statusCode).toBe(200);
    expect(closed.json<{ process: { status: string } }>().process.status).toBe("closed");

    const memberReopen = await call(app, "POST", `${processPath(processId)}/reopen`, {}, memberA);
    expect(memberReopen.statusCode).toBe(403);

    const reopened = await call(
      app,
      "POST",
      `${processPath(processId)}/reopen`,
      { notes: "Reabertura" },
      ownerA,
    );
    expect(reopened.statusCode).toBe(200);
    expect(reopened.json<{ process: { status: string } }>().process.status).toBe("active");

    const memberCreate = await call(
      app,
      "POST",
      matterPath(matterAId),
      {
        administrativeBodyId: bodyId,
        subject: "Criado por member",
        number: "MEMBER-001",
      },
      memberA,
    );
    expect(memberCreate.statusCode).toBe(201);

    const audits = await database.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.organizationId, orgA));
    const actions = audits.map((item) => item.action);
    expect(actions).toContain("administrative_process.created");
    expect(actions).toContain("administrative_process.closed");
    expect(actions).toContain("administrative_process.reopened");
  });
});
