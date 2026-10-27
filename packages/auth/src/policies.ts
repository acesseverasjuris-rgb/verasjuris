import type { PermissionKey } from "@verasjuris/types";
import {
  actorCanGrantRole,
  authorizeAccess,
  type AccessDecision,
  type AccessMembership,
} from "./authorize.js";

export type PolicyActor = {
  roles: readonly string[];
  permissions: readonly string[];
};

const INVITEABLE_ROLES = new Set(["administrator", "member"]);

/**
 * Autorização por permission no tenant. Policies compostas chamam isto primeiro.
 */
export function policyRequirePermission(input: {
  membership: AccessMembership;
  required: PermissionKey;
}): AccessDecision {
  return authorizeAccess(input);
}

/**
 * Quem pode convidar com determinado papel inicial.
 * Owner nunca é convidável por este fluxo.
 * Administrator só pode ser convidado por owner ou administrator.
 */
export function actorCanInviteRole(input: {
  actorRoles: readonly string[];
  actorPermissions: readonly string[];
  inviteRole: string;
}): boolean {
  if (!input.actorPermissions.includes("member.invite")) return false;
  if (!INVITEABLE_ROLES.has(input.inviteRole)) return false;
  if (input.inviteRole === "administrator") {
    return input.actorRoles.includes("owner") || input.actorRoles.includes("administrator");
  }
  return true;
}

/**
 * Alterar membership que já é ou passará a ser owner exige ator owner.
 */
export function actorCanTouchOwnerMembership(input: {
  actorRoles: readonly string[];
  currentRoles: readonly string[];
  nextRoles: readonly string[];
}): boolean {
  const touchesOwner = input.currentRoles.includes("owner") || input.nextRoles.includes("owner");
  if (!touchesOwner) return true;
  return input.actorRoles.includes("owner");
}

/**
 * Invariante: não remover/rebaixar o último owner ativo.
 */
export function wouldRemoveLastOwner(input: {
  currentRoles: readonly string[];
  nextRoles: readonly string[];
  nextStatus: "active" | "suspended" | "removed";
  otherActiveOwnerCount: number;
}): boolean {
  if (!input.currentRoles.includes("owner")) return false;
  const losingOwner = input.nextStatus === "removed" || !input.nextRoles.includes("owner");
  return losingOwner && input.otherActiveOwnerCount === 0;
}

/**
 * Sessão alvo deve pertencer ao usuário autenticado.
 */
export function policyOwnSession(input: {
  sessionUserId: string;
  accountUserId: string;
}): AccessDecision {
  if (input.sessionUserId !== input.accountUserId) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Não encontramos esta sessão no seu acesso.",
    };
  }
  return { ok: true };
}

/**
 * Atribuição de papéis: permission role.assign + regra de owner.
 */
export function policyAssignRoles(input: {
  membership: AccessMembership;
  actor: PolicyActor;
  targetRoles: readonly string[];
}): AccessDecision {
  const permission = authorizeAccess({
    membership: input.membership,
    required: "role.assign",
  });
  if (!permission.ok) return permission;
  for (const role of input.targetRoles) {
    if (
      !actorCanGrantRole({
        actorRoles: input.actor.roles,
        actorPermissions: input.actor.permissions,
        targetRole: role,
      })
    ) {
      return {
        ok: false,
        code: "AUTHORIZATION_ERROR",
        message: "Você não pode atribuir este papel. Nenhuma alteração foi confirmada.",
      };
    }
  }
  return { ok: true };
}

/**
 * Convite com papel pretendido.
 */
export function policyInviteWithRole(input: {
  membership: AccessMembership;
  actor: PolicyActor;
  inviteRole: string;
}): AccessDecision {
  const permission = authorizeAccess({
    membership: input.membership,
    required: "member.invite",
  });
  if (!permission.ok) return permission;
  if (
    !actorCanInviteRole({
      actorRoles: input.actor.roles,
      actorPermissions: input.actor.permissions,
      inviteRole: input.inviteRole,
    })
  ) {
    return {
      ok: false,
      code: "AUTHORIZATION_ERROR",
      message: "Você não pode convidar com este papel. Nenhum convite foi criado.",
    };
  }
  return { ok: true };
}

export { actorCanGrantRole, authorizeAccess };
