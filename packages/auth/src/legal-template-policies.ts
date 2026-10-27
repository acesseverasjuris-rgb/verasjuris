import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type LegalTemplatePermission = Extract<
  PermissionKey,
  | "legal_template.read"
  | "legal_template.create"
  | "legal_template.update"
  | "legal_template.approve"
  | "legal_template.activate"
  | "legal_template.archive"
>;

export function policyLegalTemplate(
  membership: AccessMembership,
  required: LegalTemplatePermission,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

/**
 * Templates SYSTEM (institucionais) são somente leitura para organizações;
 * mutação exige template da própria organização (scope=organization).
 */
export function policyLegalTemplateMutation(
  membership: AccessMembership,
  required: Extract<
    LegalTemplatePermission,
    | "legal_template.create"
    | "legal_template.update"
    | "legal_template.approve"
    | "legal_template.activate"
    | "legal_template.archive"
  >,
  templateOrganizationId: string | null,
  actorOrganizationId: string,
): AccessDecision {
  const base = authorizeAccess({ membership, required });
  if (!base.ok) return base;
  if (templateOrganizationId === null || templateOrganizationId !== actorOrganizationId) {
    return {
      ok: false,
      code: "AUTHORIZATION_ERROR",
      message: "Templates institucionais do sistema não podem ser alterados pela organização.",
    };
  }
  return base;
}
