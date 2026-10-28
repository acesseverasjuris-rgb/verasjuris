/**
 * Etapa 11 — Tributário.
 * TaxCase estende LegalMatter; AdministrativeProcess/JudicialProcess são reutilizados.
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
import { administrativeProcesses } from "./administrative.js";
import { crmClients } from "./crm.js";
import { documents } from "./documents.js";
import { organizationMembers, organizations } from "./identity.js";
import { judicialProcesses } from "./judicial.js";
import { legalMatters } from "./matters.js";
import { deadlines } from "./productivity.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const taxTaxpayerTypeEnum = pgEnum("tax_taxpayer_type", [
  "individual",
  "company",
  "mei",
  "public_body",
  "other",
]);

export const taxJurisdictionScopeEnum = pgEnum("tax_jurisdiction_scope", [
  "federal",
  "state",
  "municipal",
  "mixed",
  "other",
]);

export const taxCaseStatusEnum = pgEnum("tax_case_status", [
  "draft",
  "active",
  "suspended",
  "closed",
  "archived",
]);

export const taxJurisdictionEnum = pgEnum("tax_jurisdiction", [
  "federal",
  "state",
  "municipal",
  "other",
]);

export const taxNatureEnum = pgEnum("tax_nature", [
  "tax",
  "fee",
  "contribution",
  "improvement",
  "other",
]);

export const taxTypeSourceEnum = pgEnum("tax_type_source", [
  "system_seed",
  "organization",
  "import",
  "provider",
  "not_configured",
]);

export const taxObligationTypeEnum = pgEnum("tax_obligation_type", [
  "principal",
  "accessory",
  "payment",
  "declaration",
  "filing",
  "bookkeeping",
  "withholding",
  "other",
]);

export const taxObligationStatusEnum = pgEnum("tax_obligation_status", [
  "draft",
  "open",
  "pending",
  "fulfilled",
  "overdue",
  "disputed",
  "cancelled",
]);

export const taxCreditOriginEnum = pgEnum("tax_credit_origin", [
  "overpayment",
  "undue_payment",
  "judicial_recognition",
  "administrative_recognition",
  "withholding",
  "incentive",
  "other",
]);

export const taxCreditStatusEnum = pgEnum("tax_credit_status", [
  "draft",
  "identified",
  "under_review",
  "confirmed",
  "used",
  "expired",
  "cancelled",
]);

export const taxRefundStatusEnum = pgEnum("tax_refund_status", [
  "draft",
  "requested",
  "under_analysis",
  "partially_granted",
  "granted",
  "denied",
  "cancelled",
]);

export const taxCompensationStatusEnum = pgEnum("tax_compensation_status", [
  "draft",
  "requested",
  "under_analysis",
  "accepted",
  "partially_accepted",
  "rejected",
  "cancelled",
]);

export const taxAssessmentStatusEnum = pgEnum("tax_assessment_status", [
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
]);

export const taxThesisStatusEnum = pgEnum("tax_thesis_status", [
  "draft",
  "under_research",
  "supported",
  "contested",
  "outdated",
  "superseded",
  "archived",
]);

export const taxThesisRiskLevelEnum = pgEnum("tax_thesis_risk_level", [
  "low",
  "medium",
  "high",
  "critical",
  "unknown",
]);

export const taxThesisApplicabilityEnum = pgEnum("tax_thesis_applicability", [
  "suggested",
  "applicable",
  "not_applicable",
  "needs_review",
  "rejected",
]);

export const taxCalculationTypeEnum = pgEnum("tax_calculation_type", [
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
]);

export const taxCalculationStatusEnum = pgEnum("tax_calculation_status", [
  "draft",
  "calculated",
  "review_required",
  "reviewed",
  "approved",
  "superseded",
]);

export const taxGuaranteeTypeEnum = pgEnum("tax_guarantee_type", [
  "cash",
  "bank_guarantee",
  "insurance",
  "property",
  "vehicle",
  "receivable",
  "other",
]);

export const taxGuaranteeStatusEnum = pgEnum("tax_guarantee_status", [
  "draft",
  "proposed",
  "accepted",
  "rejected",
  "released",
  "executed",
  "cancelled",
]);

export const taxEnforcementStatusEnum = pgEnum("tax_enforcement_status", [
  "draft",
  "filed",
  "active",
  "suspended",
  "settled",
  "extinguished",
  "archived",
]);

export const taxAdminCasePhaseEnum = pgEnum("tax_admin_case_phase", [
  "impugnacao",
  "defesa",
  "diligencia",
  "julgamento",
  "recurso",
  "decisao_final",
  "other",
]);

export const taxCases = pgTable(
  "tax_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => crmClients.id, { onDelete: "restrict" }),
    responsibleMembershipId: uuid("responsible_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    taxpayerType: taxTaxpayerTypeEnum("taxpayer_type").notNull().default("company"),
    jurisdictionScope: taxJurisdictionScopeEnum("jurisdiction_scope").notNull().default("federal"),
    status: taxCaseStatusEnum("status").notNull().default("draft"),
    notes: text("notes"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("tax_cases_org_idx").on(table.organizationId),
    index("tax_cases_org_client_idx").on(table.organizationId, table.clientId),
    index("tax_cases_matter_idx").on(table.legalMatterId),
    index("tax_cases_org_status_idx").on(table.organizationId, table.status),
  ],
);

/** Catálogo configurável — seed inicial NÃO é catálogo oficial completo. */
export const taxTypes = pgTable(
  "tax_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    jurisdiction: taxJurisdictionEnum("jurisdiction").notNull().default("federal"),
    taxNature: taxNatureEnum("tax_nature").notNull().default("tax"),
    active: boolean("active").notNull().default(true),
    source: taxTypeSourceEnum("source").notNull().default("system_seed"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("tax_types_code_unique").on(table.code),
    index("tax_types_jurisdiction_idx").on(table.jurisdiction),
    index("tax_types_active_idx").on(table.active),
  ],
);

