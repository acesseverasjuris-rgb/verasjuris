import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type LegalAreaModulePermission = Extract<
  PermissionKey,
  "legal_area_module.read" | "legal_area_module.manage"
>;

export function policyLegalAreaModule(
  membership: AccessMembership,
  required: LegalAreaModulePermission,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
