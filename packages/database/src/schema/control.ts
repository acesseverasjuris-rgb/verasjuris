/**
 * Etapas 23 — VerasJuris Control (diretoria, RH, financeiro interno, jurídico interno,
 * compliance, fornecedores, produto/tecnologia).
 * Reutiliza Organization/User/Contract/Document/LegalMatter/Ledger/Treasury — não duplicar.
 * Acesso: organization.internalCompany === true (+ config InternalOrganization).
 */
import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { contracts } from "./contracts.js";
import { documents } from "./documents.js";
import { organizationMembers, organizations, users } from "./identity.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

/* ─── Director enums ─── */

export const controlGoalStatusEnum = pgEnum("control_goal_status", [
  "draft",
  "active",
  "at_risk",
  "achieved",
  "missed",
  "cancelled",
  "archived",
]);

export const controlGoalTargetTypeEnum = pgEnum("control_goal_target_type", [
  "absolute",
  "percentage",
  "currency",
  "count",
  "custom",
]);

export const controlKpiDirectionEnum = pgEnum("control_kpi_direction", [
  "higher_is_better",
  "lower_is_better",
  "target_range",
]);

export const controlKpiSourceTypeEnum = pgEnum("control_kpi_source_type", [
  "internal_query",
  "manual",
  "external_provider",
]);

export const controlApprovalStatusEnum = pgEnum("control_approval_status", [
  "pending",
  "partially_approved",
  "approved",
  "rejected",
  "cancelled",
  "expired",
]);

export const controlApprovalPolicyEnum = pgEnum("control_approval_policy", [
  "single",
  "sequential",
  "parallel",
  "threshold_based",
]);

export const controlApprovalDecisionEnum = pgEnum("control_approval_decision", [
  "approved",
  "rejected",
]);

/* ─── HR enums ─── */

export const controlEmployeeStatusEnum = pgEnum("control_employee_status", [
  "preboarding",
  "active",
  "on_leave",
  "suspended",
  "terminated",
  "archived",
]);

export const controlEmploymentTypeEnum = pgEnum("control_employment_type", [
  "employee",
  "intern",
  "contractor",
  "partner",
  "temporary",
  "other",
]);

export const employeeOnboardingItemTypeEnum = pgEnum("employee_onboarding_item_type", [
  "documents",
  "access",
  "training",
  "equipment",
  "policies",
  "meetings",
  "security",
  "lgpd",
  "other",
]);

export const employeeOnboardingItemStatusEnum = pgEnum("employee_onboarding_item_status", [
  "pending",
  "in_progress",
  "completed",
  "skipped",
  "blocked",
]);

export const employeeOnboardingPlanStatusEnum = pgEnum("employee_onboarding_plan_status", [
  "draft",
  "active",
  "completed",
  "cancelled",
]);

export const employeePerformanceReviewStatusEnum = pgEnum("employee_performance_review_status", [
  "draft",
  "in_progress",
  "completed",
  "cancelled",
]);

export const employeeLeaveTypeEnum = pgEnum("employee_leave_type", [
  "vacation",
  "medical",
  "personal",
  "parental",
  "other",
]);

export const employeeLeaveStatusEnum = pgEnum("employee_leave_status", [
  "draft",
  "requested",
  "approved",
  "rejected",
  "cancelled",
  "taken",
]);

/* ─── Internal finance enums ─── */

export const internalBudgetStatusEnum = pgEnum("internal_budget_status", [
  "draft",
  "under_review",
  "approved",
  "revised",
  "closed",
]);

export const expenseReportStatusEnum = pgEnum("expense_report_status", [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "reimbursed",
]);

export const expenseReportItemStatusEnum = pgEnum("expense_report_item_status", [
  "pending",
  "approved",
  "rejected",
]);

/* ─── Internal legal enums ─── */

export const intellectualPropertyTypeEnum = pgEnum("intellectual_property_type", [
  "trademark",
  "patent",
  "software",
  "domain",
  "copyright",
  "trade_secret",
  "design",
  "other",
]);

export const intellectualPropertyStatusEnum = pgEnum("intellectual_property_status", [
  "draft",
  "filed",
  "pending",
  "registered",
  "rejected",
  "expired",
  "abandoned",
]);

export const dueDiligenceCaseStatusEnum = pgEnum("due_diligence_case_status", [
  "draft",
  "open",
  "in_progress",
  "completed",
  "cancelled",
]);

export const dueDiligenceCaseTypeEnum = pgEnum("due_diligence_case_type", [
  "corporate",
  "vendor",
  "investment",
  "m_and_a",
  "partner",
  "other",
]);

export const dueDiligenceItemAreaEnum = pgEnum("due_diligence_item_area", [
  "corporate",
  "legal",
  "tax",
  "labor",
  "privacy",
  "security",
  "financial",
  "sanctions",
  "ip",
  "contracts",
  "other",
]);

export const dueDiligenceItemStatusEnum = pgEnum("due_diligence_item_status", [
  "pending",
  "in_progress",
  "completed",
  "not_applicable",
  "blocked",
]);

export const internalPolicyStatusEnum = pgEnum("internal_policy_status", [
  "draft",
  "under_review",
  "approved",
  "active",
  "superseded",
  "archived",
]);

/* ─── Compliance enums ─── */

