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
import { organizationMembers, organizations } from "./identity.js";
import { documents, documentVersions } from "./documents.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const documentProcessingStatusEnum = pgEnum("document_processing_status", [
  "pending",
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "not_configured",
]);

export const documentExtractionMethodEnum = pgEnum("document_extraction_method", [
  "native_text",
  "plain_text",
  "ocr",
  "manual",
  "unavailable",
]);

export const documentReviewStatusEnum = pgEnum("document_intel_review_status", [
  "unreviewed",
  "reviewed",
  "corrected",
  "rejected",
]);

export const documentSegmentStatusEnum = pgEnum("document_segment_status", [
  "detected",
  "confirmed",
  "rejected",
  "not_configured",
]);

export const documentProcessingRuns = pgTable(
  "document_processing_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    documentVersionId: uuid("document_version_id")
      .notNull()
      .references(() => documentVersions.id, { onDelete: "cascade" }),
    status: documentProcessingStatusEnum("status").notNull().default("pending"),
    processingStrategy: text("processing_strategy").notNull().default("auto"),
    ocrRequired: boolean("ocr_required").notNull().default(false),
    ocrProvider: text("ocr_provider"),
    extractionMethod: documentExtractionMethodEnum("extraction_method"),
    textHash: text("text_hash"),
    pageCount: integer("page_count"),
    charCount: integer("char_count"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    errorCode: text("error_code"),
    errorSafeMessage: text("error_safe_message"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("document_processing_runs_org_idx").on(table.organizationId),
    index("document_processing_runs_version_idx").on(table.documentVersionId),
    index("document_processing_runs_doc_idx").on(table.documentId),
  ],
);

export const documentPages = pgTable(
  "document_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    documentVersionId: uuid("document_version_id")
      .notNull()
      .references(() => documentVersions.id, { onDelete: "cascade" }),
    processingRunId: uuid("processing_run_id").references(() => documentProcessingRuns.id, {
      onDelete: "set null",
    }),
    pageNumber: integer("page_number").notNull(),
    text: text("text").notNull().default(""),
    extractionMethod: documentExtractionMethodEnum("extraction_method").notNull(),
    confidence: integer("confidence"),
    charCount: integer("char_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("document_pages_version_page_unique").on(table.documentVersionId, table.pageNumber),
    index("document_pages_org_idx").on(table.organizationId),
    index("document_pages_version_idx").on(table.documentVersionId),
  ],
);

export const documentSegments = pgTable(
  "document_segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    documentVersionId: uuid("document_version_id")
      .notNull()
      .references(() => documentVersions.id, { onDelete: "cascade" }),
    processingRunId: uuid("processing_run_id").references(() => documentProcessingRuns.id, {
      onDelete: "set null",
    }),
    startPage: integer("start_page").notNull(),
    endPage: integer("end_page").notNull(),
    detectedType: text("detected_type"),
    confidence: integer("confidence"),
    status: documentSegmentStatusEnum("status").notNull().default("not_configured"),
    reviewStatus: documentReviewStatusEnum("review_status").notNull().default("unreviewed"),
    ...timestamps,
  },
  (table) => [
    index("document_segments_version_idx").on(table.documentVersionId),
    index("document_segments_org_idx").on(table.organizationId),
  ],
);

/**
 * Metadata extraída — valor original da IA preservado; correção humana em campos separados.
 */
export const documentExtractedMetadata = pgTable(
  "document_extracted_metadata",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    documentVersionId: uuid("document_version_id")
      .notNull()
      .references(() => documentVersions.id, { onDelete: "cascade" }),
    processingRunId: uuid("processing_run_id").references(() => documentProcessingRuns.id, {
      onDelete: "set null",
    }),
    fieldKey: text("field_key").notNull(),
    originalValue: text("original_value"),
    correctedValue: text("corrected_value"),
    confidence: integer("confidence"),
    sourcePage: integer("source_page"),
    extractionMethod: text("extraction_method").notNull().default("ai"),
    reviewStatus: documentReviewStatusEnum("review_status").notNull().default("unreviewed"),
    reviewedByMembershipId: uuid("reviewed_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
    reviewComment: text("review_comment"),
    ...timestamps,
  },
  (table) => [
    index("document_extracted_metadata_org_idx").on(table.organizationId),
    index("document_extracted_metadata_doc_idx").on(table.documentId),
    index("document_extracted_metadata_version_idx").on(table.documentVersionId),
  ],
);

export const documentClassifications = pgTable(
  "document_classifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    documentVersionId: uuid("document_version_id")
      .notNull()
      .references(() => documentVersions.id, { onDelete: "cascade" }),
    processingRunId: uuid("processing_run_id").references(() => documentProcessingRuns.id, {
      onDelete: "set null",
    }),
    suggestedKind: text("suggested_kind"),
    appliedKind: text("applied_kind"),
    confidence: integer("confidence"),
    method: text("method").notNull().default("manual"),
    status: text("status").notNull().default("manual"),
    reviewStatus: documentReviewStatusEnum("review_status").notNull().default("unreviewed"),
    reviewedByMembershipId: uuid("reviewed_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("document_classifications_org_idx").on(table.organizationId),
    index("document_classifications_doc_idx").on(table.documentId),
  ],
);

export const documentProcessingRunsRelations = relations(
  documentProcessingRuns,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [documentProcessingRuns.organizationId],
      references: [organizations.id],
    }),
    document: one(documents, {
      fields: [documentProcessingRuns.documentId],
      references: [documents.id],
    }),
    version: one(documentVersions, {
      fields: [documentProcessingRuns.documentVersionId],
      references: [documentVersions.id],
    }),
    pages: many(documentPages),
    segments: many(documentSegments),
    metadata: many(documentExtractedMetadata),
    classifications: many(documentClassifications),
  }),
);

export const documentPagesRelations = relations(documentPages, ({ one }) => ({
  version: one(documentVersions, {
    fields: [documentPages.documentVersionId],
    references: [documentVersions.id],
  }),
  run: one(documentProcessingRuns, {
    fields: [documentPages.processingRunId],
    references: [documentProcessingRuns.id],
  }),
}));

export const documentSegmentsRelations = relations(documentSegments, ({ one }) => ({
  version: one(documentVersions, {
    fields: [documentSegments.documentVersionId],
    references: [documentVersions.id],
  }),
}));

export const documentExtractedMetadataRelations = relations(
  documentExtractedMetadata,
  ({ one }) => ({
    document: one(documents, {
      fields: [documentExtractedMetadata.documentId],
      references: [documents.id],
    }),
    version: one(documentVersions, {
      fields: [documentExtractedMetadata.documentVersionId],
      references: [documentVersions.id],
    }),
  }),
);

export const documentClassificationsRelations = relations(documentClassifications, ({ one }) => ({
  document: one(documents, {
    fields: [documentClassifications.documentId],
    references: [documents.id],
  }),
}));
