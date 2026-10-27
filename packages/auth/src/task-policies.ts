import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type TaskPermission = Extract<
  PermissionKey,
  | "task.read"
  | "task.create"
  | "task.update"
  | "task.assign"
  | "task.comment"
  | "task.manage_checklist"
  | "task.manage_dependencies"
  | "task.complete"
  | "task.archive"
  | "sla.manage"
>;

export function policyTask(membership: AccessMembership, required: TaskPermission): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policySla(
  membership: AccessMembership,
  required: Extract<PermissionKey, "sla.manage" | "task.read">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