export const complianceRiskCategoryEnum = pgEnum("compliance_risk_category", [
  "legal",
  "regulatory",
  "privacy",
  "security",
  "financial",
  "operational",
  "reputational",
  "vendor",
  "ai",
  "fraud",
  "other",
]);

export const complianceRiskStatusEnum = pgEnum("compliance_risk_status", [
  "open",
  "monitoring",
  "mitigated",
  "accepted",
  "closed",
]);

export const complianceControlTypeEnum = pgEnum("compliance_control_type", [
  "preventive",
  "detective",
  "corrective",
  "compensating",
]);

export const complianceControlStatusEnum = pgEnum("compliance_control_status", [
  "draft",
  "active",
  "inactive",
  "retired",
]);

export const complianceControlFrequencyEnum = pgEnum("compliance_control_frequency", [
  "continuous",
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
  "ad_hoc",
]);

export const complianceIncidentTypeEnum = pgEnum("compliance_incident_type", [
  "privacy",
  "security",
  "fraud",
  "financial",
  "regulatory",
  "operational",
  "vendor",
  "ai",
  "other",
]);

export const complianceIncidentStatusEnum = pgEnum("compliance_incident_status", [
  "open",
  "triaged",
  "investigating",
  "contained",
  "remediating",
  "monitoring",
  "closed",
]);

export const complianceIncidentSeverityEnum = pgEnum("compliance_incident_severity", [
  "critical",
  "high",
  "medium",
  "low",
]);

export const complianceAuditTypeEnum = pgEnum("compliance_audit_type", [
  "internal",
  "external",
  "regulatory",
  "vendor",
  "security",
  "financial",
  "privacy",
]);

export const complianceAuditStatusEnum = pgEnum("compliance_audit_status", [
  "planned",
  "in_progress",
  "completed",
  "cancelled",
]);

export const complianceFindingSeverityEnum = pgEnum("compliance_finding_severity", [
  "critical",
  "high",
  "medium",
  "low",
]);

export const complianceFindingStatusEnum = pgEnum("compliance_finding_status", [
  "open",
  "in_remediation",
  "resolved",
  "accepted",
  "deferred",
]);

export const complianceObligationStatusEnum = pgEnum("compliance_obligation_status", [
  "open",
  "in_progress",
  "completed",
  "overdue",
  "waived",
]);

/* ─── Vendor enums ─── */

export const controlVendorStatusEnum = pgEnum("control_vendor_status", [
  "prospect",
  "under_review",
  "approved",
  "active",
  "suspended",
  "terminated",
  "archived",
]);

