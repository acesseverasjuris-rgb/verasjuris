import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type DossierPermission = Extract<PermissionKey, "dossier.read" | "dossier.manage_links">;

export function policyDossier(
  membership: AccessMembership,
  required: DossierPermission,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
