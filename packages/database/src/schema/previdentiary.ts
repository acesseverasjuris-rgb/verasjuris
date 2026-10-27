import { relations, sql } from "drizzle-orm";
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
import { administrativeProcesses } from "./administrative.js";
import { crmClients } from "./crm.js";
import { documents } from "./documents.js";
import { organizationMembers, organizations } from "./identity.js";
import { judicialProcesses } from "./judicial.js";
import { legalMatters } from "./matters.js";
import { calendarEvents } from "./productivity.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const previdentiaryRegimeEnum = pgEnum("previdentiary_regime", [
  "rgps",
  "rpps",
  "military",
  "other",
]);

export const socialSecurityBenefitStatusEnum = pgEnum("social_security_benefit_status", [
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
]);

export const socialSecurityBenefitSourceEnum = pgEnum("social_security_benefit_source", [
  "manual",
  "document",
  "import",
  "provider",
  "not_configured",
]);

export const benefitTypeSourceEnum = pgEnum("benefit_type_source", [
  "system_seed",
  "organization",
  "import",
  "provider",
  "not_configured",
]);

export const benefitTypeCategoryEnum = pgEnum("benefit_type_category", [
  "retirement",
  "disability",
  "accident_aid",
  "maternity",
  "survivor_pension",
  "imprisonment_aid",
  "bpc_loas",
  "accident_benefit",
  "assistential",
  "other",
]);

export const socialSecurityPeriodCategoryEnum = pgEnum("social_security_period_category", [
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
]);

export const socialSecurityPeriodStatusEnum = pgEnum("social_security_period_status", [
  "draft",
  "active",
  "reviewed",
  "rejected",
  "superseded",
]);

export const contributionValidationStatusEnum = pgEnum("contribution_validation_status", [
  "unreviewed",
  "valid",
  "invalid",
  "needs_review",
  "not_applicable",
]);

export const previdentiaryRequestTypeEnum = pgEnum("previdentiary_request_type", [
  "initial_request",
  "extension",
  "reconsideration",
  "revision",
  "restoration",
  "appeal",
  "compliance",
  "other",
]);

export const previdentiaryRequestStatusEnum = pgEnum("previdentiary_request_status", [
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
]);

export const protocolVerificationStatusEnum = pgEnum("protocol_verification_status", [
  "unverified",
  "manual",
  "verified",
  "source_unavailable",
  "not_configured",
]);

export const previdentiaryExamStatusEnum = pgEnum("previdentiary_exam_status", [
  "scheduled",
  "completed",
  "missed",
  "cancelled",
  "rescheduled",
  "result_available",
  "unknown",
]);

export const previdentiaryExamModalityEnum = pgEnum("previdentiary_exam_modality", [
  "in_person",
  "remote",
  "documental",
  "other",
  "unknown",
]);

export const ruleSetStatusEnum = pgEnum("previdentiary_rule_set_status", [
  "draft",
  "active",
  "deprecated",
  "archived",
]);

export const previdentiaryCalculationStatusEnum = pgEnum("previdentiary_calculation_status", [
  "draft",
  "calculated",
  "review_required",
  "reviewed",
  "approved",
  "superseded",
]);

export const benefitScenarioReviewStatusEnum = pgEnum("benefit_scenario_review_status", [
  "draft",
  "estimated",
  "review_required",
  "reviewed",
  "superseded",
]);

export const cnisImportStatusEnum = pgEnum("cnis_import_status", [
  "draft",
  "pending_review",
  "reviewed",
  "rejected",
  "failed",
  "not_configured",
]);

export const cnisEntryReviewStatusEnum = pgEnum("cnis_entry_review_status", [
  "unreviewed",
  "accepted",
  "rejected",
  "corrected",
  "needs_review",
]);

export const periodReviewStatusEnum = pgEnum("period_review_status", [
  "unreviewed",
  "accepted",
  "rejected",
  "needs_review",
]);

export const previdentiaryCases = pgTable(
  "previdentiary_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => crmClients.id, { onDelete: "restrict" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    responsibleMembershipId: uuid("responsible_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    regime: previdentiaryRegimeEnum("regime").notNull().default("rgps"),
    insuredCategory: text("insured_category"),
    currentSituation: text("current_situation"),
    notes: text("notes"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("previdentiary_cases_org_idx").on(table.organizationId),
    index("previdentiary_cases_org_client_idx").on(table.organizationId, table.clientId),
    index("previdentiary_cases_matter_idx").on(table.legalMatterId),
    index("previdentiary_cases_org_regime_idx").on(table.organizationId, table.regime),
    index("previdentiary_cases_responsible_idx").on(table.responsibleMembershipId),
  ],
);

