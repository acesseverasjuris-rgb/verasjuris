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

export const PREVIDENTIARY_REGIMES = ["rgps", "rpps", "military", "other"] as const;
export const SOCIAL_SECURITY_BENEFIT_STATUSES = [
  "draft",
  "requested",
  "under_analysis",
  "granted",
  "active",
  "suspended",
  "ceased",
  "denied",
  "cancelled",
  "under_appeal",
  "judicialized",
  "archived",
] as const;
export const PREVIDENTIARY_REQUEST_TYPES = [
  "initial_request",
  "extension",
  "reconsideration",
  "revision",
  "restoration",
  "appeal",
  "compliance",
  "other",
] as const;
export const PREVIDENTIARY_REQUEST_STATUSES = [
  "draft",
  "ready",
  "submitted",
  "under_analysis",
  "requirement_open",
  "decided",
  "appeal",
  "closed",
  "cancelled",
  "archived",
] as const;
export const PROTOCOL_VERIFICATION_STATUSES = [
  "unverified",
  "manual",
  "verified",
  "source_unavailable",
  "not_configured",
] as const;
export const PREVIDENTIARY_EXAM_STATUSES = [
  "scheduled",
  "completed",
  "missed",
  "cancelled",
  "rescheduled",
  "result_available",
  "unknown",
] as const;
export const PREVIDENTIARY_CALCULATION_STATUSES = [
  "draft",
  "calculated",
  "review_required",
  "reviewed",
  "approved",
  "superseded",
] as const;
export const CNIS_IMPORT_STATUSES = [
  "draft",
  "pending_review",
  "reviewed",
  "rejected",
  "failed",
  "not_configured",
] as const;