export const controlVendorRiskLevelEnum = pgEnum("control_vendor_risk_level", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const vendorOnboardingStatusEnum = pgEnum("vendor_onboarding_status", [
  "not_started",
  "in_progress",
  "completed",
  "blocked",
]);

export const vendorSlaStatusEnum = pgEnum("vendor_sla_status", [
  "active",
  "breached",
  "paused",
  "expired",
]);

export const vendorSlaResultStatusEnum = pgEnum("vendor_sla_result_status", [
  "met",
  "missed",
  "partial",
  "not_measured",
]);

/* ─── Product enums ─── */

export const roadmapItemTypeEnum = pgEnum("roadmap_item_type", [
  "feature",
  "improvement",
  "tech_debt",
  "bug",
  "security",
  "compliance",
  "infrastructure",
]);

export const roadmapItemStatusEnum = pgEnum("roadmap_item_status", [
  "proposed",
  "planned",
  "in_progress",
  "done",
  "deferred",
  "cancelled",
]);

export const roadmapItemPriorityEnum = pgEnum("roadmap_item_priority", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const productBugStatusEnum = pgEnum("product_bug_status", [
  "open",
  "triaged",
  "in_progress",
  "blocked",
  "fixed",
  "verified",
  "closed",
  "wont_fix",
]);

export const productBugSeverityEnum = pgEnum("product_bug_severity", [
  "critical",
  "high",
  "medium",
  "low",
]);

export const technologyIncidentSeverityEnum = pgEnum("technology_incident_severity", [
  "sev1",
  "sev2",
  "sev3",
  "sev4",
]);

export const technologyIncidentStatusEnum = pgEnum("technology_incident_status", [
  "open",
  "investigating",
  "mitigated",
  "resolved",
  "closed",
]);

export const productReleaseStatusEnum = pgEnum("product_release_status", [
  "planned",
  "ready",
  "deploying",
  "released",
  "failed",
  "rolled_back",
  "cancelled",
]);

export const productFeatureStatusEnum = pgEnum("product_feature_status", [
  "discovery",
  "planned",
  "in_development",
  "testing",
  "released",
  "deprecated",
  "retired",
]);

export const controlProjectStatusEnum = pgEnum("control_project_status", [
  "proposed",
  "approved",
  "active",
  "at_risk",
  "blocked",
  "completed",
  "cancelled",
]);

/* ═══ DIRECTOR ═══ */

export const controlGoals = pgTable(
  "control_goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    ownerMembershipId: uuid("owner_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    area: text("area"),
    periodStart: timestamp("period_start", { withTimezone: true, mode: "date" }),
    periodEnd: timestamp("period_end", { withTimezone: true, mode: "date" }),
    targetType: controlGoalTargetTypeEnum("target_type").notNull().default("absolute"),
    targetValue: text("target_value"),
    currentValueSource: text("current_value_source"),
    status: controlGoalStatusEnum("status").notNull().default("draft"),
    ...timestamps,
  },
  (table) => [
    index("control_goals_org_idx").on(table.organizationId),
    index("control_goals_org_status_idx").on(table.organizationId, table.status),
  ],
);

export const controlKpis = pgTable(
  "control_kpis",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    unit: text("unit"),
    direction: controlKpiDirectionEnum("direction").notNull().default("higher_is_better"),
    sourceType: controlKpiSourceTypeEnum("source_type").notNull().default("manual"),
    sourceConfig: jsonb("source_config").$type<Record<string, unknown>>(),
    targetValue: text("target_value"),
    warningThreshold: text("warning_threshold"),
    criticalThreshold: text("critical_threshold"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("control_kpis_org_key_unique").on(table.organizationId, table.key),
    index("control_kpis_org_idx").on(table.organizationId),
  ],
);

export const controlKpiSnapshots = pgTable(
  "control_kpi_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kpiId: uuid("kpi_id")
      .notNull()
      .references(() => controlKpis.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    value: text("value").notNull(),
    source: text("source"),
    calculatedAt: timestamp("calculated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("control_kpi_snapshots_kpi_idx").on(table.kpiId),
    index("control_kpi_snapshots_kpi_period_idx").on(table.kpiId, table.period),
  ],
);

export const controlApprovalRequests = pgTable(
  "control_approval_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    referenceType: text("reference_type").notNull(),
    referenceId: uuid("reference_id").notNull(),
    requestedByMembershipId: uuid("requested_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    approverPolicy: controlApprovalPolicyEnum("approver_policy").notNull().default("single"),
    status: controlApprovalStatusEnum("status").notNull().default("pending"),
    requestedAt: timestamp("requested_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true, mode: "date" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("control_approval_requests_org_idx").on(table.organizationId),
    index("control_approval_requests_org_status_idx").on(table.organizationId, table.status),
    index("control_approval_requests_ref_idx").on(table.referenceType, table.referenceId),
  ],
);

export const controlApprovalDecisions = pgTable(
  "control_approval_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => controlApprovalRequests.id, { onDelete: "cascade" }),
    approverMembershipId: uuid("approver_membership_id")
      .notNull()
      .references(() => organizationMembers.id, { onDelete: "restrict" }),
    decision: controlApprovalDecisionEnum("decision").notNull(),
    comment: text("comment"),
    decidedAt: timestamp("decided_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("control_approval_decisions_request_idx").on(table.requestId),
    uniqueIndex("control_approval_decisions_request_approver_unique").on(
      table.requestId,
      table.approverMembershipId,
    ),
  ],
);

/* ═══ HR ═══ */

export const controlDepartments = pgTable(
  "control_departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("control_departments_org_slug_unique").on(table.organizationId, table.slug),
    index("control_departments_org_idx").on(table.organizationId),
  ],
);

export const controlPositions = pgTable(
  "control_positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => controlDepartments.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    level: text("level"),
    description: text("description"),
    responsibilities: text("responsibilities"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("control_positions_org_idx").on(table.organizationId),
    index("control_positions_department_idx").on(table.departmentId),
  ],
);

export const controlEmployees = pgTable(
  "control_employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    employeeCode: text("employee_code").notNull(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    status: controlEmployeeStatusEnum("status").notNull().default("preboarding"),
    hiredAt: timestamp("hired_at", { withTimezone: true, mode: "date" }),
    terminatedAt: timestamp("terminated_at", { withTimezone: true, mode: "date" }),
    managerEmployeeId: uuid("manager_employee_id"),
    departmentId: uuid("department_id").references(() => controlDepartments.id, {
      onDelete: "set null",
    }),
    positionId: uuid("position_id").references(() => controlPositions.id, {
      onDelete: "set null",
    }),
    employmentType: controlEmploymentTypeEnum("employment_type").notNull().default("employee"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("control_employees_org_code_unique").on(table.organizationId, table.employeeCode),
    index("control_employees_org_idx").on(table.organizationId),
    index("control_employees_org_status_idx").on(table.organizationId, table.status),
    index("control_employees_department_idx").on(table.departmentId),
    index("control_employees_manager_idx").on(table.managerEmployeeId),
    index("control_employees_user_idx").on(table.userId),
  ],
);

export const employeeContractLinks = pgTable(
  "employee_contract_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => controlEmployees.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("employee_contract_links_unique").on(table.employeeId, table.contractId),
    index("employee_contract_links_contract_idx").on(table.contractId),
  ],
);

export const employeeOnboardingTemplates = pgTable(
  "employee_onboarding_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    departmentId: uuid("department_id").references(() => controlDepartments.id, {
      onDelete: "set null",
    }),
    positionId: uuid("position_id").references(() => controlPositions.id, {
      onDelete: "set null",
    }),
    employmentType: controlEmploymentTypeEnum("employment_type"),
    itemsTemplate: jsonb("items_template").$type<Record<string, unknown>[]>().notNull().default([]),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [index("employee_onboarding_templates_org_idx").on(table.organizationId)],
);

