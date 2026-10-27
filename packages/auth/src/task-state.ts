import { AppError } from "@verasjuris/types";

export const TASK_STATUSES = [
  "todo",
  "in_progress",
  "waiting",
  "blocked",
  "done",
  "cancelled",
  "archived",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

const TASK_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  todo: ["in_progress", "waiting", "blocked", "cancelled", "archived"],
  in_progress: ["waiting", "blocked", "done", "cancelled", "todo"],
  waiting: ["in_progress", "blocked", "todo", "cancelled"],
  blocked: ["todo", "in_progress", "waiting", "cancelled"],
  done: ["archived", "todo", "in_progress"],
  cancelled: ["todo", "archived"],
  archived: ["todo"],
};

export function assertTaskTransition(from: TaskStatus, to: TaskStatus): void {
  if (from === to) return;
  if (!TASK_TRANSITIONS[from].includes(to)) {
    throw new AppError(
      "CONFLICT",
      `A transição de status da tarefa de “${from}” para “${to}” não é permitida.`,
    );
  }
}

export const TASK_SLA_STATUSES = [
  "running",
  "paused",
  "warning",
  "breached",
  "completed",
  "cancelled",
] as const;
export type TaskSlaStatus = (typeof TASK_SLA_STATUSES)[number];

/** SLA operacional pausa em WAITING; não é prazo jurídico. */
export function slaStatusForTaskStatus(
  taskStatus: TaskStatus,
  current: TaskSlaStatus | null,
): TaskSlaStatus | null {
  if (!current || current === "completed" || current === "cancelled" || current === "breached") {
    return current;
  }
  if (taskStatus === "waiting" || taskStatus === "blocked") return "paused";
  if (taskStatus === "done") return "completed";
  if (taskStatus === "cancelled" || taskStatus === "archived") return "cancelled";
  if (current === "paused") return "running";
  return current;
}
