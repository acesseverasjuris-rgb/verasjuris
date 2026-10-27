import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type LegalReviewPermission = Extract<
  PermissionKey,
  "legal_review.read" | "legal_review.create" | "legal_review.review" | "legal_review.manage"
>;

export function policyLegalReview(
  membership: AccessMembership,
  required: LegalReviewPermission,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyLegalReviewItem(
  membership: AccessMembership,
  required: Extract<LegalReviewPermission, "legal_review.review" | "legal_review.read">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyLegalReviewSet(
  membership: AccessMembership,
  required: Extract<
    LegalReviewPermission,
    "legal_review.read" | "legal_review.create" | "legal_review.manage"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
