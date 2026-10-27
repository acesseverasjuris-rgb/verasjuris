import { z } from "zod";

const uuid = z.string().uuid("O identificador não é válido.");
const optionalUuid = uuid.optional();
const nullableUuid = uuid.nullable().optional();
const datetime = z.string().datetime({ offset: true });
const optionalDatetime = datetime.optional();
const nullableDatetime = datetime.nullable().optional();
const cents = z
  .number()
  .int("Informe um valor inteiro em centavos.")
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);
const competence = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Informe a competência no formato YYYY-MM.");

export const LABOR_CLIENT_ROLES = ["employee", "employer", "other"] as const;
export const LABOR_CASE_STATUSES = ["draft", "active", "suspended", "closed", "archived"] as const;
export const EMPLOYMENT_CONTRACT_STATUSES = [
  "draft",
  "active",
  "suspended",
  "terminated",
  "cancelled",
  "archived",
] as const;
export const LABOR_CALCULATION_STATUSES = [
  "draft",
  "calculated",
  "review_required",
  "reviewed",
  "approved",
  "superseded",
] as const;
export const LABOR_LIQUIDATION_STATUSES = [
  "draft",
  "calculated",
  "review_required",
  "reviewed",
  "approved",
  "superseded",
  "cancelled",
] as const;
export const LABOR_REMUNERATION_ITEM_TYPES = [
  "salary",
  "commission",
  "gratification",
  "additional",
  "bonus",
  "tip",
  "variable",
  "benefit",
  "deduction",
  "other",
] as const;

export const createLaborCaseSchema = z.object({
  clientId: uuid,
  legalMatterId: uuid,
  judicialProcessId: optionalUuid,
  responsibleMembershipId: optionalUuid,
  clientRole: z.enum(LABOR_CLIENT_ROLES).default("employee"),
  status: z.enum(LABOR_CASE_STATUSES).default("draft"),
  notes: z.string().trim().max(8000).optional(),
});