export function normalizeNb(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export const createPrevidentiaryCaseSchema = z.object({
  clientId: uuid,
  legalMatterId: uuid,
  responsibleMembershipId: optionalUuid,
  regime: z.enum(PREVIDENTIARY_REGIMES).default("rgps"),
  insuredCategory: z.string().trim().max(120).optional(),
  currentSituation: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(8000).optional(),
});

export const updatePrevidentiaryCaseSchema = createPrevidentiaryCaseSchema
  .omit({ clientId: true, legalMatterId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const upsertPrevidentiaryClientProfileSchema = z.object({
  clientId: uuid,
  nitMasked: z.string().trim().max(40).nullable().optional(),
  pisMasked: z.string().trim().max(40).nullable().optional(),
  category: z.string().trim().max(120).nullable().optional(),
  occupation: z.string().trim().max(200).nullable().optional(),
  ruralWorker: z.boolean().optional(),
  specialExposure: z.boolean().optional(),
  disability: z.boolean().optional(),
  publicServiceHistory: z.boolean().optional(),
  benefitHistoryNotes: z.string().trim().max(8000).nullable().optional(),
});

export const createSocialSecurityBenefitSchema = z.object({
  previdentiaryCaseId: uuid,
  clientId: uuid,
  benefitTypeId: uuid,
  nb: z.string().trim().max(40).optional(),
  der: optionalDatetime,
  dib: optionalDatetime,
  dcb: optionalDatetime,
  dip: optionalDatetime,
  cessacaoAt: optionalDatetime,
  status: z.enum(SOCIAL_SECURITY_BENEFIT_STATUSES).default("draft"),
  administrativeProcessId: optionalUuid,
  judicialProcessId: optionalUuid,
  source: z.enum(["manual", "document", "import", "provider", "not_configured"]).default("manual"),
  sourceReference: z.string().trim().max(200).optional(),
});

export const updateSocialSecurityBenefitSchema = createSocialSecurityBenefitSchema
  .omit({ previdentiaryCaseId: true, clientId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createSocialSecurityPeriodSchema = z.object({
  previdentiaryCaseId: uuid,
  clientId: uuid,
  startDate: datetime,
  endDate: nullableDatetime,
  category: z
    .enum([
      "employment",
      "individual_contributor",
      "optional",
      "domestic",
      "rural",
      "public_service",
      "special",
      "interleaved_benefit",
      "military",
      "other",
    ])
    .default("other"),
  employerName: z.string().trim().max(200).optional(),
  employerDocument: z.string().trim().max(40).optional(),
  source: z.enum(["manual", "document", "import", "provider", "not_configured"]).default("manual"),
  sourceDocumentId: optionalUuid,
  status: z.enum(["draft", "active", "reviewed", "rejected", "superseded"]).default("draft"),
  reviewed: z.boolean().optional(),
});

export const createSocialSecurityContributionSchema = z.object({
  previdentiaryCaseId: uuid,
  periodId: optionalUuid,
  competence,
  remunerationCents: cents,
  contributionCents: cents.optional(),
  contributionType: z.string().trim().max(80).optional(),
  source: z.enum(["manual", "document", "import", "provider", "not_configured"]).default("manual"),
  sourceDocumentId: optionalUuid,
  validationStatus: z
    .enum(["unreviewed", "valid", "invalid", "needs_review", "not_applicable"])
    .default("unreviewed"),
});

const previdentiaryRequestFields = {
  benefitTypeId: optionalUuid,
  requestType: z.enum(PREVIDENTIARY_REQUEST_TYPES).default("initial_request"),
  der: optionalDatetime,
  protocolNumber: z.string().trim().max(120).optional(),
  protocolDate: optionalDatetime,
  protocolSource: z.string().trim().max(40).default("manual"),
  protocolVerificationStatus: z.enum(PROTOCOL_VERIFICATION_STATUSES).default("manual"),
  status: z.enum(PREVIDENTIARY_REQUEST_STATUSES).default("draft"),
  source: z.enum(["manual", "document", "import", "provider", "not_configured"]).default("manual"),
  justificationSummary: z.string().trim().max(8000).optional(),
};

function refineProtocolVerification(
  value: { protocolVerificationStatus?: string; protocolSource?: string },
  ctx: z.RefinementCtx,
) {
  if (value.protocolVerificationStatus === "verified" && value.protocolSource === "manual") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Sem integração confirmada, o protocolo não pode ser marcado como verificado no órgão.",
      path: ["protocolVerificationStatus"],
    });
  }
}

export const createPrevidentiaryRequestSchema = z
  .object({
    previdentiaryCaseId: uuid,
    /** Informe um processo existente OU deixe ausente para criar sob o matter do caso. */
    administrativeProcessId: optionalUuid,
    administrativeBodyId: optionalUuid,
    adminSubject: z.string().trim().min(1).max(500).optional(),
    ...previdentiaryRequestFields,
  })
  .superRefine(refineProtocolVerification);

export const updatePrevidentiaryRequestSchema = z
  .object(previdentiaryRequestFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." })
  .superRefine(refineProtocolVerification);

export const createPrevidentiaryMedicalExamSchema = z.object({
  requestId: uuid,
  calendarEventId: optionalUuid,
  /** Quando true e há scheduledAt, cria CalendarEvent vinculado. */
  createCalendarEvent: z.boolean().optional(),
  examType: z.string().trim().min(1).max(120),
  scheduledAt: optionalDatetime,
  timezone: z.string().trim().min(2).max(64).default("America/Sao_Paulo"),
  location: z.string().trim().max(300).optional(),
  modality: z.enum(["in_person", "remote", "documental", "other", "unknown"]).default("unknown"),
  examinerInfo: z.string().trim().max(500).optional(),
  status: z.enum(PREVIDENTIARY_EXAM_STATUSES).default("scheduled"),
  resultSummary: z.string().trim().max(4000).optional(),
  source: z.enum(["manual", "document", "import", "provider", "not_configured"]).default("manual"),
  documentId: optionalUuid,
});

export const createPrevidentiarySocialAssessmentSchema = z.object({
  requestId: uuid,
  calendarEventId: optionalUuid,
  createCalendarEvent: z.boolean().optional(),
  scheduledAt: optionalDatetime,
  timezone: z.string().trim().min(2).max(64).default("America/Sao_Paulo"),
  location: z.string().trim().max(300).optional(),
  modality: z.enum(["in_person", "remote", "documental", "other", "unknown"]).default("unknown"),
  status: z.enum(PREVIDENTIARY_EXAM_STATUSES).default("scheduled"),
  resultSummary: z.string().trim().max(4000).optional(),
  source: z.enum(["manual", "document", "import", "provider", "not_configured"]).default("manual"),
  documentId: optionalUuid,
});

export const createPrevidentiaryCalculationSchema = z.object({
  previdentiaryCaseId: uuid,
  calculationType: z.string().trim().min(1).max(80),
  ruleSetId: optionalUuid,
  ruleSetVersion: z.string().trim().min(1).max(40),
  referenceDate: datetime,
  inputSnapshot: z.record(z.string(), z.unknown()).default({}),
  resultSnapshot: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(PREVIDENTIARY_CALCULATION_STATUSES).default("draft"),
});

export const updatePrevidentiaryCalculationSchema = z
  .object({
    calculationType: z.string().trim().min(1).max(80).optional(),
    ruleSetId: nullableUuid,
    ruleSetVersion: z.string().trim().min(1).max(40).optional(),
    referenceDate: optionalDatetime,
    inputSnapshot: z.record(z.string(), z.unknown()).optional(),
    resultSnapshot: z.record(z.string(), z.unknown()).nullable().optional(),
    status: z.enum(PREVIDENTIARY_CALCULATION_STATUSES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createBenefitScenarioSchema = z.object({
  previdentiaryCaseId: uuid,
  calculationId: optionalUuid,
  benefitTypeId: optionalUuid,
  der: optionalDatetime,
  ruleSetVersion: z.string().trim().max(40).optional(),
  eligibilityStatus: z.string().trim().max(80).optional(),
  estimatedRmiCents: cents.optional(),
  estimatedStart: optionalDatetime,
  assumptions: z.record(z.string(), z.unknown()).optional(),
  missingData: z.array(z.unknown()).optional(),
  reviewStatus: z
    .enum(["draft", "estimated", "review_required", "reviewed", "superseded"])
    .default("draft"),
});

export const createBenefitArrearsCalculationSchema = z.object({
  previdentiaryCaseId: uuid,
  calculationId: optionalUuid,
  benefitId: optionalUuid,
  startDate: datetime,
  endDate: datetime,
  monthlyValues: z.array(z.unknown()).optional(),
  correctionIndex: z.string().trim().max(80).optional(),
  interestRule: z.string().trim().max(120).optional(),
  deductions: z.array(z.unknown()).optional(),
  totalPrincipalCents: cents.default(0),
  totalCorrectionCents: cents.default(0),
  totalInterestCents: cents.default(0),
  totalCents: cents.default(0),
  ruleSetVersion: z.string().trim().max(40).optional(),
  status: z.enum(PREVIDENTIARY_CALCULATION_STATUSES).default("draft"),
});

const cnisEntryFields = {
  competence,
  relationshipType: z.string().trim().max(80).optional(),
  employer: z.string().trim().max(200).optional(),
  employerDocument: z.string().trim().max(40).optional(),
  remunerationCents: cents.optional(),
  contributionCents: cents.optional(),
  indicators: z.record(z.string(), z.unknown()).optional(),
  source: z.enum(["manual", "document", "import", "provider", "not_configured"]).default("import"),
  reviewStatus: z
    .enum(["unreviewed", "accepted", "rejected", "corrected", "needs_review"])
    .default("unreviewed"),
};

export const createCnisImportSchema = z.object({
  previdentiaryCaseId: uuid,
  clientId: uuid,
  sourceDocumentId: optionalUuid,
  importFormat: z.enum(["manual", "pdf", "csv", "api"]).default("manual"),
  status: z.enum(CNIS_IMPORT_STATUSES).default("draft"),
  source: z.enum(["manual", "document", "import", "provider", "not_configured"]).default("manual"),
  notes: z.string().trim().max(4000).optional(),
  entries: z.array(z.object(cnisEntryFields)).max(5_000).optional(),
});

export const createCnisEntrySchema = z.object({
  importId: uuid,
  ...cnisEntryFields,
});

export const reviewCnisEntrySchema = z.object({
  reviewStatus: z.enum(["unreviewed", "accepted", "rejected", "corrected", "needs_review"]),
});

export const runPrevidentiaryCalculationSchema = z.object({
  inputSnapshot: z.record(z.string(), z.unknown()).optional(),
});

export const reviewPrevidentiaryCalculationSchema = z.object({
  decision: z.enum(["reviewed", "approved"]),
  notes: z.string().trim().max(4000).optional(),
});

export const createPrevidentiaryRuleSetSchema = z.object({
  key: z.string().trim().min(1).max(80),
  version: z.string().trim().min(1).max(40),
  effectiveFrom: datetime,
  effectiveTo: nullableDatetime,
  source: z.string().trim().max(80).default("organization"),
  sourceUrl: z.string().trim().max(500).optional(),
  status: z.enum(["draft", "active", "deprecated", "archived"]).default("draft"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const compareBenefitScenariosSchema = z.object({
  previdentiaryCaseId: uuid,
  ruleSetVersion: z.string().trim().min(1).max(40),
  scenarios: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        benefitType: z.string().trim().min(1).max(120),
        der: z.string().optional(),
        ruleSetVersion: z.string().trim().max(40).optional(),
        eligibilityStatus: z.string().trim().max(80).optional(),
        estimatedRmiCents: cents,
        estimatedStart: z.string().optional(),
        assumptions: z.array(z.string()).optional(),
        missingData: z.array(z.string()).optional(),
      }),
    )
    .min(1)
    .max(50),
});

export const linkPrevidentiaryDocumentSchema = z.object({
  documentId: uuid,
  linkType: z
    .enum([
      "cnis",
      "ppp",
      "ltcat",
      "medical_report",
      "protocol_receipt",
      "decision",
      "requirement_response",
      "proof",
      "other",
    ])
    .default("proof"),
  targetType: z.enum([
    "previdentiary_case",
    "social_security_benefit",
    "previdentiary_request",
    "cnis_import",
    "previdentiary_calculation",
  ]),
  targetId: uuid,
});

export const createSpecialPeriodSchema = z.object({
  previdentiaryCaseId: uuid,
  periodId: optionalUuid,
  startDate: datetime,
  endDate: nullableDatetime,
  agent: z.string().trim().max(200).optional(),
  intensity: z.string().trim().max(120).optional(),
  concentration: z.string().trim().max(120).optional(),
  pppDocumentId: optionalUuid,
  ltcatDocumentId: optionalUuid,
  evidenceNotes: z.string().trim().max(4000).optional(),
  reviewStatus: z
    .enum(["unreviewed", "accepted", "rejected", "needs_review"])
    .default("unreviewed"),
});

export const createRuralPeriodSchema = z.object({
  previdentiaryCaseId: uuid,
  periodId: optionalUuid,
  startDate: datetime,
  endDate: nullableDatetime,
  regime: z.string().trim().max(80).optional(),
  evidenceNotes: z.string().trim().max(4000).optional(),
  reviewStatus: z
    .enum(["unreviewed", "accepted", "rejected", "needs_review"])
    .default("unreviewed"),
});

export const previdentiaryCaseListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  clientId: optionalUuid,
  /** Filtra por currentSituation (não há status formal no caso). */
  status: z.string().trim().max(120).optional(),
  regime: z.enum(PREVIDENTIARY_REGIMES).optional(),
  responsibleMembershipId: optionalUuid,
  maskSensitive: z
    .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
    .optional()
    .transform((v) => v === true || v === "true" || v === "1"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const socialSecurityBenefitListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  clientId: optionalUuid,
  previdentiaryCaseId: optionalUuid,
  benefitTypeId: optionalUuid,
  status: z.enum(SOCIAL_SECURITY_BENEFIT_STATUSES).optional(),
  nb: z.string().trim().max(40).optional(),
  responsibleMembershipId: optionalUuid,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const previdentiaryRequestListQuerySchema = z.object({
  previdentiaryCaseId: optionalUuid,
  status: z.enum(PREVIDENTIARY_REQUEST_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const previdentiaryCalculationListQuerySchema = z.object({
  previdentiaryCaseId: optionalUuid,
  status: z.enum(PREVIDENTIARY_CALCULATION_STATUSES).optional(),
  calculationType: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const cnisImportListQuerySchema = z.object({
  previdentiaryCaseId: optionalUuid,
  clientId: optionalUuid,
  status: z.enum(CNIS_IMPORT_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});
