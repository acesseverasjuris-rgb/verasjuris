import { z } from "zod";

const uuid = z.string().uuid("O identificador não é válido.");
const optionalUuid = uuid.optional();
const datetime = z.string().datetime({ offset: true });
const optionalDatetime = datetime.optional();
const cents = z
  .number()
  .int("Informe um valor inteiro em centavos.")
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);
const listPagination = {
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  q: z.string().trim().max(120).optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
};

export const CONTROL_GOAL_STATUSES = [
  "draft",
  "active",
  "at_risk",
  "achieved",
  "missed",
  "cancelled",
  "archived",
] as const;

export const CONTROL_APPROVAL_STATUSES = [
  "pending",
  "partially_approved",
  "approved",
  "rejected",
  "cancelled",
  "expired",
] as const;

export const CONTROL_APPROVAL_DECISIONS = ["approved", "rejected"] as const;

export const CONTROL_EMPLOYEE_STATUSES = [
  "preboarding",
  "active",
  "on_leave",
  "suspended",
  "terminated",
  "archived",
] as const;

export const CONTROL_EMPLOYMENT_TYPES = [
  "employee",
  "intern",
  "contractor",
  "partner",
  "temporary",
  "other",
] as const;

export const CONTROL_LEAVE_TYPES = [
  "vacation",
  "medical",
  "personal",
  "parental",
  "other",
] as const;

export const CONTROL_LEAVE_STATUSES = [
  "draft",
  "requested",
  "approved",
  "rejected",
  "cancelled",
  "taken",
] as const;

export const CONTROL_BUDGET_STATUSES = [
  "draft",
  "under_review",
  "approved",
  "revised",
  "closed",
] as const;

export const CONTROL_EXPENSE_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "reimbursed",
] as const;

export const CONTROL_IP_TYPES = [
  "trademark",
  "patent",
  "software",
  "domain",
  "copyright",
  "trade_secret",
  "design",
  "other",
] as const;

export const CONTROL_IP_STATUSES = [
  "draft",
  "filed",
  "pending",
  "registered",
  "rejected",
  "expired",
  "abandoned",
] as const;

export const CONTROL_POLICY_STATUSES = [
  "draft",
  "under_review",
  "approved",
  "active",
  "superseded",
  "archived",
] as const;

export const CONTROL_RISK_CATEGORIES = [
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
] as const;

export const CONTROL_INCIDENT_TYPES = [
  "privacy",
  "security",
  "fraud",
  "financial",
  "regulatory",
  "operational",
  "vendor",
  "ai",
  "other",
] as const;

export const CONTROL_INCIDENT_STATUSES = [
  "open",
  "triaged",
  "investigating",
  "contained",
  "remediating",
  "monitoring",
  "closed",
] as const;

export const CONTROL_VENDOR_STATUSES = [
  "prospect",
  "under_review",
  "approved",
  "active",
  "suspended",
  "terminated",
  "archived",
] as const;

export const CONTROL_ROADMAP_ITEM_TYPES = [
  "feature",
  "improvement",
  "tech_debt",
  "bug",
  "security",
  "compliance",
  "infrastructure",
] as const;

export const CONTROL_BUG_STATUSES = [
  "open",
  "triaged",
  "in_progress",
  "blocked",
  "fixed",
  "verified",
  "closed",
  "wont_fix",
] as const;

export const CONTROL_RELEASE_STATUSES = [
  "planned",
  "ready",
  "deploying",
  "released",
  "failed",
  "rolled_back",
  "cancelled",
] as const;

export const CONTROL_PROJECT_STATUSES = [
  "proposed",
  "approved",
  "active",
  "at_risk",
  "blocked",
  "completed",
  "cancelled",
] as const;

export const CONTROL_KPI_DIRECTIONS = [
  "higher_is_better",
  "lower_is_better",
  "target_range",
] as const;

export const CONTROL_KPI_SOURCE_TYPES = ["internal_query", "manual", "external_provider"] as const;

/** —— Diretoria —— */

export const createControlGoalSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).optional(),
  ownerMembershipId: optionalUuid,
  area: z.string().trim().max(120).optional(),
  periodStart: datetime,
  periodEnd: datetime,
  targetType: z.string().trim().min(1).max(60),
  targetValue: z.string().trim().max(120).optional(),
  currentValueSource: z.string().trim().max(120).optional(),
  status: z.enum(CONTROL_GOAL_STATUSES).optional(),
});

