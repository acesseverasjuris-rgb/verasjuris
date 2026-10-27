import { AppError } from "@verasjuris/types";

export const DEADLINE_STATUSES = [
  "draft",
  "suggested",
  "pending_confirmation",
  "confirmed",
  "completed",
  "cancelled",
] as const;
export type DeadlineStatus = (typeof DEADLINE_STATUSES)[number];

const DEADLINE_TRANSITIONS: Record<DeadlineStatus, readonly DeadlineStatus[]> = {
  draft: ["suggested", "pending_confirmation", "confirmed", "cancelled"],
  suggested: ["pending_confirmation", "confirmed", "cancelled", "draft"],
  pending_confirmation: ["confirmed", "suggested", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: ["draft", "suggested"],
};

export function assertDeadlineTransition(from: DeadlineStatus, to: DeadlineStatus): void {
  if (from === to) return;
  if (!DEADLINE_TRANSITIONS[from].includes(to)) {
    throw new AppError(
      "CONFLICT",
      `A transição de status do prazo de “${from}” para “${to}” não é permitida.`,
    );
  }
}

/** Alteração de data confirmada exige histórico + motivo (aplicado no serviço). */
export function assertDeadlineMutable(
  status: DeadlineStatus,
  action: "update" | "change_date",
): void {
  if (action === "update" && (status === "confirmed" || status === "completed")) {
    throw new AppError(
      "CONFLICT",
      "Prazo confirmado só pode ter a data alterada com histórico e motivo explícito.",
    );
  }
  if (action === "change_date" && status !== "confirmed") {
    throw new AppError(
      "CONFLICT",
      "Só prazos confirmados usam alteração com histórico. Use atualização normal nos demais estados.",
    );
  }
}
