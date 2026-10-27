import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type PublicOpportunityPermission = Extract<
  PermissionKey,
  | "public_opportunity.read"
  | "public_opportunity.create"
  | "public_opportunity.update"
  | "public_opportunity.manage"
  | "public_opportunity.save"
  | "public_opportunity.manage_requirements"
  | "public_opportunity.manage_documents"
>;

export function policyPublicOpportunity(
  membership: AccessMembership,
  required: PublicOpportunityPermission,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyPublicOpportunityInterest(
  membership: AccessMembership,
  required: Extract<
    PublicOpportunityPermission,
    "public_opportunity.save" | "public_opportunity.read"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyPublicOpportunityRequirement(
  membership: AccessMembership,
  required: Extract<
    PublicOpportunityPermission,
    "public_opportunity.manage_requirements" | "public_opportunity.read"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

/**
 * Oportunidade global (organizationId nulo) é somente leitura para qualquer organização;
 * apenas cadastros da própria organização podem ser alterados.
 */
export function policyPublicOpportunityMutation(
  membership: AccessMembership,
  required: Extract<
    PublicOpportunityPermission,
    "public_opportunity.update" | "public_opportunity.manage"
  >,
  opportunityOrganizationId: string | null,
  actorOrganizationId: string,
): AccessDecision {
  const base = authorizeAccess({ membership, required });
  if (!base.ok) return base;
  if (opportunityOrganizationId === null || opportunityOrganizationId !== actorOrganizationId) {
    return {
      ok: false,
      code: "AUTHORIZATION_ERROR",
      message: "Oportunidades de referência global não podem ser alteradas pela organização.",
    };
  }
  return base;
}
