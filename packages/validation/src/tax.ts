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
const optionalCompetence = competence.optional();

export const TAX_TAXPAYER_TYPES = ["individual", "company", "mei", "public_body", "other"] as const;
export const TAX_JURISDICTION_SCOPES = ["federal", "state", "municipal", "mixed", "other"] as const;
export const TAX_CASE_STATUSES = ["draft", "active", "suspended", "closed", "archived"] as const;
export const TAX_JURISDICTIONS = ["federal", "state", "municipal", "other"] as const;
export const TAX_NATURES = ["tax", "fee", "contribution", "improvement", "other"] as const;
export const TAX_TYPE_SOURCES = [
  "system_seed",
  "organization",
  "import",
  "provider",
  "not_configured",
] as const;
export const TAX_OBLIGATION_TYPES = [
  "principal",
  "accessory",
  "payment",
  "declaration",
  "filing",
  "bookkeeping",
  "withholding",
  "other",
] as const;
export const TAX_OBLIGATION_STATUSES = [
  "draft",
  "open",
  "pending",
  "fulfilled",
  "overdue",
  "disputed",
  "cancelled",
] as const;
export const TAX_CREDIT_ORIGINS = [
  "overpayment",
  "undue_payment",
  "judicial_recognition",
  "administrative_recognition",
  "withholding",
  "incentive",
  "other",
] as const;
export const TAX_CREDIT_STATUSES = [
  "draft",
  "identified",
  "under_review",
  "confirmed",
  "used",
  "expired",
  "cancelled",
] as const;
export const TAX_REFUND_STATUSES = [
  "draft",
  "requested",
  "under_analysis",
  "partially_granted",
  "granted",
  "denied",
  "cancelled",
] as const;
export const TAX_COMPENSATION_STATUSES = [
  "draft",
  "requested",
  "under_analysis",
  "accepted",
  "partially_accepted",
  "rejected",
  "cancelled",
] as const;
export const TAX_ASSESSMENT_STATUSES = [
  "draft",
  "issued",
  "under_review",
  "challenged",
  "decided",
  "appealed",
  "final_admin",
  "judicialized",
  "cancelled",
  "paid",
] as const;
export const TAX_THESIS_STATUSES = [
  "draft",
  "under_research",
  "supported",
  "contested",
  "outdated",
  "superseded",
  "archived",
] as const;
export const TAX_THESIS_RISK_LEVELS = ["low", "medium", "high", "critical", "unknown"] as const;
export const TAX_THESIS_APPLICABILITY = [
  "suggested",
  "applicable",
  "not_applicable",
  "needs_review",
  "rejected",
] as const;
export const TAX_CALCULATION_TYPES = [
  "debit",
  "credit",
  "refund",
  "compensation",
  "update",
  "penalty",
  "interest",
  "installment",
  "undue_repetition",
  "comparative_scenario",
  "other",
] as const;
export const TAX_CALCULATION_STATUSES = [
  "draft",
  "calculated",
  "review_required",
  "reviewed",
  "approved",
  "superseded",
] as const;
export const TAX_GUARANTEE_TYPES = [
  "cash",
  "bank_guarantee",
  "insurance",
  "property",
  "vehicle",
  "receivable",
  "other",
] as const;
export const TAX_GUARANTEE_STATUSES = [
  "draft",
  "proposed",
  "accepted",
  "rejected",
  "released",
  "executed",
  "cancelled",
] as const;
export const TAX_ENFORCEMENT_STATUSES = [
  "draft",
  "filed",
  "active",
  "suspended",
  "settled",
  "extinguished",
  "archived",
] as const;
export const TAX_ADMIN_CASE_PHASES = [
  "impugnacao",
  "defesa",
  "diligencia",
  "julgamento",
  "recurso",
  "decisao_final",
  "other",
] as const;

export const createTaxCaseSchema = z.object({
  clientId: uuid,
  legalMatterId: uuid,
  responsibleMembershipId: optionalUuid,
  taxpayerType: z.enum(TAX_TAXPAYER_TYPES).default("company"),
  jurisdictionScope: z.enum(TAX_JURISDICTION_SCOPES).default("federal"),
  status: z.enum(TAX_CASE_STATUSES).default("draft"),
  notes: z.string().trim().max(8000).optional(),
});

