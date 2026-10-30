import { organizations, seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified } from "./test-helpers.js";

describe("Etapa 23 — Control finance interno", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let owner: string;
  let orgId: string;
  let departmentId: string;
  let positionId: string;
  let employeeId: string;
  let costCenterId: string;
  let budgetId: string;

  const fin = () => `/v1/organizations/${orgId}/control/finance`;
  const hr = () => `/v1/organizations/${orgId}/control/hr`;

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
    owner = await registerVerified(app, email, {
      displayName: "Owner Fin",
      email: "owner.fin@exemplo.com",
    });
    const created = await call(app, "POST", "/v1/organizations", { name: "Org Fin" }, owner);
    orgId = created.json<{ organization: { id: string } }>().organization.id;
    await database.db
      .update(organizations)
      .set({ internalCompany: true })
      .where(eq(organizations.id, orgId));

    const dept = await call(
      app,
      "POST",
      `${hr()}/departments`,
      { name: "Financeiro", code: "fin" },
      owner,
    );
    departmentId = dept.json<{ department: { id: string } }>().department.id;
    const pos = await call(
      app,
      "POST",
      `${hr()}/positions`,
      { departmentId, title: "Analista" },
      owner,
    );
    positionId = pos.json<{ position: { id: string } }>().position.id;
    const emp = await call(
      app,
      "POST",
      `${hr()}/employees`,
      {
        employeeCode: "F-001",
        fullName: "Carla Fin",
        email: "carla.fin@exemplo.com",
        hiredAt: "2026-01-01T00:00:00.000Z",
        departmentId,
        positionId,
        employmentType: "employee",
        status: "active",
      },
      owner,
    );
    employeeId = emp.json<{ employee: { id: string } }>().employee.id;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("budget, cost center, expense e variance", async () => {
    const cc = await call(
      app,
      "POST",
      `${fin()}/cost-centers`,
      { code: "CC-OPS", name: "Operações", departmentId },
      owner,
    );
    expect(cc.statusCode).toBe(201);
    costCenterId = cc.json<{ costCenter: { id: string } }>().costCenter.id;

    const budget = await call(
      app,
      "POST",
      `${fin()}/budgets`,
      { fiscalYear: 2026, version: 1 },
      owner,
    );
    expect(budget.statusCode).toBe(201);
    budgetId = budget.json<{ budget: { id: string } }>().budget.id;

    const line = await call(
      app,
      "POST",
      `${fin()}/budgets/${budgetId}/lines`,
      {
        budgetId,
        costCenterId,
        category: "software",
        period: "2026-Q1",
        plannedAmountCents: 500_000,
      },
      owner,
    );
    expect(line.statusCode).toBe(201);

    const approved = await call(app, "POST", `${fin()}/budgets/${budgetId}/approve`, {}, owner);
    expect(approved.statusCode).toBe(200);

    const variance = await call(
      app,
      "GET",
      `${fin()}/budgets/${budgetId}/variance`,
      undefined,
      owner,
    );
    expect(variance.statusCode).toBe(200);
    const v = variance.json<{ variance: { plannedCents: number; formulaVersion: string } }>()
      .variance;
    expect(v.plannedCents).toBe(500_000);
    expect(v.formulaVersion).toBe("budget_variance.v1");

    const expense = await call(
      app,
      "POST",
      `${fin()}/expenses`,
      { employeeId, costCenterId, period: "2026-10" },
      owner,
    );
    expect(expense.statusCode).toBe(201);
    const expenseId = expense.json<{ expenseReport: { id: string } }>().expenseReport.id;

    const item = await call(
      app,
      "POST",
      `${fin()}/expenses/${expenseId}/items`,
      {
        expenseReportId: expenseId,
        category: "travel",
        description: "Uber",
        amountCents: 4500,
        incurredAt: "2026-10-05T12:00:00.000Z",
      },
      owner,
    );
    expect(item.statusCode).toBe(201);

    const submitted = await call(app, "POST", `${fin()}/expenses/${expenseId}/submit`, {}, owner);
    expect(submitted.statusCode).toBe(200);
    expect(
      submitted.json<{ expenseReport: { status: string; totalCents: number } }>().expenseReport,
    ).toMatchObject({
      status: "submitted",
      totalCents: 4500,
    });
  });
});