export const previdentiaryClientProfiles = pgTable(
  "previdentiary_client_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => crmClients.id, { onDelete: "cascade" }),
    nitMasked: text("nit_masked"),
    pisMasked: text("pis_masked"),
    category: text("category"),
    occupation: text("occupation"),
    ruralWorker: boolean("rural_worker").notNull().default(false),
    specialExposure: boolean("special_exposure").notNull().default(false),
    disability: boolean("disability").notNull().default(false),
    publicServiceHistory: boolean("public_service_history").notNull().default(false),
    benefitHistoryNotes: text("benefit_history_notes"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("previdentiary_client_profiles_org_client_unique").on(
      table.organizationId,
      table.clientId,
    ),
    index("previdentiary_client_profiles_org_idx").on(table.organizationId),
    index("previdentiary_client_profiles_client_idx").on(table.clientId),
  ],
);

/** Catálogo de espécies — NÃO é catálogo oficial do INSS. */
export const benefitTypes = pgTable(
  "benefit_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    category: benefitTypeCategoryEnum("category").notNull().default("other"),
    regime: previdentiaryRegimeEnum("regime").notNull().default("rgps"),
    active: boolean("active").notNull().default(true),
    source: benefitTypeSourceEnum("source").notNull().default("system_seed"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("benefit_types_code_unique").on(table.code),
    index("benefit_types_category_idx").on(table.category),
    index("benefit_types_regime_idx").on(table.regime),
    index("benefit_types_active_idx").on(table.active),
  ],
);

export const socialSecurityBenefits = pgTable(
  "social_security_benefits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    previdentiaryCaseId: uuid("previdentiary_case_id")
      .notNull()
      .references(() => previdentiaryCases.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => crmClients.id, { onDelete: "restrict" }),
    benefitTypeId: uuid("benefit_type_id")
      .notNull()
      .references(() => benefitTypes.id, { onDelete: "restrict" }),
    nb: text("nb"),
    normalizedNb: text("normalized_nb"),
    der: timestamp("der", { withTimezone: true, mode: "date" }),
    dib: timestamp("dib", { withTimezone: true, mode: "date" }),
    dcb: timestamp("dcb", { withTimezone: true, mode: "date" }),
    dip: timestamp("dip", { withTimezone: true, mode: "date" }),
    cessacaoAt: timestamp("cessacao_at", { withTimezone: true, mode: "date" }),
    status: socialSecurityBenefitStatusEnum("status").notNull().default("draft"),
    administrativeProcessId: uuid("administrative_process_id").references(
      () => administrativeProcesses.id,
      { onDelete: "set null" },
    ),
    judicialProcessId: uuid("judicial_process_id").references(() => judicialProcesses.id, {
      onDelete: "set null",
    }),
    source: socialSecurityBenefitSourceEnum("source").notNull().default("manual"),
    sourceReference: text("source_reference"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("social_security_benefits_org_nb_unique")
      .on(table.organizationId, table.normalizedNb)
      .where(sql`${table.normalizedNb} is not null`),
    index("social_security_benefits_org_idx").on(table.organizationId),
    index("social_security_benefits_org_status_idx").on(table.organizationId, table.status),
    index("social_security_benefits_org_client_idx").on(table.organizationId, table.clientId),
    index("social_security_benefits_case_idx").on(table.previdentiaryCaseId),
    index("social_security_benefits_der_idx").on(table.der),
    index("social_security_benefits_dib_idx").on(table.dib),
    index("social_security_benefits_type_idx").on(table.benefitTypeId),
  ],
);

export const socialSecurityBenefitHistory = pgTable(
  "social_security_benefit_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    benefitId: uuid("benefit_id")
      .notNull()
      .references(() => socialSecurityBenefits.id, { onDelete: "cascade" }),
    previousStatus: socialSecurityBenefitStatusEnum("previous_status"),
    newStatus: socialSecurityBenefitStatusEnum("new_status"),
    event: text("event").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    source: socialSecurityBenefitSourceEnum("source").notNull().default("manual"),
    actorMembershipId: uuid("actor_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("social_security_benefit_history_org_idx").on(table.organizationId),
    index("social_security_benefit_history_benefit_idx").on(table.benefitId, table.occurredAt),
  ],
);

