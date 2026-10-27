import { AppError } from "@verasjuris/types";

export const JUDICIAL_PROCESS_STATUSES = ["active", "suspended", "closed", "archived"] as const;
export type JudicialProcessStatus = (typeof JUDICIAL_PROCESS_STATUSES)[number];

const PROCESS_TRANSITIONS: Record<JudicialProcessStatus, readonly JudicialProcessStatus[]> = {
  active: ["suspended", "closed", "archived"],
  suspended: ["active", "closed", "archived"],
  closed: ["active", "archived"],
  archived: ["active"],
};

export function assertJudicialProcessTransition(
  from: JudicialProcessStatus,
  to: JudicialProcessStatus,
): void {
  if (from === to) return;
  if (!PROCESS_TRANSITIONS[from].includes(to)) {
    throw new AppError(
      "CONFLICT",
      `A transição de status do processo de “${from}” para “${to}” não é permitida.`,
    );
  }
}

export const JUDICIAL_HEARING_STATUSES = [
  "scheduled",
  "confirmed",
  "rescheduled",
  "held",
  "cancelled",
] as const;
export type JudicialHearingStatus = (typeof JUDICIAL_HEARING_STATUSES)[number];

const HEARING_TRANSITIONS: Record<JudicialHearingStatus, readonly JudicialHearingStatus[]> = {
  scheduled: ["confirmed", "rescheduled", "held", "cancelled"],
  confirmed: ["rescheduled", "held", "cancelled"],
  rescheduled: ["scheduled", "confirmed", "held", "cancelled"],
  held: [],
  cancelled: ["scheduled"],
};

export function assertHearingTransition(
  from: JudicialHearingStatus,
  to: JudicialHearingStatus,
): void {
  if (from === to) return;
  if (!HEARING_TRANSITIONS[from].includes(to)) {
    throw new AppError(
      "CONFLICT",
      `A transição de status da audiência de “${from}” para “${to}” não é permitida.`,
    );
  }
}

export const JUDICIAL_APPEAL_STATUSES = [
  "draft",
  "planned",
  "filed",
  "pending",
  "decided",
  "withdrawn",
  "not_filed",
] as const;
export type JudicialAppealStatus = (typeof JUDICIAL_APPEAL_STATUSES)[number];

const APPEAL_TRANSITIONS: Record<JudicialAppealStatus, readonly JudicialAppealStatus[]> = {
  draft: ["planned", "filed", "not_filed", "withdrawn"],
  planned: ["filed", "not_filed", "withdrawn", "draft"],
  filed: ["pending", "decided", "withdrawn"],
  pending: ["decided", "withdrawn"],
  decided: [],
  withdrawn: [],
  not_filed: ["draft", "planned"],
};

export function assertAppealTransition(from: JudicialAppealStatus, to: JudicialAppealStatus): void {
  if (from === to) return;
  if (!APPEAL_TRANSITIONS[from].includes(to)) {
    throw new AppError(
      "CONFLICT",
      `A transição de status do recurso de “${from}” para “${to}” não é permitida.`,
    );
  }
  if (to === "filed" && from !== "draft" && from !== "planned") {
    throw new AppError(
      "CONFLICT",
      "Protocolo (FILED) só pode ser registrado a partir de rascunho ou planejado, com referência adequada.",
    );
  }
}
