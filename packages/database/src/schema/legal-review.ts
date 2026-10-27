import { relations } from "drizzle-orm";
import {
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
import { aiRequests } from "./ai.js";
import { documents, documentVersions } from "./documents.js";
import { organizationMembers, organizations } from "./identity.js";
import { judicialProcesses } from "./judicial.js";
import { legalMatters } from "./matters.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const legalAiReviewStatusEnum = pgEnum("legal_ai_review_status", [
  "draft",
  "processing",
  "generated",
  "human_review",
  "reviewed",
  "closed",
  "failed",
  "not_configured",
]);

export const legalAiReviewTypeEnum = pgEnum("legal_ai_review_type", [
  "formal_review",
  "content_review",
  "cross_document_review",
  "procedural_risk_review",
  "claims_review",
  "evidence_review",
  "contract_review",
  "decision_response_review",
  "administrative_review",
]);

export const legalReviewDocumentRoleEnum = pgEnum("legal_review_document_role", [
  "initial_petition",
  "defense",
  "reply",
  "expert_report",
  "medical_report",
  "decision",
  "appeal",
  "contract",
  "evidence",
  "administrative_request",
  "administrative_decision",
  "other",
]);

export const legalReviewItemStatusEnum = pgEnum("legal_review_item_status", [
  "unreviewed",
  "confirmed",
  "rejected",
  "corrected",
]);

export const legalReviewSeverityEnum = pgEnum("legal_review_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);

/** Conjunto documental selecionado para revisão cruzada. */
export const legalReviewSets = pgTable(
  "legal_review_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id").references(() => legalMatters.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("legal_review_sets_org_idx").on(table.organizationId),
    index("legal_review_sets_matter_idx").on(table.legalMatterId),
  ],
);

export const legalReviewSetDocuments = pgTable(
  "legal_review_set_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    reviewSetId: uuid("review_set_id")
      .notNull()
      .references(() => legalReviewSets.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    documentVersionId: uuid("document_version_id").references(() => documentVersions.id, {
      onDelete: "set null",
    }),
    roleInReview: legalReviewDocumentRoleEnum("role_in_review").notNull().default("other"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("legal_review_set_documents_unique").on(table.reviewSetId, table.documentId),
    index("legal_review_set_documents_set_idx").on(table.reviewSetId),
    index("legal_review_set_documents_org_idx").on(table.organizationId),
  ],
);

/**
 * Revisão jurídica assistida por IA.
 * Resultados GENERATED não são finais — exigem revisão humana.
 */
export const legalAiReviews = pgTable(
  "legal_ai_reviews",
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
    primaryDocumentId: uuid("primary_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    reviewSetId: uuid("review_set_id").references(() => legalReviewSets.id, {
      onDelete: "set null",
    }),
    aiRequestId: uuid("ai_request_id").references(() => aiRequests.id, { onDelete: "set null" }),
    reviewType: legalAiReviewTypeEnum("review_type").notNull().default("content_review"),
    status: legalAiReviewStatusEnum("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    summary: text("summary"),
    structuredResult: jsonb("structured_result").$type<Record<string, unknown>>(),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    reviewedByMembershipId: uuid("reviewed_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    reviewComment: text("review_comment"),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("legal_ai_reviews_org_idx").on(table.organizationId),
    index("legal_ai_reviews_matter_idx").on(table.legalMatterId),
    index("legal_ai_reviews_status_idx").on(table.organizationId, table.status),
    index("legal_ai_reviews_document_idx").on(table.primaryDocumentId),
    uniqueIndex("legal_ai_reviews_org_type_version_unique").on(
      table.organizationId,
      table.legalMatterId,
      table.reviewType,
      table.version,
    ),
  ],
);

export const legalReviewFormalIssues = pgTable(
  "legal_review_formal_issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => legalAiReviews.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    description: text("description").notNull(),
    documentId: uuid("document_id"),
    documentVersionId: uuid("document_version_id"),
    pageNumber: integer("page_number"),
    excerptReference: text("excerpt_reference"),
    sourceLabel: text("source_label"),
    severity: legalReviewSeverityEnum("severity").notNull().default("medium"),
    confidence: integer("confidence"),
    reviewStatus: legalReviewItemStatusEnum("review_status").notNull().default("unreviewed"),
    correctedText: text("corrected_text"),
    reviewComment: text("review_comment"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("legal_review_formal_issues_review_idx").on(table.reviewId),
    index("legal_review_formal_issues_org_idx").on(table.organizationId),
  ],
);

export const legalReviewMissingDocuments = pgTable(
  "legal_review_missing_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => legalAiReviews.id, { onDelete: "cascade" }),
    expectedDocumentType: text("expected_document_type").notNull(),
    reasonExpected: text("reason_expected").notNull(),
    relatedClaim: text("related_claim"),
    relatedFact: text("related_fact"),
    sourceLabel: text("source_label"),
    severity: legalReviewSeverityEnum("severity").notNull().default("medium"),
    confidence: integer("confidence"),
    reviewStatus: legalReviewItemStatusEnum("review_status").notNull().default("unreviewed"),
    reviewComment: text("review_comment"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("legal_review_missing_documents_review_idx").on(table.reviewId)],
);

export const legalReviewUnaddressedClaims = pgTable(
  "legal_review_unaddressed_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => legalAiReviews.id, { onDelete: "cascade" }),
    claim: text("claim").notNull(),
    sourceDocumentId: uuid("source_document_id"),
    sourcePage: integer("source_page"),
    expectedResponseContext: text("expected_response_context"),
    responseLocated: boolean("response_located").notNull().default(false),
    responseDocumentId: uuid("response_document_id"),
    responsePage: integer("response_page"),
    notes: text("notes"),
    confidence: integer("confidence"),
    reviewStatus: legalReviewItemStatusEnum("review_status").notNull().default("unreviewed"),
    reviewComment: text("review_comment"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("legal_review_unaddressed_claims_review_idx").on(table.reviewId)],
);

export const legalReviewUnansweredGrounds = pgTable(
  "legal_review_unanswered_grounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => legalAiReviews.id, { onDelete: "cascade" }),
    ground: text("ground").notNull(),
    sourceLabel: text("source_label"),
    sourceDocumentId: uuid("source_document_id"),
    opposingDocumentId: uuid("opposing_document_id"),
    responseLocated: boolean("response_located").notNull().default(false),
    responseReference: text("response_reference"),
    impact: text("impact"),
    confidence: integer("confidence"),
    reviewStatus: legalReviewItemStatusEnum("review_status").notNull().default("unreviewed"),
    reviewComment: text("review_comment"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("legal_review_unanswered_grounds_review_idx").on(table.reviewId)],
);

export const legalReviewRisks = pgTable(
  "legal_review_risks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => legalAiReviews.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    description: text("description").notNull(),
    sourceLabel: text("source_label"),
    relatedDocuments: jsonb("related_documents").$type<string[]>(),
    severity: legalReviewSeverityEnum("severity").notNull().default("medium"),
    confidence: integer("confidence"),
    recommendation: text("recommendation"),
    requiresHumanReview: boolean("requires_human_review").notNull().default(true),
    reviewStatus: legalReviewItemStatusEnum("review_status").notNull().default("unreviewed"),
    reviewComment: text("review_comment"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("legal_review_risks_review_idx").on(table.reviewId)],
);

export const legalReviewInconsistencies = pgTable(
  "legal_review_inconsistencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => legalAiReviews.id, { onDelete: "cascade" }),
    point: text("point").notNull(),
    documentAId: uuid("document_a_id"),
    documentALabel: text("document_a_label"),
    documentBId: uuid("document_b_id"),
    documentBLabel: text("document_b_label"),
    divergence: text("divergence").notNull(),
    sourceLabel: text("source_label"),
    potentialImpact: text("potential_impact"),
    severity: legalReviewSeverityEnum("severity").notNull().default("medium"),
    confidence: integer("confidence"),
    reviewStatus: legalReviewItemStatusEnum("review_status").notNull().default("unreviewed"),
    reviewComment: text("review_comment"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("legal_review_inconsistencies_review_idx").on(table.reviewId)],
);

/**
 * Contradições na revisão (evolução do padrão de análise: pageA/pageB + status confirmado).
 * UI: “Possível contradição” até revisão humana.
 */
export const legalReviewContradictions = pgTable(
  "legal_review_contradictions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => legalAiReviews.id, { onDelete: "cascade" }),
    statementA: text("statement_a").notNull(),
    sourceA: text("source_a"),
    pageA: integer("page_a"),
    documentAId: uuid("document_a_id"),
    statementB: text("statement_b").notNull(),
    sourceB: text("source_b"),
    pageB: integer("page_b"),
    documentBId: uuid("document_b_id"),
    explanation: text("explanation"),
    severity: legalReviewSeverityEnum("severity").notNull().default("medium"),
    confidence: integer("confidence"),
    reviewStatus: legalReviewItemStatusEnum("review_status").notNull().default("unreviewed"),
    correctedText: text("corrected_text"),
    reviewComment: text("review_comment"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("legal_review_contradictions_review_idx").on(table.reviewId)],
);

export const legalReviewSetsRelations = relations(legalReviewSets, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [legalReviewSets.organizationId],
    references: [organizations.id],
  }),
  matter: one(legalMatters, {
    fields: [legalReviewSets.legalMatterId],
    references: [legalMatters.id],
  }),
  documents: many(legalReviewSetDocuments),
  reviews: many(legalAiReviews),
}));

export const legalReviewSetDocumentsRelations = relations(legalReviewSetDocuments, ({ one }) => ({
  reviewSet: one(legalReviewSets, {
    fields: [legalReviewSetDocuments.reviewSetId],
    references: [legalReviewSets.id],
  }),
  document: one(documents, {
    fields: [legalReviewSetDocuments.documentId],
    references: [documents.id],
  }),
  documentVersion: one(documentVersions, {
    fields: [legalReviewSetDocuments.documentVersionId],
    references: [documentVersions.id],
  }),
}));

export const legalAiReviewsRelations = relations(legalAiReviews, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [legalAiReviews.organizationId],
    references: [organizations.id],
  }),
  matter: one(legalMatters, {
    fields: [legalAiReviews.legalMatterId],
    references: [legalMatters.id],
  }),
  primaryDocument: one(documents, {
    fields: [legalAiReviews.primaryDocumentId],
    references: [documents.id],
  }),
  reviewSet: one(legalReviewSets, {
    fields: [legalAiReviews.reviewSetId],
    references: [legalReviewSets.id],
  }),
  aiRequest: one(aiRequests, {
    fields: [legalAiReviews.aiRequestId],
    references: [aiRequests.id],
  }),
  formalIssues: many(legalReviewFormalIssues),
  missingDocuments: many(legalReviewMissingDocuments),
  unaddressedClaims: many(legalReviewUnaddressedClaims),
  unansweredGrounds: many(legalReviewUnansweredGrounds),
  risks: many(legalReviewRisks),
  inconsistencies: many(legalReviewInconsistencies),
  contradictions: many(legalReviewContradictions),
}));

export const legalReviewFormalIssuesRelations = relations(legalReviewFormalIssues, ({ one }) => ({
  review: one(legalAiReviews, {
    fields: [legalReviewFormalIssues.reviewId],
    references: [legalAiReviews.id],
  }),
}));

export const legalReviewMissingDocumentsRelations = relations(
  legalReviewMissingDocuments,
  ({ one }) => ({
    review: one(legalAiReviews, {
      fields: [legalReviewMissingDocuments.reviewId],
      references: [legalAiReviews.id],
    }),
  }),
);

export const legalReviewUnaddressedClaimsRelations = relations(
  legalReviewUnaddressedClaims,
  ({ one }) => ({
    review: one(legalAiReviews, {
      fields: [legalReviewUnaddressedClaims.reviewId],
      references: [legalAiReviews.id],
    }),
  }),
);

export const legalReviewUnansweredGroundsRelations = relations(
  legalReviewUnansweredGrounds,
  ({ one }) => ({
    review: one(legalAiReviews, {
      fields: [legalReviewUnansweredGrounds.reviewId],
      references: [legalAiReviews.id],
    }),
  }),
);

export const legalReviewRisksRelations = relations(legalReviewRisks, ({ one }) => ({
  review: one(legalAiReviews, {
    fields: [legalReviewRisks.reviewId],
    references: [legalAiReviews.id],
  }),
}));

export const legalReviewInconsistenciesRelations = relations(
  legalReviewInconsistencies,
  ({ one }) => ({
    review: one(legalAiReviews, {
      fields: [legalReviewInconsistencies.reviewId],
      references: [legalAiReviews.id],
    }),
  }),
);

export const legalReviewContradictionsRelations = relations(
  legalReviewContradictions,
  ({ one }) => ({
    review: one(legalAiReviews, {
      fields: [legalReviewContradictions.reviewId],
      references: [legalAiReviews.id],
    }),
  }),
);
