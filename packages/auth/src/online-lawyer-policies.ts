import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type OnlineLawyerPermission = Extract<
  PermissionKey,
  | "online_lawyer.request"
  | "online_lawyer.match.read"
  | "online_lawyer.match.respond"
  | "online_lawyer.consultation.read"
  | "online_lawyer.consultation.manage"
  | "online_lawyer.availability.manage"
  | "online_lawyer.review.moderate"
>;

export function policyOnlineLegalRequest(
  membership: AccessMembership,
  required: Extract<OnlineLawyerPermission, "online_lawyer.request" | "online_lawyer.match.read">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyOnlineMatchCandidate(
  membership: AccessMembership,
  required: Extract<
    OnlineLawyerPermission,
    "online_lawyer.match.read" | "online_lawyer.match.respond"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyOnlineConsultation(
  membership: AccessMembership,
  required: Extract<
    OnlineLawyerPermission,
    "online_lawyer.consultation.read" | "online_lawyer.consultation.manage"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyLawyerAvailability(
  membership: AccessMembership,
  required: Extract<OnlineLawyerPermission, "online_lawyer.availability.manage">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyOnlineReviewModeration(
  membership: AccessMembership,
  required: Extract<
    OnlineLawyerPermission,
    "online_lawyer.review.moderate" | "online_lawyer.consultation.read"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
