import { seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified, sessionFrom, testPassword } from "./test-helpers.js";

describe("Etapa 27 — sessions security", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let cookieA: string;
  let cookieB: string;

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
      displayName: "Session User",
      email: "session.user@exemplo.com",
    });
    const loginB = await call(app, "POST", "/v1/auth/login", {
      email: "session.user@exemplo.com",
      password: testPassword,
    });
    expect(loginB.statusCode).toBe(200);
    cookieB = sessionFrom(loginB.headers);
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("lista e revoga outras sessões", async () => {
    const listed = await call(app, "GET", "/v1/me/security/sessions", undefined, cookieA);
    expect(listed.statusCode).toBe(200);
    const items = listed.json<{ items: Array<{ id: string; current: boolean }> }>().items;
    expect(items.length).toBeGreaterThanOrEqual(2);

    const revokeOthers = await call(
      app,
      "POST",
      "/v1/me/security/sessions/revoke-others",
      {},
      cookieA,
    );
    expect(revokeOthers.statusCode).toBe(200);

    const afterB = await call(app, "GET", "/v1/me/security/sessions", undefined, cookieB);
    expect(afterB.statusCode).toBe(401);

    const afterA = await call(app, "GET", "/v1/me/security/sessions", undefined, cookieA);
    expect(afterA.statusCode).toBe(200);
  });
});
