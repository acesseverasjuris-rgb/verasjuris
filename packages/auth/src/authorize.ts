import { PERMISSION_ALIASES, type PermissionKey } from "@verasjuris/types";

export type AccessMembership = {
  status: "active" | "suspended" | "removed";
  organizationStatus: "active" | "suspended";
  permissions: readonly string[];
  roles: readonly string[];
} | null;

export type AccessDecision =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "AUTHORIZATION_ERROR"; message: string };

function membershipHasPermission(permissions: readonly string[], required: PermissionKey): boolean {
  if (permissions.includes(required)) return true;
  for (const [alias, grants] of Object.entries(PERMISSION_ALIASES)) {
    if (grants?.includes(required) && permissions.includes(alias)) return true;
  }
  return false;
}

export function authorizeAccess(input: {
  membership: AccessMembership;
  required: PermissionKey;
}): AccessDecision {
  if (!input.membership || input.membership.status === "removed") {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Não encontramos este recurso no seu acesso.",
    };
  }
  if (input.membership.organizationStatus !== "active" || input.membership.status !== "active") {
    return {
      ok: false,
      code: "AUTHORIZATION_ERROR",
      message: "Seu acesso a esta organização não está ativo. Nenhum dado foi alterado.",
    };
  }
  if (!membershipHasPermission(input.membership.permissions, input.required)) {
    return {
      ok: false,
      code: "AUTHORIZATION_ERROR",
      message: "Você não tem permissão para esta ação. Nenhum dado foi alterado.",
    };
  }
  return { ok: true };
}

export function actorCanGrantRole(input: {
  actorRoles: readonly string[];
  actorPermissions: readonly string[];
  targetRole: string;
}): boolean {
  if (!input.actorPermissions.includes("role.assign")) return false;
  if (input.targetRole === "owner") return input.actorRoles.includes("owner");
  return true;
}
