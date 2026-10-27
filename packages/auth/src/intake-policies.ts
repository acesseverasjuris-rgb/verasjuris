import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

export function policyIntake(
  membership: AccessMembership,
  required: Extract<
    PermissionKey,
    | "intake.read"
    | "intake.create"
    | "intake.update"
    | "intake.assign"
    | "intake.close"
    | "intake.convert"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyTriage(
  membership: AccessMembership,
  required: Extract<
    PermissionKey,
    "triage.read" | "triage.create" | "triage.update" | "triage.review"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyLegalArea(
  membership: AccessMembership,
  required: Extract<PermissionKey, "legal_area.manage" | "intake.read">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyInitialDocument(
  membership: AccessMembership,
  required: Extract<PermissionKey, "document_initial.read" | "document_initial.upload">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