export const employeeOnboardingPlans = pgTable(
  "employee_onboarding_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => controlEmployees.id, { onDelete: "cascade" }),
    templateId: uuid("template_id").references(() => employeeOnboardingTemplates.id, {
      onDelete: "set null",
    }),
    status: employeeOnboardingPlanStatusEnum("status").notNull().default("draft"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("employee_onboarding_plans_org_idx").on(table.organizationId),
    index("employee_onboarding_plans_employee_idx").on(table.employeeId),
  ],
);

export const employeeOnboardingItems = pgTable(
  "employee_onboarding_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => employeeOnboardingPlans.id, { onDelete: "cascade" }),
    itemType: employeeOnboardingItemTypeEnum("item_type").notNull().default("other"),
    title: text("title").notNull(),
    description: text("description"),
    status: employeeOnboardingItemStatusEnum("status").notNull().default("pending"),
    sortOrder: integer("sort_order").notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    assigneeMembershipId: uuid("assignee_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    index("employee_onboarding_items_plan_idx").on(table.planId),
    index("employee_onboarding_items_status_idx").on(table.planId, table.status),
  ],
);

export const employeePerformanceReviews = pgTable(
  "employee_performance_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => controlEmployees.id, { onDelete: "cascade" }),
    periodStart: timestamp("period_start", { withTimezone: true, mode: "date" }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true, mode: "date" }).notNull(),
    reviewerEmployeeId: uuid("reviewer_employee_id").references(() => controlEmployees.id, {
      onDelete: "set null",
    }),
    status: employeePerformanceReviewStatusEnum("status").notNull().default("draft"),
    overallScore: integer("overall_score"),
    reviewScaleMax: integer("review_scale_max").notNull().default(5),
    strengths: text("strengths"),
    improvements: text("improvements"),
    goals: text("goals"),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("employee_performance_reviews_org_idx").on(table.organizationId),
    index("employee_performance_reviews_employee_idx").on(table.employeeId),
  ],
);

export const employeeLeaveRequests = pgTable(
  "employee_leave_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => controlEmployees.id, { onDelete: "cascade" }),
    leaveType: employeeLeaveTypeEnum("leave_type").notNull().default("vacation"),
    status: employeeLeaveStatusEnum("status").notNull().default("draft"),
    startAt: timestamp("start_at", { withTimezone: true, mode: "date" }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true, mode: "date" }).notNull(),
    reason: text("reason"),
    approvedByMembershipId: uuid("approved_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    decidedAt: timestamp("decided_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("employee_leave_requests_org_idx").on(table.organizationId),
    index("employee_leave_requests_employee_idx").on(table.employeeId),
    index("employee_leave_requests_org_status_idx").on(table.organizationId, table.status),
  ],
);

/* ═══ INTERNAL FINANCE ═══ */

export const costCenters = pgTable(
  "cost_centers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    departmentId: uuid("department_id").references(() => controlDepartments.id, {
      onDelete: "set null",
    }),
    managerMembershipId: uuid("manager_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("cost_centers_org_code_unique").on(table.organizationId, table.code),
    index("cost_centers_org_idx").on(table.organizationId),
  ],
);

export const internalBudgets = pgTable(
  "internal_budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    fiscalYear: integer("fiscal_year").notNull(),
    version: integer("version").notNull().default(1),
    status: internalBudgetStatusEnum("status").notNull().default("draft"),
    approvedByMembershipId: uuid("approved_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("internal_budgets_org_year_version_unique").on(
      table.organizationId,
      table.fiscalYear,
      table.version,
    ),
    index("internal_budgets_org_idx").on(table.organizationId),
  ],
);

export const internalBudgetLines = pgTable(
  "internal_budget_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    budgetId: uuid("budget_id")
      .notNull()
      .references(() => internalBudgets.id, { onDelete: "cascade" }),
    costCenterId: uuid("cost_center_id").references(() => costCenters.id, {
      onDelete: "set null",
    }),
    category: text("category").notNull(),
    period: text("period").notNull(),
    plannedAmountCents: bigint("planned_amount_cents", { mode: "number" }).notNull(),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("internal_budget_lines_budget_idx").on(table.budgetId),
    index("internal_budget_lines_cost_center_idx").on(table.costCenterId),
  ],
);

export const expenseReports = pgTable(
  "expense_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => controlEmployees.id, { onDelete: "restrict" }),
    costCenterId: uuid("cost_center_id").references(() => costCenters.id, {
      onDelete: "set null",
    }),
    period: text("period").notNull(),
    totalCents: bigint("total_cents", { mode: "number" }).notNull().default(0),
    currency: text("currency").notNull().default("BRL"),
    status: expenseReportStatusEnum("status").notNull().default("draft"),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" }),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("expense_reports_org_idx").on(table.organizationId),
    index("expense_reports_employee_idx").on(table.employeeId),
    index("expense_reports_org_status_idx").on(table.organizationId, table.status),
  ],
);

export const expenseReportItems = pgTable(
  "expense_report_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expenseReportId: uuid("expense_report_id")
      .notNull()
      .references(() => expenseReports.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    description: text("description").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    incurredAt: timestamp("incurred_at", { withTimezone: true, mode: "date" }).notNull(),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    status: expenseReportItemStatusEnum("status").notNull().default("pending"),
    ...timestamps,
  },
  (table) => [index("expense_report_items_report_idx").on(table.expenseReportId)],
);

