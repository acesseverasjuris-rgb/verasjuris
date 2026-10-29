import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type EducationPermission = Extract<
  PermissionKey,
  | "education.read"
  | "education.course.create"
  | "education.course.update"
  | "education.course.publish"
  | "education.lesson.manage"
  | "education.track.manage"
  | "education.library.manage"
  | "education.enrollment.manage"
  | "education.certificate.issue"
  | "education.certificate.revoke"
>;

export function policyEducationAccess(
  membership: AccessMembership,
  required: Extract<EducationPermission, "education.read">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyEducationCourseManage(
  membership: AccessMembership,
  required: Extract<
    EducationPermission,
    | "education.read"
    | "education.course.create"
    | "education.course.update"
    | "education.course.publish"
    | "education.track.manage"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyLesson(
  membership: AccessMembership,
  required: Extract<EducationPermission, "education.read" | "education.lesson.manage">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyLibraryItem(
  membership: AccessMembership,
  required: Extract<EducationPermission, "education.read" | "education.library.manage">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyEnrollment(
  membership: AccessMembership,
  required: Extract<EducationPermission, "education.read" | "education.enrollment.manage">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyCertificate(
  membership: AccessMembership,
  required: Extract<
    EducationPermission,
    "education.read" | "education.certificate.issue" | "education.certificate.revoke"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
