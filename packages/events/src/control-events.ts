/**
 * Nomes de eventos de domínio — Control / Analytics / Workflows (Etapas 23–25).
 * Constantes para audit, bus e triggers de workflow. Payloads tipados entram no DomainEventMap
 * quando o publisher concreto for ligado.
 */

export const CONTROL_EVENTS = {
  GOAL_CREATED: "control.goal_created",
  GOAL_UPDATED: "control.goal_updated",
  APPROVAL_REQUESTED: "control.approval_requested",
  APPROVAL_DECIDED: "control.approval_decided",
  EMPLOYEE_CREATED: "control.employee_created",
  EMPLOYEE_ACTIVATED: "control.employee_activated",
  EMPLOYEE_TERMINATED: "control.employee_terminated",
  ONBOARDING_STARTED: "control.onboarding_started",
  REVIEW_COMPLETED: "control.review_completed",
  LEAVE_APPROVED: "control.leave_approved",
  BUDGET_CREATED: "control.budget_created",
  BUDGET_APPROVED: "control.budget_approved",
  EXPENSE_SUBMITTED: "control.expense_submitted",
  EXPENSE_APPROVED: "control.expense_approved",
  IP_CREATED: "control.ip_created",
  DUE_DILIGENCE_STARTED: "control.due_diligence_started",
  POLICY_PUBLISHED: "control.policy_published",
  RISK_CREATED: "control.risk_created",
  CONTROL_TESTED: "control.control_tested",
  INCIDENT_OPENED: "control.incident_opened",
  AUDIT_COMPLETED: "control.audit_completed",
  OBLIGATION_COMPLETED: "control.obligation_completed",
  VENDOR_CREATED: "control.vendor_created",
  VENDOR_APPROVED: "control.vendor_approved",
  VENDOR_SUSPENDED: "control.vendor_suspended",
  VENDOR_REVIEWED: "control.vendor_reviewed",
  ROADMAP_CHANGED: "control.roadmap_changed",
  BUG_CREATED: "control.bug_created",
  RELEASE_CREATED: "control.release_created",
  RELEASE_MARKED_RELEASED: "control.release_marked_released",
} as const;

export type ControlEventName = (typeof CONTROL_EVENTS)[keyof typeof CONTROL_EVENTS];

export const ANALYTICS_EVENTS = {
  METRIC_CALCULATED: "analytics.metric_calculated",
  EXPORT_CREATED: "analytics.export_created",
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export const WORKFLOW_EVENTS = {
  CREATED: "workflow.created",
  PUBLISHED: "workflow.published",
  RUN_STARTED: "workflow.run_started",
  ACTION_FAILED: "workflow.action_failed",
  RETRY_SCHEDULED: "workflow.retry_scheduled",
  RUN_COMPLETED: "workflow.run_completed",
  RUN_FAILED: "workflow.run_failed",
} as const;

export type WorkflowEventName = (typeof WORKFLOW_EVENTS)[keyof typeof WORKFLOW_EVENTS];

export const CONTROL_ANALYTICS_WORKFLOW_EVENT_NAMES = [
  ...Object.values(CONTROL_EVENTS),
  ...Object.values(ANALYTICS_EVENTS),
  ...Object.values(WORKFLOW_EVENTS),
] as const;

export type ControlAnalyticsWorkflowEventName =
  (typeof CONTROL_ANALYTICS_WORKFLOW_EVENT_NAMES)[number];