export const taxObligations = pgTable(
  "tax_obligations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    taxCaseId: uuid("tax_case_id")
      .notNull()
      .references(() => taxCases.id, { onDelete: "cascade" }),
    taxTypeId: uuid("tax_type_id")
      .notNull()
      .references(() => taxTypes.id, { onDelete: "restrict" }),
    obligationType: taxObligationTypeEnum("obligation_type").notNull().default("principal"),
    competence: text("competence"),
    dueDate: timestamp("due_date", { withTimezone: true, mode: "date" }),
    amountCents: bigint("amount_cents", { mode: "number" }),
    status: taxObligationStatusEnum("status").notNull().default("draft"),
    source: text("source").notNull().default("manual"),
    evidenceDocumentId: uuid("evidence_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    deadlineId: uuid("deadline_id").references(() => deadlines.id, { onDelete: "set null" }),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("tax_obligations_org_case_idx").on(table.organizationId, table.taxCaseId),
    index("tax_obligations_status_idx").on(table.status),
    index("tax_obligations_due_date_idx").on(table.dueDate),
  ],
);

export const taxCredits = pgTable(
  "tax_credits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    taxCaseId: uuid("tax_case_id")
      .notNull()
      .references(() => taxCases.id, { onDelete: "cascade" }),
    taxTypeId: uuid("tax_type_id")
      .notNull()
      .references(() => taxTypes.id, { onDelete: "restrict" }),
    origin: taxCreditOriginEnum("origin").notNull().default("other"),
    competenceStart: text("competence_start"),
    competenceEnd: text("competence_end"),
    principalCents: bigint("principal_cents", { mode: "number" }).notNull().default(0),
    correctionCents: bigint("correction_cents", { mode: "number" }).notNull().default(0),
    interestCents: bigint("interest_cents", { mode: "number" }).notNull().default(0),
    penaltyCents: bigint("penalty_cents", { mode: "number" }).notNull().default(0),
    totalCents: bigint("total_cents", { mode: "number" }).notNull().default(0),
    status: taxCreditStatusEnum("status").notNull().default("draft"),
    source: text("source").notNull().default("manual"),
    calculationId: uuid("calculation_id"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("tax_credits_org_case_idx").on(table.organizationId, table.taxCaseId),
    index("tax_credits_status_idx").on(table.status),
  ],
);

