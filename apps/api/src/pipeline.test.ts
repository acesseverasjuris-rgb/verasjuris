import { auditEvents } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { seedReferenceData } from "@verasjuris/database";
import { MemoryEmailProvider } from "@verasjuris/email";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified, sessionFrom, testPassword as password } from "./test-helpers.js";

describe("Etapa 2.2 — Pipeline API", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let ownerA: string;
  let ownerB: string;
  let memberA: string;
  let orgA: string;
  let orgB: string;

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
      displayName: "Owner A Pipeline",
      email: "owner.a.pipeline@exemplo.com",
    });
    ownerB = await registerVerified(app, email, {
      displayName: "Owner B Pipeline",
      email: "owner.b.pipeline@exemplo.com",
    });
    await registerVerified(app, email, {
      displayName: "Member A Pipeline",
      email: "member.a.pipeline@exemplo.com",
    });

    const createdA = await call(
      app,
      "POST",
      "/v1/organizations",
      { name: "Org Pipeline A" },
      ownerA,
    );
    expect(createdA.statusCode).toBe(201);
    orgA = createdA.json<{ organization: { id: string } }>().organization.id;

    const createdB = await call(
      app,
      "POST",
      "/v1/organizations",
      { name: "Org Pipeline B" },
      ownerB,
    );
    expect(createdB.statusCode).toBe(201);
    orgB = createdB.json<{ organization: { id: string } }>().organization.id;

    await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/members`,
      { email: "member.a.pipeline@exemplo.com" },
      ownerA,
    );
    const memberLogin = await call(app, "POST", "/v1/auth/login", {
      email: "member.a.pipeline@exemplo.com",
      password,
    });
    memberA = sessionFrom(memberLogin.headers);
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  async function createLeadIntakeTriage() {
    const lead = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/crm/leads`,
      { personType: "person", name: "Lead Pipeline", email: "lead.pipeline@exemplo.com" },
      ownerA,
    );
    const leadId = lead.json<{ lead: { id: string } }>().lead.id;

    const intake = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/intakes`,
      { title: "Atendimento Pipeline", leadId },
      ownerA,
    );
    const intakeId = intake.json<{ intake: { id: string } }>().intake.id;

    await call(
      app,
      "PUT",
      `/v1/organizations/${orgA}/intakes/${intakeId}/triage`,
      { status: "in_progress", summary: "Triagem pipeline" },
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

  it("seed de motivos de perda por organização", async () => {
    const reasons = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/loss-reasons`,
      undefined,
      ownerA,
    );
    expect(reasons.statusCode).toBe(200);
    const list = reasons.json<{ lossReasons: Array<{ slug: string }> }>().lossReasons;
    expect(list.length).toBeGreaterThanOrEqual(9);
    expect(list.some((item) => item.slug === "no_response")).toBe(true);
  });

  it("cria oportunidade com lead vinculado", async () => {
    const { leadId } = await createLeadIntakeTriage();
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities`,
      { title: "Oportunidade Trabalhista", leadId, estimatedValueCents: 150000 },
      ownerA,
    );
    expect(created.statusCode).toBe(201);
    const opportunity = created.json<{
      opportunity: { id: string; stage: string; leadId: string; estimatedValueCents: number };
    }>().opportunity;
    expect(opportunity.stage).toBe("lead");
    expect(opportunity.leadId).toBe(leadId);
    expect(opportunity.estimatedValueCents).toBe(150000);

    const audits = await database.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.organizationId, orgA));
    expect(audits.some((event) => event.action === "pipeline.created")).toBe(true);
  });

  it("rejeita movimentação inválida de etapa", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities`,
      { title: "Movimento inválido" },
      ownerA,
    );
    const opportunityId = created.json<{ opportunity: { id: string } }>().opportunity.id;

    const invalid = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities/${opportunityId}/move`,
      { stage: "proposal" },
      ownerA,
    );
    expect(invalid.statusCode).toBe(409);
  });

  it("exige atendimento vinculado para avançar ao intake", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities`,
      { title: "Sem intake" },
      ownerA,
    );
    const opportunityId = created.json<{ opportunity: { id: string } }>().opportunity.id;

    const denied = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities/${opportunityId}/move`,
      { stage: "intake" },
      ownerA,
    );
    expect(denied.statusCode).toBe(400);
  });

  it("percorre pipeline com pré-condições, proposta e contratação", async () => {
    const { leadId, intakeId } = await createLeadIntakeTriage();

    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities`,
      { title: "Fluxo completo", leadId, intakeId },
      ownerA,
    );
    const opportunityId = created.json<{ opportunity: { id: string } }>().opportunity.id;

    const toIntake = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities/${opportunityId}/move`,
      { stage: "intake" },
      ownerA,
    );
    expect(toIntake.statusCode).toBe(200);
    expect(toIntake.json<{ opportunity: { stage: string } }>().opportunity.stage).toBe("intake");

    const toTriage = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities/${opportunityId}/move`,
      { stage: "triage" },
      ownerA,
    );
    expect(toTriage.statusCode).toBe(200);

    const analysis = await call(
      app,
      "PUT",
      `/v1/organizations/${orgA}/opportunities/${opportunityId}/analysis`,
      { summary: "Viável", status: "completed" },
      ownerA,
    );
    expect(analysis.statusCode).toBe(200);

    const toAnalysis = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities/${opportunityId}/move`,
      { stage: "analysis" },
      ownerA,
    );
    expect(toAnalysis.statusCode).toBe(200);

    const proposal = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities/${opportunityId}/proposals`,
      { title: "Proposta v1", priceCents: 250000 },
      ownerA,
    );
    expect(proposal.statusCode).toBe(201);
    const proposalId = proposal.json<{ proposal: { id: string; version: number } }>().proposal.id;
    expect(proposal.json<{ proposal: { version: number } }>().proposal.version).toBe(1);

    const toProposal = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities/${opportunityId}/move`,
      { stage: "proposal" },
      ownerA,
    );
    expect(toProposal.statusCode).toBe(200);

    const approved = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/proposals/${proposalId}/approve`,
      {},
      ownerA,
    );
    expect(approved.statusCode).toBe(200);

    const sent = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/proposals/${proposalId}/send`,
      {},
      ownerA,
    );
    expect(sent.statusCode).toBe(200);

    const accepted = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/proposals/${proposalId}/accept`,
      {},
      ownerA,
    );
    expect(accepted.statusCode).toBe(200);

    const detail = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/opportunities/${opportunityId}`,
      undefined,
      ownerA,
    );
    expect(detail.json<{ opportunity: { stage: string } }>().opportunity.stage).toBe("contracting");

    const duplicateAccept = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/proposals/${proposalId}/accept`,
      {},
      ownerA,
    );
    expect(duplicateAccept.statusCode).toBe(409);

    const activated = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities/${opportunityId}/engagement/activate`,
      {},
      ownerA,
    );
    expect(activated.statusCode).toBe(200);
    expect(
      activated.json<{ engagement: { status: string; clientId: string } }>().engagement.status,
    ).toBe("active");
    expect(activated.json<{ engagement: { clientId: string } }>().engagement.clientId).toBeTruthy();

    const afterActivate = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/opportunities/${opportunityId}`,
      undefined,
      ownerA,
    );
    expect(
      afterActivate.json<{ opportunity: { stage: string; clientId: string } }>().opportunity.stage,
    ).toBe("client");

    const legalCase = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities/${opportunityId}/case`,
      { title: "Caso Trabalhista Pipeline" },
      ownerA,
    );
    expect(legalCase.statusCode).toBe(201);
    const caseId = legalCase.json<{ case: { id: string } }>().case.id;

    const duplicateCase = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities/${opportunityId}/case`,
      { title: "Duplicado" },
      ownerA,
    );
    expect(duplicateCase.statusCode).toBe(409);

    const caseDetail = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/cases/${caseId}`,
      undefined,
      ownerA,
    );
    expect(caseDetail.statusCode).toBe(200);
    expect(caseDetail.json<{ case: { title: string } }>().case.title).toBe(
      "Caso Trabalhista Pipeline",
    );

    const audits = await database.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.organizationId, orgA));
    expect(audits.some((event) => event.action === "proposal.accepted")).toBe(true);
    expect(audits.some((event) => event.action === "engagement.activated")).toBe(true);
    expect(audits.some((event) => event.action === "matter.created")).toBe(true);
  });

  it("versiona proposta após ciclo concluído", async () => {
    const { leadId, intakeId } = await createLeadIntakeTriage();
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities`,
      { title: "Versionamento", leadId, intakeId },
      ownerA,
    );
    const opportunityId = created.json<{ opportunity: { id: string } }>().opportunity.id;

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

    const v1 = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities/${opportunityId}/proposals`,
      { title: "Proposta original", priceCents: 100000 },
      ownerA,
    );
    const proposalId = v1.json<{ proposal: { id: string } }>().proposal.id;
    await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/proposals/${proposalId}/approve`,
      {},
      ownerA,
    );
    await call(app, "POST", `/v1/organizations/${orgA}/proposals/${proposalId}/send`, {}, ownerA);
    await call(app, "POST", `/v1/organizations/${orgA}/proposals/${proposalId}/reject`, {}, ownerA);

    const v2 = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities/${opportunityId}/proposals`,
      { title: "Proposta revisada", priceCents: 120000 },
      ownerA,
    );
    expect(v2.statusCode).toBe(201);
    expect(v2.json<{ proposal: { version: number } }>().proposal.version).toBe(2);
  });

  it("marca perda, arquiva e restaura oportunidade", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities`,
      { title: "Perda e arquivo" },
      ownerA,
    );
    const opportunityId = created.json<{ opportunity: { id: string } }>().opportunity.id;

    const reasons = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/loss-reasons`,
      undefined,
      ownerA,
    );
    const lossReasonId = reasons.json<{ lossReasons: Array<{ id: string }> }>().lossReasons[0]!.id;

    const lost = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities/${opportunityId}/lose`,
      { lossReasonId, lossNotes: "Sem retorno do cliente" },
      ownerA,
    );
    expect(lost.statusCode).toBe(200);
    expect(lost.json<{ opportunity: { stage: string; status: string } }>().opportunity.stage).toBe(
      "lost",
    );

    const restored = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities/${opportunityId}/restore`,
      {},
      ownerA,
    );
    expect(restored.statusCode).toBe(200);
    expect(
      restored.json<{ opportunity: { stage: string; status: string } }>().opportunity.stage,
    ).toBe("lead");

    const archived = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities/${opportunityId}/archive`,
      { archiveReason: "Duplicada" },
      ownerA,
    );
    expect(archived.statusCode).toBe(200);
    expect(archived.json<{ opportunity: { stage: string } }>().opportunity.stage).toBe("archived");
  });

  it("protege oportunidade cross-tenant com 404", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities`,
      { title: "Isolamento tenant" },
      ownerA,
    );
    const opportunityId = created.json<{ opportunity: { id: string } }>().opportunity.id;

    const read = await call(
      app,
      "GET",
      `/v1/organizations/${orgB}/opportunities/${opportunityId}`,
      undefined,
      ownerB,
    );
    expect(read.statusCode).toBe(404);
  });

  it("membro não aprova proposta sem proposal.approve", async () => {
    const { leadId, intakeId } = await createLeadIntakeTriage();
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities`,
      { title: "Permissão proposta", leadId, intakeId },
      ownerA,
    );
    const opportunityId = created.json<{ opportunity: { id: string } }>().opportunity.id;

    const proposal = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/opportunities/${opportunityId}/proposals`,
      { title: "Proposta membro", priceCents: 50000 },
      memberA,
    );
    expect(proposal.statusCode).toBe(201);
    const proposalId = proposal.json<{ proposal: { id: string } }>().proposal.id;

    const denied = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/proposals/${proposalId}/approve`,
      {},
      memberA,
    );
    expect(denied.statusCode).toBe(403);
  });
});