/* ═══ INTERNAL LEGAL ═══ */

export const intellectualPropertyAssets = pgTable(
  "intellectual_property_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    assetType: intellectualPropertyTypeEnum("asset_type").notNull().default("other"),
    status: intellectualPropertyStatusEnum("status").notNull().default("draft"),
    registrationNumber: text("registration_number"),
    jurisdiction: text("jurisdiction"),
    ownerMembershipId: uuid("owner_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    filedAt: timestamp("filed_at", { withTimezone: true, mode: "date" }),
    registeredAt: timestamp("registered_at", { withTimezone: true, mode: "date" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("intellectual_property_assets_org_idx").on(table.organizationId),
    index("intellectual_property_assets_org_status_idx").on(table.organizationId, table.status),
  ],
);

export const internalDueDiligenceCases = pgTable(
  "internal_due_diligence_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    subjectType: text("subject_type").notNull(),
    subjectId: uuid("subject_id"),
    type: dueDiligenceCaseTypeEnum("type").notNull().default("other"),
    status: dueDiligenceCaseStatusEnum("status").notNull().default("draft"),
    title: text("title").notNull(),
    ownerMembershipId: uuid("owner_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    openedAt: timestamp("opened_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("internal_due_diligence_cases_org_idx").on(table.organizationId),
    index("internal_due_diligence_cases_subject_idx").on(table.subjectType, table.subjectId),
  ],
);

export const dueDiligenceChecklists = pgTable(
  "due_diligence_checklists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => internalDueDiligenceCases.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ...timestamps,
  },
  (table) => [index("due_diligence_checklists_case_idx").on(table.caseId)],
);

export const dueDiligenceItems = pgTable(
  "due_diligence_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    checklistId: uuid("checklist_id")
      .notNull()
      .references(() => dueDiligenceChecklists.id, { onDelete: "cascade" }),
    area: dueDiligenceItemAreaEnum("area").notNull().default("other"),
    title: text("title").notNull(),
    description: text("description"),
    status: dueDiligenceItemStatusEnum("status").notNull().default("pending"),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [index("due_diligence_items_checklist_idx").on(table.checklistId)],
);

export const internalPolicies = pgTable(
  "internal_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    category: text("category").notNull().default("general"),
    version: integer("version").notNull().default(1),
    status: internalPolicyStatusEnum("status").notNull().default("draft"),
    effectiveAt: timestamp("effective_at", { withTimezone: true, mode: "date" }),
    reviewAt: timestamp("review_at", { withTimezone: true, mode: "date" }),
    ownerMembershipId: uuid("owner_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    index("internal_policies_org_idx").on(table.organizationId),
    index("internal_policies_org_status_idx").on(table.organizationId, table.status),
  ],
);

export const policyAcknowledgements = pgTable(
  "policy_acknowledgements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => internalPolicies.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id").references(() => controlEmployees.id, {
      onDelete: "cascade",
    }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    policyVersion: integer("policy_version").notNull(),
  },
  (table) => [
    index("policy_acknowledgements_policy_idx").on(table.policyId),
    index("policy_acknowledgements_employee_idx").on(table.employeeId),
  ],
);

/* ═══ COMPLIANCE ═══ */

