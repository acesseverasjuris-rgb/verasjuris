import { auditEvents } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { seedReferenceData } from "@verasjuris/database";
import { MemoryEmailProvider } from "@verasjuris/email";
import { CSRF_HEADER, SESSION_COOKIE } from "@verasjuris/security";
import { eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified, testPassword as password } from "./test-helpers.js";

describe("API da fundação", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;

  beforeAll(async () => {
    const database = await started;
    await seedReferenceData(database.db);
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
    });
  });

  afterAll(async () => {
    await app.close();
    const database = await started;
    await database.close();
  });

  it("responde o healthcheck sem segredos", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ status: string; version: string; checks: { database: string } }>();
    expect(body.status).toBe("ok");
    expect(body.version).toBe("0.1.0");
    expect(body.checks.database).toBe("ok");
    expect(JSON.stringify(body)).not.toMatch(/postgres:\/\/|password|stack/);
  });

  it("rejeita cadastro inválido e mutação sem proteção", async () => {
    const invalid = await call(app, "POST", "/v1/auth/register", {
      displayName: "A",
      email: "nao-e-email",
      password: "curta",
    });
    expect(invalid.statusCode).toBe(400);
    const body = invalid.json<{
      error: { code: string; stack?: string; details: Array<{ path: string }> };
    }>();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.stack).toBeUndefined();
    expect(body.error.details.some((detail) => detail.path === "password")).toBe(true);

    const unprotected = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: "ana@exemplo.com", password: password },
      headers: { "content-type": "application/json" },
    });
    expect(unprotected.statusCode).toBe(403);
  });

  it("isola organizações, permissões e auditoria", async () => {
    const database = await started;
    const anaCookie = await registerVerified(app, email, {
      displayName: "Ana Lima",
      email: "ana@exemplo.com",
    });
    const brunoCookie = await registerVerified(app, email, {
      displayName: "Bruno Dias",
      email: "bruno@exemplo.com",
    });
    const caioCookie = await registerVerified(app, email, {
      displayName: "Caio Reis",
      email: "caio@exemplo.com",
    });

    const wrongPassword = await call(app, "POST", "/v1/auth/login", {
      email: "ana@exemplo.com",
      password: "senha-incorreta",
    });
    expect(wrongPassword.statusCode).toBe(401);
    expect(JSON.stringify(wrongPassword.json())).not.toContain("stack");

    const anaOrg = await call(
      app,
      "POST",
      "/v1/organizations",
      { name: "Organização Alfa" },
      anaCookie,
    );
    expect(anaOrg.statusCode).toBe(201);
    const alfaId = anaOrg.json<{ organization: { id: string } }>().organization.id;

    const brunoOrg = await call(
      app,
      "POST",
      "/v1/organizations",
      { name: "Organização Beta" },
      brunoCookie,
    );
    const betaId = brunoOrg.json<{ organization: { id: string } }>().organization.id;

    const stranger = await call(app, "GET", `/v1/organizations/${alfaId}`, undefined, caioCookie);
    expect(stranger.statusCode).toBe(404);

    const crossPath = await call(app, "GET", `/v1/organizations/${betaId}`, undefined, anaCookie);
    expect(crossPath.statusCode).toBe(404);

    const queryBypass = await call(
      app,
      "GET",
      `/v1/organizations/${alfaId}?organizationId=${betaId}`,
      undefined,
      anaCookie,
    );
    expect(queryBypass.statusCode).toBe(200);
    expect(queryBypass.json<{ organization: { id: string } }>().organization.id).toBe(alfaId);

    const memberPost = await call(
      app,
      "POST",
      `/v1/organizations/${alfaId}/members`,
      { email: "caio@exemplo.com" },
      anaCookie,
    );
    expect(memberPost.statusCode).toBe(201);
    const membershipId = memberPost.json<{ member: { membershipId: string } }>().member
      .membershipId;

    const crossMember = await call(
      app,
      "POST",
      `/v1/organizations/${alfaId}/members`,
      { email: "ana@exemplo.com" },
      brunoCookie,
    );
    expect(crossMember.statusCode).toBe(404);

    const caioSession = await call(app, "GET", "/v1/auth/session", undefined, caioCookie);
    expect(
      caioSession.json<{ account: { memberships: Array<{ roles: string[] }> } }>().account
        .memberships[0]?.roles,
    ).toEqual(["member"]);

    const forbiddenUpdate = await call(
      app,
      "PATCH",
      `/v1/organizations/${alfaId}`,
      { name: "Nome indevido" },
      caioCookie,
    );
    expect(forbiddenUpdate.statusCode).toBe(403);

    const forbiddenRole = await call(
      app,
      "PATCH",
      `/v1/organizations/${alfaId}/members/${membershipId}`,
      { roleKeys: ["administrator"] },
      caioCookie,
    );
    expect(forbiddenRole.statusCode).toBe(403);

    const caioAuditBeforeRole = await call(
      app,
      "GET",
      `/v1/organizations/${alfaId}/audit`,
      undefined,
      caioCookie,
    );
    expect(caioAuditBeforeRole.statusCode).toBe(403);

    const adminRole = await call(
      app,
      "PATCH",
      `/v1/organizations/${alfaId}/members/${membershipId}`,
      { roleKeys: ["administrator"] },
      anaCookie,
    );
    expect(adminRole.statusCode).toBe(200);

    const caioMembers = await call(
      app,
      "GET",
      `/v1/organizations/${alfaId}/members`,
      undefined,
      caioCookie,
    );
    expect(caioMembers.statusCode).toBe(200);

    const caioAudit = await call(
      app,
      "GET",
      `/v1/organizations/${alfaId}/audit`,
      undefined,
      caioCookie,
    );
    expect(caioAudit.statusCode).toBe(200);

    const membersResponse = await call(
      app,
      "GET",
      `/v1/organizations/${alfaId}/members`,
      undefined,
      anaCookie,
    );
    const ownerId = membersResponse
      .json<{ members: Array<{ membershipId: string; roles: string[] }> }>()
      .members.find((member) => member.roles.includes("owner"))?.membershipId;
    const lastOwner = await call(
      app,
      "PATCH",
      `/v1/organizations/${alfaId}/members/${ownerId}`,
      { roleKeys: ["member"] },
      anaCookie,
    );
    expect(lastOwner.statusCode).toBe(409);

    const audit = await call(app, "GET", `/v1/organizations/${alfaId}/audit`, undefined, anaCookie);
    expect(audit.statusCode).toBe(200);
    const events = audit.json<{ events: Array<{ action: string }> }>().events;
    expect(events.some((event) => event.action === "organization.created")).toBe(true);
    expect(
      events.some(
        (event) => event.action === "membership.created" || event.action === "membership.updated",
      ),
    ).toBe(true);
    expect(JSON.stringify(events)).not.toContain(password);

    const stored = await database.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.organizationId, alfaId));
    expect(JSON.stringify(stored)).not.toContain(password);
    await expect(
      database.db.execute(
        sql`update audit_events set action = 'tamper' where organization_id = ${alfaId}`,
      ),
    ).rejects.toSatisfy((error: unknown) => {
      const messages: string[] = [];
      const seen = new Set<unknown>();
      let current: unknown = error;
      while (current && typeof current === "object" && !seen.has(current)) {
        seen.add(current);
        if ("message" in current && typeof current.message === "string")
          messages.push(current.message);
        current = "cause" in current ? current.cause : undefined;
      }
      return messages.join("\n").includes("append-only");
    });

    void CSRF_HEADER;
    void SESSION_COOKIE;
  });
});
