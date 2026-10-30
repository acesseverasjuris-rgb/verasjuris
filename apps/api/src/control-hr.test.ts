import { organizations, seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified } from "./test-helpers.js";

describe("Etapa 23 — Control HR", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let owner: string;
  let orgId: string;
  let departmentId: string;
  let positionId: string;
  let employeeId: string;
  let reviewerId: string;

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
      displayName: "Owner HR",
      email: "owner.hr@exemplo.com",
    });
    const created = await call(app, "POST", "/v1/organizations", { name: "Org HR" }, owner);
    orgId = created.json<{ organization: { id: string } }>().organization.id;
    await database.db
      .update(organizations)
      .set({ internalCompany: true })
      .where(eq(organizations.id, orgId));
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("cria departamento, cargo e colaboradores", async () => {
    const dept = await call(
      app,
      "POST",
      `${hr()}/departments`,
      { name: "Engenharia", code: "eng" },
      owner,
    );
    expect(dept.statusCode).toBe(201);
    departmentId = dept.json<{ department: { id: string } }>().department.id;

    const pos = await call(
      app,
      "POST",
      `${hr()}/positions`,
      { departmentId, title: "Engenheiro", level: "mid" },
      owner,
    );
    expect(pos.statusCode).toBe(201);
    positionId = pos.json<{ position: { id: string } }>().position.id;

    const emp = await call(
      app,
      "POST",
      `${hr()}/employees`,
      {
        employeeCode: "E-001",
        fullName: "Ana Silva",
        email: "ana.hr@exemplo.com",
        hiredAt: "2026-01-15T00:00:00.000Z",
        departmentId,
        positionId,
        employmentType: "employee",
        status: "active",
      },
      owner,
    );
    expect(emp.statusCode).toBe(201);
    employeeId = emp.json<{ employee: { id: string } }>().employee.id;

    const reviewer = await call(
      app,
      "POST",
      `${hr()}/employees`,
      {
        employeeCode: "E-002",
        fullName: "Bruno Chef",
        email: "bruno.hr@exemplo.com",
        hiredAt: "2025-01-15T00:00:00.000Z",
        departmentId,
        positionId,
        employmentType: "employee",
        status: "active",
      },
      owner,
    );
    expect(reviewer.statusCode).toBe(201);
    reviewerId = reviewer.json<{ employee: { id: string } }>().employee.id;
  });

  it("onboarding, review e leave com calendar event", async () => {
    const plan = await call(app, "POST", `${hr()}/onboarding-plans`, { employeeId }, owner);
    expect(plan.statusCode).toBe(201);
    expect(plan.json<{ items: unknown[] }>().items.length).toBeGreaterThan(0);

    const review = await call(
      app,
      "POST",
      `${hr()}/reviews`,
      {
        employeeId,
        reviewerEmployeeId: reviewerId,
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-06-30T00:00:00.000Z",
        overallScore: 4,
        reviewScaleMax: 5,
      },
      owner,
    );
    expect(review.statusCode).toBe(201);

    const leave = await call(
      app,
      "POST",
      `${hr()}/leaves`,
      {
        employeeId,
        type: "vacation",
        startAt: "2026-11-01T00:00:00.000Z",
        endAt: "2026-11-10T00:00:00.000Z",
        status: "requested",
      },
      owner,
    );
    expect(leave.statusCode).toBe(201);
    const leaveId = leave.json<{ leave: { id: string } }>().leave.id;

    const decided = await call(
      app,
      "POST",
      `${hr()}/leaves/${leaveId}/decide`,
      { status: "approved" },
      owner,
    );
    expect(decided.statusCode).toBe(200);
    expect(decided.json<{ calendarEventId: string | null }>().calendarEventId).toBeTruthy();
  });
});