export const socialSecurityPeriods = pgTable(
  "social_security_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    previdentiaryCaseId: uuid("previdentiary_case_id")
      .notNull()
      .references(() => previdentiaryCases.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => crmClients.id, { onDelete: "restrict" }),
    startDate: timestamp("start_date", { withTimezone: true, mode: "date" }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true, mode: "date" }),
    category: socialSecurityPeriodCategoryEnum("category").notNull().default("other"),
    employerName: text("employer_name"),
    employerDocument: text("employer_document"),
    source: socialSecurityBenefitSourceEnum("source").notNull().default("manual"),
    sourceDocumentId: uuid("source_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    status: socialSecurityPeriodStatusEnum("status").notNull().default("draft"),
    reviewed: boolean("reviewed").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("social_security_periods_org_idx").on(table.organizationId),
    index("social_security_periods_case_idx").on(table.previdentiaryCaseId),
    index("social_security_periods_org_client_idx").on(table.organizationId, table.clientId),
    index("social_security_periods_dates_idx").on(table.startDate, table.endDate),
    index("social_security_periods_status_idx").on(table.organizationId, table.status),
  ],
);

export const socialSecurityContributions = pgTable(
  "social_security_contributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    previdentiaryCaseId: uuid("previdentiary_case_id")
      .notNull()
      .references(() => previdentiaryCases.id, { onDelete: "cascade" }),
    periodId: uuid("period_id").references(() => socialSecurityPeriods.id, {
      onDelete: "set null",
    }),
    competence: text("competence").notNull(),
    remunerationCents: bigint("remuneration_cents", { mode: "number" }).notNull().default(0),
    contributionCents: bigint("contribution_cents", { mode: "number" }),
    contributionType: text("contribution_type"),
    source: socialSecurityBenefitSourceEnum("source").notNull().default("manual"),
    sourceDocumentId: uuid("source_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    validationStatus: contributionValidationStatusEnum("validation_status")
      .notNull()
      .default("unreviewed"),
    ...timestamps,
  },
  (table) => [
    index("social_security_contributions_org_idx").on(table.organizationId),
    index("social_security_contributions_case_idx").on(table.previdentiaryCaseId),
    index("social_security_contributions_period_idx").on(table.periodId),
    index("social_security_contributions_competence_idx").on(
      table.organizationId,
      table.competence,
    ),
  ],
);

export const specialPeriods = pgTable(
  "special_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    previdentiaryCaseId: uuid("previdentiary_case_id")
      .notNull()
      .references(() => previdentiaryCases.id, { onDelete: "cascade" }),
    periodId: uuid("period_id").references(() => socialSecurityPeriods.id, {
      onDelete: "set null",
    }),
    startDate: timestamp("start_date", { withTimezone: true, mode: "date" }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true, mode: "date" }),
    agent: text("agent"),
    intensity: text("intensity"),
    concentration: text("concentration"),
    pppDocumentId: uuid("ppp_document_id").references(() => documents.id, { onDelete: "set null" }),
    ltcatDocumentId: uuid("ltcat_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    evidenceNotes: text("evidence_notes"),
    reviewStatus: periodReviewStatusEnum("review_status").notNull().default("unreviewed"),
    ...timestamps,
  },
  (table) => [
    index("special_periods_org_idx").on(table.organizationId),
    index("special_periods_case_idx").on(table.previdentiaryCaseId),
    index("special_periods_dates_idx").on(table.startDate, table.endDate),
    index("special_periods_review_idx").on(table.organizationId, table.reviewStatus),
  ],
);

export const ruralPeriods = pgTable(
  "rural_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    previdentiaryCaseId: uuid("previdentiary_case_id")
      .notNull()
      .references(() => previdentiaryCases.id, { onDelete: "cascade" }),
    periodId: uuid("period_id").references(() => socialSecurityPeriods.id, {
      onDelete: "set null",
    }),
    startDate: timestamp("start_date", { withTimezone: true, mode: "date" }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true, mode: "date" }),
    regime: text("regime"),
    evidenceNotes: text("evidence_notes"),
    reviewStatus: periodReviewStatusEnum("review_status").notNull().default("unreviewed"),
    ...timestamps,
  },
  (table) => [
    index("rural_periods_org_idx").on(table.organizationId),
    index("rural_periods_case_idx").on(table.previdentiaryCaseId),
    index("rural_periods_dates_idx").on(table.startDate, table.endDate),
    index("rural_periods_review_idx").on(table.organizationId, table.reviewStatus),
  ],
);

