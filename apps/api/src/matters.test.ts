import { auditEvents } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { seedReferenceData } from "@verasjuris/database";
import { MemoryEmailProvider } from "@verasjuris/email";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified, sessionFrom, testPassword as password } from "./test-helpers.js";

describe("Etapa 3 — LegalMatter API", () => {
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
  let memberAMembershipId: string;
  let clientAId: string;
  let clientBId: string;
  let areaAId: string;
  let areaBId: string;
  let tagAId: string;

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
      displayName: "Owner A Matters",
      email: "owner.a.matters@exemplo.com",
    });
    ownerB = await registerVerified(app, email, {
      displayName: "Owner B Matters",
      email: "owner.b.matters@exemplo.com",
    });
    await registerVerified(app, email, {
      displayName: "Member A Matters",
      email: "member.a.matters@exemplo.com",
    });

    const createdA = await call(
      app,
      "POST",
      "/v1/organizations",
      { name: "Org Matters A" },
      ownerA,
    );
    expect(createdA.statusCode).toBe(201);
    orgA = createdA.json<{ organization: { id: string } }>().organization.id;

    const createdB = await call(
      app,
      "POST",
      "/v1/organizations",
      { name: "Org Matters B" },
      ownerB,
    );
    expect(createdB.statusCode).toBe(201);
    orgB = createdB.json<{ organization: { id: string } }>().organization.id;

    await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/members`,
      { email: "member.a.matters@exemplo.com" },
      ownerA,
    );
    const memberLogin = await call(app, "POST", "/v1/auth/login", {
      email: "member.a.matters@exemplo.com",
      password,
    });
    memberA = sessionFrom(memberLogin.headers);

    const membersA = await call(app, "GET", `/v1/organizations/${orgA}/members`, undefined, ownerA);
    const membersListA = membersA.json<{
      members: Array<{ membershipId: string; email: string }>;
    }>().members;
    ownerAMembershipId = membersListA.find(
      (item) => item.email === "owner.a.matters@exemplo.com",
    )!.membershipId;
    memberAMembershipId = membersListA.find(
      (item) => item.email === "member.a.matters@exemplo.com",
    )!.membershipId;

    const membersB = await call(app, "GET", `/v1/organizations/${orgB}/members`, undefined, ownerB);
    ownerBMembershipId = membersB
      .json<{ members: Array<{ membershipId: string; email: string }> }>()
      .members.find((item) => item.email === "owner.b.matters@exemplo.com")!.membershipId;

    const clientA = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/crm/clients`,
      { personType: "person", fullName: "Cliente Caso", email: "cliente.a.matters@exemplo.com" },
      ownerA,
    );
    expect(clientA.statusCode).toBe(201);
    clientAId = clientA.json<{ client: { id: string } }>().client.id;

    const clientB = await call(
      app,
      "POST",
      `/v1/organizations/${orgB}/crm/clients`,
      {
        personType: "person",
        fullName: "Cliente Matters B",
        email: "cliente.b.matters@exemplo.com",
      },
      ownerB,
    );
    expect(clientB.statusCode).toBe(201);
    clientBId = clientB.json<{ client: { id: string } }>().client.id;

    const areasA = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/legal-areas`,
      undefined,
      ownerA,
    );
    areaAId = areasA
      .json<{ legalAreas: Array<{ id: string; slug: string }> }>()
      .legalAreas.find((item) => item.slug === "trabalhista")!.id;

    const areasB = await call(
      app,
      "GET",
      `/v1/organizations/${orgB}/legal-areas`,
      undefined,
      ownerB,
    );
    areaBId = areasB.json<{ legalAreas: Array<{ id: string }> }>().legalAreas[0]!.id;

    const tag = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/crm/tags`,
      { name: "Urgente Matter" },
      ownerA,
    );
    expect(tag.statusCode).toBe(201);
    tagAId = tag.json<{ tag: { id: string } }>().tag.id;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  async function createLeadIntakeThroughClient() {
    const lead = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/crm/leads`,
      {
        personType: "person",
        name: "Lead Matter Pipeline",
        email: `lead.matter.${Date.now()}@exemplo.com`,
      },
      ownerA,
    );
    const leadId = lead.json<{ lead: { id: string } }>().lead.id;
    const intake = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/intakes`,
      { title: "Atendimento Matter", leadId },
      ownerA,
    );
    const intakeId = intake.json<{ intake: { id: string } }>().intake.id;
    await call(
      app,
      "PUT",
      `/v1/organizations/${orgA}/intakes/${intakeId}/triage`,
      { status: "in_progress", summary: "Triagem matter" },
      ownerA,
    );
    await call(
      app,
      "PUT",
      `/v1/organizations/${orgA}/intakes/${intakeId}/triage`,
      { status: "reviewed" },
      ownerA,
    );
    return { leadId, intakeId };
  }

  it("seed de tipos de demanda por organização", async () => {
    const types = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/demand-types`,
      undefined,
      ownerA,
    );
    expect(types.statusCode).toBe(200);
    const list = types.json<{ items: Array<{ slug: string }> }>().items;
    expect(list.some((item) => item.slug === "litigation")).toBe(true);
  });

  it("cria LegalMatter manualmente com referência interna", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters`,
      {
        title: "Caso Manual Trabalhista",
        clientId: clientAId,
        legalAreaId: areaAId,
        summary: "Demanda trabalhista",
        responsibleMembershipId: ownerAMembershipId,
      },
      ownerA,
    );
    expect(created.statusCode).toBe(201);
    const matter = created.json<{
      matter: { id: string; internalReference: string; status: string; title: string };
    }>().matter;
    expect(matter.title).toBe("Caso Manual Trabalhista");
    expect(matter.status).toBe("open");
    expect(matter.internalReference).toMatch(/^VJ-\d{4}-\d{6}$/);

    const detail = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/matters/${matter.id}`,
      undefined,
      ownerA,
    );
    expect(detail.statusCode).toBe(200);
    expect(detail.json<{ matter: { client: { id: string } } }>().matter.client.id).toBe(clientAId);

    const audits = await database.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.organizationId, orgA));
    expect(audits.some((event) => event.action === "matter.created")).toBe(true);
  });

  it("rejeita cliente de outro tenant com 404", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters`,
      { title: "Cliente alienígena", clientId: clientBId },
      ownerA,
    );
    expect(created.statusCode).toBe(404);
  });

  it("rejeita área jurídica de outro tenant com 404", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters`,
      { title: "Área alienígena", clientId: clientAId, legalAreaId: areaBId },
      ownerA,
    );
    expect(created.statusCode).toBe(404);
  });

  it("rejeita subárea incompatível com a área", async () => {
    const areas = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/legal-areas`,
      undefined,
      ownerA,
    );
    const civilId = areas
      .json<{ legalAreas: Array<{ id: string; slug: string }> }>()
      .legalAreas.find((item) => item.slug === "civel")!.id;

    const subarea = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/legal-subareas`,
      { legalAreaId: areaAId, name: "Rescisão contratual" },
      ownerA,
    );
    expect(subarea.statusCode).toBe(201);
    const subareaId = subarea.json<{ subarea: { id: string } }>().subarea.id;

    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters`,
      {
        title: "Subárea incompatível",
        clientId: clientAId,
        legalAreaId: civilId,
        legalSubareaId: subareaId,
      },
      ownerA,
    );
    expect([400, 404]).toContain(created.statusCode);
  });

  it("gerencia partes com múltiplas partes contrárias", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters`,
      { title: "Caso com partes", clientId: clientAId },
      ownerA,
    );
    const matterId = created.json<{ matter: { id: string } }>().matter.id;

    const p1 = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters/${matterId}/parties`,
      { displayName: "Réu Um", position: "opposing" },
      ownerA,
    );
    expect(p1.statusCode).toBe(201);
    const p2 = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters/${matterId}/parties`,
      { displayName: "Réu Dois", position: "opposing" },
      ownerA,
    );
    expect(p2.statusCode).toBe(201);

    const detail = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/matters/${matterId}`,
      undefined,
      ownerA,
    );
    const parties = detail.json<{
      matter: { parties: Array<{ displayName: string; position: string }> };
    }>().matter.parties;
    expect(parties.filter((item) => item.position === "opposing")).toHaveLength(2);

    const partyId = p1.json<{ party: { id: string } }>().party.id;
    const removed = await call(
      app,
      "DELETE",
      `/v1/organizations/${orgA}/matters/${matterId}/parties/${partyId}`,
      undefined,
      ownerA,
    );
    expect(removed.statusCode).toBe(200);

    const audits = await database.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.organizationId, orgA));
    expect(audits.some((event) => event.action === "matter.party_added")).toBe(true);
    expect(audits.some((event) => event.action === "matter.party_removed")).toBe(true);
  });

  it("atribui responsável e equipe; rejeita membro de outro tenant", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters`,
      { title: "Caso equipe", clientId: clientAId },
      ownerA,
    );
    const matterId = created.json<{ matter: { id: string } }>().matter.id;

    const team = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters/${matterId}/team`,
      { membershipId: memberAMembershipId, teamRole: "lawyer" },
      ownerA,
    );
    expect(team.statusCode).toBe(201);

    const responsible = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters/${matterId}/team`,
      { membershipId: ownerAMembershipId, teamRole: "responsible", isPrimary: true },
      ownerA,
    );
    expect(responsible.statusCode).toBe(201);

    const detail = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/matters/${matterId}`,
      undefined,
      ownerA,
    );
    expect(
      detail.json<{ matter: { responsibleMembershipId: string } }>().matter.responsibleMembershipId,
    ).toBe(ownerAMembershipId);

    const foreign = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters/${matterId}/team`,
      { membershipId: ownerBMembershipId, teamRole: "collaborator" },
      ownerA,
    );
    expect(foreign.statusCode).toBe(404);
  });

  it("valida honorários em centavos e basis points (rejeita float)", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters`,
      { title: "Caso honorários", clientId: clientAId },
      ownerA,
    );
    const matterId = created.json<{ matter: { id: string } }>().matter.id;

    const fee = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters/${matterId}/fees`,
      {
        type: "hybrid",
        fixedAmountCents: 150000,
        percentageBasisPoints: 2000,
        successFeeBasisPoints: 1000,
      },
      ownerA,
    );
    expect(fee.statusCode).toBe(201);
    expect(fee.json<{ fee: { fixedAmountCents: number } }>().fee.fixedAmountCents).toBe(150000);

    const floatCents = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters/${matterId}/fees`,
      { type: "fixed", fixedAmountCents: 10.5 },
      ownerA,
    );
    expect(floatCents.statusCode).toBe(400);

    const floatBp = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters/${matterId}/fees`,
      { type: "percentage", percentageBasisPoints: 12.5 },
      ownerA,
    );
    expect(floatBp.statusCode).toBe(400);
  });

  it("define tags do caso", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters`,
      { title: "Caso tags", clientId: clientAId },
      ownerA,
    );
    const matterId = created.json<{ matter: { id: string } }>().matter.id;

    const tags = await call(
      app,
      "PUT",
      `/v1/organizations/${orgA}/matters/${matterId}/tags`,
      { tagIds: [tagAId] },
      ownerA,
    );
    expect(tags.statusCode).toBe(200);
    expect(tags.json<{ ok: boolean; tagIds: string[] }>().tagIds).toEqual([tagAId]);

    const detail = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/matters/${matterId}`,
      undefined,
      ownerA,
    );
    expect(detail.json<{ matter: { tags: Array<{ id: string }> } }>().matter.tags[0]!.id).toBe(
      tagAId,
    );
  });

  it("transições de status: close, archive e restore", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters`,
      { title: "Caso status", clientId: clientAId },
      ownerA,
    );
    const matterId = created.json<{ matter: { id: string } }>().matter.id;

    const active = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters/${matterId}/status`,
      { status: "active" },
      ownerA,
    );
    expect(active.statusCode).toBe(200);
    expect(active.json<{ matter: { status: string } }>().matter.status).toBe("active");

    const waiting = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters/${matterId}/status`,
      { status: "waiting" },
      ownerA,
    );
    expect(waiting.statusCode).toBe(200);

    const closed = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters/${matterId}/status`,
      { status: "closed" },
      ownerA,
    );
    expect(closed.statusCode).toBe(200);
    expect(closed.json<{ matter: { status: string } }>().matter.status).toBe("closed");

    const archived = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters/${matterId}/status`,
      { status: "archived" },
      ownerA,
    );
    expect(archived.statusCode).toBe(200);
    expect(archived.json<{ matter: { status: string } }>().matter.status).toBe("archived");

    const restored = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters/${matterId}/status`,
      { status: "open" },
      ownerA,
    );
    expect(restored.statusCode).toBe(200);
    expect(restored.json<{ matter: { status: string } }>().matter.status).toBe("open");

    const invalid = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters/${matterId}/status`,
      { status: "draft" },
      ownerA,
    );
    expect(invalid.statusCode).toBe(409);

    const audits = await database.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.organizationId, orgA));
    expect(audits.some((event) => event.action === "matter.closed")).toBe(true);
    expect(audits.some((event) => event.action === "matter.archived")).toBe(true);
    expect(audits.some((event) => event.action === "matter.restored")).toBe(true);
    expect(audits.some((event) => event.action === "matter.status_changed")).toBe(true);
  });

  it("registra timeline operacional", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters`,
      { title: "Caso timeline", clientId: clientAId },
      ownerA,
    );
    const matterId = created.json<{ matter: { id: string } }>().matter.id;

    await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters/${matterId}/parties`,
      { displayName: "Parte timeline", position: "interested" },
      ownerA,
    );

    const timeline = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/matters/${matterId}/timeline`,
      undefined,
      ownerA,
    );
    expect(timeline.statusCode).toBe(200);
    const items = timeline.json<{ items: Array<{ eventType: string; title: string }> }>().items;
    expect(items.some((item) => item.eventType === "matter.created")).toBe(true);
    expect(items.some((item) => item.eventType === "matter.party_added")).toBe(true);
    expect(items.some((item) => item.title.includes("Caso") || item.title.includes("Parte"))).toBe(
      true,
    );
  });

  it("nega honorários e encerramento para membro sem permissão", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters`,
      { title: "Caso permissões membro", clientId: clientAId },
      ownerA,
    );
    const matterId = created.json<{ matter: { id: string } }>().matter.id;

    const feeDenied = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters/${matterId}/fees`,
      { type: "fixed", fixedAmountCents: 1000 },
      memberA,
    );
    expect(feeDenied.statusCode).toBe(403);

    const closeDenied = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters/${matterId}/status`,
      { status: "closed" },
      memberA,
    );
    expect(closeDenied.statusCode).toBe(403);

    const readOk = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/matters/${matterId}`,
      undefined,
      memberA,
    );
    expect(readOk.statusCode).toBe(200);

    const crossTenant = await call(
      app,
      "GET",
      `/v1/organizations/${orgB}/matters/${matterId}`,
      undefined,
      ownerB,
    );
    expect(crossTenant.statusCode).toBe(404);
  });

  it("protege IDOR cross-tenant", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters`,
      { title: "Caso IDOR", clientId: clientAId },
      ownerA,
    );
    const matterId = created.json<{ matter: { id: string } }>().matter.id;

    const foreign = await call(
      app,
      "GET",
      `/v1/organizations/${orgB}/matters/${matterId}`,
      undefined,
      ownerB,
    );
    expect(foreign.statusCode).toBe(404);

    const foreignUpdate = await call(
      app,
      "PATCH",
      `/v1/organizations/${orgB}/matters/${matterId}`,
      { title: "Hack" },
      ownerB,
    );
    expect(foreignUpdate.statusCode).toBe(404);
  });

  it("cria via pipeline com idempotência CONFLICT", async () => {
    const { leadId, intakeId } = await createLeadIntakeThroughClient();
    const opportunity = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities`,
      { title: "Oportunidade Matter", leadId, intakeId },
      ownerA,
    );
    const opportunityId = opportunity.json<{ opportunity: { id: string } }>().opportunity.id;

    await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities/${opportunityId}/move`,
      { stage: "intake" },
      ownerA,
    );
    await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities/${opportunityId}/move`,
      { stage: "triage" },
      ownerA,
    );
    await call(
      app,
      "PUT",
      `/v1/organizations/${orgA}/opportunities/${opportunityId}/analysis`,
      { status: "completed" },
      ownerA,
    );
    await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities/${opportunityId}/move`,
      { stage: "analysis" },
      ownerA,
    );
    const proposal = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities/${opportunityId}/proposals`,
      { title: "Proposta Matter", priceCents: 10000 },
      ownerA,
    );
    const proposalId = proposal.json<{ proposal: { id: string } }>().proposal.id;
    await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/proposals/${proposalId}/approve`,
      {},
      ownerA,
    );
    await call(app, "POST", `/v1/organizations/${orgA}/proposals/${proposalId}/send`, {}, ownerA);
    await call(app, "POST", `/v1/organizations/${orgA}/proposals/${proposalId}/accept`, {}, ownerA);
    await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities/${opportunityId}/engagement/activate`,
      {},
      ownerA,
    );

    const legalCase = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities/${opportunityId}/case`,
      { title: "Caso via Pipeline" },
      ownerA,
    );
    expect(legalCase.statusCode).toBe(201);
    const body = legalCase.json<{
      matter: { id: string; internalReference: string };
      case: { id: string };
    }>();
    expect(body.matter.id).toBe(body.case.id);
    expect(body.matter.internalReference).toMatch(/^VJ-\d{4}-\d{6}$/);

    const duplicate = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities/${opportunityId}/case`,
      { title: "Duplicado" },
      ownerA,
    );
    expect(duplicate.statusCode).toBe(409);

    const audits = await database.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.organizationId, orgA));
    expect(audits.some((event) => event.action === "matter.created")).toBe(true);
  });
});
