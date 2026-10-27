import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type CalendarPermission = Extract<
  PermissionKey,
  | "calendar.read"
  | "calendar.create"
  | "calendar.update"
  | "calendar.delete"
  | "calendar.manage_team"
>;

export function policyCalendar(
  membership: AccessMembership,
  required: CalendarPermission,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
