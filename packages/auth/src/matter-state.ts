import { AppError } from "@verasjuris/types";

export const MATTER_STATUSES = [
  "draft",
  "open",
  "active",
  "waiting",
  "suspended",
  "closed",
  "archived",
] as const;

export type MatterStatus = (typeof MATTER_STATUSES)[number];

/** Transições operacionais — sem WON/LOST (resultado jurídico ≠ status do matter). */
const MATTER_TRANSITIONS: Record<MatterStatus, readonly MatterStatus[]> = {
  draft: ["open", "archived"],
  open: ["active", "waiting", "suspended", "closed", "archived"],
  active: ["open", "waiting", "suspended", "closed", "archived"],
  waiting: ["open", "active", "suspended", "closed", "archived"],
  suspended: ["open", "active", "waiting", "closed", "archived"],
  closed: ["archived", "open", "active"],
  archived: ["open"],
};

export function assertMatterTransition(from: MatterStatus, to: MatterStatus): void {
  if (from === to) return;
  if (!MATTER_TRANSITIONS[from].includes(to)) {
    throw new AppError(
      "CONFLICT",
      `A transição de status do caso de “${from}” para “${to}” não é permitida.`,
    );
  }
}
