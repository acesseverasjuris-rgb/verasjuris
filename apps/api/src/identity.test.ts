import { auditEvents, organizationMembers, sessions, users } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { seedReferenceData } from "@verasjuris/database";
import { MemoryEmailProvider } from "@verasjuris/email";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified, sessionFrom, testPassword as password } from "./test-helpers.js";

describe("Etapa 1 — identidade", () => {
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

  it("cadastra sem enumeração e exige verificação de e-mail", async () => {
    const database = await started;
    const first = await call(app, "POST", "/v1/auth/register", {
      displayName: "Helena",
      email: "Helena@Exemplo.com",
      password,
    });
    expect(first.statusCode).toBe(201);
    const firstBody = first.json<{
      status: string;
      emailDelivery: string;
      message: string;
      account?: unknown;
    }>();
    expect(firstBody.status).toBe("accepted");
    expect(firstBody.account).toBeUndefined();
    expect(first.headers["set-cookie"]).toBeUndefined();
    expect(firstBody.emailDelivery).toBe("captured");

    const user = await database.db.query.users.findFirst({
      where: eq(users.email, "helena@exemplo.com"),
    });
    expect(user?.status).toBe("pending_verification");
    expect(user?.emailVerifiedAt).toBeNull();

    const duplicate = await call(app, "POST", "/v1/auth/register", {
      displayName: "Outra",
      email: "helena@exemplo.com",
      password,
    });
    expect(duplicate.statusCode).toBe(201);
    expect(duplicate.json<{ status: string }>().status).toBe("accepted");
    expect(JSON.stringify(duplicate.json())).not.toMatch(/já existe|already/i);

    const pendingLogin = await call(app, "POST", "/v1/auth/login", {
      email: "helena@exemplo.com",
      password,
    });
    expect(pendingLogin.statusCode).toBe(401);

    const mail = email.latest("email_verification", "helena@exemplo.com");
    expect(mail?.token).toBeTruthy();
    expect(JSON.stringify(first.json())).not.toContain(mail?.token);

    const confirmed = await call(app, "POST", "/v1/auth/email-verification/confirm", {
      token: mail?.token,
    });
    expect(confirmed.statusCode).toBe(200);

    const reuse = await call(app, "POST", "/v1/auth/email-verification/confirm", {
      token: mail?.token,
    });
    expect(reuse.statusCode).toBe(409);

    const login = await call(app, "POST", "/v1/auth/login", {
      email: "helena@exemplo.com",
      password,
    });
    expect(login.statusCode).toBe(200);

    const audits = await database.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.actorUserId, user?.id ?? ""));
    expect(audits.some((event) => event.action === "user.registered")).toBe(true);
    expect(audits.some((event) => event.action === "email.verified")).toBe(true);
    expect(JSON.stringify(audits)).not.toContain(mail?.token);
  });

  it("recupera senha com resposta neutra e revoga sessões", async () => {
    const cookie = await registerVerified(app, email, {
      displayName: "Ícaro",
      email: "icaro@exemplo.com",
    });
    const missing = await call(app, "POST", "/v1/auth/password-reset/request", {
      email: "naoexiste@exemplo.com",
    });
    const existing = await call(app, "POST", "/v1/auth/password-reset/request", {
      email: "icaro@exemplo.com",
    });
    expect(missing.statusCode).toBe(200);
    expect(existing.statusCode).toBe(200);
    expect(missing.json<{ message: string }>().message).toBe(
      existing.json<{ message: string }>().message,
    );

    const mail = email.latest("password_reset", "icaro@exemplo.com");
    expect(mail?.token).toBeTruthy();
    const newPassword = "nova-senha-segura";
    const reset = await call(app, "POST", "/v1/auth/password-reset/confirm", {
      token: mail?.token,
      password: newPassword,
    });
    expect(reset.statusCode).toBe(200);

    const reuse = await call(app, "POST", "/v1/auth/password-reset/confirm", {
      token: mail?.token,
      password: newPassword,
    });
    expect(reuse.statusCode).toBe(401);

    const oldSession = await call(app, "GET", "/v1/auth/session", undefined, cookie);
    expect(oldSession.statusCode).toBe(401);

    const loginOld = await call(app, "POST", "/v1/auth/login", {
      email: "icaro@exemplo.com",
      password,
    });
    expect(loginOld.statusCode).toBe(401);
    const loginNew = await call(app, "POST", "/v1/auth/login", {
      email: "icaro@exemplo.com",
      password: newPassword,
    });
    expect(loginNew.statusCode).toBe(200);
  });

  it("suporta multi-organização, troca e convites", async () => {
    const ownerCookie = await registerVerified(app, email, {
      displayName: "Juliana",
      email: "juliana@exemplo.com",
    });
    const guestCookie = await registerVerified(app, email, {
      displayName: "Kevin",
      email: "kevin@exemplo.com",
    });

    const org1 = await call(
      app,
      "POST",
      "/v1/organizations",
      { name: "Escritório Um" },
      ownerCookie,
    );
    const org2 = await call(
      app,
      "POST",
      "/v1/organizations",
      { name: "Escritório Dois" },
      ownerCookie,
    );
    const org3 = await call(
      app,
      "POST",
      "/v1/organizations",
      { name: "Escritório Três" },
      ownerCookie,
    );
    const id1 = org1.json<{ organization: { id: string } }>().organization.id;
    const id2 = org2.json<{ organization: { id: string } }>().organization.id;
    const id3 = org3.json<{ organization: { id: string } }>().organization.id;

    await call(
      app,
      "POST",
      `/v1/organizations/${id2}/members`,
      { email: "kevin@exemplo.com" },
      ownerCookie,
    );
    const invite = await call(
      app,
      "POST",
      `/v1/organizations/${id3}/invitations`,
      { email: "kevin@exemplo.com", roleKey: "administrator" },
      ownerCookie,
    );
    expect(invite.statusCode).toBe(201);
    expect(invite.json<{ invitation: { emailDelivery: string } }>().invitation.emailDelivery).toBe(
      "captured",
    );

    const deniedInvite = await call(
      app,
      "POST",
      `/v1/organizations/${id2}/invitations`,
      { email: "alguem@exemplo.com", roleKey: "member" },
      guestCookie,
    );
    expect(deniedInvite.statusCode).toBe(403);

    const inviteMail = email.latest("organization_invitation", "kevin@exemplo.com");
    expect(inviteMail?.token).toBeTruthy();
    const accept = await call(
      app,
      "POST",
      `/v1/invitations/${inviteMail?.token}/accept`,
      undefined,
      guestCookie,
    );
    expect(accept.statusCode).toBe(200);

    const acceptAgain = await call(
      app,
      "POST",
      `/v1/invitations/${inviteMail?.token}/accept`,
      undefined,
      guestCookie,
    );
    expect(acceptAgain.statusCode).toBe(409);

    const wrongEmail = await registerVerified(app, email, {
      displayName: "Outro",
      email: "outro.convite@exemplo.com",
    });
    const invite2 = await call(
      app,
      "POST",
      `/v1/organizations/${id1}/invitations`,
      { email: "destino@exemplo.com", roleKey: "member" },
      ownerCookie,
    );
    const invite2Mail = email.latest("organization_invitation", "destino@exemplo.com");
    const wrongAccept = await call(
      app,
      "POST",
      `/v1/invitations/${invite2Mail?.token}/accept`,
      undefined,
      wrongEmail,
    );
    expect(wrongAccept.statusCode).toBe(403);

    // refresh guest session memberships via login
    const guestLogin = await call(app, "POST", "/v1/auth/login", {
      email: "kevin@exemplo.com",
      password,
    });
    const guestFresh = sessionFrom(guestLogin.headers);
    const session = await call(app, "GET", "/v1/auth/session", undefined, guestFresh);
    const memberships = session.json<{
      account: { memberships: Array<{ organizationId: string; roles: string[] }> };
    }>().account.memberships;
    expect(memberships).toHaveLength(2);
    expect(memberships.find((item) => item.organizationId === id2)?.roles).toEqual(["member"]);
    expect(memberships.find((item) => item.organizationId === id3)?.roles).toEqual([
      "administrator",
    ]);

    const switchOk = await call(
      app,
      "POST",
      `/v1/organizations/${id3}/switch`,
      undefined,
      guestFresh,
    );
    expect(switchOk.statusCode).toBe(200);
    const switchBad = await call(
      app,
      "POST",
      `/v1/organizations/${id1}/switch`,
      undefined,
      guestFresh,
    );
    expect(switchBad.statusCode).toBe(404);

    const ownerSession = await call(app, "GET", "/v1/auth/session", undefined, ownerCookie);
    expect(
      ownerSession.json<{ account: { memberships: unknown[] } }>().account.memberships,
    ).toHaveLength(3);
    void invite2;
  });

  it("lista e revoga sessões do próprio usuário", async () => {
    const cookieA = await registerVerified(app, email, {
      displayName: "Lia",
      email: "lia@exemplo.com",
    });
    const loginB = await call(app, "POST", "/v1/auth/login", {
      email: "lia@exemplo.com",
      password,
    });
    const cookieB = sessionFrom(loginB.headers);

    const listed = await call(app, "GET", "/v1/sessions", undefined, cookieA);
    expect(listed.statusCode).toBe(200);
    const items = listed.json<{ sessions: Array<{ id: string; current: boolean }> }>().sessions;
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(items)).not.toMatch(/token|hash/i);

    const other = items.find((item) => !item.current);
    if (!other) throw new Error("outra sessão ausente");
    const revoked = await call(app, "DELETE", `/v1/sessions/${other.id}`, undefined, cookieA);
    expect(revoked.statusCode).toBe(204);
    const otherSession = await call(app, "GET", "/v1/auth/session", undefined, cookieB);
    expect(otherSession.statusCode).toBe(401);

    const stranger = await registerVerified(app, email, {
      displayName: "Mara",
      email: "mara@exemplo.com",
    });
    const strangerSessions = await call(app, "GET", "/v1/sessions", undefined, stranger);
    const strangerId = strangerSessions.json<{ sessions: Array<{ id: string }> }>().sessions[0]?.id;
    const cross = await call(app, "DELETE", `/v1/sessions/${strangerId}`, undefined, cookieA);
    expect(cross.statusCode).toBe(404);
  });

  it("impede operação com membership suspensa e usuário suspenso", async () => {
    const database = await started;
    const ownerCookie = await registerVerified(app, email, {
      displayName: "Nara",
      email: "nara@exemplo.com",
    });
    await registerVerified(app, email, {
      displayName: "Otto",
      email: "otto@exemplo.com",
    });
    const org = await call(app, "POST", "/v1/organizations", { name: "Org Suspensa" }, ownerCookie);
    const orgId = org.json<{ organization: { id: string } }>().organization.id;
    await call(
      app,
      "POST",
      `/v1/organizations/${orgId}/members`,
      { email: "otto@exemplo.com" },
      ownerCookie,
    );
    const members = await call(
      app,
      "GET",
      `/v1/organizations/${orgId}/members`,
      undefined,
      ownerCookie,
    );
    const membershipId = members
      .json<{ members: Array<{ membershipId: string; email: string }> }>()
      .members.find((item) => item.email === "otto@exemplo.com")?.membershipId;
    if (!membershipId) throw new Error("membership ausente");
    await database.db
      .update(organizationMembers)
      .set({ status: "suspended" })
      .where(eq(organizationMembers.id, membershipId));

    const memberLogin = await call(app, "POST", "/v1/auth/login", {
      email: "otto@exemplo.com",
      password,
    });
    const freshMember = sessionFrom(memberLogin.headers);
    const denied = await call(app, "GET", `/v1/organizations/${orgId}`, undefined, freshMember);
    expect(denied.statusCode).toBe(403);

    const otto = await database.db.query.users.findFirst({
      where: eq(users.email, "otto@exemplo.com"),
    });
    if (!otto) throw new Error("usuário ausente");
    await database.db.update(users).set({ status: "suspended" }).where(eq(users.id, otto.id));
    const suspendedSession = await call(app, "GET", "/v1/auth/session", undefined, freshMember);
    expect(suspendedSession.statusCode).toBe(401);
    void sessions;
  });
});
