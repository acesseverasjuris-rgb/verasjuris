import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type ProfessionalVerificationPermission = Extract<
  PermissionKey,
  | "professional_verification.read_own"
  | "professional_verification.submit"
  | "professional_verification.review"
  | "professional_verification.approve"
  | "professional_verification.suspend"
  | "professional_verification.revalidate"
>;

export function policyProfessionalVerification(
  membership: AccessMembership,
  required: ProfessionalVerificationPermission,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

/** Impede autoaprovação: revisor não pode ser o titular do caso. */
export function policyProfessionalVerificationReviewDecision(input: {
  reviewerUserId: string;
  caseSubjectUserId: string;
  decision: "approved" | "rejected" | string;
}): AccessDecision {
  if (
    (input.decision === "approved" || input.decision === "rejected") &&
    input.reviewerUserId === input.caseSubjectUserId
  ) {
    return {
      ok: false,
      code: "AUTHORIZATION_ERROR",
      message: "Você não pode revisar ou aprovar sua própria verificação profissional.",
    };
  }
  return { ok: true };
}

/** Nunca marcar verified sem sucesso explícito do provedor (checado no serviço). */
export function policyProfessionalVerificationProviderVerified(input: {
  providerStatus: string;
  providerVerified: boolean;
}): AccessDecision {
  if (input.providerVerified && input.providerStatus !== "configured") {
    return {
      ok: false,
      code: "AUTHORIZATION_ERROR",
      message: "O status verificado exige provedor configurado e resposta de sucesso.",
    };
  }
  return { ok: true };
}
