import { describe, expect, it } from "vitest";
import {
  actorCanInviteRole,
  policyAssignRoles,
  policyInviteWithRole,
  policyOwnSession,
  wouldRemoveLastOwner,
} from "./policies.js";

const ownerMembership = {
  status: "active" as const,
  organizationStatus: "active" as const,
  permissions: [
    "organization.read",
    "organization.update",
    "member.read",
    "member.manage",
    "member.invite",
    "role.read",
    "role.assign",
    "audit.read",
  ],
  roles: ["owner"],
};

const adminMembership = {
  status: "active" as const,
  organizationStatus: "active" as const,
  permissions: [
    "organization.read",
    "organization.update",
    "member.read",
    "member.manage",
    "member.invite",
    "role.read",
    "audit.read",
  ],
  roles: ["administrator"],
};

const memberMembership = {
  status: "active" as const,
  organizationStatus: "active" as const,
  permissions: ["organization.read", "member.read"],
  roles: ["member"],
};

describe("policies", () => {
  it("impede convite com papel owner", () => {
    expect(
      actorCanInviteRole({
        actorRoles: ["owner"],
        actorPermissions: ["member.invite"],
        inviteRole: "owner",
      }),
    ).toBe(false);
  });

  it("permite administrador convidar administrador e membro", () => {
    expect(
      actorCanInviteRole({
        actorRoles: ["administrator"],
        actorPermissions: ["member.invite"],
        inviteRole: "administrator",
      }),
    ).toBe(true);
    expect(
      actorCanInviteRole({
        actorRoles: ["administrator"],
        actorPermissions: ["member.invite"],
        inviteRole: "member",
      }),
    ).toBe(true);
  });

  it("nega convite quando membership é apenas member", () => {
    const decision = policyInviteWithRole({
      membership: memberMembership,
      actor: { roles: ["member"], permissions: memberMembership.permissions },
      inviteRole: "member",
    });
    expect(decision).toMatchObject({ ok: false, code: "AUTHORIZATION_ERROR" });
  });

  it("nega atribuição de owner por administrator", () => {
    const decision = policyAssignRoles({
      membership: adminMembership,
      actor: {
        roles: ["administrator"],
        permissions: [...adminMembership.permissions, "role.assign"],
      },
      targetRoles: ["owner"],
    });
    expect(decision).toMatchObject({ ok: false, code: "AUTHORIZATION_ERROR" });
  });

  it("detecta remoção do último owner", () => {
    expect(
      wouldRemoveLastOwner({
        currentRoles: ["owner"],
        nextRoles: ["member"],
        nextStatus: "active",
        otherActiveOwnerCount: 0,
      }),
    ).toBe(true);
    expect(
      wouldRemoveLastOwner({
        currentRoles: ["owner"],
        nextRoles: ["member"],
        nextStatus: "active",
        otherActiveOwnerCount: 1,
      }),
    ).toBe(false);
  });

  it("restringe revogação de sessão a si mesmo", () => {
    expect(policyOwnSession({ sessionUserId: "a", accountUserId: "b" })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(policyOwnSession({ sessionUserId: "a", accountUserId: "a" })).toEqual({ ok: true });
  });

  it("permite owner atribuir owner", () => {
    const decision = policyAssignRoles({
      membership: ownerMembership,
      actor: { roles: ["owner"], permissions: ownerMembership.permissions },
      targetRoles: ["owner"],
    });
    expect(decision).toEqual({ ok: true });
  });
});
