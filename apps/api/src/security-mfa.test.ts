import { mfaRecoveryCodes, seedReferenceData, users } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { generateTotp } from "@verasjuris/security";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified } from "./test-helpers.js";

const APP_KEY = "test-app-encryption-key-verasjuris-26";

describe("Etapa 27 — MFA TOTP", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let cookie: string;
  let secret = "";

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    process.env.APP_ENCRYPTION_KEY = APP_KEY;
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
      appEncryptionKey: APP_KEY,
    });
    cookie = await registerVerified(app, email, {
      displayName: "MFA User",
      email: "mfa.user@exemplo.com",
    });
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("enable/verify/invalid/recovery/reuse blocked", async () => {
    const begin = await call(app, "POST", "/v1/me/security/mfa/totp/begin", {}, cookie);
    expect(begin.statusCode).toBe(201);
    const began = begin.json<{ secret: string }>();
    secret = began.secret;
    expect(secret.length).toBeGreaterThan(10);

    const bad = await call(
      app,
      "POST",
      "/v1/me/security/mfa/totp/enable",
      { code: "000000" },
      cookie,
    );
    expect(bad.statusCode).toBeGreaterThanOrEqual(400);

    const code = generateTotp(secret);
    const enable = await call(app, "POST", "/v1/me/security/mfa/totp/enable", { code }, cookie);
    expect(enable.statusCode).toBe(200);
    const enabled = enable.json<{ recoveryCodes: string[]; enabled: boolean }>();
    expect(enabled.enabled).toBe(true);
    expect(enabled.recoveryCodes).toHaveLength(8);

    const user = await database.db.query.users.findFirst({
      where: eq(users.email, "mfa.user@exemplo.com"),
    });
    const rows = await database.db.query.mfaRecoveryCodes.findMany({
      where: eq(mfaRecoveryCodes.userId, user!.id),
    });
    // hashes only
    for (const row of rows) {
      expect(row.codeHash).not.toEqual(enabled.recoveryCodes[0]);
      expect(row.codeHash.length).toBeGreaterThan(20);
    }

    const verifyOk = await call(
      app,
      "POST",
      "/v1/me/security/mfa/totp/verify",
      { code: generateTotp(secret) },
      cookie,
    );
    expect(verifyOk.statusCode).toBe(200);

    const verifyBad = await call(
      app,
      "POST",
      "/v1/me/security/mfa/totp/verify",
      { code: "111111" },
      cookie,
    );
    expect(verifyBad.statusCode).toBeGreaterThanOrEqual(400);

    const recovery = enabled.recoveryCodes[0]!;
    const recOk = await call(
      app,
      "POST",
      "/v1/me/security/mfa/recovery/verify",
      { code: recovery },
      cookie,
    );
    expect(recOk.statusCode).toBe(200);

    const reuse = await call(
      app,
      "POST",
      "/v1/me/security/mfa/recovery/verify",
      { code: recovery },
      cookie,
    );
    expect(reuse.statusCode).toBeGreaterThanOrEqual(400);
  });
});
