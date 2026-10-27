import { createTestDatabase } from "@verasjuris/database/testing";
import { seedReferenceData } from "@verasjuris/database";
import { MemoryEmailProvider } from "@verasjuris/email";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified } from "./test-helpers.js";

describe("Etapa 5 — Tasks API", () => {
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
      displayName: "Owner A Tasks",
      email: "owner.a.tasks@exemplo.com",
    });
    ownerB = await registerVerified(app, email, {
      displayName: "Owner B Tasks",
      email: "owner.b.tasks@exemplo.com",
    });
    orgA = (await call(app, "POST", "/v1/organizations", { name: "Org Tasks A" }, ownerA)).json<{
      organization: { id: string };
    }>().organization.id;
    orgB = (await call(app, "POST", "/v1/organizations", { name: "Org Tasks B" }, ownerB)).json<{
      organization: { id: string };
    }>().organization.id;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("cria tarefa e lista", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/tasks`,
      { title: "Elaborar petição" },
      ownerA,
    );
    expect(created.statusCode).toBe(201);
    const list = await call(app, "GET", `/v1/organizations/${orgA}/tasks`, undefined, ownerA);
    expect(list.statusCode).toBe(200);
    expect(list.json<{ total: number }>().total).toBeGreaterThanOrEqual(1);
  });

  it("retorna 404 cross-tenant", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/tasks`,
      { title: "Privada A" },
      ownerA,
    );
    const taskId = created.json<{ task: { id: string } }>().task.id;
    const foreign = await call(
      app,
      "GET",
      `/v1/organizations/${orgB}/tasks/${taskId}`,
      undefined,
      ownerB,
    );
    expect(foreign.statusCode).toBe(404);
  });

  it("detecta ciclo de dependências", async () => {
    const a = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/tasks`,
      { title: "Task A" },
      ownerA,
    );
    const b = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/tasks`,
      { title: "Task B" },
      ownerA,
    );
    const idA = a.json<{ task: { id: string } }>().task.id;
    const idB = b.json<{ task: { id: string } }>().task.id;
    const dep1 = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/tasks/${idA}/dependencies`,
      { dependsOnTaskId: idB },
      ownerA,
    );
    expect(dep1.statusCode).toBe(201);
    const cycle = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/tasks/${idB}/dependencies`,
      { dependsOnTaskId: idA },
      ownerA,
    );
    expect(cycle.statusCode).toBe(409);
  });

  it("sanitiza HTML/XSS em comentários", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/tasks`,
      { title: "Com comentário" },
      ownerA,
    );
    const taskId = created.json<{ task: { id: string } }>().task.id;
    const commented = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/tasks/${taskId}/comments`,
      { body: '<script>alert("x")</script>Olá <b>mundo</b>' },
      ownerA,
    );
    expect(commented.statusCode).toBe(201);
    const body = commented.json<{ comment: { body: string } }>().comment.body;
    expect(body).not.toContain("<script");
    expect(body).not.toContain("<b>");
    expect(body).toContain("Olá");
    expect(body).toContain("mundo");
  });

  it("pausa SLA ao entrar em waiting", async () => {
    const policy = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/sla-policies`,
      { name: `SLA-${Date.now()}`, targetMinutes: 120, warningMinutes: 60 },
      ownerA,
    );
    expect(policy.statusCode).toBe(201);
    const policyId = policy.json<{ policy: { id: string } }>().policy.id;
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/tasks`,
      { title: "Com SLA", status: "in_progress", slaPolicyId: policyId },
      ownerA,
    );
    const taskId = created.json<{ task: { id: string } }>().task.id;
    const waiting = await call(
      app,
      "PATCH",
      `/v1/organizations/${orgA}/tasks/${taskId}`,
      { status: "waiting" },
      ownerA,
    );
    expect(waiting.statusCode).toBe(200);
    const detail = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/tasks/${taskId}`,
      undefined,
      ownerA,
    );
    expect(detail.json<{ sla: { status: string } | null }>().sla?.status).toBe("paused");
  });
});