export const previdentiaryRequests = pgTable(
  "previdentiary_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    previdentiaryCaseId: uuid("previdentiary_case_id")
      .notNull()
      .references(() => previdentiaryCases.id, { onDelete: "cascade" }),
    administrativeProcessId: uuid("administrative_process_id")
      .notNull()
      .references(() => administrativeProcesses.id, { onDelete: "restrict" }),
    benefitTypeId: uuid("benefit_type_id").references(() => benefitTypes.id, {
      onDelete: "set null",
    }),
    requestType: previdentiaryRequestTypeEnum("request_type").notNull().default("initial_request"),
    der: timestamp("der", { withTimezone: true, mode: "date" }),
    protocolNumber: text("protocol_number"),
    protocolDate: timestamp("protocol_date", { withTimezone: true, mode: "date" }),
    protocolSource: text("protocol_source").notNull().default("manual"),
    protocolVerificationStatus: protocolVerificationStatusEnum("protocol_verification_status")
      .notNull()
      .default("manual"),
    status: previdentiaryRequestStatusEnum("status").notNull().default("draft"),
    source: socialSecurityBenefitSourceEnum("source").notNull().default("manual"),
    justificationSummary: text("justification_summary"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("previdentiary_requests_org_idx").on(table.organizationId),
    index("previdentiary_requests_case_idx").on(table.previdentiaryCaseId),
    index("previdentiary_requests_admin_process_idx").on(table.administrativeProcessId),
    index("previdentiary_requests_org_status_idx").on(table.organizationId, table.status),
    index("previdentiary_requests_der_idx").on(table.der),
  ],
);

export const previdentiaryMedicalExams = pgTable(
  "previdentiary_medical_exams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    requestId: uuid("request_id")
      .notNull()
      .references(() => previdentiaryRequests.id, { onDelete: "cascade" }),
    calendarEventId: uuid("calendar_event_id").references(() => calendarEvents.id, {
      onDelete: "set null",
    }),
    examType: text("exam_type").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "date" }),
    timezone: text("timezone").notNull().default("America/Sao_Paulo"),
    location: text("location"),
    modality: previdentiaryExamModalityEnum("modality").notNull().default("unknown"),
    examinerInfo: text("examiner_info"),
    status: previdentiaryExamStatusEnum("status").notNull().default("scheduled"),
    resultSummary: text("result_summary"),
    source: socialSecurityBenefitSourceEnum("source").notNull().default("manual"),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    index("previdentiary_medical_exams_org_idx").on(table.organizationId),
    index("previdentiary_medical_exams_request_idx").on(table.requestId),
    index("previdentiary_medical_exams_calendar_idx").on(table.calendarEventId),
    index("previdentiary_medical_exams_status_idx").on(table.organizationId, table.status),
    index("previdentiary_medical_exams_scheduled_idx").on(table.scheduledAt),
  ],
);

export const previdentiarySocialAssessments = pgTable(
  "previdentiary_social_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    requestId: uuid("request_id")
      .notNull()
      .references(() => previdentiaryRequests.id, { onDelete: "cascade" }),
    calendarEventId: uuid("calendar_event_id").references(() => calendarEvents.id, {
      onDelete: "set null",
    }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "date" }),
    timezone: text("timezone").notNull().default("America/Sao_Paulo"),
    location: text("location"),
    modality: previdentiaryExamModalityEnum("modality").notNull().default("unknown"),
    status: previdentiaryExamStatusEnum("status").notNull().default("scheduled"),
    resultSummary: text("result_summary"),
    source: socialSecurityBenefitSourceEnum("source").notNull().default("manual"),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    index("previdentiary_social_assessments_org_idx").on(table.organizationId),
    index("previdentiary_social_assessments_request_idx").on(table.requestId),
    index("previdentiary_social_assessments_calendar_idx").on(table.calendarEventId),
    index("previdentiary_social_assessments_status_idx").on(table.organizationId, table.status),
    index("previdentiary_social_assessments_scheduled_idx").on(table.scheduledAt),
  ],
);

export const previdentiaryRuleSets = pgTable(
  "previdentiary_rule_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    version: text("version").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true, mode: "date" }).notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true, mode: "date" }),
    source: text("source").notNull().default("system_seed"),
    sourceUrl: text("source_url"),
    status: ruleSetStatusEnum("status").notNull().default("draft"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    /** Quando true, a versão já foi usada em cálculo e não pode ser alterada. */
    locked: boolean("locked").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("previdentiary_rule_sets_key_version_unique").on(table.key, table.version),
    index("previdentiary_rule_sets_status_idx").on(table.status),
    index("previdentiary_rule_sets_effective_idx").on(table.effectiveFrom, table.effectiveTo),
  ],
);

