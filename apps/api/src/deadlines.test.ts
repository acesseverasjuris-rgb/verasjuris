import { createTestDatabase } from "@verasjuris/database/testing";
import { seedReferenceData } from "@verasjuris/database";
import { MemoryEmailProvider } from "@verasjuris/email";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified } from "./test-helpers.js";

describe("Etapa 5.2 — Deadlines API", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let ownerA: string;
  let ownerB: string;
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
      displayName: "Owner A Deadlines",
      email: "owner.a.deadlines@exemplo.com",
    });
    ownerB = await registerVerified(app, email, {
      displayName: "Owner B Deadlines",
      email: "owner.b.deadlines@exemplo.com",
    });
    orgA = (
      await call(app, "POST", "/v1/organizations", { name: "Org Deadlines A" }, ownerA)
    ).json<{ organization: { id: string } }>().organization.id;
    orgB = (
      await call(app, "POST", "/v1/organizations", { name: "Org Deadlines B" }, ownerB)
    ).json<{ organization: { id: string } }>().organization.id;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("calcula business_days com holiday NOT_CONFIGURED e status suggested", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/deadlines`,
      {
        title: "Contestação",
        baseDate: new Date("2026-10-20T12:00:00.000Z").toISOString(),
        ruleType: "business_days",
        ruleDays: 15,
        timezone: "America/Sao_Paulo",
        calculate: true,
      },
      ownerA,
    );
    expect(created.statusCode).toBe(201);
    const deadline = created.json<{
      deadline: {
        status: string;
        calculatedDueAt: string | null;
        holidayCalendar: string;
        calculationNotes?: string;
      };
    }>().deadline;
    expect(deadline.status).toBe("suggested");
    expect(deadline.calculatedDueAt).toBeTruthy();
    expect(deadline.holidayCalendar).toBe("NOT_CONFIGURED");
    expect(deadline.calculationNotes ?? "").toMatch(/NOT_CONFIGURED|feriados/i);
  });

  it("confirma prazo sugerido", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/deadlines`,
      {
        title: "Recurso",
        baseDate: new Date("2026-10-01T12:00:00.000Z").toISOString(),
        ruleType: "calendar_days",
        ruleDays: 10,
        calculate: true,
      },
      ownerA,
    );
    const id = created.json<{ deadline: { id: string } }>().deadline.id;
    const confirmed = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/deadlines/${id}/confirm`,
      {},
      ownerA,
    );
    expect(confirmed.statusCode).toBe(200);
    const deadline = confirmed.json<{
      deadline: { status: string; confirmedDueAt: string | null };
    }>().deadline;
    expect(deadline.status).toBe("confirmed");
    expect(deadline.confirmedDueAt).toBeTruthy();
  });

  it("retorna 404 cross-tenant", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/deadlines`,
      {
        title: "Privado",
        baseDate: new Date().toISOString(),
        ruleType: "manual_date",
        manualDueAt: new Date().toISOString(),
        calculate: true,
      },
      ownerA,
    );
    const id = created.json<{ deadline: { id: string } }>().deadline.id;
    const foreign = await call(
      app,
      "GET",
      `/v1/organizations/${orgB}/deadlines/${id}`,
      undefined,
      ownerB,
    );
    expect(foreign.statusCode).toBe(404);
  });

  it("alteração de confirmado exige motivo", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/deadlines`,
      {
        title: "Alterável",
        baseDate: new Date("2026-09-01T12:00:00.000Z").toISOString(),
        ruleType: "calendar_days",
        ruleDays: 5,
        calculate: true,
      },
      ownerA,
    );
    const id = created.json<{ deadline: { id: string } }>().deadline.id;
    await call(app, "POST", `/v1/organizations/${orgA}/deadlines/${id}/confirm`, {}, ownerA);
    const bad = await call(
      app,
      "PATCH",
      `/v1/organizations/${orgA}/deadlines/${id}`,
      { title: "Novo título" },
      ownerA,
    );
    expect(bad.statusCode).toBe(409);
    const changed = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/deadlines/${id}/change`,
      {
        confirmedDueAt: new Date("2026-12-31T12:00:00.000Z").toISOString(),
        reason: "Erro de contagem — correção após conferência.",
      },
      ownerA,
    );
    expect(changed.statusCode).toBe(200);
  });
});
