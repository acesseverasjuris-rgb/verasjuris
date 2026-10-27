import { MemoryEmailProvider } from "@verasjuris/email";
import { createTestDatabase } from "@verasjuris/database/testing";
import { seedReferenceData } from "@verasjuris/database";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified, testPassword as password } from "./test-helpers.js";

type RoleSetup = {
  ownerCookie: string;
  adminCookie: string;
  memberCookie: string;
  outsiderCookie: string;
  orgId: string;
  otherOrgId: string;
};

describe("Etapa 1.1 — matriz RBAC e policies", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let setup: RoleSetup;

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

    const ownerCookie = await registerVerified(app, email, {
      displayName: "Owner Matrix",
      email: "owner.matrix@exemplo.com",
    });
    await registerVerified(app, email, {
      displayName: "Admin Matrix",
      email: "admin.matrix@exemplo.com",
    });
    await registerVerified(app, email, {
      displayName: "Member Matrix",
      email: "member.matrix@exemplo.com",
    });
    const outsiderCookie = await registerVerified(app, email, {
      displayName: "Outsider Matrix",
      email: "outsider.matrix@exemplo.com",
    });

    const org = await call(app, "POST", "/v1/organizations", { name: "Org Matrix" }, ownerCookie);
    const orgId = org.json<{ organization: { id: string } }>().organization.id;
    const other = await call(
      app,
      "POST",
      "/v1/organizations",
      { name: "Org Matrix Outra" },
      outsiderCookie,
    );
    const otherOrgId = other.json<{ organization: { id: string } }>().organization.id;

    await call(
      app,
      "POST",
      `/v1/organizations/${orgId}/members`,
      { email: "admin.matrix@exemplo.com" },
      ownerCookie,
    );
    await call(
      app,
      "POST",
      `/v1/organizations/${orgId}/members`,
      { email: "member.matrix@exemplo.com" },
      ownerCookie,
    );
    const members = await call(
      app,
      "GET",
      `/v1/organizations/${orgId}/members`,
      undefined,
      ownerCookie,
    );
    const list = members.json<{
      members: Array<{ membershipId: string; email: string }>;
    }>().members;
    const adminMembership = list.find(
      (item) => item.email === "admin.matrix@exemplo.com",
    )?.membershipId;
    if (!adminMembership) throw new Error("admin membership ausente");
    await call(
      app,
      "PATCH",
      `/v1/organizations/${orgId}/members/${adminMembership}`,
      { roleKeys: ["administrator"] },
      ownerCookie,
    );

    // refresh cookies after role change
    const adminLogin = await call(app, "POST", "/v1/auth/login", {
      email: "admin.matrix@exemplo.com",
      password,
    });
    const memberLogin = await call(app, "POST", "/v1/auth/login", {
      email: "member.matrix@exemplo.com",
      password,
    });
    setup = {
      ownerCookie,
      adminCookie: adminLogin.headers["set-cookie"]
        ? (String(adminLogin.headers["set-cookie"]).match(/vj_session=([^;]+)/)?.[1] ?? "")
        : "",
      memberCookie: memberLogin.headers["set-cookie"]
        ? (String(memberLogin.headers["set-cookie"]).match(/vj_session=([^;]+)/)?.[1] ?? "")
        : "",
      outsiderCookie,
      orgId,
      otherOrgId,
    };
    if (!setup.adminCookie || !setup.memberCookie) throw new Error("cookies ausentes");
  });

  afterAll(async () => {
    await app.close();
    await (await started).close();
  });

  it("owner pode atualizar organização e atribuir papéis", async () => {
    const update = await call(
      app,
      "PATCH",
      `/v1/organizations/${setup.orgId}`,
      { name: "Org Matrix Renomeada" },
      setup.ownerCookie,
    );
    expect(update.statusCode).toBe(200);
  });

  it("member lê organização e é negado em update/invite/audit/role", async () => {
    expect(
      (await call(app, "GET", `/v1/organizations/${setup.orgId}`, undefined, setup.memberCookie))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await call(
          app,
          "PATCH",
          `/v1/organizations/${setup.orgId}`,
          { name: "Hack" },
          setup.memberCookie,
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await call(
          app,
          "POST",
          `/v1/organizations/${setup.orgId}/invitations`,
          { email: "x@exemplo.com", roleKey: "member" },
          setup.memberCookie,
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await call(
          app,
          "GET",
          `/v1/organizations/${setup.orgId}/audit`,
          undefined,
          setup.memberCookie,
        )
      ).statusCode,
    ).toBe(403);
  });

  it("administrator convida member e não consegue conceder owner", async () => {
    const invite = await call(
      app,
      "POST",
      `/v1/organizations/${setup.orgId}/invitations`,
      { email: "convidado.matrix@exemplo.com", roleKey: "member" },
      setup.adminCookie,
    );
    expect(invite.statusCode).toBe(201);

    const members = await call(
      app,
      "GET",
      `/v1/organizations/${setup.orgId}/members`,
      undefined,
      setup.ownerCookie,
    );
    const memberId = members
      .json<{ members: Array<{ membershipId: string; email: string }> }>()
      .members.find((item) => item.email === "member.matrix@exemplo.com")?.membershipId;
    const escalate = await call(
      app,
      "PATCH",
      `/v1/organizations/${setup.orgId}/members/${memberId}`,
      { roleKeys: ["owner"] },
      setup.adminCookie,
    );
    expect(escalate.statusCode).toBe(403);
  });

  it("nega cross-tenant e sem membership", async () => {
    expect(
      (await call(app, "GET", `/v1/organizations/${setup.orgId}`, undefined, setup.outsiderCookie))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await call(
          app,
          "POST",
          `/v1/organizations/${setup.otherOrgId}/invitations`,
          { email: "y@exemplo.com", roleKey: "member" },
          setup.ownerCookie,
        )
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await call(
          app,
          "POST",
          `/v1/organizations/${setup.otherOrgId}/switch`,
          undefined,
          setup.ownerCookie,
        )
      ).statusCode,
    ).toBe(404);
  });

  it("reenvio e revogação de convite", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${setup.orgId}/invitations`,
      { email: "resend.matrix@exemplo.com", roleKey: "member" },
      setup.ownerCookie,
    );
    const invitationId = created.json<{ invitation: { id: string } }>().invitation.id;
    const resend = await call(
      app,
      "POST",
      `/v1/organizations/${setup.orgId}/invitations/${invitationId}/resend`,
      undefined,
      setup.ownerCookie,
    );
    expect(resend.statusCode).toBe(200);
    expect(resend.json<{ invitation: { status: string } }>().invitation.status).toBe("pending");

    const revoked = await call(
      app,
      "DELETE",
      `/v1/organizations/${setup.orgId}/invitations/${invitationId}`,
      undefined,
      setup.ownerCookie,
    );
    expect(revoked.statusCode).toBe(204);
  });

  it("atualiza perfil próprio com auditoria", async () => {
    const updated = await call(
      app,
      "PATCH",
      "/v1/account/profile",
      {
        displayName: "Owner Atualizado",
        locale: "pt-BR",
        timeZone: "America/Sao_Paulo",
      },
      setup.ownerCookie,
    );
    expect(updated.statusCode).toBe(200);
    expect(updated.json<{ profile: { displayName: string } }>().profile.displayName).toBe(
      "Owner Atualizado",
    );
    const session = await call(app, "GET", "/v1/auth/session", undefined, setup.ownerCookie);
    expect(
      session.json<{ account: { user: { displayName: string } } }>().account.user.displayName,
    ).toBe("Owner Atualizado");
  });
});
