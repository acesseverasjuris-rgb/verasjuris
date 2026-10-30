import { seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified } from "./test-helpers.js";
import { evaluateCondition } from "./modules/workflows/condition-engine.js";

describe("Etapa 25 — Workflows", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let owner: string;
  let orgId: string;

  const wf = () => `/v1/organizations/${orgId}/workflows`;

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
      displayName: "Owner WF",
      email: "owner.wf@exemplo.com",
    });
    const created = await call(app, "POST", "/v1/organizations", { name: "Org WF" }, owner);
    orgId = created.json<{ organization: { id: string } }>().organization.id;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("publish torna versão imutável", async () => {
    const created = await call(
      app,
      "POST",
      wf(),
      {
        key: "task_on_event",
        name: "Criar tarefa",
        trigger: { type: "manual" },
        actions: [{ type: "create_task", params: { title: "Tarefa WF" } }],
      },
      owner,
    );
    expect(created.statusCode).toBe(201);
    const definitionId = created.json<{ definition: { id: string } }>().definition.id;

    const published = await call(app, "POST", `${wf()}/${definitionId}/publish`, {}, owner);
    expect(published.statusCode).toBe(200);
    expect(published.json<{ version: { immutable: boolean } }>().version.immutable).toBe(true);

    const update = await call(
      app,
      "PATCH",
      `${wf()}/${definitionId}`,
      { name: "Tentativa mutação" },
      owner,
    );
    expect(update.statusCode).toBe(409);
  });

  it("conditions, dry-run, idempotency e approval wait", async () => {
    expect(
      evaluateCondition(
        { operator: "equals", field: "status", value: "ready" },
        { status: "ready" },
      ),
    ).toBe(true);

    const created = await call(
      app,
      "POST",
      wf(),
      {
        key: "approval_flow",
        name: "Aprovação",
        trigger: { type: "manual" },
        conditions: { operator: "equals", field: "go", value: true },
        actions: [
          {
            type: "request_approval",
            params: {
              type: "wf",
              referenceType: "workflow",
              referenceId: "33333333-3333-4333-8333-333333333333",
              approverPolicy: "single",
            },
            failurePolicy: "wait_for_review",
          },
          { type: "wait", params: { waitFor: "approval" } },
        ],
      },
      owner,
    );
    expect(created.statusCode).toBe(201);
    const definitionId = created.json<{ definition: { id: string } }>().definition.id;
    await call(app, "POST", `${wf()}/${definitionId}/publish`, {}, owner);

    const dry = await call(
      app,
      "POST",
      `${wf()}/${definitionId}/run`,
      {
        dryRun: true,
        payload: { go: true },
        idempotencyKey: "dry-run-key-12345678",
      },
      owner,
    );
    expect(dry.statusCode).toBe(201);
    expect(dry.json<{ run: { dryRun: boolean } }>().run.dryRun).toBe(true);
    const drySteps = dry.json<{ steps: Array<{ dryRunSkipped?: boolean }> }>().steps;
    expect(drySteps.some((s) => s.dryRunSkipped)).toBe(true);

    const run1 = await call(
      app,
      "POST",
      `${wf()}/${definitionId}/run`,
      {
        dryRun: false,
        payload: { go: true },
        idempotencyKey: "idempotent-run-abcdef12",
      },
      owner,
    );
    expect(run1.statusCode).toBe(201);
    expect(run1.json<{ run: { status: string } }>().run.status).toBe("waiting");

    const run2 = await call(
      app,
      "POST",
      `${wf()}/${definitionId}/run`,
      {
        dryRun: false,
        payload: { go: true },
        idempotencyKey: "idempotent-run-abcdef12",
      },
      owner,
    );
    expect(run2.statusCode).toBe(201);
    expect(run2.json<{ idempotentReplay?: boolean }>().idempotentReplay).toBe(true);
  });

  it("security: rejeita ação com URL arbitrária e não usa eval", async () => {
    const created = await call(
      app,
      "POST",
      wf(),
      {
        key: "bad_webhook",
        name: "Webhook ruim",
        trigger: { type: "manual" },
        actions: [
          {
            type: "webhook_external",
            params: { urlRef: "allowed-hook", url: "https://evil.example" },
          },
        ],
      },
      owner,
    );
    expect(created.statusCode).toBe(400);

    const engineSrc = (
      await import("./modules/workflows/condition-engine.js")
    ).evaluateCondition.toString();
    expect(engineSrc).not.toMatch(/\beval\s*\(/);
  });

  it("lista templates seed", async () => {
    const templates = await call(app, "GET", `${wf()}/templates`, undefined, owner);
    expect(templates.statusCode).toBe(200);
    expect(
      templates
        .json<{ templates: Array<{ key: string }> }>()
        .templates.some((t) => t.key === "deadline_reminder"),
    ).toBe(true);
  });
});
