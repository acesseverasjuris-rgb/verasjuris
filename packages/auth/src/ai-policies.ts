import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type AiPermission = Extract<
  PermissionKey,
  | "ai.use"
  | "ai.analysis.run"
  | "ai.analysis.review"
  | "ai.usage.read"
  | "ai.jobs.read"
  | "ai.jobs.manage"
  | "ai.prompts.read"
  | "ai.prompts.manage"
  | "ai.models.manage"
  | "ai.config.manage"
>;

type DocumentIntelligencePermission = Extract<
  PermissionKey,
  "document_intelligence.read" | "document_intelligence.process" | "document_intelligence.review"
>;

type LegalAnalysisPermission = Extract<
  PermissionKey,
  "legal_analysis.read" | "legal_analysis.create" | "legal_analysis.review"
>;

export function policyAIUsage(
  membership: AccessMembership,
  required: Extract<AiPermission, "ai.usage.read" | "ai.use"> = "ai.usage.read",
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyAIAnalysis(
  membership: AccessMembership,
  required: Extract<
    PermissionKey,
    | "ai.analysis.run"
    | "ai.analysis.review"
    | "legal_analysis.read"
    | "legal_analysis.create"
    | "legal_analysis.review"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyAIJob(
  membership: AccessMembership,
  required: Extract<AiPermission, "ai.jobs.read" | "ai.jobs.manage">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyAIPrompt(
  membership: AccessMembership,
  required: Extract<AiPermission, "ai.prompts.read" | "ai.prompts.manage">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyAIConfiguration(
  membership: AccessMembership,
  required: Extract<AiPermission, "ai.config.manage" | "ai.models.manage">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

/** @deprecated Prefer policyAIUsage / policyAIConfiguration. */
export function policyAi(membership: AccessMembership, required: AiPermission): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyDocumentIntelligence(
  membership: AccessMembership,
  required: DocumentIntelligencePermission,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyLegalAnalysis(
  membership: AccessMembership,
  required: LegalAnalysisPermission,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyAiDocumentProcessing(membership: AccessMembership): AccessDecision {
  const ai = authorizeAccess({ membership, required: "ai.use" });
  if (!ai.ok) return ai;
  const intel = authorizeAccess({ membership, required: "document_intelligence.process" });
  if (!intel.ok) return intel;
  return authorizeAccess({ membership, required: "document.read" });
}

export function policyAiLegalAnalysisRequest(membership: AccessMembership): AccessDecision {
  const ai = authorizeAccess({ membership, required: "ai.analysis.run" });
  if (!ai.ok) return ai;
  const create = authorizeAccess({ membership, required: "legal_analysis.create" });
  if (!create.ok) return create;
  return authorizeAccess({ membership, required: "matter.read" });
}

/** Criar revisão jurídica assistida: IA + permissão de create + leitura documental. */
export function policyAiLegalReviewRequest(membership: AccessMembership): AccessDecision {
  const ai = authorizeAccess({ membership, required: "ai.use" });
  if (!ai.ok) return ai;
  const create = authorizeAccess({ membership, required: "legal_review.create" });
  if (!create.ok) return create;
  return authorizeAccess({ membership, required: "document.read" });
}