export const previdentiaryCalculations = pgTable(
  "previdentiary_calculations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    previdentiaryCaseId: uuid("previdentiary_case_id")
      .notNull()
      .references(() => previdentiaryCases.id, { onDelete: "cascade" }),
    calculationType: text("calculation_type").notNull(),
    ruleSetId: uuid("rule_set_id").references(() => previdentiaryRuleSets.id, {
      onDelete: "restrict",
    }),
    ruleSetVersion: text("rule_set_version").notNull(),
    referenceDate: timestamp("reference_date", { withTimezone: true, mode: "date" }).notNull(),
    inputSnapshot: jsonb("input_snapshot").$type<Record<string, unknown>>().notNull().default({}),
    resultSnapshot: jsonb("result_snapshot").$type<Record<string, unknown>>(),
    status: previdentiaryCalculationStatusEnum("status").notNull().default("draft"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    reviewedByMembershipId: uuid("reviewed_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("previdentiary_calculations_org_idx").on(table.organizationId),
    index("previdentiary_calculations_case_idx").on(table.previdentiaryCaseId),
    index("previdentiary_calculations_org_status_idx").on(table.organizationId, table.status),
    index("previdentiary_calculations_reference_idx").on(table.referenceDate),
    index("previdentiary_calculations_rule_set_idx").on(table.ruleSetId),
  ],
);

export const benefitScenarios = pgTable(
  "benefit_scenarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    previdentiaryCaseId: uuid("previdentiary_case_id")
      .notNull()
      .references(() => previdentiaryCases.id, { onDelete: "cascade" }),
    calculationId: uuid("calculation_id").references(() => previdentiaryCalculations.id, {
      onDelete: "set null",
    }),
    benefitTypeId: uuid("benefit_type_id").references(() => benefitTypes.id, {
      onDelete: "set null",
    }),
    der: timestamp("der", { withTimezone: true, mode: "date" }),
    ruleSetVersion: text("rule_set_version"),
    eligibilityStatus: text("eligibility_status"),
    estimatedRmiCents: bigint("estimated_rmi_cents", { mode: "number" }),
    estimatedStart: timestamp("estimated_start", { withTimezone: true, mode: "date" }),
    assumptions: jsonb("assumptions").$type<Record<string, unknown>>(),
    missingData: jsonb("missing_data").$type<unknown[]>(),
    reviewStatus: benefitScenarioReviewStatusEnum("review_status").notNull().default("draft"),
    ...timestamps,
  },
  (table) => [
    index("benefit_scenarios_org_idx").on(table.organizationId),
    index("benefit_scenarios_case_idx").on(table.previdentiaryCaseId),
    index("benefit_scenarios_review_idx").on(table.organizationId, table.reviewStatus),
  ],
);

export const benefitArrearsCalculations = pgTable(
  "benefit_arrears_calculations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    previdentiaryCaseId: uuid("previdentiary_case_id")
      .notNull()
      .references(() => previdentiaryCases.id, { onDelete: "cascade" }),
    calculationId: uuid("calculation_id").references(() => previdentiaryCalculations.id, {
      onDelete: "set null",
    }),
    benefitId: uuid("benefit_id").references(() => socialSecurityBenefits.id, {
      onDelete: "set null",
    }),
    startDate: timestamp("start_date", { withTimezone: true, mode: "date" }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true, mode: "date" }).notNull(),
    monthlyValues: jsonb("monthly_values").$type<unknown[]>(),
    correctionIndex: text("correction_index"),
    interestRule: text("interest_rule"),
    deductions: jsonb("deductions").$type<unknown[]>(),
    totalPrincipalCents: bigint("total_principal_cents", { mode: "number" }).notNull().default(0),
    totalCorrectionCents: bigint("total_correction_cents", { mode: "number" }).notNull().default(0),
    totalInterestCents: bigint("total_interest_cents", { mode: "number" }).notNull().default(0),
    totalCents: bigint("total_cents", { mode: "number" }).notNull().default(0),
    ruleSetVersion: text("rule_set_version"),
    status: previdentiaryCalculationStatusEnum("status").notNull().default("draft"),
    ...timestamps,
  },
  (table) => [
    index("benefit_arrears_calculations_org_idx").on(table.organizationId),
    index("benefit_arrears_calculations_case_idx").on(table.previdentiaryCaseId),
    index("benefit_arrears_calculations_dates_idx").on(table.startDate, table.endDate),
    index("benefit_arrears_calculations_status_idx").on(table.organizationId, table.status),
  ],
);

