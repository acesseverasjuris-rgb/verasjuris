import { seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified } from "./test-helpers.js";

describe("Etapa 33 — enterprise", () => {
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
      displayName: "Ent User",
      email: "ent.user@exemplo.com",
    });
    orgId = (await call(app, "POST", "/v1/organizations", { name: "Org Ent" }, cookie)).json<{
      organization: { id: string };
    }>().organization.id;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("SSO/SCIM NOT_CONFIGURED, policies, SLA, domain", async () => {
    const sso = await call(
      app,
      "PUT",
      `/v1/organizations/${orgId}/enterprise/sso`,
      {
        protocol: "oidc",
        issuer: "https://idp.example.com",
        clientSecretReference: "secret/refs/sso",
      },
      cookie,
    );
    expect(sso.statusCode).toBe(200);
    expect(sso.json<{ providerStatus: string }>().providerStatus).toBe("not_configured");

    const scim = await call(
      app,
      "PUT",
      `/v1/organizations/${orgId}/enterprise/scim`,
      { enabled: true, bearerTokenReference: "secret/refs/scim" },
      cookie,
    );
    expect(scim.statusCode).toBe(200);
    expect(scim.json<{ providerStatus: string }>().providerStatus).toBe("not_configured");

    const policy = await call(
      app,
      "PUT",
      `/v1/organizations/${orgId}/enterprise/security-policy`,
      { mfaPolicy: "required_admin", sessionTimeoutMinutes: 60 },
      cookie,
    );
    expect(policy.statusCode).toBe(200);

    const sla = await call(
      app,
      "POST",
      `/v1/organizations/${orgId}/enterprise/slas`,
      { name: "Gold", availabilityTargetPercent: 99.9 },
      cookie,
    );
    expect(sla.statusCode).toBe(201);

    const domain = await call(
      app,
      "POST",
      `/v1/organizations/${orgId}/enterprise/domain/verify`,
      { domain: "cliente.example.com" },
      cookie,
    );
    expect(domain.statusCode).toBe(200);
    expect(domain.json<{ status: string }>().status).toBe("not_configured");
  });
});
