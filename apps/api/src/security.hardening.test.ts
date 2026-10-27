import { sessions, users } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { seedReferenceData } from "@verasjuris/database";
import { MemoryEmailProvider } from "@verasjuris/email";
import { CSRF_HEADER, SESSION_COOKIE } from "@verasjuris/security";
import { eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { registerVerified, testPassword as password } from "./test-helpers.js";

const webOrigin = "http://127.0.0.1:3000";

async function call(
  app: FastifyInstance,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  url: string,
  options: {
    body?: Record<string, unknown>;
    cookie?: string;
    origin?: string;
    csrf?: string;
  } = {},
) {
  return app.inject({
    method,
    url,
    ...(options.body ? { payload: options.body } : {}),
    headers: {
      ...(options.csrf === undefined ? { [CSRF_HEADER]: "1" } : { [CSRF_HEADER]: options.csrf }),
      ...(options.origin ? { origin: options.origin } : {}),
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.cookie ? { cookie: `${SESSION_COOKIE}=${options.cookie}` } : {}),
    },
  });
}

describe("endurecimento da fundação", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;

  beforeAll(async () => {
    const database = await started;
    await seedReferenceData(database.db);
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin,
      isProduction: false,
      email,
    });
  });

  afterAll(async () => {
    await app.close();
    const database = await started;
    await database.close();
  });

  it("invalida a sessão no servidor após logout", async () => {
    const cookie = await registerVerified(app, email, {
      displayName: "Dora Sessão",
      email: "dora.sessao@exemplo.com",
    });
    const logout = await call(app, "POST", "/v1/auth/logout", { cookie });
    expect(logout.statusCode).toBe(204);
    const reused = await call(app, "GET", "/v1/auth/session", { cookie });
    expect(reused.statusCode).toBe(401);
  });

  it("rejeita sessão expirada e usuário desativado", async () => {
    const database = await started;
    const cookie = await registerVerified(app, email, {
      displayName: "Eva Expirada",
      email: "eva.expirada@exemplo.com",
    });
    const user = await database.db.query.users.findFirst({
      where: eq(users.email, "eva.expirada@exemplo.com"),
    });
    if (!user) throw new Error("usuário ausente");
    await database.db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(sessions.userId, user.id));

    const expired = await call(app, "GET", "/v1/auth/session", { cookie });
    expect(expired.statusCode).toBe(401);

    const activeCookie = await registerVerified(app, email, {
      displayName: "Fábio Desativado",
      email: "fabio.desativado@exemplo.com",
    });
    const disabledUser = await database.db.query.users.findFirst({
      where: eq(users.email, "fabio.desativado@exemplo.com"),
    });
    if (!disabledUser) throw new Error("usuário ausente");
    await database.db
      .update(users)
      .set({ status: "disabled" })
      .where(eq(users.id, disabledUser.id));
    const disabledSession = await call(app, "GET", "/v1/auth/session", { cookie: activeCookie });
    expect(disabledSession.statusCode).toBe(401);
    const disabledLogin = await call(app, "POST", "/v1/auth/login", {
      body: { email: "fabio.desativado@exemplo.com", password },
    });
    expect(disabledLogin.statusCode).toBe(401);
    expect(disabledLogin.json<{ error: { message: string } }>().error.message).toBe(
      "Não foi possível entrar. Confira e-mail e senha. Nenhuma sessão foi aberta.",
    );
  });

  it("rejeita Origin e Referer estranhos em mutações", async () => {
    const denied = await call(app, "POST", "/v1/auth/login", {
      body: { email: "x@exemplo.com", password },
      origin: "https://attacker.example",
    });
    expect(denied.statusCode).toBe(403);
    expect(denied.json<{ error: { code: string } }>().error.code).toBe("AUTHORIZATION_ERROR");

    const allowed = await call(app, "POST", "/v1/auth/login", {
      body: { email: "inexistente@exemplo.com", password },
      origin: webOrigin,
    });
    expect(allowed.statusCode).toBe(401);
  });

  it("impede IDOR de membership e mass assignment no rename", async () => {
    const anaCookie = await registerVerified(app, email, {
      displayName: "Ana IDOR",
      email: "ana.idor@exemplo.com",
    });
    const brunoCookie = await registerVerified(app, email, {
      displayName: "Bruno IDOR",
      email: "bruno.idor@exemplo.com",
    });
    const alfa = await call(app, "POST", "/v1/organizations", {
      body: { name: "Org IDOR Alfa" },
      cookie: anaCookie,
    });
    const beta = await call(app, "POST", "/v1/organizations", {
      body: { name: "Org IDOR Beta" },
      cookie: brunoCookie,
    });
    const alfaId = alfa.json<{ organization: { id: string } }>().organization.id;
    const betaId = beta.json<{ organization: { id: string } }>().organization.id;
    const betaMembers = await call(app, "GET", `/v1/organizations/${betaId}/members`, {
      cookie: brunoCookie,
    });
    const betaMembershipId = betaMembers.json<{ members: Array<{ membershipId: string }> }>()
      .members[0]?.membershipId;
    if (!betaMembershipId) throw new Error("membership beta ausente");

    const crossPatch = await call(
      app,
      "PATCH",
      `/v1/organizations/${alfaId}/members/${betaMembershipId}`,
      {
        body: { roleKeys: ["member"] },
        cookie: anaCookie,
      },
    );
    expect(crossPatch.statusCode).toBe(404);

    const mass = await call(app, "PATCH", `/v1/organizations/${alfaId}`, {
      body: { name: "Nome válido", slug: "slug-forjado", status: "suspended" },
      cookie: anaCookie,
    });
    expect(mass.statusCode).toBe(200);
    const renamed = mass.json<{ organization: { name: string; slug: string; status: string } }>()
      .organization;
    expect(renamed.name).toBe("Nome válido");
    expect(renamed.slug).not.toBe("slug-forjado");
    expect(renamed.status).toBe("active");
  });

  it("mantém ao menos um proprietário sob demoção concorrente", async () => {
    const cookieA = await registerVerified(app, email, {
      displayName: "Owner A",
      email: "owner.a@exemplo.com",
    });
    const cookieB = await registerVerified(app, email, {
      displayName: "Owner B",
      email: "owner.b@exemplo.com",
    });
    const org = await call(app, "POST", "/v1/organizations", {
      body: { name: "Org Concorrência" },
      cookie: cookieA,
    });
    const orgId = org.json<{ organization: { id: string } }>().organization.id;
    await call(app, "POST", `/v1/organizations/${orgId}/members`, {
      body: { email: "owner.b@exemplo.com" },
      cookie: cookieA,
    });
    const members = await call(app, "GET", `/v1/organizations/${orgId}/members`, {
      cookie: cookieA,
    });
    const list = members.json<{
      members: Array<{ membershipId: string; email: string; roles: string[] }>;
    }>().members;
    const membershipA = list.find((item) => item.email === "owner.a@exemplo.com")?.membershipId;
    const membershipB = list.find((item) => item.email === "owner.b@exemplo.com")?.membershipId;
    if (!membershipA || !membershipB) throw new Error("memberships ausentes");
    await call(app, "PATCH", `/v1/organizations/${orgId}/members/${membershipB}`, {
      body: { roleKeys: ["owner"] },
      cookie: cookieA,
    });

    const [first, second] = await Promise.all([
      call(app, "PATCH", `/v1/organizations/${orgId}/members/${membershipA}`, {
        body: { roleKeys: ["member"] },
        cookie: cookieA,
      }),
      call(app, "PATCH", `/v1/organizations/${orgId}/members/${membershipB}`, {
        body: { roleKeys: ["member"] },
        cookie: cookieB,
      }),
    ]);
    const statuses = [first.statusCode, second.statusCode].sort();
    expect(statuses).toContain(200);
    expect(statuses).toContain(409);

    const checkA = await call(app, "GET", `/v1/organizations/${orgId}/members`, {
      cookie: cookieA,
    });
    const checkB = await call(app, "GET", `/v1/organizations/${orgId}/members`, {
      cookie: cookieB,
    });
    const surviving = checkA.statusCode === 200 ? checkA : checkB;
    expect(surviving.statusCode).toBe(200);
    const owners = surviving
      .json<{ members: Array<{ roles: string[]; status: string }> }>()
      .members.filter((member) => member.status === "active" && member.roles.includes("owner"));
    expect(owners.length).toBeGreaterThanOrEqual(1);
  });

  it("bloqueia DELETE em audit_events e define cookie HttpOnly no login", async () => {
    const database = await started;
    const cookie = await registerVerified(app, email, {
      displayName: "Guto Audit",
      email: "guto.audit@exemplo.com",
    });
    const login = await call(app, "POST", "/v1/auth/login", {
      body: { email: "guto.audit@exemplo.com", password },
    });
    expect(String(login.headers["set-cookie"])).toMatch(/HttpOnly/i);
    expect(String(login.headers["set-cookie"])).toMatch(/SameSite=Lax/i);
    expect(cookie.length).toBeGreaterThan(10);
    await expect(database.db.execute(sql`delete from audit_events`)).rejects.toSatisfy(
      (error: unknown) => {
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
      },
    );
  });
});
