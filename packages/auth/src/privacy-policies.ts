import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type PrivacyPermission = Extract<
  PermissionKey,
  | "privacy.read"
  | "privacy.manage"
  | "privacy.consent.manage"
  | "privacy.dsr.manage"
  | "privacy.incident.manage"
  | "privacy.admin"
>;

export function policyPrivacy(
  membership: AccessMembership,
  required: Extract<PrivacyPermission, "privacy.read" | "privacy.manage" | "privacy.admin">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyPrivacyConsent(
  membership: AccessMembership,
  required: Extract<
    PrivacyPermission,
    "privacy.read" | "privacy.consent.manage" | "privacy.manage" | "privacy.admin"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyPrivacyDsr(
  membership: AccessMembership,
  required: Extract<
    PrivacyPermission,
    "privacy.read" | "privacy.dsr.manage" | "privacy.manage" | "privacy.admin"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyPrivacyIncident(
  membership: AccessMembership,
  required: Extract<
    PrivacyPermission,
    "privacy.read" | "privacy.incident.manage" | "privacy.manage" | "privacy.admin"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyPrivacyAdmin(
  membership: AccessMembership,
  required: Extract<PrivacyPermission, "privacy.admin">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
