import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

export function policyCrm(membership: AccessMembership, required: PermissionKey): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyProfiles(
  membership: AccessMembership,
  required: Extract<PermissionKey, "profiles.read" | "profiles.update_self" | "profiles.manage">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

/** Nunca permitir forçar VERIFIED sem provedor real. */
export function policyProfessionalVerificationStatus(next: string): AccessDecision {
  if (next === "verified") {
    return {
      ok: false,
      code: "AUTHORIZATION_ERROR",
      message:
        "A verificação profissional externa ainda não está configurada. O status verificado não pode ser definido.",
    };
  }
  if (!["not_submitted", "pending", "rejected"].includes(next)) {
    return {
      ok: false,
      code: "AUTHORIZATION_ERROR",
      message: "O status de verificação informado não é permitido.",
    };
  }
  return { ok: true };
}
