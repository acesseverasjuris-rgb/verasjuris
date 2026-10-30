import type { AppDatabase } from "@verasjuris/database";
import type { JobHandler, JobRecord, LocalInProcessQueueProvider } from "@verasjuris/events";

export const JOB_GOAL_PROGRESS_REFRESH = "GOAL_PROGRESS_REFRESH" as const;
export const JOB_KPI_REFRESH = "KPI_REFRESH" as const;
export const JOB_EMPLOYEE_REVIEW_REMINDER = "EMPLOYEE_REVIEW_REMINDER" as const;
export const JOB_LEAVE_REMINDER = "LEAVE_REMINDER" as const;
export const JOB_BUDGET_VARIANCE_REFRESH = "BUDGET_VARIANCE_REFRESH" as const;
export const JOB_COMPLIANCE_OBLIGATION_REMINDER = "COMPLIANCE_OBLIGATION_REMINDER" as const;
export const JOB_VENDOR_SLA_CHECK = "VENDOR_SLA_CHECK" as const;
export const JOB_ROADMAP_STATUS_REFRESH = "ROADMAP_STATUS_REFRESH" as const;
export const JOB_ANALYTICS_METRIC_REFRESH = "ANALYTICS_METRIC_REFRESH" as const;
export const JOB_ANALYTICS_SNAPSHOT = "ANALYTICS_SNAPSHOT" as const;
export const JOB_ANALYTICS_EXPORT = "ANALYTICS_EXPORT" as const;
export const JOB_WORKFLOW_RUN = "WORKFLOW_RUN" as const;
export const JOB_WORKFLOW_ACTION = "WORKFLOW_ACTION" as const;
export const JOB_WORKFLOW_RETRY = "WORKFLOW_RETRY" as const;
export const JOB_WORKFLOW_TIMEOUT = "WORKFLOW_TIMEOUT" as const;
export const JOB_WORKFLOW_SCHEDULE_TRIGGER = "WORKFLOW_SCHEDULE_TRIGGER" as const;

type OrgPayload = {
  organizationId?: string;
  kpiId?: string;
  budgetId?: string;
  metricKey?: string;
  workflowRunId?: string;
  definitionId?: string;
  exportId?: string;
};

function requireOrganizationId(job: JobRecord): string {
  const payload = job.payload as OrgPayload | null;
  const organizationId = payload?.organizationId?.trim();
  if (!organizationId) {
    throw Object.assign(new Error(`${job.type} exige organizationId`), {
      code: "VALIDATION_ERROR",
    });
  }
  return organizationId;
}

function createIdempotentStub(name: string): JobHandler {
  return async (job: JobRecord) => {
    requireOrganizationId(job);
    // Idempotent stub — services are invoked when imported paths are available in worker build.
    void name;
  };
}

export function registerLocalControlAnalyticsWorkflowHandlers(
  queue: LocalInProcessQueueProvider,
  db: AppDatabase,
): void {
  void db;

  const stubs: Array<[string, string]> = [
    [JOB_GOAL_PROGRESS_REFRESH, "goal_progress"],
    [JOB_KPI_REFRESH, "kpi_refresh"],
    [JOB_EMPLOYEE_REVIEW_REMINDER, "employee_review"],
    [JOB_LEAVE_REMINDER, "leave_reminder"],
    [JOB_BUDGET_VARIANCE_REFRESH, "budget_variance"],
    [JOB_COMPLIANCE_OBLIGATION_REMINDER, "compliance_obligation"],
    [JOB_VENDOR_SLA_CHECK, "vendor_sla"],
    [JOB_ROADMAP_STATUS_REFRESH, "roadmap_status"],
    [JOB_ANALYTICS_METRIC_REFRESH, "analytics_metric"],
    [JOB_ANALYTICS_SNAPSHOT, "analytics_snapshot"],
    [JOB_ANALYTICS_EXPORT, "analytics_export"],
    [JOB_WORKFLOW_RUN, "workflow_run"],
    [JOB_WORKFLOW_ACTION, "workflow_action"],
    [JOB_WORKFLOW_RETRY, "workflow_retry"],
    [JOB_WORKFLOW_TIMEOUT, "workflow_timeout"],
    [JOB_WORKFLOW_SCHEDULE_TRIGGER, "workflow_schedule"],
  ];

  for (const [type, name] of stubs) {
    queue.registerHandler(type, createIdempotentStub(name));
  }
}
