import { AppError } from "@verasjuris/types";

export const OPPORTUNITY_STAGES = [
  "lead",
  "intake",
  "triage",
  "analysis",
  "proposal",
  "contracting",
  "client",
  "case",
  "lost",
  "archived",
] as const;

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

/** Transições de stage “operacionais” (não terminais). Pré-condições de negócio são validadas no service. */
const STAGE_TRANSITIONS: Record<OpportunityStage, readonly OpportunityStage[]> = {
  lead: ["intake", "lost", "archived"],
  intake: ["triage", "lost", "archived"],
  triage: ["analysis", "lost", "archived"],
  analysis: ["proposal", "lost", "archived"],
  proposal: ["contracting", "lost", "archived"],
  contracting: ["client", "lost", "archived"],
  client: ["case", "lost", "archived"],
  case: ["archived"],
  lost: ["archived", "lead"],
  archived: ["lead"],
};

export function assertOpportunityStageTransition(
  from: OpportunityStage,
  to: OpportunityStage,
): void {
  if (from === to) return;
  if (!STAGE_TRANSITIONS[from].includes(to)) {
    throw new AppError(
      "CONFLICT",
      `A transição de etapa de “${from}” para “${to}” não é permitida.`,
    );
  }
}

export type NextActionHint =
  | "start_intake"
  | "complete_triage"
  | "complete_analysis"
  | "create_proposal"
  | "send_proposal"
  | "accept_proposal"
  | "activate_engagement"
  | "open_case"
  | "none";

export function nextActionForStage(
  stage: OpportunityStage,
  context: {
    hasIntake: boolean;
    hasTriageReady: boolean;
    hasAnalysisCompleted: boolean;
    hasProposal: boolean;
    proposalStatus?: string | null;
    hasEngagementActive: boolean;
    hasClient: boolean;
    hasCase: boolean;
  },
): NextActionHint {
  if (stage === "lost" || stage === "archived" || stage === "case") return "none";
  if (stage === "lead" || !context.hasIntake) return "start_intake";
  if (stage === "intake" || !context.hasTriageReady) return "complete_triage";
  if (stage === "triage" || !context.hasAnalysisCompleted) return "complete_analysis";
  if (stage === "analysis" || !context.hasProposal) return "create_proposal";
  if (context.proposalStatus === "draft" || context.proposalStatus === "internal_review")
    return "create_proposal";
  if (context.proposalStatus === "approved") return "send_proposal";
  if (context.proposalStatus === "sent") return "accept_proposal";
  if (stage === "proposal" || stage === "contracting") {
    if (!context.hasEngagementActive) return "activate_engagement";
  }
  if ((stage === "client" || context.hasClient) && !context.hasCase) return "open_case";
  return "none";
}
