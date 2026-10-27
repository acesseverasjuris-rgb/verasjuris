import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

export function policyAdministrativeProcess(
  membership: AccessMembership,
  required: Extract<
    PermissionKey,
    | "administrative_process.read"
    | "administrative_process.create"
    | "administrative_process.update"
    | "administrative_process.assign"
    | "administrative_process.manage_requests"
    | "administrative_process.manage_requirements"
    | "administrative_process.manage_deadlines"
    | "administrative_process.manage_decisions"
    | "administrative_process.manage_appeals"
    | "administrative_process.close"
    | "administrative_process.reopen"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyAdministrativeRequest(
  membership: AccessMembership,
  required: Extract<
    PermissionKey,
    "administrative_process.read" | "administrative_process.manage_requests"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyAdministrativeRequirement(
  membership: AccessMembership,
  required: Extract<
    PermissionKey,
    "administrative_process.read" | "administrative_process.manage_requirements"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyAdministrativeDeadline(
  membership: AccessMembership,
  required: Extract<
    PermissionKey,
    "administrative_process.read" | "administrative_process.manage_deadlines"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyAdministrativeDecision(
  membership: AccessMembership,
  required: Extract<
    PermissionKey,
    "administrative_process.read" | "administrative_process.manage_decisions"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyAdministrativeAppeal(
  membership: AccessMembership,
  required: Extract<
    PermissionKey,
    "administrative_process.read" | "administrative_process.manage_appeals"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyAdministrativeCatalog(
  membership: AccessMembership,
  required: Extract<PermissionKey, "administrative_catalog.manage" | "administrative_process.read">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
