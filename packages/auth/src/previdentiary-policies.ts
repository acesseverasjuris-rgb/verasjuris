import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type PrevidentiaryPermission = Extract<
  PermissionKey,
  | "previdentiary.read"
  | "previdentiary.create"
  | "previdentiary.update"
  | "previdentiary.manage_benefits"
  | "previdentiary.manage_requests"
  | "previdentiary.manage_cnis"
  | "previdentiary.calculate"
  | "previdentiary.review_calculation"
  | "previdentiary.manage_medical_exam"
>;

export function policyPrevidentiaryCase(
  membership: AccessMembership,
  required: Extract<
    PrevidentiaryPermission,
    "previdentiary.read" | "previdentiary.create" | "previdentiary.update"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyBenefit(
  membership: AccessMembership,
  required: Extract<
    PrevidentiaryPermission,
    "previdentiary.read" | "previdentiary.manage_benefits"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyPrevidentiaryRequest(
  membership: AccessMembership,
  required: Extract<
    PrevidentiaryPermission,
    "previdentiary.read" | "previdentiary.manage_requests"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyPrevidentiaryCalculation(
  membership: AccessMembership,
  required: Extract<
    PrevidentiaryPermission,
    "previdentiary.read" | "previdentiary.calculate" | "previdentiary.review_calculation"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyCNIS(
  membership: AccessMembership,
  required: Extract<PrevidentiaryPermission, "previdentiary.read" | "previdentiary.manage_cnis">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyPrevidentiaryMedicalExam(
  membership: AccessMembership,
  required: Extract<
    PrevidentiaryPermission,
    "previdentiary.read" | "previdentiary.manage_medical_exam"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