export const updateControlGoalSchema = createControlGoalSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const controlGoalListQuerySchema = z.object({
  ...listPagination,
  status: z.enum(CONTROL_GOAL_STATUSES).optional(),
  area: z.string().trim().max(120).optional(),
  ownerMembershipId: optionalUuid,
  sort: z.enum(["createdAt", "updatedAt", "periodEnd", "title"]).default("updatedAt"),
});

export const createControlKpiSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/, "Informe uma chave válida."),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional(),
  unit: z.string().trim().max(40).optional(),
  direction: z.enum(CONTROL_KPI_DIRECTIONS).default("higher_is_better"),
  sourceType: z.enum(CONTROL_KPI_SOURCE_TYPES).default("internal_query"),
  sourceConfig: z.record(z.unknown()).optional(),
  targetValue: z.string().trim().max(120).optional(),
  warningThreshold: z.string().trim().max(120).optional(),
  criticalThreshold: z.string().trim().max(120).optional(),
  active: z.boolean().optional(),
});

export const updateControlKpiSchema = createControlKpiSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const controlKpiListQuerySchema = z.object({
  ...listPagination,
  active: z.coerce.boolean().optional(),
  sourceType: z.enum(CONTROL_KPI_SOURCE_TYPES).optional(),
  sort: z.enum(["createdAt", "name", "key"]).default("name"),
});

export const createControlApprovalRequestSchema = z.object({
  type: z.string().trim().min(1).max(80),
  referenceType: z.string().trim().min(1).max(80),
  referenceId: uuid,
  approverPolicy: z.enum(["single", "sequential", "parallel", "threshold"]).default("single"),
  comment: z.string().trim().max(2000).optional(),
});

export const decideControlApprovalSchema = z.object({
  decision: z.enum(CONTROL_APPROVAL_DECISIONS),
  comment: z.string().trim().max(2000).optional(),
});

export const controlApprovalListQuerySchema = z.object({
  ...listPagination,
  status: z.enum(CONTROL_APPROVAL_STATUSES).optional(),
  type: z.string().trim().max(80).optional(),
  referenceType: z.string().trim().max(80).optional(),
  sort: z.enum(["requestedAt", "decidedAt", "createdAt"]).default("requestedAt"),
});

/** —— RH —— */

export const createControlDepartmentSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(1).max(40).optional(),
  description: z.string().trim().max(1000).optional(),
  active: z.boolean().optional(),
});

export const updateControlDepartmentSchema = createControlDepartmentSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createControlPositionSchema = z.object({
  departmentId: uuid,
  title: z.string().trim().min(2).max(160),
  level: z.string().trim().max(60).optional(),
  description: z.string().trim().max(2000).optional(),
  responsibilities: z.string().trim().max(4000).optional(),
  active: z.boolean().optional(),
});

export const updateControlPositionSchema = createControlPositionSchema
  .partial()
  .omit({ departmentId: true })
  .extend({ departmentId: optionalUuid })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createControlEmployeeSchema = z.object({
  userId: optionalUuid,
  employeeCode: z.string().trim().min(1).max(60),
  fullName: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(40).optional(),
  status: z.enum(CONTROL_EMPLOYEE_STATUSES).optional(),
  hiredAt: datetime,
  terminatedAt: optionalDatetime,
  managerEmployeeId: optionalUuid,
  departmentId: uuid,
  positionId: uuid,
  employmentType: z.enum(CONTROL_EMPLOYMENT_TYPES).default("employee"),
});

export const updateControlEmployeeSchema = createControlEmployeeSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const controlEmployeeListQuerySchema = z.object({
  ...listPagination,
  status: z.enum(CONTROL_EMPLOYEE_STATUSES).optional(),
  departmentId: optionalUuid,
  positionId: optionalUuid,
  employmentType: z.enum(CONTROL_EMPLOYMENT_TYPES).optional(),
  managerEmployeeId: optionalUuid,
  sort: z.enum(["createdAt", "fullName", "hiredAt", "employeeCode"]).default("fullName"),
});

export const createEmployeeLeaveRequestSchema = z.object({
  employeeId: uuid,
  type: z.enum(CONTROL_LEAVE_TYPES),
  startAt: datetime,
  endAt: datetime,
  reason: z.string().trim().max(2000).optional(),
  status: z.enum(["draft", "requested"]).optional(),
});

