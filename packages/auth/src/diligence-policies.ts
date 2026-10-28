import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type DiligencePermission = Extract<
  PermissionKey,
  | "diligence.read"
  | "diligence.create"
  | "diligence.propose"
  | "diligence.assign"
  | "diligence.execute"
  | "diligence.review_evidence"
  | "diligence.complete"
>;

export function policyDiligence(
  membership: AccessMembership,
  required: DiligencePermission,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyDiligenceAssignment(
  membership: AccessMembership,
  required: Extract<
    DiligencePermission,
    "diligence.assign" | "diligence.execute" | "diligence.complete"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