export const complianceRisks = pgTable(
  "compliance_risks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    category: complianceRiskCategoryEnum("category").notNull().default("other"),
    title: text("title").notNull(),
    description: text("description"),
    ownerMembershipId: uuid("owner_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    likelihood: integer("likelihood").notNull().default(1),
    impact: integer("impact").notNull().default(1),
    inherentRisk: integer("inherent_risk"),
    residualRisk: integer("residual_risk"),
    status: complianceRiskStatusEnum("status").notNull().default("open"),
    reviewAt: timestamp("review_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("compliance_risks_org_idx").on(table.organizationId),
    index("compliance_risks_org_status_idx").on(table.organizationId, table.status),
  ],
);

export const complianceControls = pgTable(
  "compliance_controls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    riskId: uuid("risk_id").references(() => complianceRisks.id, { onDelete: "set null" }),
    code: text("code").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    controlType: complianceControlTypeEnum("control_type").notNull().default("preventive"),
    ownerMembershipId: uuid("owner_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    frequency: complianceControlFrequencyEnum("frequency").notNull().default("ad_hoc"),
    status: complianceControlStatusEnum("status").notNull().default("draft"),
    lastTestedAt: timestamp("last_tested_at", { withTimezone: true, mode: "date" }),
    nextTestAt: timestamp("next_test_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("compliance_controls_org_code_unique").on(table.organizationId, table.code),
    index("compliance_controls_org_idx").on(table.organizationId),
    index("compliance_controls_risk_idx").on(table.riskId),
  ],
);

export const complianceIncidents = pgTable(
  "compliance_incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: complianceIncidentTypeEnum("type").notNull().default("other"),
    severity: complianceIncidentSeverityEnum("severity").notNull().default("medium"),
    title: text("title").notNull(),
    description: text("description"),
    detectedAt: timestamp("detected_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    status: complianceIncidentStatusEnum("status").notNull().default("open"),
    ownerMembershipId: uuid("owner_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    rootCause: text("root_cause"),
    impact: text("impact"),
    resolution: text("resolution"),
    closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("compliance_incidents_org_idx").on(table.organizationId),
    index("compliance_incidents_org_status_idx").on(table.organizationId, table.status),
  ],
);

export const complianceAudits = pgTable(
  "compliance_audits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: complianceAuditTypeEnum("type").notNull().default("internal"),
    title: text("title").notNull(),
    status: complianceAuditStatusEnum("status").notNull().default("planned"),
    ownerMembershipId: uuid("owner_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    plannedAt: timestamp("planned_at", { withTimezone: true, mode: "date" }),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("compliance_audits_org_idx").on(table.organizationId),
    index("compliance_audits_org_status_idx").on(table.organizationId, table.status),
  ],
);

export const complianceAuditFindings = pgTable(
  "compliance_audit_findings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    auditId: uuid("audit_id")
      .notNull()
      .references(() => complianceAudits.id, { onDelete: "cascade" }),
    severity: complianceFindingSeverityEnum("severity").notNull().default("medium"),
    description: text("description").notNull(),
    ownerMembershipId: uuid("owner_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    remediationDueAt: timestamp("remediation_due_at", { withTimezone: true, mode: "date" }),
    status: complianceFindingStatusEnum("status").notNull().default("open"),
    ...timestamps,
  },
  (table) => [index("compliance_audit_findings_audit_idx").on(table.auditId)],
);

export const complianceObligations = pgTable(
  "compliance_obligations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    source: text("source"),
    authority: text("authority"),
    frequency: text("frequency"),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    ownerMembershipId: uuid("owner_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    status: complianceObligationStatusEnum("status").notNull().default("open"),
    evidenceDocumentId: uuid("evidence_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    index("compliance_obligations_org_idx").on(table.organizationId),
    index("compliance_obligations_org_status_idx").on(table.organizationId, table.status),
  ],
);

/* ═══ VENDORS ═══ */

export const controlVendors = pgTable(
  "control_vendors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalName: text("legal_name").notNull(),
    tradeName: text("trade_name"),
    taxId: text("tax_id"),
    category: text("category"),
    status: controlVendorStatusEnum("status").notNull().default("prospect"),
    riskLevel: controlVendorRiskLevelEnum("risk_level").notNull().default("medium"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    contactName: text("contact_name"),
    onboardingStatus: vendorOnboardingStatusEnum("onboarding_status")
      .notNull()
      .default("not_started"),
    ...timestamps,
  },
  (table) => [
    index("control_vendors_org_idx").on(table.organizationId),
    index("control_vendors_org_status_idx").on(table.organizationId, table.status),
  ],
);

export const vendorSlas = pgTable(
  "vendor_slas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => controlVendors.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id").references(() => contracts.id, { onDelete: "set null" }),
    metric: text("metric").notNull(),
    target: text("target").notNull(),
    measurement: text("measurement"),
    period: text("period"),
    status: vendorSlaStatusEnum("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => [
    index("vendor_slas_vendor_idx").on(table.vendorId),
    index("vendor_slas_org_idx").on(table.organizationId),
  ],
);

export const vendorSlaResults = pgTable(
  "vendor_sla_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slaId: uuid("sla_id")
      .notNull()
      .references(() => vendorSlas.id, { onDelete: "cascade" }),
    periodStart: timestamp("period_start", { withTimezone: true, mode: "date" }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true, mode: "date" }).notNull(),
    actualValue: text("actual_value"),
    status: vendorSlaResultStatusEnum("status").notNull().default("not_measured"),
    notes: text("notes"),
    measuredAt: timestamp("measured_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("vendor_sla_results_sla_idx").on(table.slaId)],
);

export const vendorReviews = pgTable(
  "vendor_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => controlVendors.id, { onDelete: "cascade" }),
    periodStart: timestamp("period_start", { withTimezone: true, mode: "date" }),
    periodEnd: timestamp("period_end", { withTimezone: true, mode: "date" }),
    qualityScore: integer("quality_score"),
    deadlineScore: integer("deadline_score"),
    costScore: integer("cost_score"),
    securityScore: integer("security_score"),
    complianceScore: integer("compliance_score"),
    supportScore: integer("support_score"),
    overallScore: integer("overall_score"),
    reviewScaleMax: integer("review_scale_max").notNull().default(5),
    comments: text("comments"),
    reviewerMembershipId: uuid("reviewer_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (table) => [
    index("vendor_reviews_vendor_idx").on(table.vendorId),
    index("vendor_reviews_org_idx").on(table.organizationId),
  ],
);

/* ═══ PRODUCT / TECHNOLOGY ═══ */

export const controlProjects = pgTable(
  "control_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    ownerMembershipId: uuid("owner_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    sponsorMembershipId: uuid("sponsor_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    status: controlProjectStatusEnum("status").notNull().default("proposed"),
    startAt: timestamp("start_at", { withTimezone: true, mode: "date" }),
    targetEndAt: timestamp("target_end_at", { withTimezone: true, mode: "date" }),
    budgetId: uuid("budget_id").references(() => internalBudgets.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    index("control_projects_org_idx").on(table.organizationId),
    index("control_projects_org_status_idx").on(table.organizationId, table.status),
  ],
);

export const productRoadmaps = pgTable(
  "product_roadmaps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [index("product_roadmaps_org_idx").on(table.organizationId)],
);

export const roadmapItems = pgTable(
  "roadmap_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roadmapId: uuid("roadmap_id")
      .notNull()
      .references(() => productRoadmaps.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    type: roadmapItemTypeEnum("type").notNull().default("feature"),
    priority: roadmapItemPriorityEnum("priority").notNull().default("medium"),
    status: roadmapItemStatusEnum("status").notNull().default("proposed"),
    targetQuarter: text("target_quarter"),
    ownerMembershipId: uuid("owner_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    productArea: text("product_area"),
    linkedProjectId: uuid("linked_project_id").references(() => controlProjects.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    index("roadmap_items_roadmap_idx").on(table.roadmapId),
    index("roadmap_items_status_idx").on(table.roadmapId, table.status),
  ],
);

export const productReleases = pgTable(
  "product_releases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    name: text("name"),
    environment: text("environment"),
    status: productReleaseStatusEnum("status").notNull().default("planned"),
    plannedAt: timestamp("planned_at", { withTimezone: true, mode: "date" }),
    releasedAt: timestamp("released_at", { withTimezone: true, mode: "date" }),
    notes: text("notes"),
    commitReference: text("commit_reference"),
    deploymentReference: text("deployment_reference"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("product_releases_org_version_unique").on(table.organizationId, table.version),
    index("product_releases_org_idx").on(table.organizationId),
  ],
);

export const productBugs = pgTable(
  "product_bugs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    severity: productBugSeverityEnum("severity").notNull().default("medium"),
    priority: roadmapItemPriorityEnum("priority").notNull().default("medium"),
    status: productBugStatusEnum("status").notNull().default("open"),
    environment: text("environment"),
    reporterMembershipId: uuid("reporter_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    ownerMembershipId: uuid("owner_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    reproductionSteps: text("reproduction_steps"),
    fixedInReleaseId: uuid("fixed_in_release_id").references(() => productReleases.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    index("product_bugs_org_idx").on(table.organizationId),
    index("product_bugs_org_status_idx").on(table.organizationId, table.status),
  ],
);

export const technologyIncidents = pgTable(
  "technology_incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    severity: technologyIncidentSeverityEnum("severity").notNull().default("sev3"),
    title: text("title").notNull(),
    description: text("description"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    detectedAt: timestamp("detected_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
    status: technologyIncidentStatusEnum("status").notNull().default("open"),
    impact: text("impact"),
    rootCause: text("root_cause"),
    postmortemDocumentId: uuid("postmortem_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    index("technology_incidents_org_idx").on(table.organizationId),
    index("technology_incidents_org_status_idx").on(table.organizationId, table.status),
  ],
);

export const productFeatures = pgTable(
  "product_features",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    ownerMembershipId: uuid("owner_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    status: productFeatureStatusEnum("status").notNull().default("discovery"),
    releaseId: uuid("release_id").references(() => productReleases.id, { onDelete: "set null" }),
    featureFlagKey: text("feature_flag_key"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("product_features_org_key_unique").on(table.organizationId, table.key),
    index("product_features_org_idx").on(table.organizationId),
  ],
);

/* ═══ Relations ═══ */

export const controlGoalsRelations = relations(controlGoals, ({ one }) => ({
  organization: one(organizations, {
    fields: [controlGoals.organizationId],
    references: [organizations.id],
  }),
}));

export const controlKpisRelations = relations(controlKpis, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [controlKpis.organizationId],
    references: [organizations.id],
  }),
  snapshots: many(controlKpiSnapshots),
}));

export const controlKpiSnapshotsRelations = relations(controlKpiSnapshots, ({ one }) => ({
  kpi: one(controlKpis, { fields: [controlKpiSnapshots.kpiId], references: [controlKpis.id] }),
}));

export const controlApprovalRequestsRelations = relations(
  controlApprovalRequests,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [controlApprovalRequests.organizationId],
      references: [organizations.id],
    }),
    decisions: many(controlApprovalDecisions),
  }),
);

export const controlApprovalDecisionsRelations = relations(controlApprovalDecisions, ({ one }) => ({
  request: one(controlApprovalRequests, {
    fields: [controlApprovalDecisions.requestId],
    references: [controlApprovalRequests.id],
  }),
}));

export const controlDepartmentsRelations = relations(controlDepartments, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [controlDepartments.organizationId],
    references: [organizations.id],
  }),
  positions: many(controlPositions),
  employees: many(controlEmployees),
}));

