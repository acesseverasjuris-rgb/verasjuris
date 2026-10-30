import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type ControlPermission = Extract<
  PermissionKey,
  | "control.read"
  | "control.director.manage"
  | "control.approval.manage"
  | "control.hr.read"
  | "control.hr.manage"
  | "control.hr.review"
  | "control.hr.leave.approve"
  | "control.finance.read"
  | "control.finance.manage"
  | "control.finance.approve"
  | "control.legal.read"
  | "control.legal.manage"
  | "control.compliance.read"
  | "control.compliance.manage"
  | "control.compliance.audit"
  | "control.vendor.read"
  | "control.vendor.manage"
  | "control.product.read"
  | "control.product.manage"
>;

type AnalyticsPermission = Extract<
  PermissionKey,
  | "analytics.read"
  | "analytics.finance.read"
  | "analytics.hr.read"
  | "analytics.legal.read"
  | "analytics.export"
  | "analytics.admin"
>;

type WorkflowPermission = Extract<
  PermissionKey,
  | "workflow.read"
  | "workflow.create"
  | "workflow.update"
  | "workflow.publish"
  | "workflow.run"
  | "workflow.cancel"
  | "workflow.view_logs"
  | "workflow.admin"
>;

export function policyInternalControl(
  membership: AccessMembership,
  required: Extract<
    ControlPermission,
    | "control.read"
    | "control.director.manage"
    | "control.approval.manage"
    | "control.hr.read"
    | "control.hr.manage"
    | "control.finance.read"
    | "control.finance.manage"
    | "control.legal.read"
    | "control.legal.manage"
    | "control.compliance.read"
    | "control.compliance.manage"
    | "control.vendor.read"
    | "control.vendor.manage"
    | "control.product.read"
    | "control.product.manage"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyEmployee(
  membership: AccessMembership,
  required: Extract<
    ControlPermission,
    | "control.read"
    | "control.hr.read"
    | "control.hr.manage"
    | "control.hr.review"
    | "control.hr.leave.approve"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyBudget(
  membership: AccessMembership,
  required: Extract<
    ControlPermission,
    "control.read" | "control.finance.read" | "control.finance.manage" | "control.finance.approve"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyExpenseReport(
  membership: AccessMembership,
  required: Extract<
    ControlPermission,
    "control.read" | "control.finance.read" | "control.finance.manage" | "control.finance.approve"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyInternalLegalMatter(
  membership: AccessMembership,
  required: Extract<
    ControlPermission,
    "control.read" | "control.legal.read" | "control.legal.manage"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyComplianceRisk(
  membership: AccessMembership,
  required: Extract<
    ControlPermission,
    | "control.read"
    | "control.compliance.read"
    | "control.compliance.manage"
    | "control.compliance.audit"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyComplianceIncident(
  membership: AccessMembership,
  required: Extract<
    ControlPermission,
    | "control.read"
    | "control.compliance.read"
    | "control.compliance.manage"
    | "control.compliance.audit"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyVendor(
  membership: AccessMembership,
  required: Extract<
    ControlPermission,
    "control.read" | "control.vendor.read" | "control.vendor.manage"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyProductProject(
  membership: AccessMembership,
  required: Extract<
    ControlPermission,
    "control.read" | "control.product.read" | "control.product.manage"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyAnalytics(
  membership: AccessMembership,
  required: AnalyticsPermission,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyWorkflowDefinition(
  membership: AccessMembership,
  required: Extract<
    WorkflowPermission,
    "workflow.read" | "workflow.create" | "workflow.update" | "workflow.publish" | "workflow.admin"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyWorkflowRun(
  membership: AccessMembership,
  required: Extract<
    WorkflowPermission,
    "workflow.read" | "workflow.run" | "workflow.cancel" | "workflow.view_logs" | "workflow.admin"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
