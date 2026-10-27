import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type LegalResearchPermission = Extract<
  PermissionKey,
  "legal_research.read" | "legal_research.execute" | "legal_research.save" | "legal_research.manage"
>;

export function policyLegalResearch(
  membership: AccessMembership,
  required: LegalResearchPermission,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyLegalResearchExecute(membership: AccessMembership): AccessDecision {
  return authorizeAccess({ membership, required: "legal_research.execute" });
}

export function policySavedResearch(
  membership: AccessMembership,
  required: Extract<
    LegalResearchPermission,
    "legal_research.read" | "legal_research.save" | "legal_research.manage"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyLegalMatterResearchLink(
  membership: AccessMembership,
  required: Extract<
    LegalResearchPermission,
    "legal_research.read" | "legal_research.save" | "legal_research.manage"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
