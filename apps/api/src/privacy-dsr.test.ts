import { documents, seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified } from "./test-helpers.js";

describe("Etapa 28 — privacy DSR", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let cookieA: string;
  let cookieB: string;
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
    cookieA = await registerVerified(app, email, {
      displayName: "Privacy A",
      email: "privacy.a@exemplo.com",
    });
    cookieB = await registerVerified(app, email, {
      displayName: "Privacy B",
      email: "privacy.b@exemplo.com",
    });
    orgA = (await call(app, "POST", "/v1/organizations", { name: "Org Privacy A" }, cookieA)).json<{
      organization: { id: string };
    }>().organization.id;
    orgB = (await call(app, "POST", "/v1/organizations", { name: "Org Privacy B" }, cookieB)).json<{
      organization: { id: string };
    }>().organization.id;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("portability + third-party isolation + legal hold blocks deletion", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/privacy/dsr`,
      { subjectKey: "privacy.a@exemplo.com", type: "portability" },
      cookieA,
    );
    expect(created.statusCode).toBe(201);
    const dsrId = created.json<{ request: { id: string } }>().request.id;

    const cross = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/privacy/dsr/${dsrId}`,
      undefined,
      cookieB,
    );
    expect(cross.statusCode).toBeGreaterThanOrEqual(400);

    const listB = await call(
      app,
      "GET",
      `/v1/organizations/${orgB}/privacy/dsr`,
      undefined,
      cookieB,
    );
    expect(listB.statusCode).toBe(200);
    expect(listB.json<{ items: unknown[] }>().items).toHaveLength(0);

    const exported = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/privacy/dsr/${dsrId}/export`,
      undefined,
      cookieA,
    );
    expect(exported.statusCode).toBe(200);
    expect(exported.json<{ export: { organizationId: string } }>().export.organizationId).toBe(
      orgA,
    );

    const delReq = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/privacy/dsr`,
      { subjectKey: "privacy.a@exemplo.com", type: "deletion" },
      cookieA,
    );
    expect(delReq.statusCode).toBe(201);
    const delId = delReq.json<{ request: { id: string } }>().request.id;

    await database.db.insert(documents).values({
      organizationId: orgA,
      ownerType: "organization",
      ownerId: orgA,
      title: "Held",
      status: "active",
      legalHold: true,
    });

    const blocked = await call(
      app,
      "PATCH",
      `/v1/organizations/${orgA}/privacy/dsr/${delId}`,
      { status: "completed" },
      cookieA,
    );
    expect(blocked.statusCode).toBeGreaterThanOrEqual(400);
  });
});
