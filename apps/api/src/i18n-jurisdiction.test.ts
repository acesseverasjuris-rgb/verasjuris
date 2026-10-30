import { seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified } from "./test-helpers.js";

describe("Etapa 32 — i18n jurisdiction", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let cookie: string;

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
      displayName: "I18n User",
      email: "i18n.user@exemplo.com",
    });
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("exige BR declarado e rejeita aplicação silenciosa", async () => {
    const ok = await call(
      app,
      "POST",
      "/v1/i18n/jurisdiction/check-br",
      {
        country: "BR",
        language: "pt-BR",
        currency: "BRL",
        timezone: "America/Sao_Paulo",
      },
      cookie,
    );
    expect(ok.statusCode).toBe(200);

    const us = await call(
      app,
      "POST",
      "/v1/i18n/jurisdiction/check-br",
      {
        country: "US",
        language: "en",
        currency: "USD",
        timezone: "America/New_York",
      },
      cookie,
    );
    expect(us.statusCode).toBeGreaterThanOrEqual(400);
  });
});
