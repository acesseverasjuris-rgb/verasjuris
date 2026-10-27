import { auditEvents, legalMatters } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { seedReferenceData } from "@verasjuris/database";
import { MemoryEmailProvider } from "@verasjuris/email";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified, sessionFrom, testPassword as password } from "./test-helpers.js";

const VALID_CNJ_A = "0000001-20.2016.8.26.0100";
const VALID_CNJ_B = "1234567-37.2024.5.02.0001";
const INVALID_DV_CNJ = "0000001-99.2016.8.26.0100";

describe("Etapa 3.1 — JudicialProcess API", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let ownerA: string;
  let ownerB: string;
  let memberA: string;
  let orgA: string;
  let orgB: string;
  let clientAId: string;
  let matterAId: string;
  let matterBId: string;
  let tribunalId: string;
  let phaseId: string;
  let subjectId: string;
  let classId: string;

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
      displayName: "Owner A Judicial",
      email: "owner.a.judicial@exemplo.com",
    });
    ownerB = await registerVerified(app, email, {
      displayName: "Owner B Judicial",
      email: "owner.b.judicial@exemplo.com",
    });
    await registerVerified(app, email, {
      displayName: "Member A Judicial",
      email: "member.a.judicial@exemplo.com",
    });

    const createdA = await call(
      app,
      "POST",
      "/v1/organizations",
      { name: "Org Judicial A" },
      ownerA,
    );
    expect(createdA.statusCode).toBe(201);
    orgA = createdA.json<{ organization: { id: string } }>().organization.id;

    const createdB = await call(
      app,
      "POST",
      "/v1/organizations",
      { name: "Org Judicial B" },
      ownerB,
    );
    expect(createdB.statusCode).toBe(201);
    orgB = createdB.json<{ organization: { id: string } }>().organization.id;

    await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/members`,
      { email: "member.a.judicial@exemplo.com" },
      ownerA,
    );
    const memberLogin = await call(app, "POST", "/v1/auth/login", {
      email: "member.a.judicial@exemplo.com",
      password,
    });
    memberA = sessionFrom(memberLogin.headers);

    const clientA = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/crm/clients`,
      { personType: "person", fullName: "Cliente Judicial A" },
      ownerA,
    );
    clientAId = clientA.json<{ client: { id: string } }>().client.id;

    const clientB = await call(
      app,
      "POST",
      `/v1/organizations/${orgB}/crm/clients`,
      { personType: "person", fullName: "Cliente Judicial B" },
      ownerB,
    );
    const clientBId = clientB.json<{ client: { id: string } }>().client.id;

    const matterA = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters`,
      { title: "Caso Judicial A", clientId: clientAId },
      ownerA,
    );
    expect(matterA.statusCode).toBe(201);
    matterAId = matterA.json<{ matter: { id: string } }>().matter.id;

    const matterB = await call(
      app,
      "POST",
      `/v1/organizations/${orgB}/matters`,
      { title: "Caso Judicial B", clientId: clientBId },
      ownerB,
    );
    matterBId = matterB.json<{ matter: { id: string } }>().matter.id;

    const courts = await call(app, "GET", `/v1/organizations/${orgA}/courts`, undefined, ownerA);
    expect(courts.statusCode).toBe(200);
    const courtList = courts.json<{ courts: Array<{ id: string; acronym: string }> }>().courts;
    expect(courtList.length).toBeGreaterThan(0);
    tribunalId = courtList.find((item) => item.acronym === "TJSP")!.id;

    const phases = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/judicial-phases`,
      undefined,
      ownerA,
    );
    phaseId = phases
      .json<{ judicialPhases: Array<{ id: string; slug: string }> }>()
      .judicialPhases.find((item) => item.slug === "conhecimento")!.id;

    const subjects = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/procedural-subjects`,
      undefined,
      ownerA,
    );
    subjectId = subjects.json<{ proceduralSubjects: Array<{ id: string }> }>()
      .proceduralSubjects[0]!.id;

    const classes = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/procedural-classes`,
      undefined,
      ownerA,
    );
    classId = classes.json<{ proceduralClasses: Array<{ id: string }> }>().proceduralClasses[0]!.id;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  function processPath(matterId: string, processId?: string) {
    const base = `/v1/organizations/${orgA}/matters/${matterId}/judicial-processes`;
    return processId ? `${base}/${processId}` : base;
  }

  it("rejeita CNJ inválido e DV incorreto", async () => {
    const short = await call(
      app,
      "POST",
      processPath(matterAId),
      { cnjNumber: "123", tribunalId },
      ownerA,
    );
    expect(short.statusCode).toBe(400);

    const badDv = await call(
      app,
      "POST",
      processPath(matterAId),
      { cnjNumber: INVALID_DV_CNJ, tribunalId },
      ownerA,
    );
    expect(badDv.statusCode).toBe(400);
    expect(badDv.json<{ error: { message: string } }>().error.message).toMatch(/correção|CNJ/i);
  });

  it("cria, lê e atualiza processo com CNJ válido", async () => {
    const created = await call(
      app,
      "POST",
      processPath(matterAId),
      {
        cnjNumber: VALID_CNJ_A,
        tribunalId,
        proceduralClassId: classId,
        primarySubjectId: subjectId,
        subjectIds: [subjectId],
        currentPhaseId: phaseId,
        courtUnitText: "1ª Vara Cível",
        districtText: "São Paulo",
        confidentialityLevel: "restricted",
      },
      ownerA,
    );
    expect(created.statusCode).toBe(201);
    const process = created.json<{
      process: {
        id: string;
        cnjNumber: string;
        cnjNumberNormalized: string;
        source: string;
        status: string;
      };
    }>().process;
    expect(process.cnjNumber).toBe(VALID_CNJ_A);
    expect(process.cnjNumberNormalized).toBe("00000012020168260100");
    expect(process.source).toBe("manual");
    expect(process.status).toBe("active");

    const got = await call(app, "GET", processPath(matterAId, process.id), undefined, ownerA);
    expect(got.statusCode).toBe(200);
    expect(got.json<{ process: { id: string } }>().process.id).toBe(process.id);

    const updated = await call(
      app,
      "PATCH",
      processPath(matterAId, process.id),
      { courtUnitText: "2ª Vara Cível", confidentialityLevel: "public" },
      ownerA,
    );
    expect(updated.statusCode).toBe(200);
    expect(updated.json<{ process: { courtUnitText: string } }>().process.courtUnitText).toBe(
      "2ª Vara Cível",
    );
  });

  it("conflita CNJ duplicado na organização", async () => {
    const duplicate = await call(
      app,
      "POST",
      processPath(matterAId),
      { cnjNumber: VALID_CNJ_A, tribunalId },
      ownerA,
    );
    expect(duplicate.statusCode).toBe(409);
  });

  it("retorna 404 para matter externo / IDOR", async () => {
    const missingMatter = await call(
      app,
      "POST",
      processPath("00000000-0000-4000-8000-000000000099"),
      { cnjNumber: VALID_CNJ_B, tribunalId },
      ownerA,
    );
    expect(missingMatter.statusCode).toBe(404);

    const crossMatter = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters/${matterBId}/judicial-processes`,
      { cnjNumber: VALID_CNJ_B, tribunalId },
      ownerA,
    );
    expect(crossMatter.statusCode).toBe(404);
  });

  it("gerencia partes, advogados (OAB unverified) e fases", async () => {
    const created = await call(
      app,
      "POST",
      processPath(matterAId),
      { cnjNumber: VALID_CNJ_B, tribunalId, currentPhaseId: phaseId },
      ownerA,
    );
    expect(created.statusCode).toBe(201);
    const processId = created.json<{ process: { id: string } }>().process.id;

    const party = await call(
      app,
      "POST",
      `${processPath(matterAId, processId)}/parties`,
      { displayName: "Autor Teste", proceduralRole: "author", side: "active" },
      ownerA,
    );
    expect(party.statusCode).toBe(201);

    const lawyer = await call(
      app,
      "POST",
      `${processPath(matterAId, processId)}/lawyers`,
      {
        displayName: "Dra. Maria",
        oabNumber: "123456",
        oabState: "SP",
        partyId: party.json<{ party: { id: string } }>().party.id,
      },
      ownerA,
    );
    expect(lawyer.statusCode).toBe(201);
    expect(
      lawyer.json<{ lawyer: { oabVerificationStatus: string } }>().lawyer.oabVerificationStatus,
    ).toBe("unverified");

    const phasesCatalog = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/judicial-phases`,
      undefined,
      ownerA,
    );
    const recursoId = phasesCatalog
      .json<{ judicialPhases: Array<{ id: string; slug: string }> }>()
      .judicialPhases.find((item) => item.slug === "recurso")!.id;

    const phaseChange = await call(
      app,
      "POST",
      `${processPath(matterAId, processId)}/phases`,
      { phaseId: recursoId, notes: "Interposição" },
      ownerA,
    );
    expect(phaseChange.statusCode).toBe(201);

    const history = await call(
      app,
      "GET",
      `${processPath(matterAId, processId)}/phases`,
      undefined,
      ownerA,
    );
    expect(history.statusCode).toBe(200);
    expect(history.json<{ phases: unknown[] }>().phases.length).toBeGreaterThanOrEqual(2);
  });

  it("registra movimentações, audiências, decisões, recursos e cumprimento", async () => {
    const list = await call(app, "GET", processPath(matterAId), undefined, ownerA);
    const processId = list
      .json<{ items: Array<{ id: string; cnjNumber: string }> }>()
      .items.find((item) => item.cnjNumber === VALID_CNJ_B)!.id;

    const movement = await call(
      app,
      "POST",
      `${processPath(matterAId, processId)}/movements`,
      {
        occurredAt: new Date("2024-06-01T12:00:00.000Z").toISOString(),
        title: "Juntada de petição",
        description: "Petição intermediária",
      },
      ownerA,
    );
    expect(movement.statusCode).toBe(201);
    expect(movement.json<{ movement: { source: string } }>().movement.source).toBe("manual");

    const hearing = await call(
      app,
      "POST",
      `${processPath(matterAId, processId)}/hearings`,
      {
        type: "conciliation",
        scheduledAt: new Date("2024-07-01T15:00:00.000Z").toISOString(),
        locationType: "remote",
      },
      ownerA,
    );
    expect(hearing.statusCode).toBe(201);
    const hearingId = hearing.json<{ hearing: { id: string } }>().hearing.id;

    const hearingUpdate = await call(
      app,
      "PATCH",
      `${processPath(matterAId, processId)}/hearings/${hearingId}`,
      { status: "confirmed" },
      ownerA,
    );
    expect(hearingUpdate.statusCode).toBe(200);
    expect(hearingUpdate.json<{ hearing: { status: string } }>().hearing.status).toBe("confirmed");

    const held = await call(
      app,
      "PATCH",
      `${processPath(matterAId, processId)}/hearings/${hearingId}`,
      { status: "held", resultSummary: "Acordo parcial" },
      ownerA,
    );
    expect(held.statusCode).toBe(200);

    const invalidHearing = await call(
      app,
      "PATCH",
      `${processPath(matterAId, processId)}/hearings/${hearingId}`,
      { status: "scheduled" },
      ownerA,
    );
    expect(invalidHearing.statusCode).toBe(409);

    const decision = await call(
      app,
      "POST",
      `${processPath(matterAId, processId)}/decisions`,
      {
        decisionType: "sentence",
        title: "Sentença de procedência parcial",
        decidedAt: new Date("2024-08-01T12:00:00.000Z").toISOString(),
      },
      ownerA,
    );
    expect(decision.statusCode).toBe(201);

    const matterAfterDecision = await database.db.query.legalMatters.findFirst({
      where: eq(legalMatters.id, matterAId),
    });
    expect(matterAfterDecision?.status).not.toBe("closed");

    const appealNoProtocol = await call(
      app,
      "POST",
      `${processPath(matterAId, processId)}/appeals`,
      { appealType: "Apelação", status: "filed" },
      ownerA,
    );
    expect(appealNoProtocol.statusCode).toBe(400);

    const appeal = await call(
      app,
      "POST",
      `${processPath(matterAId, processId)}/appeals`,
      {
        appealType: "Apelação",
        status: "filed",
        protocolReference: "PROT-2024-001",
        filedAt: new Date("2024-09-01T12:00:00.000Z").toISOString(),
      },
      ownerA,
    );
    expect(appeal.statusCode).toBe(201);

    const enforcement = await call(
      app,
      "POST",
      `${processPath(matterAId, processId)}/enforcement`,
      { type: "compliance", status: "active", summary: "Cumprimento de sentença" },
      ownerA,
    );
    expect(enforcement.statusCode).toBe(201);

    const timeline = await call(
      app,
      "GET",
      `${processPath(matterAId, processId)}/timeline`,
      undefined,
      ownerA,
    );
    expect(timeline.statusCode).toBe(200);
    expect(timeline.json<{ timeline: unknown[] }>().timeline.length).toBeGreaterThan(0);
  });

  it("baixa e reabre com permissões; member sem close/reopen", async () => {
    const list = await call(app, "GET", processPath(matterAId), undefined, ownerA);
    const processId = list
      .json<{ items: Array<{ id: string; cnjNumber: string }> }>()
      .items.find((item) => item.cnjNumber === VALID_CNJ_B)!.id;

    const memberClose = await call(
      app,
      "POST",
      `${processPath(matterAId, processId)}/close`,
      { closureReason: "Trânsito em julgado" },
      memberA,
    );
    expect(memberClose.statusCode).toBe(403);

    const closed = await call(
      app,
      "POST",
      `${processPath(matterAId, processId)}/close`,
      { closureReason: "Trânsito em julgado", closureNotes: "Baixa manual" },
      ownerA,
    );
    expect(closed.statusCode).toBe(200);
    expect(
      closed.json<{ process: { status: string; closureSource: string } }>().process.status,
    ).toBe("closed");
    expect(closed.json<{ process: { closureSource: string } }>().process.closureSource).toBe(
      "manual",
    );

    const memberReopen = await call(
      app,
      "POST",
      `${processPath(matterAId, processId)}/reopen`,
      {},
      memberA,
    );
    expect(memberReopen.statusCode).toBe(403);

    const reopened = await call(
      app,
      "POST",
      `${processPath(matterAId, processId)}/reopen`,
      { notes: "Reabertura para cumprimento" },
      ownerA,
    );
    expect(reopened.statusCode).toBe(200);
    expect(reopened.json<{ process: { status: string } }>().process.status).toBe("active");
  });

  it("bloqueia cross-tenant e registra auditoria", async () => {
    const list = await call(app, "GET", processPath(matterAId), undefined, ownerA);
    const processId = list.json<{ items: Array<{ id: string }> }>().items[0]!.id;

    const cross = await call(
      app,
      "GET",
      `/v1/organizations/${orgB}/matters/${matterBId}/judicial-processes/${processId}`,
      undefined,
      ownerB,
    );
    expect(cross.statusCode).toBe(404);

    const foreignOrg = await call(
      app,
      "GET",
      `/v1/organizations/${orgB}/matters/${matterAId}/judicial-processes`,
      undefined,
      ownerA,
    );
    expect(foreignOrg.statusCode).toBe(404);

    const audits = await database.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.organizationId, orgA));
    const actions = audits.map((item) => item.action);
    expect(actions).toContain("judicial_process.created");
    expect(actions).toContain("judicial_process.party_added");
    expect(actions).toContain("judicial_process.lawyer_added");
    expect(actions).toContain("judicial_process.phase_changed");
    expect(actions).toContain("judicial_process.movement_added");
    expect(actions).toContain("judicial_process.hearing_scheduled");
    expect(actions).toContain("judicial_process.decision_recorded");
    expect(actions).toContain("judicial_process.appeal_created");
    expect(actions).toContain("judicial_process.enforcement_recorded");
    expect(actions).toContain("judicial_process.closed");
    expect(actions).toContain("judicial_process.reopened");
  });
});