export const updateEmployeeLeaveRequestSchema = z
  .object({
    type: z.enum(CONTROL_LEAVE_TYPES).optional(),
    startAt: optionalDatetime,
    endAt: optionalDatetime,
    reason: z.string().trim().max(2000).nullable().optional(),
    status: z.enum(CONTROL_LEAVE_STATUSES).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const decideEmployeeLeaveSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  comment: z.string().trim().max(2000).optional(),
});

export const createEmployeePerformanceReviewSchema = z.object({
  employeeId: uuid,
  periodStart: datetime,
  periodEnd: datetime,
  reviewerEmployeeId: uuid,
  overallScore: z.number().int().min(0).max(10_000).optional(),
  reviewScaleMax: z.number().int().min(1).max(10_000).default(5),
  strengths: z.string().trim().max(4000).optional(),
  improvements: z.string().trim().max(4000).optional(),
  goals: z.string().trim().max(4000).optional(),
});

export const updateEmployeePerformanceReviewSchema = createEmployeePerformanceReviewSchema
  .partial()
  .omit({ employeeId: true })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

/** —— Financeiro interno —— */

export const createCostCenterSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(2).max(160),
  departmentId: optionalUuid,
  managerMembershipId: optionalUuid,
  active: z.boolean().optional(),
});

export const updateCostCenterSchema = createCostCenterSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createInternalBudgetSchema = z.object({
  fiscalYear: z.number().int().min(2000).max(2100),
  version: z.number().int().min(1).max(1000).default(1),
  status: z.enum(CONTROL_BUDGET_STATUSES).optional(),
  notes: z.string().trim().max(4000).optional(),
});

