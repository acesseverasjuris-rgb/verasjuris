import { auditEvents, seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { FGTS_ESTIMATE_LABEL } from "@verasjuris/calculations";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { bootstrapEtapa6, type Etapa6Setup } from "./etapa6.fixtures.js";
import { call } from "./test-helpers.js";

describe("Etapa 10 — gestão trabalhista (Labor API)", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let s: Etapa6Setup;
  let clientId: string;
  let laborCaseId: string;

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
    s = await bootstrapEtapa6(app, email, "labor");

    const clients = await call(app, "GET", `${root()}/crm/clients`, undefined, s.ownerA);
    expect(clients.statusCode).toBe(200);
    const listed = clients.json<{ clients?: { id: string }[]; items?: { id: string }[] }>();
    clientId = listed.items?.[0]?.id ?? listed.clients?.[0]?.id ?? "";
    if (!clientId) {
      const created = await call(
        app,
        "POST",
        `${root()}/crm/clients`,
        { personType: "person", fullName: "Empregado Teste Labor" },
        s.ownerA,
      );
      expect(created.statusCode).toBe(201);
      clientId = created.json<{ client: { id: string } }>().client.id;
    }
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("provedores: status NOT_CONFIGURED (eSocial, FGTS, tribunal, ponto)", async () => {
    const status = await call(app, "GET", `${root()}/labor-providers/status`, undefined, s.ownerA);
    expect(status.statusCode).toBe(200);
    const body = status.json<{
      eSocial: { status: string };
      fgts: { status: string; officialBalanceAvailable: boolean; disclaimer: string };
      laborCourt: { status: string };
      timeTrackingImport: { status: string; manualEntryAvailable: boolean };
      manualEntryAvailable: boolean;
    }>();
    expect(body.eSocial.status).toBe("not_configured");
    expect(body.fgts.status).toBe("not_configured");
    expect(body.fgts.officialBalanceAvailable).toBe(false);
    expect(body.fgts.disclaimer).toContain("não é saldo oficial");
    expect(body.laborCourt.status).toBe("not_configured");
    expect(body.timeTrackingImport.status).toBe("not_configured");
    expect(body.timeTrackingImport.manualEntryAvailable).toBe(true);
    expect(body.manualEntryAvailable).toBe(true);
    expect(status.payload.toLowerCase()).not.toMatch(/saldo oficial[^"]*$/i);
  });

  it("caso trabalhista CRUD com clientRole e legalMatterId", async () => {
    const created = await call(
      app,
      "POST",
      `${root()}/labor-cases`,
      {
        clientId,
        legalMatterId: s.matterAId,
        clientRole: "employee",
        status: "active",
        notes: "Reclamação trabalhista de exemplo",
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    const laborCase = created.json<{
      laborCase: { id: string; clientRole: string; legalMatterId: string };
    }>().laborCase;
    expect(laborCase.clientRole).toBe("employee");
    expect(laborCase.legalMatterId).toBe(s.matterAId);
    laborCaseId = laborCase.id;

    const got = await call(app, "GET", `${root()}/labor-cases/${laborCaseId}`, undefined, s.ownerA);
    expect(got.statusCode).toBe(200);
    expect(got.json<{ laborCase: { id: string } }>().laborCase.id).toBe(laborCaseId);

    const patched = await call(
      app,
      "PATCH",
      `${root()}/labor-cases/${laborCaseId}`,
      { clientRole: "employer", status: "active" },
      s.ownerA,
    );
    expect(patched.statusCode).toBe(200);
    expect(patched.json<{ laborCase: { clientRole: string } }>().laborCase.clientRole).toBe(
      "employer",
    );

    const audits = await database.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "labor.case_created"));
    expect(audits.some((a) => a.resourceId === laborCaseId)).toBe(true);
  });

  it("contrato + histórico automático em alteração de função/salário", async () => {
    const created = await call(
      app,
      "POST",
      `${root()}/employment-contracts`,
      {
        laborCaseId,
        employerName: "Empresa Alpha Ltda",
        employerDocument: "12.345.678/0001-90",
        admissionDate: "2024-01-15T00:00:00.000Z",
        jobTitle: "Analista",
        workplace: "São Paulo",
        salaryCents: 500_000,
        weeklyHours: 44,
        status: "active",
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    const contract = created.json<{ contract: { id: string; salaryCents: number } }>().contract;
    expect(contract.salaryCents).toBe(500_000);

    const updated = await call(
      app,
      "PATCH",
      `${root()}/employment-contracts/${contract.id}`,
      {
        jobTitle: "Analista Sênior",
        salaryCents: 650_000,
        workplace: "Campinas",
        weeklyHours: 40,
      },
      s.ownerA,
    );
    expect(updated.statusCode).toBe(200);
    expect(
      updated.json<{ historyCreated: number; contract: { salaryCents: number } }>(),
    ).toMatchObject({
      historyCreated: 4,
      contract: { salaryCents: 650_000 },
    });

    const history = await call(
      app,
      "GET",
      `${root()}/employment-contracts/${contract.id}/history`,
      undefined,
      s.ownerA,
    );
    expect(history.statusCode).toBe(200);
    const kinds = history
      .json<{ history: { kind: string }[] }>()
      .history.map((h) => h.kind)
      .sort();
    expect(kinds).toEqual(["job_title", "salary", "schedule", "workplace"].sort());
  });

  it("jornada (schedule + time record manual) e remuneração em centavos", async () => {
    const schedule = await call(
      app,
      "POST",
      `${root()}/work-schedules`,
      {
        laborCaseId,
        name: "Segunda a sexta",
        weeklyHours: 44,
        includesNightShift: false,
      },
      s.ownerA,
    );
    expect(schedule.statusCode).toBe(201);

    const time = await call(
      app,
      "POST",
      `${root()}/work-time-records`,
      {
        laborCaseId,
        workDate: "2026-03-10T00:00:00.000Z",
        clockInAt: "2026-03-10T08:00:00.000Z",
        clockOutAt: "2026-03-10T17:00:00.000Z",
        overtimeMinutes: 60,
        source: "manual",
      },
      s.ownerA,
    );
    expect(time.statusCode).toBe(201);

    const rem = await call(
      app,
      "POST",
      `${root()}/labor-remuneration`,
      {
        laborCaseId,
        itemType: "salary",
        description: "Salário março/2026",
        competence: "2026-03",
        amountCents: 650_000,
      },
      s.ownerA,
    );
    expect(rem.statusCode).toBe(201);
    expect(
      rem.json<{ remunerationItem: { amountCents: number } }>().remunerationItem.amountCents,
    ).toBe(650_000);

    const negative = await call(
      app,
      "POST",
      `${root()}/labor-remuneration`,
      {
        laborCaseId,
        description: "Negativo",
        amountCents: -1,
      },
      s.ownerA,
    );
    expect(negative.statusCode).toBe(400);

    const fractional = await call(
      app,
      "POST",
      `${root()}/labor-remuneration`,
      {
        laborCaseId,
        description: "Fracionário",
        amountCents: 10.5,
      },
      s.ownerA,
    );
    expect(fractional.statusCode).toBe(400);
  });

  it("férias, FGTS (estimativa ≠ saldo oficial), rescisão e pedidos", async () => {
    const vacation = await call(
      app,
      "POST",
      `${root()}/vacations`,
      {
        laborCaseId,
        accrualStart: "2025-01-15T00:00:00.000Z",
        accrualEnd: "2026-01-14T00:00:00.000Z",
        enjoyedDays: 0,
        status: "available",
      },
      s.ownerA,
    );
    expect(vacation.statusCode).toBe(201);

    const fgts = await call(
      app,
      "POST",
      `${root()}/fgts`,
      {
        laborCaseId,
        competence: "2026-03",
        baseAmountCents: 650_000,
        dueAmountCents: 52_000,
        paidAmountCents: 50_000,
      },
      s.ownerA,
    );
    expect(fgts.statusCode).toBe(201);
    const fgtsBody = fgts.json<{
      fgtsRecord: { estimateLabel: string; isOfficialBalance: boolean; dueAmountCents: number };
      disclaimer: string;
    }>();
    expect(fgtsBody.fgtsRecord.isOfficialBalance).toBe(false);
    expect(fgtsBody.fgtsRecord.estimateLabel).toBe(FGTS_ESTIMATE_LABEL);
    expect(fgtsBody.disclaimer).toContain("não é saldo oficial");
    expect(fgts.payload.toLowerCase()).not.toMatch(/"saldo oficial"/);

    const contracts = await call(
      app,
      "GET",
      `${root()}/employment-contracts?laborCaseId=${laborCaseId}`,
      undefined,
      s.ownerA,
    );
    const contractId = contracts.json<{ contracts: { id: string }[] }>().contracts[0]!.id;

    const termination = await call(
      app,
      "POST",
      `${root()}/employment-terminations`,
      {
        laborCaseId,
        contractId,
        terminationType: "sem_justa_causa",
        terminationDate: "2026-04-01T00:00:00.000Z",
        lastSalaryCents: 650_000,
        noticeType: "indenizado",
      },
      s.ownerA,
    );
    expect(termination.statusCode).toBe(201);
    expect(
      termination.json<{ termination: { lastSalaryCents: number } }>().termination.lastSalaryCents,
    ).toBe(650_000);

    const claim = await call(
      app,
      "POST",
      `${root()}/labor-claims`,
      {
        laborCaseId,
        claimType: "horas_extras",
        title: "Horas extras habituais",
        amountCents: 120_000,
        status: "active",
      },
      s.ownerA,
    );
    expect(claim.statusCode).toBe(201);
  });

  it("cálculo jornada + rescisão via engine; approve imutável; liquidação", async () => {
    const jornada = await call(
      app,
      "POST",
      `${root()}/labor-calculations`,
      {
        laborCaseId,
        calculationType: "jornada",
        referenceDate: "2026-03-31T00:00:00.000Z",
        ruleSetVersion: "labor-jornada-v1",
        inputSnapshot: {
          records: [
            { startMinute: 480, endMinute: 720, kind: "normal" },
            { startMinute: 780, endMinute: 1020, kind: "normal" },
            { startMinute: 1020, endMinute: 1080, kind: "overtime" },
          ],
        },
      },
      s.ownerA,
    );
    expect(jornada.statusCode).toBe(201);
    const jornadaId = jornada.json<{ calculation: { id: string } }>().calculation.id;

    const runJornada = await call(
      app,
      "POST",
      `${root()}/labor-calculations/${jornadaId}/run`,
      {},
      s.ownerA,
    );
    expect(runJornada.statusCode).toBe(200);
    const jornadaCalc = runJornada.json<{
      calculation: {
        status: string;
        resultSnapshot: { result: { overtimeMinutes: number }; reviewHint: string };
      };
    }>();
    expect(jornadaCalc.calculation.status).toBe("review_required");
    expect(jornadaCalc.calculation.resultSnapshot.reviewHint).toBe("review_required");
    expect(jornadaCalc.calculation.resultSnapshot.result.overtimeMinutes).toBe(60);

    const rescisao = await call(
      app,
      "POST",
      `${root()}/labor-calculations`,
      {
        laborCaseId,
        calculationType: "rescisao",
        referenceDate: "2026-04-01T00:00:00.000Z",
        ruleSetVersion: "labor-rescisao-v1",
        inputSnapshot: {
          lastSalaryCents: 650_000,
          balanceSalaryCents: 100_000,
          fgtsBaseCents: 1_000_000,
          terminationDate: "2026-04-01",
          ruleParams: {
            thirteenthBasisPoints: 5000,
            proportionalVacationBasisPoints: 5000,
            vacationThirdBasisPoints: 3333,
            noticeBasisPoints: 10_000,
            fgtsPenaltyBasisPoints: 4000,
          },
        },
      },
      s.ownerA,
    );
    expect(rescisao.statusCode).toBe(201);
    const rescisaoId = rescisao.json<{ calculation: { id: string } }>().calculation.id;
    const runRescisao = await call(
      app,
      "POST",
      `${root()}/labor-calculations/${rescisaoId}/run`,
      {},
      s.ownerA,
    );
    expect(runRescisao.statusCode).toBe(200);
    expect(
      runRescisao.json<{
        calculation: { status: string; resultSnapshot: { result: { totalCents: number } } };
      }>().calculation.resultSnapshot.result.totalCents,
    ).toBeGreaterThan(0);

    const approve = await call(
      app,
      "POST",
      `${root()}/labor-calculations/${rescisaoId}/review`,
      { status: "approved" },
      s.ownerA,
    );
    expect(approve.statusCode).toBe(200);
    expect(approve.json<{ calculation: { status: string } }>().calculation.status).toBe("approved");

    const rerun = await call(
      app,
      "POST",
      `${root()}/labor-calculations/${rescisaoId}/run`,
      {},
      s.ownerA,
    );
    expect(rerun.statusCode).toBe(409);

    const rereview = await call(
      app,
      "POST",
      `${root()}/labor-calculations/${rescisaoId}/review`,
      { status: "reviewed" },
      s.ownerA,
    );
    expect(rereview.statusCode).toBe(409);

    const liquidacaoCalc = await call(
      app,
      "POST",
      `${root()}/labor-calculations`,
      {
        laborCaseId,
        calculationType: "liquidacao",
        referenceDate: "2026-04-15T00:00:00.000Z",
        ruleSetVersion: "labor-liq-v1",
        inputSnapshot: {
          claims: [
            {
              key: "he",
              principalCents: 120_000,
              correctionCents: 10_000,
              interestCents: 5_000,
              indexConfigured: true,
            },
          ],
        },
      },
      s.ownerA,
    );
    const liqCalcId = liquidacaoCalc.json<{ calculation: { id: string } }>().calculation.id;
    await call(app, "POST", `${root()}/labor-calculations/${liqCalcId}/run`, {}, s.ownerA);

    const liquidation = await call(
      app,
      "POST",
      `${root()}/labor-liquidations`,
      {
        laborCaseId,
        calculationId: liqCalcId,
        referenceDate: "2026-04-15T00:00:00.000Z",
        status: "calculated",
      },
      s.ownerA,
    );
    expect(liquidation.statusCode).toBe(201);
    const liq = liquidation.json<{
      liquidation: { totalPrincipalCents: number; totalCents: number };
    }>().liquidation;
    expect(liq.totalPrincipalCents).toBe(120_000);
    expect(liq.totalCents).toBe(135_000);

    const timeline = await call(
      app,
      "GET",
      `${root()}/labor-cases/${laborCaseId}/timeline`,
      undefined,
      s.ownerA,
    );
    expect(timeline.statusCode).toBe(200);
    expect(timeline.json<{ events: unknown[] }>().events.length).toBeGreaterThan(3);
  });

  it("cross-tenant: caso de outra org responde 404", async () => {
    const foreign = await call(
      app,
      "GET",
      `${root(s.orgB)}/labor-cases/${laborCaseId}`,
      undefined,
      s.ownerB,
    );
    expect(foreign.statusCode).toBe(404);

    const outsider = await call(
      app,
      "GET",
      `${root()}/labor-cases/${laborCaseId}`,
      undefined,
      s.ownerB,
    );
    expect(outsider.statusCode).toBe(404);

    const forged = await call(
      app,
      "POST",
      `${root(s.orgB)}/labor-cases`,
      {
        clientId,
        legalMatterId: s.matterAId,
        clientRole: "employee",
      },
      s.ownerB,
    );
    expect(forged.statusCode).toBe(404);
  });
});