export const taxRefundRequests = pgTable(
  "tax_refund_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    taxCaseId: uuid("tax_case_id")
      .notNull()
      .references(() => taxCases.id, { onDelete: "cascade" }),
    taxCreditId: uuid("tax_credit_id")
      .notNull()
      .references(() => taxCredits.id, { onDelete: "restrict" }),
    administrativeProcessId: uuid("administrative_process_id").references(
      () => administrativeProcesses.id,
      { onDelete: "set null" },
    ),
    requestDate: timestamp("request_date", { withTimezone: true, mode: "date" }).notNull(),
    protocolNumber: text("protocol_number"),
    amountRequestedCents: bigint("amount_requested_cents", { mode: "number" }).notNull(),
    amountGrantedCents: bigint("amount_granted_cents", { mode: "number" }),
    status: taxRefundStatusEnum("status").notNull().default("draft"),
    source: text("source").notNull().default("manual"),
    decisionDocumentId: uuid("decision_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("tax_refund_requests_org_case_idx").on(table.organizationId, table.taxCaseId),
    index("tax_refund_requests_status_idx").on(table.status),
  ],
);

export const taxCompensations = pgTable(
  "tax_compensations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    taxCaseId: uuid("tax_case_id")
      .notNull()
      .references(() => taxCases.id, { onDelete: "cascade" }),
    sourceCreditId: uuid("source_credit_id")
      .notNull()
      .references(() => taxCredits.id, { onDelete: "restrict" }),
    destinationTaxTypeId: uuid("destination_tax_type_id")
      .notNull()
      .references(() => taxTypes.id, { onDelete: "restrict" }),
    destinationCompetence: text("destination_competence"),
    requestedAmountCents: bigint("requested_amount_cents", { mode: "number" }).notNull(),
    acceptedAmountCents: bigint("accepted_amount_cents", { mode: "number" }),
    status: taxCompensationStatusEnum("status").notNull().default("draft"),
    protocol: text("protocol"),
    source: text("source").notNull().default("manual"),
    administrativeProcessId: uuid("administrative_process_id").references(
      () => administrativeProcesses.id,
      { onDelete: "set null" },
    ),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("tax_compensations_org_case_idx").on(table.organizationId, table.taxCaseId),
    index("tax_compensations_status_idx").on(table.status),
  ],
);

export const taxAssessments = pgTable(
  "tax_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    taxCaseId: uuid("tax_case_id")
      .notNull()
      .references(() => taxCases.id, { onDelete: "cascade" }),
    authority: text("authority").notNull(),
    assessmentNumber: text("assessment_number").notNull(),
    assessmentDate: timestamp("assessment_date", { withTimezone: true, mode: "date" }).notNull(),
    taxTypeId: uuid("tax_type_id")
      .notNull()
      .references(() => taxTypes.id, { onDelete: "restrict" }),
    principalCents: bigint("principal_cents", { mode: "number" }).notNull().default(0),
    penaltyCents: bigint("penalty_cents", { mode: "number" }).notNull().default(0),
    interestCents: bigint("interest_cents", { mode: "number" }).notNull().default(0),
    totalCents: bigint("total_cents", { mode: "number" }).notNull().default(0),
    legalBasisText: text("legal_basis_text"),
    status: taxAssessmentStatusEnum("status").notNull().default("draft"),
    administrativeProcessId: uuid("administrative_process_id").references(
      () => administrativeProcesses.id,
      { onDelete: "set null" },
    ),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    source: text("source").notNull().default("manual"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("tax_assessments_org_case_idx").on(table.organizationId, table.taxCaseId),
    index("tax_assessments_status_idx").on(table.status),
    uniqueIndex("tax_assessments_org_number_unique").on(
      table.organizationId,
      table.assessmentNumber,
    ),
  ],
);

/** Extensão especializada sobre AdministrativeProcess. */
export const taxAdministrativeCases = pgTable(
  "tax_administrative_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    taxCaseId: uuid("tax_case_id")
      .notNull()
      .references(() => taxCases.id, { onDelete: "cascade" }),
    administrativeProcessId: uuid("administrative_process_id")
      .notNull()
      .references(() => administrativeProcesses.id, { onDelete: "cascade" }),
    taxAssessmentId: uuid("tax_assessment_id").references(() => taxAssessments.id, {
      onDelete: "set null",
    }),
    phase: taxAdminCasePhaseEnum("phase").notNull().default("impugnacao"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("tax_administrative_cases_org_case_idx").on(table.organizationId, table.taxCaseId),
    uniqueIndex("tax_administrative_cases_admin_unique").on(table.administrativeProcessId),
  ],
);

export const taxDebtCertificates = pgTable(
  "tax_debt_certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    taxCaseId: uuid("tax_case_id")
      .notNull()
      .references(() => taxCases.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    issuer: text("issuer").notNull(),
    taxTypeId: uuid("tax_type_id").references(() => taxTypes.id, { onDelete: "set null" }),
    principalCents: bigint("principal_cents", { mode: "number" }).notNull().default(0),
    correctionCents: bigint("correction_cents", { mode: "number" }).notNull().default(0),
    interestCents: bigint("interest_cents", { mode: "number" }).notNull().default(0),
    penaltyCents: bigint("penalty_cents", { mode: "number" }).notNull().default(0),
    totalCents: bigint("total_cents", { mode: "number" }).notNull().default(0),
    registrationDate: timestamp("registration_date", { withTimezone: true, mode: "date" }),
    source: text("source").notNull().default("manual"),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("tax_debt_certificates_org_case_idx").on(table.organizationId, table.taxCaseId),
    uniqueIndex("tax_debt_certificates_org_number_unique").on(table.organizationId, table.number),
  ],
);

export const taxEnforcementCases = pgTable(
  "tax_enforcement_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    taxCaseId: uuid("tax_case_id")
      .notNull()
      .references(() => taxCases.id, { onDelete: "cascade" }),
    judicialProcessId: uuid("judicial_process_id")
      .notNull()
      .references(() => judicialProcesses.id, { onDelete: "cascade" }),
    debtCertificateId: uuid("debt_certificate_id").references(() => taxDebtCertificates.id, {
      onDelete: "set null",
    }),
    cdaNumber: text("cda_number"),
    cdaAmountCents: bigint("cda_amount_cents", { mode: "number" }),
    filingDate: timestamp("filing_date", { withTimezone: true, mode: "date" }),
    seizureStatus: text("seizure_status"),
    guaranteeType: taxGuaranteeTypeEnum("guarantee_type"),
    guaranteeAmountCents: bigint("guarantee_amount_cents", { mode: "number" }),
    embargoStatus: text("embargo_status"),
    exceptionStatus: text("exception_status"),
    installmentStatus: text("installment_status"),
    status: taxEnforcementStatusEnum("status").notNull().default("draft"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("tax_enforcement_cases_org_case_idx").on(table.organizationId, table.taxCaseId),
    uniqueIndex("tax_enforcement_cases_judicial_unique").on(table.judicialProcessId),
    index("tax_enforcement_cases_status_idx").on(table.status),
  ],
);

export const taxGuarantees = pgTable(
  "tax_guarantees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    taxCaseId: uuid("tax_case_id")
      .notNull()
      .references(() => taxCases.id, { onDelete: "cascade" }),
    enforcementCaseId: uuid("enforcement_case_id").references(() => taxEnforcementCases.id, {
      onDelete: "set null",
    }),
    guaranteeType: taxGuaranteeTypeEnum("guarantee_type").notNull().default("other"),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull().default(0),
    status: taxGuaranteeStatusEnum("status").notNull().default("draft"),
    description: text("description"),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    index("tax_guarantees_org_case_idx").on(table.organizationId, table.taxCaseId),
    index("tax_guarantees_status_idx").on(table.status),
  ],
);

export const taxLegalTheses = pgTable(
  "tax_legal_theses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    summary: text("summary"),
    taxTypeId: uuid("tax_type_id").references(() => taxTypes.id, { onDelete: "set null" }),
    legalBasis: text("legal_basis"),
    status: taxThesisStatusEnum("status").notNull().default("draft"),
    riskLevel: taxThesisRiskLevelEnum("risk_level").notNull().default("unknown"),
    sourceResearchId: uuid("source_research_id"),
    verifiedCitationCount: integer("verified_citation_count").notNull().default(0),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("tax_legal_theses_org_idx").on(table.organizationId),
    index("tax_legal_theses_status_idx").on(table.status),
  ],
);

export const taxCaseThesisLinks = pgTable(
  "tax_case_thesis_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    taxCaseId: uuid("tax_case_id")
      .notNull()
      .references(() => taxCases.id, { onDelete: "cascade" }),
    thesisId: uuid("thesis_id")
      .notNull()
      .references(() => taxLegalTheses.id, { onDelete: "cascade" }),
    applicabilityStatus: taxThesisApplicabilityEnum("applicability_status")
      .notNull()
      .default("suggested"),
    assumptions: jsonb("assumptions").$type<Record<string, unknown>>(),
    missingData: jsonb("missing_data").$type<string[]>(),
    reviewedByMembershipId: uuid("reviewed_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("tax_case_thesis_links_case_thesis_unique").on(table.taxCaseId, table.thesisId),
    index("tax_case_thesis_links_org_idx").on(table.organizationId),
  ],
);

export const taxRuleSets = pgTable(
  "tax_rule_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    version: text("version").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true, mode: "date" }).notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true, mode: "date" }),
    source: text("source").notNull().default("system"),
    sourceUrl: text("source_url"),
    status: text("status").notNull().default("active"),
    locked: boolean("locked").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("tax_rule_sets_key_version_unique").on(table.key, table.version),
    index("tax_rule_sets_status_idx").on(table.status),
  ],
);

export const taxCalculations = pgTable(
  "tax_calculations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    taxCaseId: uuid("tax_case_id")
      .notNull()
      .references(() => taxCases.id, { onDelete: "cascade" }),
    calculationType: taxCalculationTypeEnum("calculation_type").notNull().default("other"),
    taxTypeId: uuid("tax_type_id").references(() => taxTypes.id, { onDelete: "set null" }),
    ruleSetId: uuid("rule_set_id").references(() => taxRuleSets.id, { onDelete: "set null" }),
    ruleSetVersion: text("rule_set_version").notNull(),
    referenceDate: timestamp("reference_date", { withTimezone: true, mode: "date" }).notNull(),
    inputSnapshot: jsonb("input_snapshot").$type<Record<string, unknown>>().notNull(),
    resultSnapshot: jsonb("result_snapshot").$type<Record<string, unknown>>(),
    status: taxCalculationStatusEnum("status").notNull().default("draft"),
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
    index("tax_calculations_org_case_idx").on(table.organizationId, table.taxCaseId),
    index("tax_calculations_status_idx").on(table.status),
    index("tax_calculations_type_idx").on(table.calculationType),
  ],
);

/* Relations */

export const taxCasesRelations = relations(taxCases, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [taxCases.organizationId],
    references: [organizations.id],
  }),
  matter: one(legalMatters, { fields: [taxCases.legalMatterId], references: [legalMatters.id] }),
  client: one(crmClients, { fields: [taxCases.clientId], references: [crmClients.id] }),
  obligations: many(taxObligations),
  credits: many(taxCredits),
  assessments: many(taxAssessments),
  calculations: many(taxCalculations),
}));

export const taxTypesRelations = relations(taxTypes, ({ many }) => ({
  obligations: many(taxObligations),
  credits: many(taxCredits),
}));

export const taxObligationsRelations = relations(taxObligations, ({ one }) => ({
  taxCase: one(taxCases, { fields: [taxObligations.taxCaseId], references: [taxCases.id] }),
  taxType: one(taxTypes, { fields: [taxObligations.taxTypeId], references: [taxTypes.id] }),
}));

export const taxCreditsRelations = relations(taxCredits, ({ one }) => ({
  taxCase: one(taxCases, { fields: [taxCredits.taxCaseId], references: [taxCases.id] }),
  taxType: one(taxTypes, { fields: [taxCredits.taxTypeId], references: [taxTypes.id] }),
}));

export const taxRefundRequestsRelations = relations(taxRefundRequests, ({ one }) => ({
  taxCase: one(taxCases, { fields: [taxRefundRequests.taxCaseId], references: [taxCases.id] }),
  credit: one(taxCredits, {
    fields: [taxRefundRequests.taxCreditId],
    references: [taxCredits.id],
  }),
}));

export const taxCompensationsRelations = relations(taxCompensations, ({ one }) => ({
  taxCase: one(taxCases, { fields: [taxCompensations.taxCaseId], references: [taxCases.id] }),
  sourceCredit: one(taxCredits, {
    fields: [taxCompensations.sourceCreditId],
    references: [taxCredits.id],
  }),
}));

export const taxAssessmentsRelations = relations(taxAssessments, ({ one }) => ({
  taxCase: one(taxCases, { fields: [taxAssessments.taxCaseId], references: [taxCases.id] }),
  taxType: one(taxTypes, { fields: [taxAssessments.taxTypeId], references: [taxTypes.id] }),
}));

export const taxAdministrativeCasesRelations = relations(taxAdministrativeCases, ({ one }) => ({
  taxCase: one(taxCases, {
    fields: [taxAdministrativeCases.taxCaseId],
    references: [taxCases.id],
  }),
  administrativeProcess: one(administrativeProcesses, {
    fields: [taxAdministrativeCases.administrativeProcessId],
    references: [administrativeProcesses.id],
  }),
}));

export const taxDebtCertificatesRelations = relations(taxDebtCertificates, ({ one }) => ({
  taxCase: one(taxCases, { fields: [taxDebtCertificates.taxCaseId], references: [taxCases.id] }),
}));

export const taxEnforcementCasesRelations = relations(taxEnforcementCases, ({ one }) => ({
  taxCase: one(taxCases, { fields: [taxEnforcementCases.taxCaseId], references: [taxCases.id] }),
  judicialProcess: one(judicialProcesses, {
    fields: [taxEnforcementCases.judicialProcessId],
    references: [judicialProcesses.id],
  }),
  debtCertificate: one(taxDebtCertificates, {
    fields: [taxEnforcementCases.debtCertificateId],
    references: [taxDebtCertificates.id],
  }),
}));

export const taxGuaranteesRelations = relations(taxGuarantees, ({ one }) => ({
  taxCase: one(taxCases, { fields: [taxGuarantees.taxCaseId], references: [taxCases.id] }),
}));

export const taxLegalThesesRelations = relations(taxLegalTheses, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [taxLegalTheses.organizationId],
    references: [organizations.id],
  }),
  links: many(taxCaseThesisLinks),
}));

export const taxCaseThesisLinksRelations = relations(taxCaseThesisLinks, ({ one }) => ({
  taxCase: one(taxCases, { fields: [taxCaseThesisLinks.taxCaseId], references: [taxCases.id] }),
  thesis: one(taxLegalTheses, {
    fields: [taxCaseThesisLinks.thesisId],
    references: [taxLegalTheses.id],
  }),
}));

export const taxRuleSetsRelations = relations(taxRuleSets, ({ many }) => ({
  calculations: many(taxCalculations),
}));

export const taxCalculationsRelations = relations(taxCalculations, ({ one }) => ({
  taxCase: one(taxCases, { fields: [taxCalculations.taxCaseId], references: [taxCases.id] }),
  ruleSet: one(taxRuleSets, {
    fields: [taxCalculations.ruleSetId],
    references: [taxRuleSets.id],
  }),
}));
