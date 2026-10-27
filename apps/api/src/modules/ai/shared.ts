import type { AccessDecision, AccessMembership, SessionAccount } from "@verasjuris/auth";
import { AppError } from "@verasjuris/types";

export function membershipOf(account: SessionAccount, organizationId: string) {
  return account.memberships.find((item) => item.organizationId === organizationId) ?? null;
}

export function accessOf(account: SessionAccount, organizationId: string): AccessMembership {
  const membership = membershipOf(account, organizationId);
  return membership
    ? {
        status: membership.membershipStatus,
        organizationStatus: membership.organizationStatus,
        permissions: membership.permissions,
        roles: membership.roles,
      }
    : null;
}

/**
 * Aplica uma política e devolve o vínculo do ator. Sem vínculo com a organização => NOT_FOUND (404),
 * nunca 403, para não revelar a existência de organizações/recursos de terceiros.
 */
export function authorize(
  account: SessionAccount,
  organizationId: string,
  check: (access: AccessMembership) => AccessDecision,
) {
  const decision = check(accessOf(account, organizationId));
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId) as NonNullable<ReturnType<typeof membershipOf>>;
}

/** Escapa curingas de LIKE/ILIKE para busca literal. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}
