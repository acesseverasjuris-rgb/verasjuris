import { auditEvents } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { seedReferenceData } from "@verasjuris/database";
import { MemoryEmailProvider } from "@verasjuris/email";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified, sessionFrom, testPassword as password } from "./test-helpers.js";

describe("Etapa 2.1 — Intake/Triage API", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let ownerA: string;
  let ownerB: string;
  let memberA: string;
  let orgA: string;
  let orgB: string;
  let ownerAMembershipId: string;
  let ownerBMembershipId: string;

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
      displayName: "Owner A Intake",
      email: "owner.a.intake@exemplo.com",
    });
    ownerB = await registerVerified(app, email, {
      displayName: "Owner B Intake",
      email: "owner.b.intake@exemplo.com",
    });
    await registerVerified(app, email, {
      displayName: "Member A Intake",
      email: "member.a.intake@exemplo.com",
    });

    const createdA = await call(app, "POST", "/v1/organizations", { name: "Org Intake A" }, ownerA);
    expect(createdA.statusCode).toBe(201);
    orgA = createdA.json<{ organization: { id: string } }>().organization.id;

    const createdB = await call(app, "POST", "/v1/organizations", { name: "Org Intake B" }, ownerB);
    expect(createdB.statusCode).toBe(201);
    orgB = createdB.json<{ organization: { id: string } }>().organization.id;

    await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/members`,
      { email: "member.a.intake@exemplo.com" },
      ownerA,
    );
    const memberLogin = await call(app, "POST", "/v1/auth/login", {
      email: "member.a.intake@exemplo.com",
      password,
    });
    memberA = sessionFrom(memberLogin.headers);

    const membersA = await call(app, "GET", `/v1/organizations/${orgA}/members`, undefined, ownerA);
    ownerAMembershipId = membersA
      .json<{ members: Array<{ membershipId: string; email: string }> }>()
      .members.find((item) => item.email === "owner.a.intake@exemplo.com")!.membershipId;

    const membersB = await call(app, "GET", `/v1/organizations/${orgB}/members`, undefined, ownerB);
    ownerBMembershipId = membersB
      .json<{ members: Array<{ membershipId: string; email: string }> }>()
      .members.find((item) => item.email === "owner.b.intake@exemplo.com")!.membershipId;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("seed de áreas jurídicas por organização", async () => {
    const areas = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/legal-areas`,
      undefined,
      ownerA,
    );
    expect(areas.statusCode).toBe(200);
    const list = areas.json<{ legalAreas: Array<{ slug: string; name: string }> }>().legalAreas;
    expect(list.length).toBeGreaterThanOrEqual(10);
    expect(list.some((item) => item.slug === "trabalhista")).toBe(true);
  });

  it("cria atendimento com novo lead", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/intakes`,
      {
        title: "Consulta previdenciária",
        summary: "Cliente busca aposentadoria",
        createLead: {
          personType: "person",
          name: "João Intake Novo",
          email: "joao.intake@exemplo.com",
        },
        urgency: "attention",
      },
      ownerA,
    );
    expect(created.statusCode).toBe(201);
    const intake = created.json<{
      intake: { id: string; status: string; leadId: string | null; title: string };
    }>().intake;
    expect(intake.status).toBe("open");
    expect(intake.leadId).toBeTruthy();
    expect(intake.title).toBe("Consulta previdenciária");

    const audits = await database.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.organizationId, orgA));
    expect(audits.some((event) => event.action === "intake.created")).toBe(true);
  });

  it("cria atendimento com lead existente", async () => {
    const lead = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/crm/leads`,
      { personType: "person", name: "Lead Existente Intake", email: "lead.existente@exemplo.com" },
      ownerA,
    );
    expect(lead.statusCode).toBe(201);
    const leadId = lead.json<{ lead: { id: string } }>().lead.id;

    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/intakes`,
      {
        title: "Atendimento com lead existente",
        leadId,
      },
      ownerA,
    );
    expect(created.statusCode).toBe(201);
    expect(created.json<{ intake: { leadId: string } }>().intake.leadId).toBe(leadId);
  });

  it("rejeita responsável de outra organização", async () => {
    const invalid = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/intakes`,
      {
        title: "Responsável inválido",
        responsibleMembershipId: ownerBMembershipId,
      },
      ownerA,
    );
    expect([400, 404]).toContain(invalid.statusCode);
  });

  it("cria, atualiza e revisa triagem", async () => {
    const intake = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/intakes`,
      { title: "Triagem completa", summary: "Caso trabalhista" },
      ownerA,
    );
    const intakeId = intake.json<{ intake: { id: string } }>().intake.id;

    const created = await call(
      app,
      "PUT",
      `/v1/organizations/${orgA}/intakes/${intakeId}/triage`,
      {
        status: "in_progress",
        summary: "Análise inicial",
        facts: "Cliente relata demissão sem justa causa",
      },
      ownerA,
    );
    expect(created.statusCode).toBe(200);
    expect(created.json<{ triage: { status: string } }>().triage.status).toBe("in_progress");

    const detail = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/intakes/${intakeId}`,
      undefined,
      ownerA,
    );
    expect(detail.json<{ intake: { status: string } }>().intake.status).toBe("triage");

    const reviewed = await call(
      app,
      "PUT",
      `/v1/organizations/${orgA}/intakes/${intakeId}/triage`,
      { status: "reviewed", nextAction: "Agendar reunião" },
      ownerA,
    );
    expect(reviewed.statusCode).toBe(200);
    expect(
      reviewed.json<{ triage: { status: string; reviewedAt: string | null } }>().triage.status,
    ).toBe("reviewed");
    expect(
      reviewed.json<{ triage: { reviewedAt: string | null } }>().triage.reviewedAt,
    ).toBeTruthy();
  });

  it("rejeita transição inválida de triagem", async () => {
    const intake = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/intakes`,
      { title: "Triagem inválida" },
      ownerA,
    );
    const intakeId = intake.json<{ intake: { id: string } }>().intake.id;

    await call(
      app,
      "PUT",
      `/v1/organizations/${orgA}/intakes/${intakeId}/triage`,
      { status: "in_progress" },
      ownerA,
    );

    const invalid = await call(
      app,
      "PUT",
      `/v1/organizations/${orgA}/intakes/${intakeId}/triage`,
      { status: "draft" },
      ownerA,
    );
    expect(invalid.statusCode).toBe(409);
  });

  it("protege intake cross-tenant com 404", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/intakes`,
      { title: "Isolamento tenant" },
      ownerA,
    );
    const intakeId = created.json<{ intake: { id: string } }>().intake.id;

    const read = await call(
      app,
      "GET",
      `/v1/organizations/${orgB}/intakes/${intakeId}`,
      undefined,
      ownerB,
    );
    expect(read.statusCode).toBe(404);

    const triage = await call(
      app,
      "PUT",
      `/v1/organizations/${orgB}/intakes/${intakeId}/triage`,
      { status: "in_progress" },
      ownerB,
    );
    expect(triage.statusCode).toBe(404);
  });

  it("converte atendimento via lead e bloqueia duplicata", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/intakes`,
      {
        title: "Conversão via lead",
        createLead: {
          personType: "person",
          name: "Lead Conversão Intake",
          email: "conversao.intake@exemplo.com",
        },
      },
      ownerA,
    );
    const intakeId = created.json<{ intake: { id: string } }>().intake.id;

    const converted = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/intakes/${intakeId}/convert`,
      {},
      ownerA,
    );
    expect(converted.statusCode).toBe(200);
    const clientId = converted.json<{ clientId: string }>().clientId;
    expect(clientId).toBeTruthy();

    const detail = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/intakes/${intakeId}`,
      undefined,
      ownerA,
    );
    expect(detail.json<{ intake: { status: string; clientId: string } }>().intake.status).toBe(
      "converted",
    );

    const again = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/intakes/${intakeId}/convert`,
      {},
      ownerA,
    );
    expect(again.statusCode).toBe(409);
  });

  it("registra documento indisponível e bloqueia upload recebido", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/intakes`,
      { title: "Documentos iniciais" },
      ownerA,
    );
    const intakeId = created.json<{ intake: { id: string } }>().intake.id;

    const unavailable = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/intakes/${intakeId}/documents`,
      {
        filename: "rg.pdf",
        status: "unavailable",
        unavailableReason: "Cliente não possui documento no momento",
      },
      ownerA,
    );
    expect(unavailable.statusCode).toBe(201);

    const pending = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/intakes/${intakeId}/documents`,
      { filename: "comprovante.pdf", status: "pending" },
      ownerA,
    );
    expect(pending.statusCode).toBe(201);

    const received = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/intakes/${intakeId}/documents`,
      { filename: "contrato.pdf", status: "received", mimeType: "application/pdf" },
      ownerA,
    );
    expect(received.statusCode).toBe(503);
    expect(received.json<{ error: { code: string } }>().error.code).toBe("NOT_CONFIGURED");

    const list = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/intakes/${intakeId}/documents`,
      undefined,
      ownerA,
    );
    expect(list.statusCode).toBe(200);
    expect(list.json<{ documents: unknown[] }>().documents.length).toBeGreaterThanOrEqual(2);
  });

  it("membro não encerra atendimento sem intake.close", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/intakes`,
      {
        title: "Encerramento negado",
        responsibleMembershipId: ownerAMembershipId,
      },
      ownerA,
    );
    const intakeId = created.json<{ intake: { id: string } }>().intake.id;

    const denied = await call(
      app,
      "PATCH",
      `/v1/organizations/${orgA}/intakes/${intakeId}`,
      { status: "closed" },
      memberA,
    );
    expect(denied.statusCode).toBe(403);

    const allowed = await call(
      app,
      "PATCH",
      `/v1/organizations/${orgA}/intakes/${intakeId}`,
      { status: "closed" },
      ownerA,
    );
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json<{ intake: { status: string } }>().intake.status).toBe("closed");
  });
});
