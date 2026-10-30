import {
  apiClientScopes,
  apiClients,
  apiCredentials,
  apiScopes,
  seedReferenceData,
} from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { hashPassword } from "@verasjuris/security";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified } from "./test-helpers.js";

describe("Etapa 26 — public API gateway", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let orgA: string;
  let orgB: string;
  let bearerClients: string;
  let bearerMatters: string;

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
    const cookieA = await registerVerified(app, email, {
      displayName: "Public A",
      email: "public.a@exemplo.com",
    });
    const cookieB = await registerVerified(app, email, {
      displayName: "Public B",
      email: "public.b@exemplo.com",
    });
    orgA = (await call(app, "POST", "/v1/organizations", { name: "Org Public A" }, cookieA)).json<{
      organization: { id: string };
    }>().organization.id;
    orgB = (await call(app, "POST", "/v1/organizations", { name: "Org Public B" }, cookieB)).json<{
      organization: { id: string };
    }>().organization.id;

    for (const key of [
      "clients.read",
      "matters.read",
      "documents.read",
      "deadlines.read",
      "analytics.read",
      "marketplace.read",
      "billing.read",
      "webhooks.manage",
    ]) {
      await database.db.insert(apiScopes).values({ key, name: key }).onConflictDoNothing();
    }

    async function mint(orgId: string, scopeKeys: string[], credentialId: string, secret: string) {
      const [client] = await database.db
        .insert(apiClients)
        .values({ organizationId: orgId, name: `client-${credentialId}`, status: "active" })
        .returning();
      await database.db.insert(apiCredentials).values({
        apiClientId: client!.id,
        credentialId,
        secretHash: await hashPassword(secret),
        prefix: "vj",
      });
      const scopes = await database.db.query.apiScopes.findMany();
      for (const key of scopeKeys) {
        const scope = scopes.find((s) => s.key === key);
        if (!scope) continue;
        await database.db.insert(apiClientScopes).values({
          apiClientId: client!.id,
          scopeId: scope.id,
        });
      }
      return `Bearer ${credentialId}.${secret}`;
    }

    bearerClients = await mint(orgA, ["clients.read"], "cred_clients", "secret-clients-12");
    bearerMatters = await mint(orgA, ["matters.read"], "cred_matters", "secret-matters-12");
    void orgB;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("auth, scope, tenant, rate, openapi", async () => {
    const openapi = await app.inject({ method: "GET", url: "/v1/public/openapi.json" });
    expect(openapi.statusCode).toBe(200);

    const unauth = await app.inject({ method: "GET", url: "/v1/public/clients" });
    expect(unauth.statusCode).toBe(401);

    const ok = await app.inject({
      method: "GET",
      url: "/v1/public/clients",
      headers: { authorization: bearerClients },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json<{ organizationId: string }>().organizationId).toBe(orgA);

    const scopeDenied = await app.inject({
      method: "GET",
      url: "/v1/public/clients",
      headers: { authorization: bearerMatters },
    });
    expect(scopeDenied.statusCode).toBe(403);

    // rate limit pressure (best-effort)
    let limited = false;
    for (let i = 0; i < 130; i += 1) {
      const res = await app.inject({
        method: "GET",
        url: "/v1/public/matters",
        headers: { authorization: bearerMatters },
      });
      if (res.statusCode === 429) {
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
  });
});