export const controlPositionsRelations = relations(controlPositions, ({ one }) => ({
  department: one(controlDepartments, {
    fields: [controlPositions.departmentId],
    references: [controlDepartments.id],
  }),
  organization: one(organizations, {
    fields: [controlPositions.organizationId],
    references: [organizations.id],
  }),
}));

export const controlEmployeesRelations = relations(controlEmployees, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [controlEmployees.organizationId],
    references: [organizations.id],
  }),
  department: one(controlDepartments, {
    fields: [controlEmployees.departmentId],
    references: [controlDepartments.id],
  }),
  position: one(controlPositions, {
    fields: [controlEmployees.positionId],
    references: [controlPositions.id],
  }),
  user: one(users, { fields: [controlEmployees.userId], references: [users.id] }),
  contractLinks: many(employeeContractLinks),
  onboardingPlans: many(employeeOnboardingPlans),
  leaveRequests: many(employeeLeaveRequests),
}));

export const employeeContractLinksRelations = relations(employeeContractLinks, ({ one }) => ({
  employee: one(controlEmployees, {
    fields: [employeeContractLinks.employeeId],
    references: [controlEmployees.id],
  }),
  contract: one(contracts, {
    fields: [employeeContractLinks.contractId],
    references: [contracts.id],
  }),
}));

