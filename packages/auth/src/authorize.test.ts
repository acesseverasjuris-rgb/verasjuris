import { describe, expect, it } from "vitest";
import { actorCanGrantRole, authorizeAccess } from "./authorize.js";

describe("autorização", () => {
  it("nega recurso quando não há participação", () => {
    const decision = authorizeAccess({ membership: null, required: "organization.read" });
    expect(decision).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("nega permissão mesmo com participação ativa", () => {
    const decision = authorizeAccess({
      membership: {
        status: "active",
        organizationStatus: "active",
        permissions: ["organization.read"],
        roles: ["member"],
      },
      required: "organization.update",
    });
    expect(decision).toMatchObject({ ok: false, code: "AUTHORIZATION_ERROR" });
  });

  it("permite quando a permissão está presente", () => {
    const decision = authorizeAccess({
      membership: {
        status: "active",
        organizationStatus: "active",
        permissions: ["member.manage"],
        roles: ["administrator"],
      },
      required: "member.manage",
    });
    expect(decision).toEqual({ ok: true });
  });

  it("impede que um papel sem proprietário conceda o papel de proprietário", () => {
    expect(
      actorCanGrantRole({
        actorRoles: ["administrator"],
        actorPermissions: ["role.assign"],
        targetRole: "owner",
      }),
    ).toBe(false);
    expect(
      actorCanGrantRole({
        actorRoles: ["owner"],
        actorPermissions: ["role.assign"],
        targetRole: "owner",
      }),
    ).toBe(true);
  });
});
