import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type SecurityPermission = Extract<
  PermissionKey,
  | "security.read"
  | "security.manage"
  | "security.mfa.manage"
  | "security.session.manage"
  | "security.alert.manage"
  | "security.admin"
>;

export function policySecurity(
  membership: AccessMembership,
  required: Extract<SecurityPermission, "security.read" | "security.manage" | "security.admin">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyMfa(
  membership: AccessMembership,
  required: Extract<
    SecurityPermission,
    "security.read" | "security.mfa.manage" | "security.manage" | "security.admin"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policySecuritySession(
  membership: AccessMembership,
  required: Extract<
    SecurityPermission,
    "security.read" | "security.session.manage" | "security.manage" | "security.admin"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policySecurityAlert(
  membership: AccessMembership,
  required: Extract<
    SecurityPermission,
    "security.read" | "security.alert.manage" | "security.manage" | "security.admin"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policySecurityAdmin(
  membership: AccessMembership,
  required: Extract<SecurityPermission, "security.admin">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
