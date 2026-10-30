import { organizations, seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified } from "./test-helpers.js";

describe("Etapa 23 — Control diretor/aprovações", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let ownerA: string;
  let ownerB: string;
  let orgA: string;
  let orgB: string;

  const control = (org?: string) => `/v1/organizations/${org ?? orgA}/control`;

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
      displayName: "Owner Control A",
      email: "owner.control.a@exemplo.com",
    });
    ownerB = await registerVerified(app, email, {
      displayName: "Owner Control B",
      email: "owner.control.b@exemplo.com",
    });

    const createdA = await call(
      app,
      "POST",
      "/v1/organizations",
      { name: "Org Control A" },
      ownerA,
    );
    expect(createdA.statusCode).toBe(201);
    orgA = createdA.json<{ organization: { id: string } }>().organization.id;

    const createdB = await call(
      app,
      "POST",
      "/v1/organizations",
      { name: "Org Control B" },
      ownerB,
    );
    expect(createdB.statusCode).toBe(201);
    orgB = createdB.json<{ organization: { id: string } }>().organization.id;

    await database.db
      .update(organizations)
      .set({ internalCompany: true })
      .where(eq(organizations.id, orgA));
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("isola org não-interna com 404", async () => {
    const res = await call(app, "GET", `${control(orgB)}/director/dashboard`, undefined, ownerB);
    expect(res.statusCode).toBe(404);
  });

  it("cria meta e KPI, rejeita overwrite em internal_query", async () => {
    const goal = await call(
      app,
      "POST",
      `${control()}/goals`,
      {
        title: "Meta receita",
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-12-31T23:59:59.000Z",
        targetType: "currency",
        targetValue: "1000000",
        status: "active",
      },
      ownerA,
    );
    expect(goal.statusCode).toBe(201);

    const kpi = await call(
      app,
      "POST",
      `${control()}/kpis`,
      {
        key: "active_employees",
        name: "Colaboradores ativos",
        sourceType: "internal_query",
        sourceConfig: { queryKey: "employee_count" },
        direction: "higher_is_better",
      },
      ownerA,
    );
    expect(kpi.statusCode).toBe(201);
    const kpiId = kpi.json<{ kpi: { id: string } }>().kpi.id;

    const bad = await call(
      app,
      "POST",
      `${control()}/kpis/${kpiId}/snapshots`,
      { period: "2026-10", value: "999" },
      ownerA,
    );
    expect(bad.statusCode).toBe(400);

    const ok = await call(
      app,
      "POST",
      `${control()}/kpis/${kpiId}/snapshots`,
      { period: "2026-10" },
      ownerA,
    );
    expect(ok.statusCode).toBe(201);
    expect(ok.json<{ snapshot: { value: string; source: string } }>().snapshot.source).toContain(
      "internal_query",
    );
  });

  it("aprovações: race de segunda decisão do mesmo ator → conflict", async () => {
    const refId = "11111111-1111-4111-8111-111111111111";
    const created = await call(
      app,
      "POST",
      `${control()}/approvals`,
      {
        type: "expense",
        referenceType: "expense_report",
        referenceId: refId,
        approverPolicy: "single",
      },
      ownerA,
    );
    expect(created.statusCode).toBe(201);
    const approvalId = created.json<{ approval: { id: string } }>().approval.id;

    const first = await call(
      app,
      "POST",
      `${control()}/approvals/${approvalId}/decide`,
      { decision: "approved" },
      ownerA,
    );
    expect(first.statusCode).toBe(200);
    expect(first.json<{ approval: { status: string } }>().approval.status).toBe("approved");

    const second = await call(
      app,
      "POST",
      `${control()}/approvals/${approvalId}/decide`,
      { decision: "rejected" },
      ownerA,
    );
    expect(second.statusCode).toBe(409);
  });

  it("dashboard agrega contagens reais e exige permissão/internal", async () => {
    const dash = await call(app, "GET", `${control()}/director/dashboard`, undefined, ownerA);
    expect(dash.statusCode).toBe(200);
    const body = dash.json<{ dashboard: Record<string, number> }>().dashboard;
    expect(typeof body.goalsActive).toBe("number");
    expect(typeof body.kpisActive).toBe("number");
    expect(typeof body.approvalsPending).toBe("number");

    const cross = await call(app, "GET", `${control(orgA)}/director/dashboard`, undefined, ownerB);
    expect(cross.statusCode).toBe(404);
  });
});
