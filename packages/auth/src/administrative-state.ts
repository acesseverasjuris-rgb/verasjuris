import { AppError } from "@verasjuris/types";

export const ADMINISTRATIVE_PROCESS_STATUSES = [
  "draft",
  "active",
  "waiting_body",
  "waiting_client",
  "requirement_open",
  "under_analysis",
  "decided",
  "appeal",
  "suspended",
  "closed",
  "archived",
] as const;
export type AdministrativeProcessStatus = (typeof ADMINISTRATIVE_PROCESS_STATUSES)[number];

const PROCESS_TRANSITIONS: Record<
  AdministrativeProcessStatus,
  readonly AdministrativeProcessStatus[]
> = {
  draft: ["active", "closed", "archived"],
  active: [
    "waiting_body",
    "waiting_client",
    "requirement_open",
    "under_analysis",
    "decided",
    "appeal",
    "suspended",
    "closed",
    "archived",
  ],
  waiting_body: [
    "active",
    "waiting_client",
    "requirement_open",
    "under_analysis",
    "decided",
    "suspended",
    "closed",
  ],
  waiting_client: [
    "active",
    "waiting_body",
    "requirement_open",
    "under_analysis",
    "suspended",
    "closed",
  ],
  requirement_open: [
    "active",
    "waiting_body",
    "waiting_client",
    "under_analysis",
    "suspended",
    "closed",
  ],
  under_analysis: ["active", "waiting_body", "decided", "appeal", "suspended", "closed"],
  decided: ["appeal", "closed", "archived", "active"],
  appeal: ["under_analysis", "decided", "suspended", "closed"],
  suspended: ["active", "waiting_body", "waiting_client", "requirement_open", "closed", "archived"],
  closed: ["active", "archived"],
  archived: ["active"],
};

export function assertAdministrativeProcessTransition(
  from: AdministrativeProcessStatus,
  to: AdministrativeProcessStatus,
): void {
  if (from === to) return;
  if (!PROCESS_TRANSITIONS[from].includes(to)) {
    throw new AppError(
      "CONFLICT",
      `A transição de status do processo administrativo de “${from}” para “${to}” não é permitida.`,
    );
  }
}

export const ADMINISTRATIVE_REQUEST_STATUSES = [
  "draft",
  "review",
  "approved",
  "ready_to_submit",
  "submitted",
  "confirmed",
  "rejected",
  "cancelled",
] as const;
export type AdministrativeRequestStatus = (typeof ADMINISTRATIVE_REQUEST_STATUSES)[number];

const REQUEST_TRANSITIONS: Record<
  AdministrativeRequestStatus,
  readonly AdministrativeRequestStatus[]
> = {
  draft: ["review", "approved", "ready_to_submit", "submitted", "cancelled"],
  review: ["draft", "approved", "rejected", "cancelled"],
  approved: ["ready_to_submit", "submitted", "cancelled"],
  ready_to_submit: ["submitted", "cancelled", "approved"],
  submitted: ["confirmed", "cancelled"],
  confirmed: [],
  rejected: ["draft", "review"],
  cancelled: ["draft"],
};

export function assertAdministrativeRequestTransition(
  from: AdministrativeRequestStatus,
  to: AdministrativeRequestStatus,
): void {
  if (from === to) return;
  if (!REQUEST_TRANSITIONS[from].includes(to)) {
    throw new AppError(
      "CONFLICT",
      `A transição de status do requerimento de “${from}” para “${to}” não é permitida.`,
    );
  }
}

export const ADMINISTRATIVE_REQUIREMENT_STATUSES = [
  "open",
  "in_progress",
  "responded",
  "accepted",
  "not_applicable",
  "cancelled",
  "overdue",
] as const;
export type AdministrativeRequirementStatus = (typeof ADMINISTRATIVE_REQUIREMENT_STATUSES)[number];

const REQUIREMENT_TRANSITIONS: Record<
  AdministrativeRequirementStatus,
  readonly AdministrativeRequirementStatus[]
> = {
  open: ["in_progress", "responded", "not_applicable", "cancelled", "overdue"],
  in_progress: ["responded", "open", "cancelled", "overdue"],
  responded: ["accepted", "in_progress", "cancelled"],
  accepted: [],
  not_applicable: [],
  cancelled: ["open"],
  overdue: ["in_progress", "responded", "cancelled"],
};

export function assertAdministrativeRequirementTransition(
  from: AdministrativeRequirementStatus,
  to: AdministrativeRequirementStatus,
): void {
  if (from === to) return;
  if (!REQUIREMENT_TRANSITIONS[from].includes(to)) {
    throw new AppError(
      "CONFLICT",
      `A transição de status da exigência de “${from}” para “${to}” não é permitida.`,
    );
  }
}

export const ADMINISTRATIVE_DEADLINE_STATUSES = [
  "suggested",
  "pending_confirmation",
  "confirmed",
  "completed",
  "cancelled",
] as const;
export type AdministrativeDeadlineStatus = (typeof ADMINISTRATIVE_DEADLINE_STATUSES)[number];

const DEADLINE_TRANSITIONS: Record<
  AdministrativeDeadlineStatus,
  readonly AdministrativeDeadlineStatus[]
> = {
  suggested: ["pending_confirmation", "confirmed", "cancelled"],
  pending_confirmation: ["confirmed", "suggested", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: ["suggested"],
};

export function assertAdministrativeDeadlineTransition(
  from: AdministrativeDeadlineStatus,
  to: AdministrativeDeadlineStatus,
): void {
  if (from === to) return;
  if (!DEADLINE_TRANSITIONS[from].includes(to)) {
    throw new AppError(
      "CONFLICT",
      `A transição de status do prazo de “${from}” para “${to}” não é permitida.`,
    );
  }
}

export const ADMINISTRATIVE_APPEAL_STATUSES = [
  "draft",
  "review",
  "approved",
  "ready_to_file",
  "filed",
  "confirmed",
  "decided",
  "withdrawn",
  "cancelled",
] as const;
export type AdministrativeAppealStatus = (typeof ADMINISTRATIVE_APPEAL_STATUSES)[number];

const APPEAL_TRANSITIONS: Record<
  AdministrativeAppealStatus,
  readonly AdministrativeAppealStatus[]
> = {
  draft: ["review", "approved", "ready_to_file", "filed", "cancelled", "withdrawn"],
  review: ["draft", "approved", "cancelled", "withdrawn"],
  approved: ["ready_to_file", "filed", "cancelled"],
  ready_to_file: ["filed", "cancelled", "approved"],
  filed: ["confirmed", "decided", "withdrawn"],
  confirmed: ["decided", "withdrawn"],
  decided: [],
  withdrawn: [],
  cancelled: ["draft"],
};

export function assertAdministrativeAppealTransition(
  from: AdministrativeAppealStatus,
  to: AdministrativeAppealStatus,
): void {
  if (from === to) return;
  if (!APPEAL_TRANSITIONS[from].includes(to)) {
    throw new AppError(
      "CONFLICT",
      `A transição de status do recurso administrativo de “${from}” para “${to}” não é permitida.`,
    );
  }
}
