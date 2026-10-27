import { benefitTypes } from "@verasjuris/database";
import { seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { bootstrapEtapa6, type Etapa6Setup } from "./etapa6.fixtures.js";
import { call } from "./test-helpers.js";

describe("Prompt 16 — previdenciário API", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let s: Etapa6Setup;
  let clientId: string;
  let benefitTypeId: string;
  let caseId: string;

  const root = (org = s.orgA) => `/v1/organizations/${org}`;

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
    s = await bootstrapEtapa6(app, email, "prev");
    const matter = await call(app, "GET", `${root()}/matters/${s.matterAId}`, undefined, s.ownerA);
    expect(matter.statusCode).toBe(200);
    clientId = matter.json<{ matter: { clientId: string } }>().matter.clientId;

    const types = await database.db.query.benefitTypes.findMany({ limit: 1 });
    if (!types[0]) {
      const [seeded] = await database.db
        .insert(benefitTypes)
        .values({
          code: "SEED-TEST-PREV",
          name: "[SEED] Teste",
          category: "other",
          regime: "rgps",
          source: "system_seed",
        })
        .returning();
      benefitTypeId = seeded!.id;
    } else {
      benefitTypeId = types[0].id;
    }
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("cria caso previdenciário", async () => {
    const created = await call(
      app,
      "POST",
      `${root()}/previdentiary-cases`,
      {
        clientId,
        legalMatterId: s.matterAId,
        regime: "rgps",
        currentSituation: "analise",
        notes: "Caso teste",
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    const body = created.json<{ case: { id: string; clientId: string; regime: string } }>();
    expect(body.case.clientId).toBe(clientId);
    expect(body.case.regime).toBe("rgps");
    caseId = body.case.id;

    const listed = await call(
      app,
      "GET",
      `${root()}/previdentiary-cases?clientId=${clientId}`,
      undefined,
      s.ownerA,
    );
    expect(listed.statusCode).toBe(200);
    expect(listed.json<{ items: unknown[] }>().items.length).toBeGreaterThan(0);
  });

  it("benefício com NB normalizado + histórico DER/DIB/status", async () => {
    const created = await call(
      app,
      "POST",
      `${root()}/previdentiary-cases/${caseId}/benefits`,
      {
        previdentiaryCaseId: caseId,
        clientId,
        benefitTypeId,
        nb: "123.456.789-0",
        der: "2024-01-15T12:00:00.000Z",
        status: "draft",
        source: "manual",
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    const benefit = created.json<{
      benefit: { id: string; nb: string; normalizedNb: string; officialInssClaim: boolean };
    }>().benefit;
    expect(benefit.normalizedNb).toBe("1234567890");
    expect(benefit.officialInssClaim).toBe(false);

    const updated = await call(
      app,
      "PATCH",
      `${root()}/previdentiary-benefits/${benefit.id}`,
      {
        status: "requested",
        dib: "2024-02-01T12:00:00.000Z",
      },
      s.ownerA,
    );
    expect(updated.statusCode).toBe(200);
    expect(updated.json<{ benefit: { status: string; dib: string } }>().benefit.status).toBe(
      "requested",
    );

    const detail = await call(
      app,
      "GET",
      `${root()}/previdentiary-benefits/${benefit.id}`,
      undefined,
      s.ownerA,
    );
    expect(detail.statusCode).toBe(200);
    const history = detail.json<{ history: Array<{ event: string; newStatus: string }> }>().history;
    expect(history.some((h) => h.event === "benefit_created")).toBe(true);
    expect(history.some((h) => h.event === "status_changed" && h.newStatus === "requested")).toBe(
      true,
    );
  });

  it("requerimento com protocolo MANUAL (nunca Protocolado no INSS)", async () => {
    const created = await call(
      app,
      "POST",
      `${root()}/previdentiary-requests`,
      {
        previdentiaryCaseId: caseId,
        requestType: "initial_request",
        protocolNumber: "PROT-MANUAL-1",
        protocolDate: "2024-03-01T12:00:00.000Z",
        protocolSource: "manual",
        protocolVerificationStatus: "manual",
        status: "submitted",
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    const request = created.json<{
      request: {
        id: string;
        protocolNumber: string;
        protocolLabel: string;
        administrativeProcessId: string;
      };
    }>().request;
    expect(request.protocolNumber).toBe("PROT-MANUAL-1");
    expect(request.protocolLabel).toContain("manualmente");
    expect(request.protocolLabel.toLowerCase()).not.toContain("protocolado no inss");
    expect(request.administrativeProcessId).toBeTruthy();
  });

  it("perícia médica com CalendarEvent opcional", async () => {
    const req = await call(
      app,
      "POST",
      `${root()}/previdentiary-requests`,
      { previdentiaryCaseId: caseId, requestType: "initial_request" },
      s.ownerA,
    );
    const requestId = req.json<{ request: { id: string } }>().request.id;
    const exam = await call(
      app,
      "POST",
      `${root()}/previdentiary-requests/${requestId}/medical-exams`,
      {
        requestId,
        examType: "pericia_medica",
        scheduledAt: "2024-04-10T14:00:00.000-03:00",
        createCalendarEvent: true,
        status: "scheduled",
      },
      s.ownerA,
    );
    expect(exam.statusCode).toBe(201);
    const body = exam.json<{
      exam: { id: string; calendarEventId: string | null; status: string };
    }>().exam;
    expect(body.status).toBe("scheduled");
    expect(body.calendarEventId).toBeTruthy();
  });

  it("CNIS importação manual + revisão + competências duplicadas", async () => {
    const created = await call(
      app,
      "POST",
      `${root()}/cnis-imports`,
      {
        previdentiaryCaseId: caseId,
        clientId,
        importFormat: "manual",
        entries: [
          { competence: "2023-01", remunerationCents: 150_000, contributionCents: 15_000 },
          { competence: "2023-02", remunerationCents: 160_000 },
          { competence: "2023-01", remunerationCents: 151_000 },
        ],
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    const body = created.json<{
      import: { id: string; status: string };
      entries: Array<{ id: string; competence: string; remunerationCents: number | null }>;
      warnings: Array<{ code: string }>;
    }>();
    expect(body.import.status).toBe("pending_review");
    expect(body.entries).toHaveLength(3);
    expect(body.entries.every((e) => Number.isInteger(e.remunerationCents ?? 0))).toBe(true);
    expect(body.warnings.some((w) => w.code === "DUPLICATE_COMPETENCE")).toBe(true);

    const review = await call(
      app,
      "POST",
      `${root()}/cnis-entries/${body.entries[0]!.id}/review`,
      { reviewStatus: "accepted" },
      s.ownerA,
    );
    expect(review.statusCode).toBe(200);
    expect(review.json<{ entry: { reviewStatus: string } }>().entry.reviewStatus).toBe("accepted");

    const health = await call(
      app,
      "GET",
      `${root()}/previdentiary/providers/health`,
      undefined,
      s.ownerA,
    );
    expect(health.statusCode).toBe(200);
    const providers = health.json<{
      socialSecurityProvider: { status: string };
      cnisProvider: { status: string };
    }>();
    expect(providers.socialSecurityProvider.status).toBe("not_configured");
    expect(providers.cnisProvider.status).toBe("not_configured");
  });

  it("cálculos carencia/qualidade/rmi com memória; approve imutável", async () => {
    const carencia = await call(
      app,
      "POST",
      `${root()}/previdentiary-calculations`,
      {
        previdentiaryCaseId: caseId,
        calculationType: "carencia",
        ruleSetVersion: "seed-v1",
        referenceDate: "2024-06-01T12:00:00.000Z",
        inputSnapshot: {
          competences: [
            { competence: "2023-01" },
            { competence: "2023-02" },
            { competence: "2023-03" },
          ],
          requiredMonths: 12,
        },
      },
      s.ownerA,
    );
    expect(carencia.statusCode).toBe(201);
    const carenciaId = carencia.json<{ calculation: { id: string } }>().calculation.id;
    const runCarencia = await call(
      app,
      "POST",
      `${root()}/previdentiary-calculations/${carenciaId}/run`,
      {},
      s.ownerA,
    );
    expect(runCarencia.statusCode).toBe(200);
    const carenciaResult = runCarencia.json<{
      calculation: {
        status: string;
        resultSnapshot: {
          memory: unknown[];
          result: { validMonths: number };
        };
      };
    }>().calculation;
    expect(["calculated", "review_required"]).toContain(carenciaResult.status);
    expect(Array.isArray(carenciaResult.resultSnapshot.memory)).toBe(true);
    expect(carenciaResult.resultSnapshot.memory.length).toBeGreaterThan(0);
    expect(carenciaResult.resultSnapshot.result.validMonths).toBe(3);

    const qualidade = await call(
      app,
      "POST",
      `${root()}/previdentiary-calculations`,
      {
        previdentiaryCaseId: caseId,
        calculationType: "qualidade",
        ruleSetVersion: "seed-v1",
        referenceDate: "2024-06-01T12:00:00.000Z",
        inputSnapshot: {
          contributions: [{ start: "2023-01-01", end: "2023-12-31" }],
          referenceDate: "2024-06-01",
          ruleParams: { gracePeriodMonths: 12 },
        },
      },
      s.ownerA,
    );
    const qualidadeId = qualidade.json<{ calculation: { id: string } }>().calculation.id;
    const runQualidade = await call(
      app,
      "POST",
      `${root()}/previdentiary-calculations/${qualidadeId}/run`,
      {},
      s.ownerA,
    );
    expect(runQualidade.statusCode).toBe(200);
    expect(
      runQualidade.json<{ calculation: { resultSnapshot: { memory: unknown[] } } }>().calculation
        .resultSnapshot.memory.length,
    ).toBeGreaterThan(0);

    const rmi = await call(
      app,
      "POST",
      `${root()}/previdentiary-calculations`,
      {
        previdentiaryCaseId: caseId,
        calculationType: "rmi",
        ruleSetVersion: "seed-v1",
        referenceDate: "2024-06-01T12:00:00.000Z",
        inputSnapshot: {
          baseCents: 200_000,
          coefficient: { kind: "basis_points", basisPoints: 10_000 },
        },
      },
      s.ownerA,
    );
    const rmiId = rmi.json<{ calculation: { id: string } }>().calculation.id;
    const runRmi = await call(
      app,
      "POST",
      `${root()}/previdentiary-calculations/${rmiId}/run`,
      {},
      s.ownerA,
    );
    expect(runRmi.statusCode).toBe(200);
    const rmiCalc = runRmi.json<{
      calculation: {
        id: string;
        status: string;
        resultSnapshot: { result: { rmiCents: number }; memory: unknown[] };
      };
    }>().calculation;
    expect(Number.isInteger(rmiCalc.resultSnapshot.result.rmiCents)).toBe(true);
    expect(rmiCalc.resultSnapshot.result.rmiCents).toBe(200_000);
    expect(rmiCalc.resultSnapshot.memory.length).toBeGreaterThan(0);

    const approved = await call(
      app,
      "POST",
      `${root()}/previdentiary-calculations/${rmiId}/review`,
      { decision: "approved" },
      s.ownerA,
    );
    expect(approved.statusCode).toBe(200);
    expect(approved.json<{ calculation: { status: string } }>().calculation.status).toBe(
      "approved",
    );

    const immutable = await call(
      app,
      "PATCH",
      `${root()}/previdentiary-calculations/${rmiId}`,
      { inputSnapshot: { baseCents: 1 } },
      s.ownerA,
    );
    expect(immutable.statusCode).toBe(409);

    const rerun = await call(
      app,
      "POST",
      `${root()}/previdentiary-calculations/${rmiId}/run`,
      {},
      s.ownerA,
    );
    expect(rerun.statusCode).toBe(409);
  });

  it("contribuição em centavos inteiros (sem float)", async () => {
    const created = await call(
      app,
      "POST",
      `${root()}/previdentiary-cases/${caseId}/contributions`,
      {
        previdentiaryCaseId: caseId,
        competence: "2024-01",
        remunerationCents: 250_050,
        contributionCents: 27_505,
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    const contribution = created.json<{
      contribution: { remunerationCents: number; contributionCents: number };
    }>().contribution;
    expect(contribution.remunerationCents).toBe(250_050);
    expect(contribution.contributionCents).toBe(27_505);
    expect(Number.isInteger(contribution.remunerationCents)).toBe(true);

    const invalid = await call(
      app,
      "POST",
      `${root()}/previdentiary-cases/${caseId}/contributions`,
      {
        previdentiaryCaseId: caseId,
        competence: "2024-02",
        remunerationCents: 10.5,
      },
      s.ownerA,
    );
    expect(invalid.statusCode).toBe(400);
  });

  it("cross-tenant e ids forjados → 404", async () => {
    const forged = "00000000-0000-4000-8000-000000000099";
    const crossCase = await call(
      app,
      "GET",
      `${root(s.orgB)}/previdentiary-cases/${caseId}`,
      undefined,
      s.ownerB,
    );
    expect(crossCase.statusCode).toBe(404);

    const forgedCase = await call(
      app,
      "GET",
      `${root()}/previdentiary-cases/${forged}`,
      undefined,
      s.ownerA,
    );
    expect(forgedCase.statusCode).toBe(404);

    const outsider = await call(
      app,
      "GET",
      `${root()}/previdentiary-cases/${caseId}`,
      undefined,
      s.outsider,
    );
    expect(outsider.statusCode).toBe(404);

    const crossCnis = await call(
      app,
      "POST",
      `${root(s.orgB)}/cnis-imports`,
      {
        previdentiaryCaseId: caseId,
        clientId,
        importFormat: "manual",
        entries: [{ competence: "2020-01", remunerationCents: 100 }],
      },
      s.ownerB,
    );
    expect(crossCnis.statusCode).toBe(404);
  });
});
