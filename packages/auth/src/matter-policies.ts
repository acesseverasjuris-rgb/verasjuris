import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

export function policyLegalMatter(
  membership: AccessMembership,
  required: Extract<
    PermissionKey,
    | "matter.read"
    | "matter.create"
    | "matter.update"
    | "matter.assign"
    | "matter.manage_team"
    | "matter.manage_parties"
    | "matter.manage_fees"
    | "matter.manage_tags"
    | "matter.close"
    | "matter.archive"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyMatterParty(
  membership: AccessMembership,
  required: Extract<PermissionKey, "matter.read" | "matter.manage_parties">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyMatterTeam(
  membership: AccessMembership,
  required: Extract<PermissionKey, "matter.read" | "matter.manage_team" | "matter.assign">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyMatterFee(
  membership: AccessMembership,
  required: Extract<PermissionKey, "matter.read" | "matter.manage_fees">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyLegalCatalog(
  membership: AccessMembership,
  required: Extract<PermissionKey, "legal_catalog.manage" | "legal_area.manage" | "matter.read">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
