import { AppError } from "@verasjuris/types";

export const INTAKE_STATUSES = [
  "open",
  "triage",
  "waiting_client",
  "under_review",
  "qualified",
  "not_qualified",
  "converted",
  "closed",
  "archived",
] as const;

export type IntakeStatus = (typeof INTAKE_STATUSES)[number];

export const TRIAGE_STATUSES = [
  "draft",
  "in_progress",
  "waiting_information",
  "ready_for_analysis",
  "reviewed",
  "closed",
] as const;

export type TriageStatus = (typeof TRIAGE_STATUSES)[number];

const INTAKE_TRANSITIONS: Record<IntakeStatus, readonly IntakeStatus[]> = {
  open: ["triage", "waiting_client", "under_review", "not_qualified", "closed", "archived"],
  triage: ["waiting_client", "under_review", "qualified", "not_qualified", "closed"],
  waiting_client: ["triage", "under_review", "qualified", "not_qualified", "closed"],
  under_review: ["triage", "waiting_client", "qualified", "not_qualified", "converted", "closed"],
  qualified: ["converted", "under_review", "closed", "archived"],
  not_qualified: ["closed", "archived", "open"],
  converted: ["closed", "archived"],
  closed: ["archived", "open"],
  archived: [],
};

const TRIAGE_TRANSITIONS: Record<TriageStatus, readonly TriageStatus[]> = {
  draft: ["in_progress", "waiting_information", "ready_for_analysis", "closed"],
  in_progress: ["waiting_information", "ready_for_analysis", "reviewed", "closed"],
  waiting_information: ["in_progress", "ready_for_analysis", "closed"],
  ready_for_analysis: ["reviewed", "in_progress", "waiting_information", "closed"],
  reviewed: ["closed", "in_progress"],
  closed: [],
};

export function assertIntakeTransition(from: IntakeStatus, to: IntakeStatus): void {
  if (from === to) return;
  if (!INTAKE_TRANSITIONS[from].includes(to)) {
    throw new AppError(
      "CONFLICT",
      `A transição de atendimento de “${from}” para “${to}” não é permitida.`,
    );
  }
}

export function assertTriageTransition(from: TriageStatus, to: TriageStatus): void {
  if (from === to) return;
  if (!TRIAGE_TRANSITIONS[from].includes(to)) {
    throw new AppError(
      "CONFLICT",
      `A transição de triagem de “${from}” para “${to}” não é permitida.`,
    );
  }
}