export const cnisImports = pgTable(
  "cnis_imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    previdentiaryCaseId: uuid("previdentiary_case_id")
      .notNull()
      .references(() => previdentiaryCases.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => crmClients.id, { onDelete: "restrict" }),
    sourceDocumentId: uuid("source_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    importFormat: text("import_format").notNull().default("manual"),
    status: cnisImportStatusEnum("status").notNull().default("draft"),
    source: socialSecurityBenefitSourceEnum("source").notNull().default("manual"),
    notes: text("notes"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    reviewedByMembershipId: uuid("reviewed_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("cnis_imports_org_idx").on(table.organizationId),
    index("cnis_imports_case_idx").on(table.previdentiaryCaseId),
    index("cnis_imports_org_status_idx").on(table.organizationId, table.status),
    index("cnis_imports_org_client_idx").on(table.organizationId, table.clientId),
  ],
);

export const cnisEntries = pgTable(
  "cnis_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    importId: uuid("import_id")
      .notNull()
      .references(() => cnisImports.id, { onDelete: "cascade" }),
    competence: text("competence").notNull(),
    relationshipType: text("relationship_type"),
    employer: text("employer"),
    employerDocument: text("employer_document"),
    remunerationCents: bigint("remuneration_cents", { mode: "number" }),
    contributionCents: bigint("contribution_cents", { mode: "number" }),
    indicators: jsonb("indicators").$type<Record<string, unknown>>(),
    source: socialSecurityBenefitSourceEnum("source").notNull().default("import"),
    reviewStatus: cnisEntryReviewStatusEnum("review_status").notNull().default("unreviewed"),
    ...timestamps,
  },
  (table) => [
    index("cnis_entries_org_idx").on(table.organizationId),
    index("cnis_entries_import_idx").on(table.importId),
    index("cnis_entries_competence_idx").on(table.organizationId, table.competence),
    index("cnis_entries_review_idx").on(table.organizationId, table.reviewStatus),
  ],
);

export const cnisWarnings = pgTable(
  "cnis_warnings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    importId: uuid("import_id")
      .notNull()
      .references(() => cnisImports.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id").references(() => cnisEntries.id, { onDelete: "set null" }),
    code: text("code").notNull(),
    severity: text("severity").notNull().default("warning"),
    message: text("message").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("cnis_warnings_org_idx").on(table.organizationId),
    index("cnis_warnings_import_idx").on(table.importId),
    index("cnis_warnings_entry_idx").on(table.entryId),
  ],
);

/**
 * Placeholders NÃO oficiais — source=system_seed.
 * NÃO usar como catálogo oficial do INSS.
 */
export const SEED_BENEFIT_TYPES = [
  {
    code: "SEED-APOS-IDADE",
    name: "[SEED] Aposentadoria por idade (placeholder)",
    category: "retirement" as const,
    regime: "rgps" as const,
  },
  {
    code: "SEED-APOS-TEMPO",
    name: "[SEED] Aposentadoria por tempo de contribuição (placeholder)",
    category: "retirement" as const,
    regime: "rgps" as const,
  },
  {
    code: "SEED-AUX-DOENCA",
    name: "[SEED] Auxílio por incapacidade temporária (placeholder)",
    category: "disability" as const,
    regime: "rgps" as const,
  },
  {
    code: "SEED-BPC-LOAS",
    name: "[SEED] BPC/LOAS (placeholder assistencial)",
    category: "bpc_loas" as const,
    regime: "rgps" as const,
  },
  {
    code: "SEED-PENSAO-MORTE",
    name: "[SEED] Pensão por morte (placeholder)",
    category: "survivor_pension" as const,
    regime: "rgps" as const,
  },
] as const;

export const SEED_BENEFIT_TYPE_SOURCE = "system_seed" as const;

export function normalizeNb(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export const previdentiaryCasesRelations = relations(previdentiaryCases, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [previdentiaryCases.organizationId],
    references: [organizations.id],
  }),
  client: one(crmClients, {
    fields: [previdentiaryCases.clientId],
    references: [crmClients.id],
  }),
  legalMatter: one(legalMatters, {
    fields: [previdentiaryCases.legalMatterId],
    references: [legalMatters.id],
  }),
  responsibleMembership: one(organizationMembers, {
    fields: [previdentiaryCases.responsibleMembershipId],
    references: [organizationMembers.id],
  }),
  benefits: many(socialSecurityBenefits),
  periods: many(socialSecurityPeriods),
  contributions: many(socialSecurityContributions),
  requests: many(previdentiaryRequests),
  calculations: many(previdentiaryCalculations),
  cnisImports: many(cnisImports),
}));

