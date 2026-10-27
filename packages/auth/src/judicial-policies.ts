import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

export function policyJudicialProcess(
  membership: AccessMembership,
  required: Extract<
    PermissionKey,
    | "judicial_process.read"
    | "judicial_process.create"
    | "judicial_process.update"
    | "judicial_process.manage_parties"
    | "judicial_process.manage_lawyers"
    | "judicial_process.manage_phase"
    | "judicial_process.manage_movements"
    | "judicial_process.manage_hearings"
    | "judicial_process.manage_decisions"
    | "judicial_process.manage_appeals"
    | "judicial_process.manage_enforcement"
    | "judicial_process.close"
    | "judicial_process.reopen"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyJudicialParty(
  membership: AccessMembership,
  required: Extract<PermissionKey, "judicial_process.read" | "judicial_process.manage_parties">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyJudicialLawyer(
  membership: AccessMembership,
  required: Extract<PermissionKey, "judicial_process.read" | "judicial_process.manage_lawyers">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyJudicialMovement(
  membership: AccessMembership,
  required: Extract<PermissionKey, "judicial_process.read" | "judicial_process.manage_movements">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyJudicialHearing(
  membership: AccessMembership,
  required: Extract<PermissionKey, "judicial_process.read" | "judicial_process.manage_hearings">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyJudicialDecision(
  membership: AccessMembership,
  required: Extract<PermissionKey, "judicial_process.read" | "judicial_process.manage_decisions">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyJudicialAppeal(
  membership: AccessMembership,
  required: Extract<PermissionKey, "judicial_process.read" | "judicial_process.manage_appeals">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyJudicialEnforcement(
  membership: AccessMembership,
  required: Extract<PermissionKey, "judicial_process.read" | "judicial_process.manage_enforcement">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