export const updateLaborCaseSchema = createLaborCaseSchema
  .omit({ clientId: true, legalMatterId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createEmploymentContractSchema = z.object({
  laborCaseId: uuid,
  employeeClientId: optionalUuid,
  employerName: z.string().trim().min(1).max(200),
  employerDocument: z.string().trim().max(40).optional(),
  admissionDate: datetime,
  terminationDate: nullableDatetime,
  contractType: z.string().trim().max(80).optional(),
  jobTitle: z.string().trim().max(160).optional(),
  workplace: z.string().trim().max(300).optional(),
  salaryCents: cents.default(0),
  remunerationStructure: z.record(z.string(), z.unknown()).optional(),
  weeklyHours: z.number().int().min(0).max(168).optional(),
  status: z.enum(EMPLOYMENT_CONTRACT_STATUSES).default("draft"),
  source: z.enum(["manual", "document", "import", "provider", "not_configured"]).default("manual"),
});

export const updateEmploymentContractSchema = createEmploymentContractSchema
  .omit({ laborCaseId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createEmploymentContractHistorySchema = z.object({
  contractId: uuid,
  kind: z
    .enum([
      "job_title",
      "salary",
      "schedule",
      "workplace",
      "suspension",
      "leave",
      "contract_change",
      "other",
    ])
    .default("other"),
  effectiveFrom: datetime,
  effectiveTo: nullableDatetime,
  previousValue: z.record(z.string(), z.unknown()).optional(),
  newValue: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().trim().max(4000).optional(),
  source: z.enum(["manual", "document", "import", "provider", "not_configured"]).default("manual"),
  documentId: optionalUuid,
});

export const createWorkScheduleSchema = z.object({
  laborCaseId: uuid,
  contractId: optionalUuid,
  name: z.string().trim().min(1).max(160),
  weeklyHours: z.number().int().min(0).max(168).optional(),
  schedulePattern: z.record(z.string(), z.unknown()).optional(),
  includesNightShift: z.boolean().optional(),
  includesOvertimeBank: z.boolean().optional(),
  effectiveFrom: optionalDatetime,
  effectiveTo: nullableDatetime,
  notes: z.string().trim().max(4000).optional(),
});

export const createWorkTimeRecordSchema = z.object({
  laborCaseId: uuid,
  contractId: optionalUuid,
  scheduleId: optionalUuid,
  workDate: datetime,
  clockInAt: optionalDatetime,
  clockOutAt: optionalDatetime,
  breakMinutes: z
    .number()
    .int()
    .min(0)
    .max(24 * 60)
    .optional(),
  overtimeMinutes: z
    .number()
    .int()
    .min(0)
    .max(24 * 60)
    .optional(),
  nightMinutes: z
    .number()
    .int()
    .min(0)
    .max(24 * 60)
    .optional(),
  notes: z.string().trim().max(2000).optional(),
  source: z.enum(["manual", "import", "provider", "not_configured"]).default("manual"),
});

export const createLaborRemunerationItemSchema = z.object({
  laborCaseId: uuid,
  contractId: optionalUuid,
  itemType: z.enum(LABOR_REMUNERATION_ITEM_TYPES).default("other"),
  description: z.string().trim().min(1).max(300),
  competence: competence.optional(),
  amountCents: cents.default(0),
  isCredit: z.boolean().default(true),
  source: z.enum(["manual", "document", "import", "provider", "not_configured"]).default("manual"),
  documentId: optionalUuid,
});

export const createVacationPeriodSchema = z.object({
  laborCaseId: uuid,
  contractId: optionalUuid,
  accrualStart: datetime,
  accrualEnd: datetime,
  concessionStart: optionalDatetime,
  concessionEnd: optionalDatetime,
  enjoyedDays: z.number().int().min(0).max(365).default(0),
  soldDays: z.number().int().min(0).max(30).default(0),
  paymentDate: optionalDatetime,
  amountCents: cents.optional(),
  status: z
    .enum(["accruing", "available", "scheduled", "enjoyed", "sold", "paid", "cancelled"])
    .default("accruing"),
  notes: z.string().trim().max(4000).optional(),
});

export const createFgtsRecordSchema = z.object({
  laborCaseId: uuid,
  contractId: optionalUuid,
  competence,
  baseAmountCents: cents.default(0),
  dueAmountCents: cents.default(0),
  paidAmountCents: cents.optional(),
  paymentDate: optionalDatetime,
  source: z.enum(["manual", "document", "import", "provider", "not_configured"]).default("manual"),
  reviewStatus: z
    .enum(["unreviewed", "accepted", "rejected", "needs_review"])
    .default("unreviewed"),
  notes: z.string().trim().max(2000).optional(),
});

export const createEmploymentTerminationSchema = z.object({
  laborCaseId: uuid,
  contractId: uuid,
  terminationType: z.string().trim().min(1).max(80),
  noticeType: z.string().trim().max(80).optional(),
  noticeStart: optionalDatetime,
  noticeEnd: optionalDatetime,
  terminationDate: datetime,
  reason: z.string().trim().max(2000).optional(),
  lastSalaryCents: cents.optional(),
  status: z
    .enum(["draft", "calculated", "review_required", "reviewed", "finalized", "cancelled"])
    .default("draft"),
  source: z.enum(["manual", "document", "import", "provider", "not_configured"]).default("manual"),
  documentId: optionalUuid,
});

export const createLaborClaimItemSchema = z.object({
  laborCaseId: uuid,
  claimType: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(8000).optional(),
  amountCents: cents.optional(),
  periodStart: optionalDatetime,
  periodEnd: optionalDatetime,
  status: z
    .enum(["draft", "active", "withdrawn", "settled", "rejected", "superseded"])
    .default("draft"),
  facts: z.string().trim().max(8000).optional(),
  evidenceNotes: z.string().trim().max(4000).optional(),
  calculationId: optionalUuid,
  documentId: optionalUuid,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const createLaborCalculationSchema = z.object({
  laborCaseId: uuid,
  calculationType: z.string().trim().min(1).max(80),
  referenceDate: datetime,
  ruleSetId: optionalUuid,
  ruleSetVersion: z.string().trim().min(1).max(40),
  inputSnapshot: z.record(z.string(), z.unknown()).default({}),
  resultSnapshot: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(LABOR_CALCULATION_STATUSES).default("draft"),
});

export const updateLaborCalculationSchema = z
  .object({
    calculationType: z.string().trim().min(1).max(80).optional(),
    referenceDate: optionalDatetime,
    ruleSetId: nullableUuid,
    ruleSetVersion: z.string().trim().min(1).max(40).optional(),
    inputSnapshot: z.record(z.string(), z.unknown()).optional(),
    resultSnapshot: z.record(z.string(), z.unknown()).nullable().optional(),
    status: z.enum(LABOR_CALCULATION_STATUSES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createLaborLiquidationSchema = z.object({
  laborCaseId: uuid,
  calculationId: optionalUuid,
  referenceDate: datetime,
  ruleSetVersion: z.string().trim().max(40).optional(),
  itemsSnapshot: z.array(z.unknown()).optional(),
  periodsSnapshot: z.array(z.unknown()).optional(),
  correctionIndex: z.string().trim().max(80).optional(),
  interestRule: z.string().trim().max(120).optional(),
  contributionsCents: cents.default(0),
  deductionsCents: cents.default(0),
  totalPrincipalCents: cents.default(0),
  totalCorrectionCents: cents.default(0),
  totalInterestCents: cents.default(0),
  totalCents: cents.default(0),
  status: z.enum(LABOR_LIQUIDATION_STATUSES).default("draft"),
  notes: z.string().trim().max(4000).optional(),
});

export const laborCaseListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  clientId: optionalUuid,
  clientRole: z.enum(LABOR_CLIENT_ROLES).optional(),
  status: z.enum(LABOR_CASE_STATUSES).optional(),
  judicialProcessId: optionalUuid,
  responsibleMembershipId: optionalUuid,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const laborCaseScopedListQuerySchema = z.object({
  laborCaseId: optionalUuid,
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const LABOR_CALCULATION_TYPES = [
  "jornada",
  "remuneracao",
  "ferias",
  "fgts",
  "rescisao",
  "liquidacao",
] as const;

export const reviewLaborCalculationSchema = z.object({
  status: z.enum(["reviewed", "approved"]),
  notes: z.string().trim().max(4000).optional(),
});

export const linkLaborDocumentSchema = z.object({
  documentId: uuid,
  linkType: z.string().trim().min(1).max(80).default("evidence"),
});

export const suggestLaborTasksSchema = z.object({
  keys: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
});

export const suggestLaborDeadlinesSchema = z.object({
  baseDate: datetime,
  titles: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
});

export const createLaborRuleSetSchema = z.object({
  key: z.string().trim().min(1).max(80),
  version: z.string().trim().min(1).max(40),
  effectiveFrom: datetime,
  effectiveTo: nullableDatetime,
  source: z.string().trim().min(1).max(120).default("system_seed"),
  sourceUrl: z.string().trim().url().max(500).optional(),
  status: z.enum(["draft", "active", "deprecated", "archived"]).default("draft"),
  metadata: z.record(z.string(), z.unknown()).optional(),
  locked: z.boolean().optional(),
});

export const updateLaborLiquidationSchema = createLaborLiquidationSchema
  .omit({ laborCaseId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });
