import { relations } from "drizzle-orm";
import {
  bigint,
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
import { aiRequests } from "./ai.js";
import { documents } from "./documents.js";
import { organizationMembers, organizations } from "./identity.js";
import { judicialProcesses } from "./judicial.js";
import { legalMatters } from "./matters.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const legalAnalysisStatusEnum = pgEnum("legal_ai_analysis_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "not_configured",
  "requires_review",
  "reviewed",
]);

export const legalAnalysisItemReviewEnum = pgEnum("legal_analysis_item_review_status", [
  "unreviewed",
  "accepted",
  "corrected",
  "rejected",
]);

export const legalAiAnalyses = pgTable(
  "legal_ai_analyses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id").references(() => legalMatters.id, {
      onDelete: "cascade",
    }),
    judicialProcessId: uuid("judicial_process_id").references(() => judicialProcesses.id, {
      onDelete: "cascade",
    }),
    administrativeProcessId: uuid("administrative_process_id").references(
      () => administrativeProcesses.id,
      { onDelete: "cascade" },
    ),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "cascade" }),
    aiRequestId: uuid("ai_request_id").references(() => aiRequests.id, { onDelete: "set null" }),
    analysisType: text("analysis_type").notNull(),
    status: legalAnalysisStatusEnum("status").notNull().default("pending"),
    version: integer("version").notNull().default(1),
    disposition: text("disposition").notNull().default("requires_review"),
    summary: text("summary"),
    structuredResult: jsonb("structured_result").$type<Record<string, unknown>>(),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
    reviewedByMembershipId: uuid("reviewed_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    reviewComment: text("review_comment"),
    ...timestamps,
  },
  (table) => [
    index("legal_ai_analyses_org_idx").on(table.organizationId),
    index("legal_ai_analyses_matter_idx").on(table.legalMatterId),
    index("legal_ai_analyses_document_idx").on(table.documentId),
    uniqueIndex("legal_ai_analyses_matter_type_version_unique").on(
      table.organizationId,
      table.legalMatterId,
      table.analysisType,
      table.version,
    ),
  ],
);

export const legalAnalysisFacts = pgTable(
  "legal_analysis_facts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => legalAiAnalyses.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    category: text("category"),
    disputeStatus: text("dispute_status").notNull().default("unknown"),
    sourceLabel: text("source_label"),
    documentId: uuid("document_id"),
    pageNumber: integer("page_number"),
    confidence: integer("confidence"),
    reviewStatus: legalAnalysisItemReviewEnum("review_status").notNull().default("unreviewed"),
    correctedText: text("corrected_text"),
    reviewComment: text("review_comment"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("legal_analysis_facts_analysis_idx").on(table.analysisId),
    index("legal_analysis_facts_org_idx").on(table.organizationId),
  ],
);

export const legalAnalysisClaims = pgTable(
  "legal_analysis_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => legalAiAnalyses.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    claimType: text("claim_type"),
    relatedParty: text("related_party"),
    sourceLabel: text("source_label"),
    documentId: uuid("document_id"),
    pageNumber: integer("page_number"),
    observation: text("observation"),
    reviewStatus: legalAnalysisItemReviewEnum("review_status").notNull().default("unreviewed"),
    correctedText: text("corrected_text"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("legal_analysis_claims_analysis_idx").on(table.analysisId)],
);

/** Fundamentação presente no documento vs sugerida pela IA — campos distintos. */
export const legalAnalysisGrounds = pgTable(
  "legal_analysis_grounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => legalAiAnalyses.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    text: text("text").notNull(),
    sourceLabel: text("source_label"),
    documentId: uuid("document_id"),
    pageNumber: integer("page_number"),
    confidence: integer("confidence"),
    reviewStatus: legalAnalysisItemReviewEnum("review_status").notNull().default("unreviewed"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("legal_analysis_grounds_analysis_idx").on(table.analysisId)],
);

export const legalAnalysisEvidenceLinks = pgTable(
  "legal_analysis_evidence_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => legalAiAnalyses.id, { onDelete: "cascade" }),
    factId: uuid("fact_id").references(() => legalAnalysisFacts.id, { onDelete: "cascade" }),
    claimId: uuid("claim_id").references(() => legalAnalysisClaims.id, { onDelete: "cascade" }),
    proposition: text("proposition").notNull(),
    evidenceDocumentId: uuid("evidence_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    pageNumber: integer("page_number"),
    excerptReference: text("excerpt_reference"),
    relevance: text("relevance"),
    reviewStatus: legalAnalysisItemReviewEnum("review_status").notNull().default("unreviewed"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("legal_analysis_evidence_analysis_idx").on(table.analysisId)],
);

export const legalAnalysisContradictions = pgTable(
  "legal_analysis_contradictions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => legalAiAnalyses.id, { onDelete: "cascade" }),
    statementA: text("statement_a").notNull(),
    sourceA: text("source_a"),
    statementB: text("statement_b").notNull(),
    sourceB: text("source_b"),
    explanation: text("explanation"),
    severity: text("severity").notNull().default("medium"),
    confidence: integer("confidence"),
    reviewStatus: legalAnalysisItemReviewEnum("review_status").notNull().default("unreviewed"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("legal_analysis_contradictions_analysis_idx").on(table.analysisId)],
);

export const legalAnalysisDates = pgTable(
  "legal_analysis_dates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => legalAiAnalyses.id, { onDelete: "cascade" }),
    dateValue: text("date_value").notNull(),
    dateType: text("date_type"),
    description: text("description"),
    sourcePage: integer("source_page"),
    confidence: integer("confidence"),
    reviewStatus: legalAnalysisItemReviewEnum("review_status").notNull().default("unreviewed"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("legal_analysis_dates_analysis_idx").on(table.analysisId)],
);

export const legalAnalysisParties = pgTable(
  "legal_analysis_parties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => legalAiAnalyses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    inferredRole: text("inferred_role"),
    sourceLabel: text("source_label"),
    pageNumber: integer("page_number"),
    confidence: integer("confidence"),
    reviewStatus: legalAnalysisItemReviewEnum("review_status").notNull().default("unreviewed"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("legal_analysis_parties_analysis_idx").on(table.analysisId)],
);

export const legalAnalysisAmounts = pgTable(
  "legal_analysis_amounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => legalAiAnalyses.id, { onDelete: "cascade" }),
    originalText: text("original_text").notNull(),
    /** Valor normalizado em centavos (inteiro). */
    amountCents: bigint("amount_cents", { mode: "number" }),
    currency: text("currency").notNull().default("BRL"),
    context: text("context"),
    sourceLabel: text("source_label"),
    pageNumber: integer("page_number"),
    confidence: integer("confidence"),
    reviewStatus: legalAnalysisItemReviewEnum("review_status").notNull().default("unreviewed"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("legal_analysis_amounts_analysis_idx").on(table.analysisId)],
);

export const legalAnalysisObligations = pgTable(
  "legal_analysis_obligations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => legalAiAnalyses.id, { onDelete: "cascade" }),
    obligor: text("obligor"),
    beneficiary: text("beneficiary"),
    action: text("action").notNull(),
    condition: text("condition"),
    deadlineText: text("deadline_text"),
    amountCents: bigint("amount_cents", { mode: "number" }),
    sourceLabel: text("source_label"),
    confidence: integer("confidence"),
    reviewStatus: legalAnalysisItemReviewEnum("review_status").notNull().default("unreviewed"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("legal_analysis_obligations_analysis_idx").on(table.analysisId)],
);

export const legalAnalysisMissingInfo = pgTable(
  "legal_analysis_missing_info",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => legalAiAnalyses.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    description: text("description").notNull(),
    reviewStatus: legalAnalysisItemReviewEnum("review_status").notNull().default("unreviewed"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("legal_analysis_missing_analysis_idx").on(table.analysisId)],
);

export const legalAiAnalysesRelations = relations(legalAiAnalyses, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [legalAiAnalyses.organizationId],
    references: [organizations.id],
  }),
  matter: one(legalMatters, {
    fields: [legalAiAnalyses.legalMatterId],
    references: [legalMatters.id],
  }),
  document: one(documents, {
    fields: [legalAiAnalyses.documentId],
    references: [documents.id],
  }),
  aiRequest: one(aiRequests, {
    fields: [legalAiAnalyses.aiRequestId],
    references: [aiRequests.id],
  }),
  facts: many(legalAnalysisFacts),
  claims: many(legalAnalysisClaims),
  grounds: many(legalAnalysisGrounds),
  evidence: many(legalAnalysisEvidenceLinks),
  contradictions: many(legalAnalysisContradictions),
  dates: many(legalAnalysisDates),
  parties: many(legalAnalysisParties),
  amounts: many(legalAnalysisAmounts),
  obligations: many(legalAnalysisObligations),
  missingInfo: many(legalAnalysisMissingInfo),
}));

export const legalAnalysisFactsRelations = relations(legalAnalysisFacts, ({ one }) => ({
  analysis: one(legalAiAnalyses, {
    fields: [legalAnalysisFacts.analysisId],
    references: [legalAiAnalyses.id],
  }),
}));

export const legalAnalysisClaimsRelations = relations(legalAnalysisClaims, ({ one }) => ({
  analysis: one(legalAiAnalyses, {
    fields: [legalAnalysisClaims.analysisId],
    references: [legalAiAnalyses.id],
  }),
}));

export const legalAnalysisGroundsRelations = relations(legalAnalysisGrounds, ({ one }) => ({
  analysis: one(legalAiAnalyses, {
    fields: [legalAnalysisGrounds.analysisId],
    references: [legalAiAnalyses.id],
  }),
}));

export const legalAnalysisEvidenceLinksRelations = relations(
  legalAnalysisEvidenceLinks,
  ({ one }) => ({
    analysis: one(legalAiAnalyses, {
      fields: [legalAnalysisEvidenceLinks.analysisId],
      references: [legalAiAnalyses.id],
    }),
  }),
);

export const legalAnalysisContradictionsRelations = relations(
  legalAnalysisContradictions,
  ({ one }) => ({
    analysis: one(legalAiAnalyses, {
      fields: [legalAnalysisContradictions.analysisId],
      references: [legalAiAnalyses.id],
    }),
  }),
);

export const legalAnalysisDatesRelations = relations(legalAnalysisDates, ({ one }) => ({
  analysis: one(legalAiAnalyses, {
    fields: [legalAnalysisDates.analysisId],
    references: [legalAiAnalyses.id],
  }),
}));

export const legalAnalysisPartiesRelations = relations(legalAnalysisParties, ({ one }) => ({
  analysis: one(legalAiAnalyses, {
    fields: [legalAnalysisParties.analysisId],
    references: [legalAiAnalyses.id],
  }),
}));

export const legalAnalysisAmountsRelations = relations(legalAnalysisAmounts, ({ one }) => ({
  analysis: one(legalAiAnalyses, {
    fields: [legalAnalysisAmounts.analysisId],
    references: [legalAiAnalyses.id],
  }),
}));

export const legalAnalysisObligationsRelations = relations(legalAnalysisObligations, ({ one }) => ({
  analysis: one(legalAiAnalyses, {
    fields: [legalAnalysisObligations.analysisId],
    references: [legalAiAnalyses.id],
  }),
}));

export const legalAnalysisMissingInfoRelations = relations(legalAnalysisMissingInfo, ({ one }) => ({
  analysis: one(legalAiAnalyses, {
    fields: [legalAnalysisMissingInfo.analysisId],
    references: [legalAiAnalyses.id],
  }),
}));
