import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type LaborPermission = Extract<
  PermissionKey,
  | "labor.read"
  | "labor.create"
  | "labor.update"
  | "labor.manage_contract"
  | "labor.manage_schedule"
  | "labor.manage_remuneration"
  | "labor.manage_fgts"
  | "labor.manage_termination"
  | "labor.manage_claims"
  | "labor.calculate"
  | "labor.review_calculation"
  | "labor.liquidate"
>;

export function policyLaborCase(
  membership: AccessMembership,
  required: Extract<LaborPermission, "labor.read" | "labor.create" | "labor.update">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyEmploymentContract(
  membership: AccessMembership,
  required: Extract<LaborPermission, "labor.read" | "labor.manage_contract">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyWorkSchedule(
  membership: AccessMembership,
  required: Extract<LaborPermission, "labor.read" | "labor.manage_schedule">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyLaborRemuneration(
  membership: AccessMembership,
  required: Extract<LaborPermission, "labor.read" | "labor.manage_remuneration">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyLaborFgts(
  membership: AccessMembership,
  required: Extract<LaborPermission, "labor.read" | "labor.manage_fgts">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyLaborTermination(
  membership: AccessMembership,
  required: Extract<LaborPermission, "labor.read" | "labor.manage_termination">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyLaborClaims(
  membership: AccessMembership,
  required: Extract<LaborPermission, "labor.read" | "labor.manage_claims">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyLaborCalculation(
  membership: AccessMembership,
  required: Extract<LaborPermission, "labor.read" | "labor.calculate" | "labor.review_calculation">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyLaborLiquidation(
  membership: AccessMembership,
  required: Extract<LaborPermission, "labor.read" | "labor.liquidate">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
