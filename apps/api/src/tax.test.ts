import { auditEvents, taxRuleSets } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { seedReferenceData } from "@verasjuris/database";
import { MemoryEmailProvider } from "@verasjuris/email";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { bootstrapEtapa6, type Etapa6Setup } from "./etapa6.fixtures.js";
import { call } from "./test-helpers.js";

const VALID_CNJ = "0000001-20.2016.8.26.0100";

describe("Etapa 11 — gestão tributária (Tax API)", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let s: Etapa6Setup;
  let clientId: string;
  let taxCaseId: string;
  let taxTypeId: string;
  let creditId: string;
  let adminProcessId: string;
  let judicialProcessId: string;
  let ruleSetId: string;

  const root = (org = s?.orgA) => `/v1/organizations/${org}`;

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
    s = await bootstrapEtapa6(app, email, "tax");

    const matter = await call(app, "GET", `${root()}/matters/${s.matterAId}`, undefined, s.ownerA);
    expect(matter.statusCode).toBe(200);
    clientId = matter.json<{ matter: { clientId: string } }>().matter.clientId;

    const types = await call(app, "GET", `${root()}/tax-types`, undefined, s.ownerA);
    expect(types.statusCode).toBe(200);
    const typeItems = types.json<{ items: Array<{ code: string; id: string; source: string }> }>()
      .items;
    expect(typeItems.length).toBeGreaterThanOrEqual(3);
    expect(typeItems.some((t) => t.code === "IRPF" && t.source === "system_seed")).toBe(true);
    taxTypeId = typeItems.find((t) => t.code === "ICMS")!.id;

    const bodies = await call(app, "GET", `${root()}/administrative-bodies`, undefined, s.ownerA);
    const bodyId = bodies
      .json<{ administrativeBodies: Array<{ id: string; acronym: string | null }> }>()
      .administrativeBodies.find((b) => b.acronym === "INSS")!.id;

    const adminCreated = await call(
      app,
      "POST",
      `${root()}/matters/${s.matterAId}/administrative-processes`,
      {
        administrativeBodyId: bodyId,
        subject: "Processo admin tributário teste",
        number: "TAX-ADM-001",
        protocolNumber: "MANUAL-001",
        protocolSource: "manual",
        status: "active",
      },
      s.ownerA,
    );
    expect(adminCreated.statusCode).toBe(201);
    adminProcessId = adminCreated.json<{ process: { id: string } }>().process.id;

    const courts = await call(app, "GET", `${root()}/courts`, undefined, s.ownerA);
    const tribunalId = courts
      .json<{ courts: Array<{ id: string; acronym: string }> }>()
      .courts.find((c) => c.acronym === "TJSP")!.id;
    const phases = await call(app, "GET", `${root()}/judicial-phases`, undefined, s.ownerA);
    const phaseId = phases
      .json<{ judicialPhases: Array<{ id: string; slug: string }> }>()
      .judicialPhases.find((p) => p.slug === "conhecimento")!.id;
    const subjects = await call(app, "GET", `${root()}/procedural-subjects`, undefined, s.ownerA);
    const subjectId = subjects.json<{ proceduralSubjects: Array<{ id: string }> }>()
      .proceduralSubjects[0]!.id;
    const classes = await call(app, "GET", `${root()}/procedural-classes`, undefined, s.ownerA);
    const classId = classes.json<{ proceduralClasses: Array<{ id: string }> }>()
      .proceduralClasses[0]!.id;

    const judicialCreated = await call(
      app,
      "POST",
      `${root()}/matters/${s.matterAId}/judicial-processes`,
      {
        cnjNumber: VALID_CNJ,
        tribunalId,
        proceduralClassId: classId,
        primarySubjectId: subjectId,
        subjectIds: [subjectId],
        currentPhaseId: phaseId,
      },
      s.ownerA,
    );
    expect(judicialCreated.statusCode).toBe(201);
    judicialProcessId = judicialCreated.json<{ process: { id: string } }>().process.id;

    const ruleSet = await call(
      app,
      "POST",
      `${root()}/tax-rule-sets`,
      {
        key: "tax-test",
        version: "v1",
        effectiveFrom: "2024-01-01T00:00:00.000Z",
        source: "test",
      },
      s.ownerA,
    );
    expect(ruleSet.statusCode).toBe(201);
    ruleSetId = ruleSet.json<{ ruleSet: { id: string; locked: boolean } }>().ruleSet.id;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("provedores tributários NOT_CONFIGURED", async () => {
    const status = await call(app, "GET", `${root()}/tax-providers/status`, undefined, s.ownerA);
    expect(status.statusCode).toBe(200);
    const body = status.json<{
      federal: { status: string };
      manualEntryAvailable: boolean;
    }>();
    expect(body.federal.status).toBe("not_configured");
    expect(body.manualEntryAvailable).toBe(true);
  });

  it("cria caso tributário com validação client/matter", async () => {
    const created = await call(
      app,
      "POST",
      `${root()}/tax-cases`,
      {
        clientId,
        legalMatterId: s.matterAId,
        taxpayerType: "company",
        jurisdictionScope: "federal",
        status: "active",
        notes: "Caso tributário teste",
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    taxCaseId = created.json<{ case: { id: string; jurisdictionScope: string } }>().case.id;
    expect(created.json<{ case: { jurisdictionScope: string } }>().case.jurisdictionScope).toBe(
      "federal",
    );

    const mismatch = await call(
      app,
      "POST",
      `${root()}/tax-cases`,
      {
        clientId: "00000000-0000-4000-8000-000000000099",
        legalMatterId: s.matterAId,
      },
      s.ownerA,
    );
    expect(mismatch.statusCode).toBe(404);

    const audits = await database.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "tax.case_created"));
    expect(audits.some((a) => a.resourceId === taxCaseId)).toBe(true);
  });

  it("obrigação com centavos inteiros e overdue derivado", async () => {
    const created = await call(
      app,
      "POST",
      `${root()}/tax-cases/${taxCaseId}/obligations`,
      {
        taxTypeId,
        obligationType: "payment",
        competence: "2024-01",
        dueDate: "2020-01-01T00:00:00.000Z",
        amountCents: 150_000,
        status: "open",
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    const obligation = created.json<{ obligation: { amountCents: number; status: string } }>()
      .obligation;
    expect(obligation.amountCents).toBe(150_000);
    expect(Number.isInteger(obligation.amountCents)).toBe(true);
    expect(obligation.status).toBe("overdue");

    const invalid = await call(
      app,
      "POST",
      `${root()}/tax-cases/${taxCaseId}/obligations`,
      {
        taxTypeId,
        amountCents: 10.5,
      },
      s.ownerA,
    );
    expect(invalid.statusCode).toBe(400);
  });

  it("crédito, restituição e compensação", async () => {
    const credit = await call(
      app,
      "POST",
      `${root()}/tax-cases/${taxCaseId}/credits`,
      {
        taxTypeId,
        origin: "overpayment",
        principalCents: 100_000,
        correctionCents: 5_000,
        totalCents: 105_000,
        status: "identified",
      },
      s.ownerA,
    );
    expect(credit.statusCode).toBe(201);
    creditId = credit.json<{ credit: { id: string; totalCents: number } }>().credit.id;
    expect(credit.json<{ credit: { totalCents: number } }>().credit.totalCents).toBe(105_000);

    const refund = await call(
      app,
      "POST",
      `${root()}/tax-cases/${taxCaseId}/refunds`,
      {
        taxCreditId: creditId,
        requestDate: "2024-06-01T12:00:00.000Z",
        amountRequestedCents: 105_000,
        status: "requested",
        protocolNumber: "MANUAL-REST-001",
      },
      s.ownerA,
    );
    expect(refund.statusCode).toBe(201);
    expect(refund.json<{ refund: { protocolNumber: string } }>().refund.protocolNumber).toBe(
      "MANUAL-REST-001",
    );

    const compensation = await call(
      app,
      "POST",
      `${root()}/tax-cases/${taxCaseId}/compensations`,
      {
        sourceCreditId: creditId,
        destinationTaxTypeId: taxTypeId,
        requestedAmountCents: 50_000,
        status: "requested",
      },
      s.ownerA,
    );
    expect(compensation.statusCode).toBe(201);
    expect(
      compensation.json<{ compensation: { requestedAmountCents: number } }>().compensation
        .requestedAmountCents,
    ).toBe(50_000);
  });

  it("lançamento, impugnação, vínculos admin/judicial, CDA e garantia", async () => {
    const assessment = await call(
      app,
      "POST",
      `${root()}/tax-cases/${taxCaseId}/assessments`,
      {
        authority: "Receita Federal",
        assessmentNumber: "AUTO-TAX-001",
        assessmentDate: "2024-03-01T12:00:00.000Z",
        taxTypeId,
        principalCents: 200_000,
        penaltyCents: 20_000,
        totalCents: 220_000,
        status: "issued",
      },
      s.ownerA,
    );
    expect(assessment.statusCode).toBe(201);
    const assessmentId = assessment.json<{ assessment: { id: string } }>().assessment.id;

    const challenged = await call(
      app,
      "PATCH",
      `${root()}/tax-assessments/${assessmentId}`,
      { status: "challenged" },
      s.ownerA,
    );
    expect(challenged.statusCode).toBe(200);
    expect(challenged.json<{ assessment: { status: string } }>().assessment.status).toBe(
      "challenged",
    );

    const adminLink = await call(
      app,
      "POST",
      `${root()}/tax-cases/${taxCaseId}/administrative-cases`,
      {
        administrativeProcessId: adminProcessId,
        taxAssessmentId: assessmentId,
        phase: "impugnacao",
      },
      s.ownerA,
    );
    expect(adminLink.statusCode).toBe(201);

    const cda = await call(
      app,
      "POST",
      `${root()}/tax-cases/${taxCaseId}/debt-certificates`,
      {
        number: "CDA-TAX-001",
        issuer: "PGFN",
        taxTypeId,
        totalCents: 220_000,
      },
      s.ownerA,
    );
    expect(cda.statusCode).toBe(201);
    const cdaId = cda.json<{ debtCertificate: { id: string } }>().debtCertificate.id;

    const enforcement = await call(
      app,
      "POST",
      `${root()}/tax-cases/${taxCaseId}/enforcements`,
      {
        judicialProcessId,
        debtCertificateId: cdaId,
        status: "filed",
      },
      s.ownerA,
    );
    expect(enforcement.statusCode).toBe(201);
    const enforcementId = enforcement.json<{ enforcement: { id: string } }>().enforcement.id;

    const guarantee = await call(
      app,
      "POST",
      `${root()}/tax-cases/${taxCaseId}/guarantees`,
      {
        enforcementCaseId: enforcementId,
        guaranteeType: "bank_guarantee",
        amountCents: 220_000,
      },
      s.ownerA,
    );
    expect(guarantee.statusCode).toBe(201);
    expect(guarantee.json<{ guarantee: { amountCents: number } }>().guarantee.amountCents).toBe(
      220_000,
    );
  });

  it("tese vinculada ao caso", async () => {
    const thesis = await call(
      app,
      "POST",
      `${root()}/tax-theses`,
      {
        title: "Tese de exclusão do ICMS da base do PIS/COFINS",
        summary: "Análise preliminar — não substitui parecer.",
        taxTypeId,
        status: "under_research",
        riskLevel: "medium",
      },
      s.ownerA,
    );
    expect(thesis.statusCode).toBe(201);
    const thesisId = thesis.json<{ thesis: { id: string } }>().thesis.id;

    const link = await call(
      app,
      "POST",
      `${root()}/tax-cases/${taxCaseId}/thesis-links`,
      {
        thesisId,
        applicabilityStatus: "needs_review",
      },
      s.ownerA,
    );
    expect(link.statusCode).toBe(201);
    expect(link.json<{ link: { thesisId: string } }>().link.thesisId).toBe(thesisId);
  });

  it("cálculo determinístico com memória, lock de rule set e revisão", async () => {
    const created = await call(
      app,
      "POST",
      `${root()}/tax-cases/${taxCaseId}/calculations`,
      {
        calculationType: "debit",
        ruleSetId,
        ruleSetVersion: "v1",
        referenceDate: "2024-06-01T12:00:00.000Z",
        inputSnapshot: {
          obligationKey: "icms_test",
          lines: [{ key: "principal", principalCents: 100_000, correctionCents: 10_000 }],
          deductionsCents: 5_000,
        },
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    const calculationId = created.json<{ calculation: { id: string } }>().calculation.id;

    const run = await call(
      app,
      "POST",
      `${root()}/tax-calculations/${calculationId}/run`,
      {},
      s.ownerA,
    );
    expect(run.statusCode).toBe(200);
    const calc = run.json<{
      calculation: {
        status: string;
        resultSnapshot: { result: { netDebitCents: number }; memory: unknown[] };
      };
    }>().calculation;
    expect(Number.isInteger(calc.resultSnapshot.result.netDebitCents)).toBe(true);
    expect(calc.resultSnapshot.result.netDebitCents).toBe(105_000);
    expect(calc.resultSnapshot.memory.length).toBeGreaterThan(0);
    expect(calc.status).toBe("review_required");

    const locked = await database.db.query.taxRuleSets.findFirst({
      where: eq(taxRuleSets.id, ruleSetId),
    });
    expect(locked?.locked).toBe(true);

    const reviewed = await call(
      app,
      "POST",
      `${root()}/tax-calculations/${calculationId}/review`,
      { status: "approved" },
      s.ownerA,
    );
    expect(reviewed.statusCode).toBe(200);
    expect(reviewed.json<{ calculation: { status: string } }>().calculation.status).toBe(
      "approved",
    );
  });

  it("cross-tenant → 404", async () => {
    const cross = await call(
      app,
      "GET",
      `${root(s.orgB)}/tax-cases/${taxCaseId}`,
      undefined,
      s.ownerB,
    );
    expect(cross.statusCode).toBe(404);

    const outsider = await call(
      app,
      "GET",
      `${root()}/tax-cases/${taxCaseId}`,
      undefined,
      s.outsider,
    );
    expect(outsider.statusCode).toBe(404);
  });
});
