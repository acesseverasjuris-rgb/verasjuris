import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type CitationPermission = Extract<
  PermissionKey,
  "citation.read" | "citation.create" | "citation.verify"
>;

export function policyCitation(
  membership: AccessMembership,
  required: CitationPermission,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyCitationVerification(membership: AccessMembership): AccessDecision {
  return authorizeAccess({ membership, required: "citation.verify" });
}