export const previdentiaryClientProfilesRelations = relations(
  previdentiaryClientProfiles,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [previdentiaryClientProfiles.organizationId],
      references: [organizations.id],
    }),
    client: one(crmClients, {
      fields: [previdentiaryClientProfiles.clientId],
      references: [crmClients.id],
    }),
  }),
);

export const benefitTypesRelations = relations(benefitTypes, ({ many }) => ({
  benefits: many(socialSecurityBenefits),
}));

export const socialSecurityBenefitsRelations = relations(
  socialSecurityBenefits,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [socialSecurityBenefits.organizationId],
      references: [organizations.id],
    }),
    previdentiaryCase: one(previdentiaryCases, {
      fields: [socialSecurityBenefits.previdentiaryCaseId],
      references: [previdentiaryCases.id],
    }),
    client: one(crmClients, {
      fields: [socialSecurityBenefits.clientId],
      references: [crmClients.id],
    }),
    benefitType: one(benefitTypes, {
      fields: [socialSecurityBenefits.benefitTypeId],
      references: [benefitTypes.id],
    }),
    administrativeProcess: one(administrativeProcesses, {
      fields: [socialSecurityBenefits.administrativeProcessId],
      references: [administrativeProcesses.id],
    }),
    judicialProcess: one(judicialProcesses, {
      fields: [socialSecurityBenefits.judicialProcessId],
      references: [judicialProcesses.id],
    }),
    history: many(socialSecurityBenefitHistory),
  }),
);

export const socialSecurityBenefitHistoryRelations = relations(
  socialSecurityBenefitHistory,
  ({ one }) => ({
    benefit: one(socialSecurityBenefits, {
      fields: [socialSecurityBenefitHistory.benefitId],
      references: [socialSecurityBenefits.id],
    }),
    document: one(documents, {
      fields: [socialSecurityBenefitHistory.documentId],
      references: [documents.id],
    }),
  }),
);

export const socialSecurityPeriodsRelations = relations(socialSecurityPeriods, ({ one, many }) => ({
  previdentiaryCase: one(previdentiaryCases, {
    fields: [socialSecurityPeriods.previdentiaryCaseId],
    references: [previdentiaryCases.id],
  }),
  contributions: many(socialSecurityContributions),
}));

export const socialSecurityContributionsRelations = relations(
  socialSecurityContributions,
  ({ one }) => ({
    period: one(socialSecurityPeriods, {
      fields: [socialSecurityContributions.periodId],
      references: [socialSecurityPeriods.id],
    }),
    previdentiaryCase: one(previdentiaryCases, {
      fields: [socialSecurityContributions.previdentiaryCaseId],
      references: [previdentiaryCases.id],
    }),
  }),
);

export const specialPeriodsRelations = relations(specialPeriods, ({ one }) => ({
  previdentiaryCase: one(previdentiaryCases, {
    fields: [specialPeriods.previdentiaryCaseId],
    references: [previdentiaryCases.id],
  }),
  period: one(socialSecurityPeriods, {
    fields: [specialPeriods.periodId],
    references: [socialSecurityPeriods.id],
  }),
}));

export const ruralPeriodsRelations = relations(ruralPeriods, ({ one }) => ({
  previdentiaryCase: one(previdentiaryCases, {
    fields: [ruralPeriods.previdentiaryCaseId],
    references: [previdentiaryCases.id],
  }),
  period: one(socialSecurityPeriods, {
    fields: [ruralPeriods.periodId],
    references: [socialSecurityPeriods.id],
  }),
}));

export const previdentiaryRequestsRelations = relations(previdentiaryRequests, ({ one, many }) => ({
  previdentiaryCase: one(previdentiaryCases, {
    fields: [previdentiaryRequests.previdentiaryCaseId],
    references: [previdentiaryCases.id],
  }),
  administrativeProcess: one(administrativeProcesses, {
    fields: [previdentiaryRequests.administrativeProcessId],
    references: [administrativeProcesses.id],
  }),
  benefitType: one(benefitTypes, {
    fields: [previdentiaryRequests.benefitTypeId],
    references: [benefitTypes.id],
  }),
  medicalExams: many(previdentiaryMedicalExams),
  socialAssessments: many(previdentiarySocialAssessments),
}));

