import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type DeadlinePermission = Extract<
  PermissionKey,
  | "deadline.read"
  | "deadline.create"
  | "deadline.update"
  | "deadline.calculate"
  | "deadline.confirm"
  | "deadline.assign"
  | "deadline.complete"
  | "deadline.cancel"
  | "deadline.manage_alerts"
  | "deadline.manage_escalation"
>;

export function policyDeadline(
  membership: AccessMembership,
  required: DeadlinePermission,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
