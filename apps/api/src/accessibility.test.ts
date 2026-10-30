import { seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified } from "./test-helpers.js";

describe("Etapa 31 — accessibility preferences", () => {
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
      displayName: "A11y User",
      email: "a11y.user@exemplo.com",
    });
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("GET/PUT preferences", async () => {
    const get1 = await call(app, "GET", "/v1/me/accessibility-preferences", undefined, cookie);
    expect(get1.statusCode).toBe(200);
    const put = await call(
      app,
      "PUT",
      "/v1/me/accessibility-preferences",
      { fontScalePercent: 125, reduceMotion: true, contrastMode: "high" },
      cookie,
    );
    expect(put.statusCode).toBe(200);
    expect(
      put.json<{ preferences: { fontScalePercent: number; reduceMotion: boolean } }>().preferences
        .fontScalePercent,
    ).toBe(125);
    expect(put.json<{ preferences: { reduceMotion: boolean } }>().preferences.reduceMotion).toBe(
      true,
    );
  });
});