export const previdentiaryMedicalExamsRelations = relations(
  previdentiaryMedicalExams,
  ({ one }) => ({
    request: one(previdentiaryRequests, {
      fields: [previdentiaryMedicalExams.requestId],
      references: [previdentiaryRequests.id],
    }),
    calendarEvent: one(calendarEvents, {
      fields: [previdentiaryMedicalExams.calendarEventId],
      references: [calendarEvents.id],
    }),
    document: one(documents, {
      fields: [previdentiaryMedicalExams.documentId],
      references: [documents.id],
    }),
  }),
);

export const previdentiarySocialAssessmentsRelations = relations(
  previdentiarySocialAssessments,
  ({ one }) => ({
    request: one(previdentiaryRequests, {
      fields: [previdentiarySocialAssessments.requestId],
      references: [previdentiaryRequests.id],
    }),
    calendarEvent: one(calendarEvents, {
      fields: [previdentiarySocialAssessments.calendarEventId],
      references: [calendarEvents.id],
    }),
    document: one(documents, {
      fields: [previdentiarySocialAssessments.documentId],
      references: [documents.id],
    }),
  }),
);

export const previdentiaryRuleSetsRelations = relations(previdentiaryRuleSets, ({ many }) => ({
  calculations: many(previdentiaryCalculations),
}));

export const previdentiaryCalculationsRelations = relations(
  previdentiaryCalculations,
  ({ one, many }) => ({
    previdentiaryCase: one(previdentiaryCases, {
      fields: [previdentiaryCalculations.previdentiaryCaseId],
      references: [previdentiaryCases.id],
    }),
    ruleSet: one(previdentiaryRuleSets, {
      fields: [previdentiaryCalculations.ruleSetId],
      references: [previdentiaryRuleSets.id],
    }),
    scenarios: many(benefitScenarios),
    arrears: many(benefitArrearsCalculations),
  }),
);

export const benefitScenariosRelations = relations(benefitScenarios, ({ one }) => ({
  previdentiaryCase: one(previdentiaryCases, {
    fields: [benefitScenarios.previdentiaryCaseId],
    references: [previdentiaryCases.id],
  }),
  calculation: one(previdentiaryCalculations, {
    fields: [benefitScenarios.calculationId],
    references: [previdentiaryCalculations.id],
  }),
  benefitType: one(benefitTypes, {
    fields: [benefitScenarios.benefitTypeId],
    references: [benefitTypes.id],
  }),
}));

export const benefitArrearsCalculationsRelations = relations(
  benefitArrearsCalculations,
  ({ one }) => ({
    previdentiaryCase: one(previdentiaryCases, {
      fields: [benefitArrearsCalculations.previdentiaryCaseId],
      references: [previdentiaryCases.id],
    }),
    calculation: one(previdentiaryCalculations, {
      fields: [benefitArrearsCalculations.calculationId],
      references: [previdentiaryCalculations.id],
    }),
    benefit: one(socialSecurityBenefits, {
      fields: [benefitArrearsCalculations.benefitId],
      references: [socialSecurityBenefits.id],
    }),
  }),
);

export const cnisImportsRelations = relations(cnisImports, ({ one, many }) => ({
  previdentiaryCase: one(previdentiaryCases, {
    fields: [cnisImports.previdentiaryCaseId],
    references: [previdentiaryCases.id],
  }),
  client: one(crmClients, {
    fields: [cnisImports.clientId],
    references: [crmClients.id],
  }),
  sourceDocument: one(documents, {
    fields: [cnisImports.sourceDocumentId],
    references: [documents.id],
  }),
  entries: many(cnisEntries),
  warnings: many(cnisWarnings),
}));

export const cnisEntriesRelations = relations(cnisEntries, ({ one, many }) => ({
  import: one(cnisImports, {
    fields: [cnisEntries.importId],
    references: [cnisImports.id],
  }),
  warnings: many(cnisWarnings),
}));

export const cnisWarningsRelations = relations(cnisWarnings, ({ one }) => ({
  import: one(cnisImports, {
    fields: [cnisWarnings.importId],
    references: [cnisImports.id],
  }),
  entry: one(cnisEntries, {
    fields: [cnisWarnings.entryId],
    references: [cnisEntries.id],
  }),
}));