export const employeeOnboardingPlansRelations = relations(
  employeeOnboardingPlans,
  ({ one, many }) => ({
    employee: one(controlEmployees, {
      fields: [employeeOnboardingPlans.employeeId],
      references: [controlEmployees.id],
    }),
    items: many(employeeOnboardingItems),
  }),
);

export const employeeOnboardingItemsRelations = relations(employeeOnboardingItems, ({ one }) => ({
  plan: one(employeeOnboardingPlans, {
    fields: [employeeOnboardingItems.planId],
    references: [employeeOnboardingPlans.id],
  }),
}));

export const costCentersRelations = relations(costCenters, ({ one }) => ({
  organization: one(organizations, {
    fields: [costCenters.organizationId],
    references: [organizations.id],
  }),
  department: one(controlDepartments, {
    fields: [costCenters.departmentId],
    references: [controlDepartments.id],
  }),
}));

export const internalBudgetsRelations = relations(internalBudgets, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [internalBudgets.organizationId],
    references: [organizations.id],
  }),
  lines: many(internalBudgetLines),
}));

export const internalBudgetLinesRelations = relations(internalBudgetLines, ({ one }) => ({
  budget: one(internalBudgets, {
    fields: [internalBudgetLines.budgetId],
    references: [internalBudgets.id],
  }),
  costCenter: one(costCenters, {
    fields: [internalBudgetLines.costCenterId],
    references: [costCenters.id],
  }),
}));

export const expenseReportsRelations = relations(expenseReports, ({ one, many }) => ({
  employee: one(controlEmployees, {
    fields: [expenseReports.employeeId],
    references: [controlEmployees.id],
  }),
  costCenter: one(costCenters, {
    fields: [expenseReports.costCenterId],
    references: [costCenters.id],
  }),
  items: many(expenseReportItems),
}));

export const expenseReportItemsRelations = relations(expenseReportItems, ({ one }) => ({
  report: one(expenseReports, {
    fields: [expenseReportItems.expenseReportId],
    references: [expenseReports.id],
  }),
}));

export const controlVendorsRelations = relations(controlVendors, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [controlVendors.organizationId],
    references: [organizations.id],
  }),
  slas: many(vendorSlas),
  reviews: many(vendorReviews),
}));

export const vendorSlasRelations = relations(vendorSlas, ({ one, many }) => ({
  vendor: one(controlVendors, { fields: [vendorSlas.vendorId], references: [controlVendors.id] }),
  results: many(vendorSlaResults),
}));

export const vendorSlaResultsRelations = relations(vendorSlaResults, ({ one }) => ({
  sla: one(vendorSlas, { fields: [vendorSlaResults.slaId], references: [vendorSlas.id] }),
}));

export const productRoadmapsRelations = relations(productRoadmaps, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [productRoadmaps.organizationId],
    references: [organizations.id],
  }),
  items: many(roadmapItems),
}));

export const roadmapItemsRelations = relations(roadmapItems, ({ one }) => ({
  roadmap: one(productRoadmaps, {
    fields: [roadmapItems.roadmapId],
    references: [productRoadmaps.id],
  }),
  linkedProject: one(controlProjects, {
    fields: [roadmapItems.linkedProjectId],
    references: [controlProjects.id],
  }),
}));

export const controlProjectsRelations = relations(controlProjects, ({ one }) => ({
  organization: one(organizations, {
    fields: [controlProjects.organizationId],
    references: [organizations.id],
  }),
  budget: one(internalBudgets, {
    fields: [controlProjects.budgetId],
    references: [internalBudgets.id],
  }),
}));

export const complianceRisksRelations = relations(complianceRisks, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [complianceRisks.organizationId],
    references: [organizations.id],
  }),
  controls: many(complianceControls),
}));

export const complianceControlsRelations = relations(complianceControls, ({ one }) => ({
  risk: one(complianceRisks, {
    fields: [complianceControls.riskId],
    references: [complianceRisks.id],
  }),
}));

export const complianceAuditsRelations = relations(complianceAudits, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [complianceAudits.organizationId],
    references: [organizations.id],
  }),
  findings: many(complianceAuditFindings),
}));

export const complianceAuditFindingsRelations = relations(complianceAuditFindings, ({ one }) => ({
  audit: one(complianceAudits, {
    fields: [complianceAuditFindings.auditId],
    references: [complianceAudits.id],
  }),
}));

export const internalDueDiligenceCasesRelations = relations(
  internalDueDiligenceCases,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [internalDueDiligenceCases.organizationId],
      references: [organizations.id],
    }),
    checklists: many(dueDiligenceChecklists),
  }),
);

export const dueDiligenceChecklistsRelations = relations(
  dueDiligenceChecklists,
  ({ one, many }) => ({
    case: one(internalDueDiligenceCases, {
      fields: [dueDiligenceChecklists.caseId],
      references: [internalDueDiligenceCases.id],
    }),
    items: many(dueDiligenceItems),
  }),
);