export const updateTaxCaseSchema = createTaxCaseSchema
  .omit({ clientId: true, legalMatterId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const taxCaseListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  clientId: optionalUuid,
  status: z.enum(TAX_CASE_STATUSES).optional(),
  jurisdictionScope: z.enum(TAX_JURISDICTION_SCOPES).optional(),
  responsibleMembershipId: optionalUuid,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createTaxTypeSchema = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(200),
  jurisdiction: z.enum(TAX_JURISDICTIONS).default("federal"),
  taxNature: z.enum(TAX_NATURES).default("tax"),
  active: z.boolean().default(true),
  source: z.enum(TAX_TYPE_SOURCES).default("organization"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateTaxTypeSchema = createTaxTypeSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const taxTypeListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  jurisdiction: z.enum(TAX_JURISDICTIONS).optional(),
  active: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createTaxObligationSchema = z.object({
  taxCaseId: uuid,
  taxTypeId: uuid,
  obligationType: z.enum(TAX_OBLIGATION_TYPES).default("principal"),
  competence: optionalCompetence,
  dueDate: optionalDatetime,
  amountCents: cents.optional(),
  status: z.enum(TAX_OBLIGATION_STATUSES).default("draft"),
  source: z.string().trim().max(80).default("manual"),
  evidenceDocumentId: optionalUuid,
  deadlineId: optionalUuid,
  notes: z.string().trim().max(4000).optional(),
});

export const updateTaxObligationSchema = createTaxObligationSchema
  .omit({ taxCaseId: true, taxTypeId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const taxObligationListQuerySchema = z.object({
  taxCaseId: optionalUuid,
  status: z.enum(TAX_OBLIGATION_STATUSES).optional(),
  taxTypeId: optionalUuid,
  fromDueDate: optionalDatetime,
  toDueDate: optionalDatetime,
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createTaxCreditSchema = z.object({
  taxCaseId: uuid,
  taxTypeId: uuid,
  origin: z.enum(TAX_CREDIT_ORIGINS).default("other"),
  competenceStart: optionalCompetence,
  competenceEnd: optionalCompetence,
  principalCents: cents.default(0),
  correctionCents: cents.default(0),
  interestCents: cents.default(0),
  penaltyCents: cents.default(0),
  totalCents: cents.default(0),
  status: z.enum(TAX_CREDIT_STATUSES).default("draft"),
  source: z.string().trim().max(80).default("manual"),
  calculationId: optionalUuid,
  notes: z.string().trim().max(4000).optional(),
});

export const updateTaxCreditSchema = createTaxCreditSchema
  .omit({ taxCaseId: true, taxTypeId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const taxCreditListQuerySchema = z.object({
  taxCaseId: optionalUuid,
  status: z.enum(TAX_CREDIT_STATUSES).optional(),
  taxTypeId: optionalUuid,
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createTaxRefundRequestSchema = z.object({
  taxCaseId: uuid,
  taxCreditId: uuid,
  administrativeProcessId: optionalUuid,
  requestDate: datetime,
  protocolNumber: z.string().trim().max(120).optional(),
  amountRequestedCents: cents,
  amountGrantedCents: cents.optional(),
  status: z.enum(TAX_REFUND_STATUSES).default("draft"),
  source: z.string().trim().max(80).default("manual"),
  decisionDocumentId: optionalUuid,
  notes: z.string().trim().max(4000).optional(),
});

export const updateTaxRefundRequestSchema = createTaxRefundRequestSchema
  .omit({ taxCaseId: true, taxCreditId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const taxRefundListQuerySchema = z.object({
  taxCaseId: optionalUuid,
  status: z.enum(TAX_REFUND_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createTaxCompensationSchema = z.object({
  taxCaseId: uuid,
  sourceCreditId: uuid,
  destinationTaxTypeId: uuid,
  destinationCompetence: optionalCompetence,
  requestedAmountCents: cents,
  acceptedAmountCents: cents.optional(),
  status: z.enum(TAX_COMPENSATION_STATUSES).default("draft"),
  protocol: z.string().trim().max(120).optional(),
  source: z.string().trim().max(80).default("manual"),
  administrativeProcessId: optionalUuid,
  notes: z.string().trim().max(4000).optional(),
});

export const updateTaxCompensationSchema = createTaxCompensationSchema
  .omit({ taxCaseId: true, sourceCreditId: true, destinationTaxTypeId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const taxCompensationListQuerySchema = z.object({
  taxCaseId: optionalUuid,
  status: z.enum(TAX_COMPENSATION_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createTaxAssessmentSchema = z.object({
  taxCaseId: uuid,
  authority: z.string().trim().min(1).max(200),
  assessmentNumber: z.string().trim().min(1).max(120),
  assessmentDate: datetime,
  taxTypeId: uuid,
  principalCents: cents.default(0),
  penaltyCents: cents.default(0),
  interestCents: cents.default(0),
  totalCents: cents.default(0),
  legalBasisText: z.string().trim().max(8000).optional(),
  status: z.enum(TAX_ASSESSMENT_STATUSES).default("draft"),
  administrativeProcessId: optionalUuid,
  documentId: optionalUuid,
  source: z.string().trim().max(80).default("manual"),
  notes: z.string().trim().max(4000).optional(),
});

export const updateTaxAssessmentSchema = createTaxAssessmentSchema
  .omit({ taxCaseId: true, taxTypeId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const taxAssessmentListQuerySchema = z.object({
  taxCaseId: optionalUuid,
  status: z.enum(TAX_ASSESSMENT_STATUSES).optional(),
  taxTypeId: optionalUuid,
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createTaxLegalThesisSchema = z.object({
  title: z.string().trim().min(2).max(300),
  summary: z.string().trim().max(8000).optional(),
  taxTypeId: optionalUuid,
  legalBasis: z.string().trim().max(8000).optional(),
  status: z.enum(TAX_THESIS_STATUSES).default("draft"),
  riskLevel: z.enum(TAX_THESIS_RISK_LEVELS).default("unknown"),
  sourceResearchId: optionalUuid,
});

export const updateTaxLegalThesisSchema = createTaxLegalThesisSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const taxThesisListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(TAX_THESIS_STATUSES).optional(),
  riskLevel: z.enum(TAX_THESIS_RISK_LEVELS).optional(),
  taxTypeId: optionalUuid,
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createTaxCaseThesisLinkSchema = z.object({
  taxCaseId: uuid,
  thesisId: uuid,
  applicabilityStatus: z.enum(TAX_THESIS_APPLICABILITY).default("suggested"),
  assumptions: z.record(z.string(), z.unknown()).optional(),
  missingData: z.array(z.string().trim().max(500)).max(50).optional(),
});

export const updateTaxCaseThesisLinkSchema = z
  .object({
    applicabilityStatus: z.enum(TAX_THESIS_APPLICABILITY).optional(),
    assumptions: z.record(z.string(), z.unknown()).nullable().optional(),
    missingData: z.array(z.string().trim().max(500)).max(50).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createTaxCalculationSchema = z.object({
  taxCaseId: uuid,
  calculationType: z.enum(TAX_CALCULATION_TYPES).default("other"),
  taxTypeId: optionalUuid,
  ruleSetId: optionalUuid,
  ruleSetVersion: z.string().trim().min(1).max(40),
  referenceDate: datetime,
  inputSnapshot: z.record(z.string(), z.unknown()).default({}),
  resultSnapshot: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(TAX_CALCULATION_STATUSES).default("draft"),
});

export const updateTaxCalculationSchema = z
  .object({
    calculationType: z.enum(TAX_CALCULATION_TYPES).optional(),
    taxTypeId: nullableUuid,
    ruleSetId: nullableUuid,
    ruleSetVersion: z.string().trim().min(1).max(40).optional(),
    referenceDate: optionalDatetime,
    inputSnapshot: z.record(z.string(), z.unknown()).optional(),
    resultSnapshot: z.record(z.string(), z.unknown()).nullable().optional(),
    status: z.enum(TAX_CALCULATION_STATUSES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const taxCalculationListQuerySchema = z.object({
  taxCaseId: optionalUuid,
  calculationType: z.enum(TAX_CALCULATION_TYPES).optional(),
  status: z.enum(TAX_CALCULATION_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const reviewTaxCalculationSchema = z.object({
  status: z.enum(["reviewed", "approved"]),
  notes: z.string().trim().max(4000).optional(),
});

export const createTaxEnforcementCaseSchema = z.object({
  taxCaseId: uuid,
  judicialProcessId: uuid,
  debtCertificateId: optionalUuid,
  cdaNumber: z.string().trim().max(120).optional(),
  cdaAmountCents: cents.optional(),
  filingDate: optionalDatetime,
  seizureStatus: z.string().trim().max(120).optional(),
  guaranteeType: z.enum(TAX_GUARANTEE_TYPES).optional(),
  guaranteeAmountCents: cents.optional(),
  embargoStatus: z.string().trim().max(120).optional(),
  exceptionStatus: z.string().trim().max(120).optional(),
  installmentStatus: z.string().trim().max(120).optional(),
  status: z.enum(TAX_ENFORCEMENT_STATUSES).default("draft"),
  notes: z.string().trim().max(4000).optional(),
});

export const updateTaxEnforcementCaseSchema = createTaxEnforcementCaseSchema
  .omit({ taxCaseId: true, judicialProcessId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const taxEnforcementListQuerySchema = z.object({
  taxCaseId: optionalUuid,
  status: z.enum(TAX_ENFORCEMENT_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createTaxDebtCertificateSchema = z.object({
  taxCaseId: uuid,
  number: z.string().trim().min(1).max(120),
  issuer: z.string().trim().min(1).max(200),
  taxTypeId: optionalUuid,
  principalCents: cents.default(0),
  correctionCents: cents.default(0),
  interestCents: cents.default(0),
  penaltyCents: cents.default(0),
  totalCents: cents.default(0),
  registrationDate: optionalDatetime,
  source: z.string().trim().max(80).default("manual"),
  documentId: optionalUuid,
  notes: z.string().trim().max(4000).optional(),
});

export const updateTaxDebtCertificateSchema = createTaxDebtCertificateSchema
  .omit({ taxCaseId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createTaxGuaranteeSchema = z.object({
  taxCaseId: uuid,
  enforcementCaseId: optionalUuid,
  guaranteeType: z.enum(TAX_GUARANTEE_TYPES).default("other"),
  amountCents: cents.default(0),
  status: z.enum(TAX_GUARANTEE_STATUSES).default("draft"),
  description: z.string().trim().max(4000).optional(),
  documentId: optionalUuid,
});

export const updateTaxGuaranteeSchema = createTaxGuaranteeSchema
  .omit({ taxCaseId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createTaxAdministrativeCaseSchema = z.object({
  taxCaseId: uuid,
  administrativeProcessId: uuid,
  taxAssessmentId: optionalUuid,
  phase: z.enum(TAX_ADMIN_CASE_PHASES).default("impugnacao"),
  notes: z.string().trim().max(4000).optional(),
});

export const updateTaxAdministrativeCaseSchema = z
  .object({
    taxAssessmentId: nullableUuid,
    phase: z.enum(TAX_ADMIN_CASE_PHASES).optional(),
    notes: z.string().trim().max(4000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createTaxRuleSetSchema = z.object({
  key: z.string().trim().min(1).max(80),
  version: z.string().trim().min(1).max(40),
  effectiveFrom: datetime,
  effectiveTo: nullableDatetime,
  source: z.string().trim().min(1).max(120).default("system"),
  sourceUrl: z.string().trim().url().max(500).optional(),
  status: z.string().trim().min(1).max(40).default("active"),
  locked: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateTaxRuleSetSchema = createTaxRuleSetSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });
