import { AppError } from "@verasjuris/types";

export const LEGAL_DRAFT_WORKFLOW_STATUSES = [
  "draft",
  "ai_assisted",
  "human_review",
  "approved",
  "ready_to_file",
  "filed",
  "confirmed",
  "rejected",
  "cancelled",
  "archived",
  "failed",
] as const;

export type LegalDraftWorkflowStatus = (typeof LEGAL_DRAFT_WORKFLOW_STATUSES)[number];

/**
 * Máquina de estados do fluxo de minuta/protocolo.
 * Protocolo é registro manual (“Protocolo informado manualmente”) — sem e-filing.
 */
const LEGAL_DRAFT_TRANSITIONS: Record<
  LegalDraftWorkflowStatus,
  readonly LegalDraftWorkflowStatus[]
> = {
  draft: ["ai_assisted", "human_review", "cancelled", "archived", "failed"],
  ai_assisted: ["human_review", "draft", "cancelled", "archived", "failed"],
  human_review: ["approved", "rejected", "draft", "cancelled", "archived", "failed"],
  approved: ["ready_to_file", "human_review", "cancelled", "archived"],
  ready_to_file: ["filed", "human_review", "cancelled", "archived"],
  filed: ["confirmed", "archived"],
  confirmed: ["archived"],
  rejected: ["draft", "archived", "cancelled"],
  cancelled: ["archived", "draft"],
  archived: [],
  failed: ["draft", "archived", "cancelled"],
};

export function allowedLegalDraftTransitions(
  from: LegalDraftWorkflowStatus,
): readonly LegalDraftWorkflowStatus[] {
  return LEGAL_DRAFT_TRANSITIONS[from];
}

export function assertLegalDraftTransition(
  from: LegalDraftWorkflowStatus,
  to: LegalDraftWorkflowStatus,
): void {
  if (from === to) return;
  if (!LEGAL_DRAFT_TRANSITIONS[from].includes(to)) {
    throw new AppError(
      "CONFLICT",
      `A transição de minuta de “${from}” para “${to}” não é permitida.`,
    );
  }
}

export type LegalDraftTransitionGuards = {
  approvedByMembershipId?: string | null;
  filedAt?: Date | string | null;
  filingMethod?: string | null;
  confirmationEvidenceDocumentId?: string | null;
  hasBlockingChecklistItems?: boolean;
  criticalChecklistIncomplete?: boolean;
  hasUnresolvedMissingVariables?: boolean;
};

/**
 * Valida pré-condições de negócio além do grafo de transições.
 * Invalid: approved sem aprovador; ready com blocking/vars; filed sem filedAt/method; confirmed sem evidência.
 */
export function assertLegalDraftTransitionGuards(
  to: LegalDraftWorkflowStatus,
  guards: LegalDraftTransitionGuards,
): void {
  if (to === "approved" && !guards.approvedByMembershipId) {
    throw new AppError(
      "CONFLICT",
      "Aprovação exige aprovador (approvedBy). Não é possível aprovar sem responsável.",
    );
  }
  if (to === "ready_to_file") {
    if (guards.hasBlockingChecklistItems) {
      throw new AppError(
        "CONFLICT",
        "Não é possível marcar pronto para protocolo com itens de checklist bloqueados.",
      );
    }
    if (guards.criticalChecklistIncomplete) {
      throw new AppError(
        "CONFLICT",
        "Itens críticos do checklist devem estar concluídos antes de ready_to_file.",
      );
    }
    if (guards.hasUnresolvedMissingVariables) {
      throw new AppError(
        "CONFLICT",
        "Há variáveis obrigatórias faltando sem justificativa. Resolva ou justifique antes de ready_to_file.",
      );
    }
  }
  if (to === "filed") {
    if (!guards.filedAt) {
      throw new AppError("CONFLICT", "Protocolo exige filedAt (data/hora do protocolo).");
    }
    if (!guards.filingMethod) {
      throw new AppError("CONFLICT", "Protocolo exige filingMethod.");
    }
  }
  if (to === "confirmed" && !guards.confirmationEvidenceDocumentId) {
    throw new AppError(
      "CONFLICT",
      "Confirmação exige documento de evidência (confirmationEvidenceDocumentId).",
    );
  }
}