export const updateInternalBudgetSchema = z
  .object({
    status: z.enum(CONTROL_BUDGET_STATUSES).optional(),
    notes: z.string().trim().max(4000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createInternalBudgetLineSchema = z.object({
  budgetId: uuid,
  costCenterId: uuid,
  category: z.string().trim().min(1).max(120),
  period: z.string().trim().min(1).max(40),
  plannedAmountCents: cents,
  notes: z.string().trim().max(2000).optional(),
});

export const updateInternalBudgetLineSchema = createInternalBudgetLineSchema
  .partial()
  .omit({ budgetId: true })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const internalBudgetListQuerySchema = z.object({
  ...listPagination,
  fiscalYear: z.coerce.number().int().min(2000).max(2100).optional(),
  status: z.enum(CONTROL_BUDGET_STATUSES).optional(),
  sort: z.enum(["createdAt", "fiscalYear", "version"]).default("fiscalYear"),
});

export const createExpenseReportSchema = z.object({
  employeeId: uuid,
  costCenterId: uuid,
  period: z.string().trim().min(1).max(40),
  notes: z.string().trim().max(2000).optional(),
});

export const updateExpenseReportSchema = z
  .object({
    costCenterId: optionalUuid,
    period: z.string().trim().min(1).max(40).optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    status: z.enum(CONTROL_EXPENSE_STATUSES).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createExpenseReportItemSchema = z.object({
  expenseReportId: uuid,
  category: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000),
  amountCents: cents.refine((v) => v > 0, "Informe um valor positivo."),
  incurredAt: datetime,
  documentId: optionalUuid,
});

export const updateExpenseReportItemSchema = createExpenseReportItemSchema
  .partial()
  .omit({ expenseReportId: true })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const expenseReportListQuerySchema = z.object({
  ...listPagination,
  employeeId: optionalUuid,
  costCenterId: optionalUuid,
  status: z.enum(CONTROL_EXPENSE_STATUSES).optional(),
  sort: z.enum(["createdAt", "submittedAt", "totalCents"]).default("createdAt"),
});

/** —— Jurídico interno —— */

export const createIntellectualPropertySchema = z.object({
  type: z.enum(CONTROL_IP_TYPES),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).optional(),
  status: z.enum(CONTROL_IP_STATUSES).optional(),
  registrationNumber: z.string().trim().max(120).optional(),
  ownerMembershipId: optionalUuid,
  filedAt: optionalDatetime,
  expiresAt: optionalDatetime,
});

export const updateIntellectualPropertySchema = createIntellectualPropertySchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createInternalDueDiligenceSchema = z.object({
  subjectType: z.string().trim().min(1).max(80),
  subjectId: uuid,
  type: z.string().trim().min(1).max(80),
  ownerMembershipId: optionalUuid,
  notes: z.string().trim().max(4000).optional(),
});

export const updateInternalDueDiligenceSchema = z
  .object({
    type: z.string().trim().min(1).max(80).optional(),
    status: z.string().trim().max(40).optional(),
    ownerMembershipId: optionalUuid.nullable(),
    notes: z.string().trim().max(4000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createInternalPolicySchema = z.object({
  title: z.string().trim().min(2).max(200),
  category: z.string().trim().min(1).max(80),
  version: z.string().trim().min(1).max(40).default("1"),
  status: z.enum(CONTROL_POLICY_STATUSES).optional(),
  effectiveAt: optionalDatetime,
  reviewAt: optionalDatetime,
  ownerMembershipId: optionalUuid,
  documentId: optionalUuid,
  summary: z.string().trim().max(4000).optional(),
});

export const updateInternalPolicySchema = createInternalPolicySchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

/** —— Compliance —— */

export const createComplianceRiskSchema = z.object({
  category: z.enum(CONTROL_RISK_CATEGORIES),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).optional(),
  ownerMembershipId: optionalUuid,
  likelihood: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  status: z.string().trim().max(40).optional(),
  reviewAt: optionalDatetime,
});

export const updateComplianceRiskSchema = createComplianceRiskSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createComplianceControlSchema = z.object({
  riskId: optionalUuid,
  code: z.string().trim().min(1).max(60),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).optional(),
  controlType: z.enum(["preventive", "detective", "corrective", "compensating"]),
  ownerMembershipId: optionalUuid,
  frequency: z.string().trim().max(60).optional(),
  status: z.string().trim().max(40).optional(),
  nextTestAt: optionalDatetime,
});

export const updateComplianceControlSchema = createComplianceControlSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createComplianceIncidentSchema = z.object({
  type: z.enum(CONTROL_INCIDENT_TYPES),
  severity: z.enum(["sev1", "sev2", "sev3", "sev4", "low", "medium", "high", "critical"]),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(8000).optional(),
  detectedAt: datetime,
  ownerMembershipId: optionalUuid,
  status: z.enum(CONTROL_INCIDENT_STATUSES).optional(),
});

export const updateComplianceIncidentSchema = createComplianceIncidentSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createComplianceAuditSchema = z.object({
  type: z.enum([
    "internal",
    "external",
    "regulatory",
    "vendor",
    "security",
    "financial",
    "privacy",
  ]),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).optional(),
  ownerMembershipId: optionalUuid,
  plannedAt: optionalDatetime,
  startedAt: optionalDatetime,
});

export const updateComplianceAuditSchema = createComplianceAuditSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createComplianceObligationSchema = z.object({
  title: z.string().trim().min(2).max(200),
  source: z.string().trim().max(200).optional(),
  authority: z.string().trim().max(200).optional(),
  frequency: z.string().trim().max(60).optional(),
  dueAt: optionalDatetime,
  ownerMembershipId: optionalUuid,
  evidenceDocumentId: optionalUuid,
  status: z.string().trim().max(40).optional(),
});

export const updateComplianceObligationSchema = createComplianceObligationSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const complianceRiskListQuerySchema = z.object({
  ...listPagination,
  category: z.enum(CONTROL_RISK_CATEGORIES).optional(),
  status: z.string().trim().max(40).optional(),
  sort: z.enum(["createdAt", "reviewAt", "title"]).default("createdAt"),
});

export const complianceIncidentListQuerySchema = z.object({
  ...listPagination,
  type: z.enum(CONTROL_INCIDENT_TYPES).optional(),
  status: z.enum(CONTROL_INCIDENT_STATUSES).optional(),
  severity: z.string().trim().max(20).optional(),
  sort: z.enum(["detectedAt", "createdAt", "closedAt"]).default("detectedAt"),
});

/** —— Fornecedores —— */

export const createControlVendorSchema = z.object({
  legalName: z.string().trim().min(2).max(200),
  tradeName: z.string().trim().max(200).optional(),
  taxId: z.string().trim().max(40).optional(),
  category: z.string().trim().max(80).optional(),
  status: z.enum(CONTROL_VENDOR_STATUSES).optional(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  contactEmail: z.string().trim().email().max(320).optional(),
  contactPhone: z.string().trim().max(40).optional(),
  onboardingStatus: z.string().trim().max(40).optional(),
});

export const updateControlVendorSchema = createControlVendorSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const controlVendorListQuerySchema = z.object({
  ...listPagination,
  status: z.enum(CONTROL_VENDOR_STATUSES).optional(),
  category: z.string().trim().max(80).optional(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  sort: z.enum(["createdAt", "legalName", "status"]).default("legalName"),
});

export const createVendorSlaSchema = z.object({
  vendorId: uuid,
  contractId: optionalUuid,
  metric: z.string().trim().min(1).max(120),
  target: z.string().trim().min(1).max(120),
  measurement: z.string().trim().max(200).optional(),
  period: z.string().trim().max(40).optional(),
  status: z.string().trim().max(40).optional(),
});

export const updateVendorSlaSchema = createVendorSlaSchema
  .partial()
  .omit({ vendorId: true })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createVendorReviewSchema = z.object({
  vendorId: uuid,
  period: z.string().trim().min(1).max(40),
  qualityScore: z.number().int().min(0).max(100).optional(),
  deadlineScore: z.number().int().min(0).max(100).optional(),
  costScore: z.number().int().min(0).max(100).optional(),
  securityScore: z.number().int().min(0).max(100).optional(),
  complianceScore: z.number().int().min(0).max(100).optional(),
  supportScore: z.number().int().min(0).max(100).optional(),
  notes: z.string().trim().max(4000).optional(),
});

/** —— Produto —— */

export const createProductRoadmapSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(4000).optional(),
  periodLabel: z.string().trim().max(40).optional(),
  active: z.boolean().optional(),
});

export const updateProductRoadmapSchema = createProductRoadmapSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createRoadmapItemSchema = z.object({
  roadmapId: uuid,
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).optional(),
  type: z.enum(CONTROL_ROADMAP_ITEM_TYPES),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  status: z.string().trim().max(40).optional(),
  targetQuarter: z.string().trim().max(20).optional(),
  ownerMembershipId: optionalUuid,
  productArea: z.string().trim().max(120).optional(),
  linkedProjectId: optionalUuid,
});

export const updateRoadmapItemSchema = createRoadmapItemSchema
  .partial()
  .omit({ roadmapId: true })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createProductBugSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(8000).optional(),
  severity: z.enum(["sev1", "sev2", "sev3", "sev4", "low", "medium", "high", "critical"]),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  status: z.enum(CONTROL_BUG_STATUSES).optional(),
  environment: z.string().trim().max(80).optional(),
  ownerMembershipId: optionalUuid,
  reproductionSteps: z.string().trim().max(8000).optional(),
  fixedInReleaseId: optionalUuid,
});

