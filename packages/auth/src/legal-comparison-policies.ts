import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type LegalComparisonPermission = Extract<
  PermissionKey,
  | "legal_comparison.read"
  | "legal_comparison.create"
  | "legal_comparison.run"
  | "legal_comparison.review"
>;

export function policyLegalComparison(
  membership: AccessMembership,
  required: LegalComparisonPermission,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
