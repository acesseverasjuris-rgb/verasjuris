import { seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified } from "./test-helpers.js";

describe("Etapa 29 — observability", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let cookie: string;
  let orgId: string;

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
    cookie = await registerVerified(app, email, {
      displayName: "Obs User",
      email: "obs.user@exemplo.com",
    });
    orgId = (await call(app, "POST", "/v1/organizations", { name: "Org Obs" }, cookie)).json<{
      organization: { id: string };
    }>().organization.id;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("live/ready/status/dashboard", async () => {
    const live = await call(app, "GET", "/health/live");
    expect(live.statusCode).toBe(200);
    const ready = await call(app, "GET", "/health/ready");
    expect(ready.statusCode).toBe(200);
    const status = await call(app, "GET", "/v1/status", undefined, cookie);
    expect(status.statusCode).toBe(200);
    const dash = await call(
      app,
      "GET",
      `/v1/organizations/${orgId}/observability/dashboard`,
      undefined,
      cookie,
    );
    expect(dash.statusCode).toBe(200);
    const body = dash.json<{
      queues: { status: string };
      providers: { observability: { status: string } };
    }>();
    expect(body.queues.status).toMatch(/not_configured|local_in_process|ok/);
    expect(body.providers.observability.status).toBe("not_configured");
  });
});