export const updateProductBugSchema = createProductBugSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createTechnologyIncidentSchema = z.object({
  severity: z.enum(["sev1", "sev2", "sev3", "sev4"]),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(8000).optional(),
  startedAt: datetime,
  detectedAt: optionalDatetime,
  impact: z.string().trim().max(4000).optional(),
  ownerMembershipId: optionalUuid,
});

export const updateTechnologyIncidentSchema = createTechnologyIncidentSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createProductReleaseSchema = z.object({
  version: z.string().trim().min(1).max(60),
  name: z.string().trim().max(160).optional(),
  environment: z.string().trim().max(80).optional(),
  status: z.enum(CONTROL_RELEASE_STATUSES).optional(),
  plannedAt: optionalDatetime,
  notes: z.string().trim().max(4000).optional(),
  commitReference: z.string().trim().max(120).optional(),
});

export const updateProductReleaseSchema = createProductReleaseSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createProductFeatureSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/, "Informe uma chave válida."),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(4000).optional(),
  ownerMembershipId: optionalUuid,
  status: z
    .enum([
      "discovery",
      "planned",
      "in_development",
      "testing",
      "released",
      "deprecated",
      "retired",
    ])
    .optional(),
  releaseId: optionalUuid,
  featureFlagKey: z.string().trim().max(120).optional(),
});

export const updateProductFeatureSchema = createProductFeatureSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createControlProjectSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).optional(),
  ownerMembershipId: optionalUuid,
  sponsorMembershipId: optionalUuid,
  status: z.enum(CONTROL_PROJECT_STATUSES).optional(),
  startAt: optionalDatetime,
  targetEndAt: optionalDatetime,
  budgetId: optionalUuid,
});

export const updateControlProjectSchema = createControlProjectSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const controlProjectListQuerySchema = z.object({
  ...listPagination,
  status: z.enum(CONTROL_PROJECT_STATUSES).optional(),
  ownerMembershipId: optionalUuid,
  sort: z.enum(["createdAt", "title", "targetEndAt"]).default("createdAt"),
});

export const productBugListQuerySchema = z.object({
  ...listPagination,
  status: z.enum(CONTROL_BUG_STATUSES).optional(),
  severity: z.string().trim().max(20).optional(),
  sort: z.enum(["createdAt", "severity", "priority", "title"]).default("createdAt"),
});
