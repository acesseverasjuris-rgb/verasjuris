import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type EnterprisePermission = Extract<
  PermissionKey,
  | "enterprise.read"
  | "enterprise.manage"
  | "enterprise.sso.manage"
  | "enterprise.scim.manage"
  | "enterprise.sla.manage"
>;

export function policyEnterprise(
  membership: AccessMembership,
  required: Extract<EnterprisePermission, "enterprise.read" | "enterprise.manage">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyEnterpriseSso(
  membership: AccessMembership,
  required: Extract<
    EnterprisePermission,
    "enterprise.read" | "enterprise.sso.manage" | "enterprise.manage"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyEnterpriseScim(
  membership: AccessMembership,
  required: Extract<
    EnterprisePermission,
    "enterprise.read" | "enterprise.scim.manage" | "enterprise.manage"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyEnterpriseSla(
  membership: AccessMembership,
  required: Extract<
    EnterprisePermission,
    "enterprise.read" | "enterprise.sla.manage" | "enterprise.manage"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
