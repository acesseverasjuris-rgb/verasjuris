import { seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified } from "./test-helpers.js";

describe("Etapa 26 — integrations", () => {
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
      displayName: "Integrations Owner",
      email: "integrations.owner@exemplo.com",
    });
    const org = await call(app, "POST", "/v1/organizations", { name: "Org Integrations" }, cookie);
    expect(org.statusCode).toBe(201);
    orgId = org.json<{ organization: { id: string } }>().organization.id;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("lista providers, health NOT_CONFIGURED, credenciais e court sync", async () => {
    const providers = await call(app, "GET", "/v1/integrations/providers", undefined, cookie);
    expect(providers.statusCode).toBe(200);
    expect(providers.json<{ items: unknown[] }>().items.length).toBeGreaterThan(0);

    const health = await call(
      app,
      "POST",
      `/v1/organizations/${orgId}/integrations/providers/health`,
      {},
      cookie,
    );
    expect(health.statusCode).toBe(200);

    const cred = await call(
      app,
      "POST",
      `/v1/organizations/${orgId}/integrations/credentials`,
      {
        providerKey: "court.tj",
        credentialReference: "secret/refs/court-tj",
        environment: "staging",
      },
      cookie,
    );
    expect(cred.statusCode).toBe(201);
    expect(
      cred.json<{ credential: { credentialReference: string } }>().credential.credentialReference,
    ).toBe("secret/refs/court-tj");

    const source = await call(
      app,
      "POST",
      `/v1/organizations/${orgId}/integrations/court-sources`,
      {
        tribunal: "TJSP",
        providerKey: "court",
        externalReference: "0000000-00.0000.0.00.0000",
      },
      cookie,
    );
    expect(source.statusCode).toBe(201);
    const sourceId = source.json<{ source: { id: string } }>().source.id;
    const sync = await call(
      app,
      "POST",
      `/v1/organizations/${orgId}/integrations/court-sources/${sourceId}/sync`,
      {},
      cookie,
    );
    expect(sync.statusCode).toBe(200);
    expect(
      sync.json<{ providerStatus: string; source: { syncStatus: string } }>().source.syncStatus,
    ).toBe("not_configured");
  });
});
