import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type TaxPermission = Extract<
  PermissionKey,
  | "tax.read"
  | "tax.create"
  | "tax.update"
  | "tax.manage_obligations"
  | "tax.manage_credits"
  | "tax.manage_refunds"
  | "tax.manage_compensations"
  | "tax.manage_assessments"
  | "tax.manage_enforcement"
  | "tax.manage_theses"
  | "tax.calculate"
  | "tax.review_calculation"
>;

export function policyTaxCase(
  membership: AccessMembership,
  required: Extract<TaxPermission, "tax.read" | "tax.create" | "tax.update">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyTaxObligation(
  membership: AccessMembership,
  required: Extract<TaxPermission, "tax.read" | "tax.manage_obligations">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyTaxCredit(
  membership: AccessMembership,
  required: Extract<TaxPermission, "tax.read" | "tax.manage_credits">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyTaxRefund(
  membership: AccessMembership,
  required: Extract<TaxPermission, "tax.read" | "tax.manage_refunds">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyTaxCompensation(
  membership: AccessMembership,
  required: Extract<TaxPermission, "tax.read" | "tax.manage_compensations">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyTaxAssessment(
  membership: AccessMembership,
  required: Extract<TaxPermission, "tax.read" | "tax.manage_assessments">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyTaxEnforcement(
  membership: AccessMembership,
  required: Extract<TaxPermission, "tax.read" | "tax.manage_enforcement">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyTaxThesis(
  membership: AccessMembership,
  required: Extract<TaxPermission, "tax.read" | "tax.manage_theses">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyTaxCalculation(
  membership: AccessMembership,
  required: Extract<TaxPermission, "tax.read" | "tax.calculate" | "tax.review_calculation">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
