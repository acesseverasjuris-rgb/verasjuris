import { relations } from "drizzle-orm";
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { aiRequests } from "./ai.js";
import { documents, documentVersions } from "./documents.js";
import { organizationMembers, organizations } from "./identity.js";
import { legalMatters } from "./matters.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const legalComparisonTypeEnum = pgEnum("legal_comparison_type", [
  "petition_vs_defense",
  "evidence_vs_allegations",
  "claim_vs_decision",
  "judgment_vs_appeal",
  "admin_process_vs_judicial_action",
]);

export const legalComparisonStatusEnum = pgEnum("legal_comparison_status", [
  "draft",
  "processing",
  "generated",
  "human_review",
  "reviewed",
  "closed",
  "failed",
  "not_configured",
]);

export const legalComparisonSourceRoleEnum = pgEnum("legal_comparison_source_role", [
  "side_a",
  "side_b",
  "petition",
  "defense",
  "evidence",
  "allegation",
  "claim",
  "decision",
  "judgment",
  "appeal",
  "administrative_request",
  "administrative_decision",
  "other",
]);

export const legalComparisonItemSeverityEnum = pgEnum("legal_comparison_item_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const legalComparisonItemReviewStatusEnum = pgEnum("legal_comparison_item_review_status", [
  "unreviewed",
  "confirmed",
  "rejected",
  "corrected",
]);

export const legalComparisons = pgTable(
  "legal_comparisons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id").references(() => legalMatters.id, {
      onDelete: "cascade",
    }),
    comparisonType: legalComparisonTypeEnum("comparison_type").notNull(),
    status: legalComparisonStatusEnum("status").notNull().default("draft"),
    title: text("title"),
    summary: text("summary"),
    structuredResult: jsonb("structured_result").$type<Record<string, unknown>>(),
    aiRequestId: uuid("ai_request_id").references(() => aiRequests.id, { onDelete: "set null" }),
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
    index("legal_comparisons_org_idx").on(table.organizationId),
    index("legal_comparisons_matter_idx").on(table.legalMatterId),
    index("legal_comparisons_type_idx").on(table.comparisonType),
    index("legal_comparisons_status_idx").on(table.organizationId, table.status),
  ],
);

export const legalComparisonSources = pgTable(
  "legal_comparison_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    comparisonId: uuid("comparison_id")
      .notNull()
      .references(() => legalComparisons.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    documentVersionId: uuid("document_version_id").references(() => documentVersions.id, {
      onDelete: "set null",
    }),
    roleInComparison: legalComparisonSourceRoleEnum("role_in_comparison")
      .notNull()
      .default("other"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("legal_comparison_sources_comparison_idx").on(table.comparisonId),
    index("legal_comparison_sources_org_idx").on(table.organizationId),
    index("legal_comparison_sources_document_idx").on(table.documentId),
  ],
);

export const legalComparisonItems = pgTable(
  "legal_comparison_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    comparisonId: uuid("comparison_id")
      .notNull()
      .references(() => legalComparisons.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    sourceA: text("source_a"),
    sourceB: text("source_b"),
    finding: text("finding").notNull(),
    severity: legalComparisonItemSeverityEnum("severity").notNull().default("medium"),
    confidence: integer("confidence"),
    provenance: jsonb("provenance").$type<Record<string, unknown>>(),
    reviewStatus: legalComparisonItemReviewStatusEnum("review_status")
      .notNull()
      .default("unreviewed"),
    reviewerComment: text("reviewer_comment"),
    reviewedByMembershipId: uuid("reviewed_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index("legal_comparison_items_comparison_idx").on(table.comparisonId),
    index("legal_comparison_items_org_idx").on(table.organizationId),
    index("legal_comparison_items_review_idx").on(table.reviewStatus),
  ],
);

export const legalComparisonsRelations = relations(legalComparisons, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [legalComparisons.organizationId],
    references: [organizations.id],
  }),
  legalMatter: one(legalMatters, {
    fields: [legalComparisons.legalMatterId],
    references: [legalMatters.id],
  }),
  aiRequest: one(aiRequests, {
    fields: [legalComparisons.aiRequestId],
    references: [aiRequests.id],
  }),
  sources: many(legalComparisonSources),
  items: many(legalComparisonItems),
}));

export const legalComparisonSourcesRelations = relations(legalComparisonSources, ({ one }) => ({
  comparison: one(legalComparisons, {
    fields: [legalComparisonSources.comparisonId],
    references: [legalComparisons.id],
  }),
  document: one(documents, {
    fields: [legalComparisonSources.documentId],
    references: [documents.id],
  }),
  documentVersion: one(documentVersions, {
    fields: [legalComparisonSources.documentVersionId],
    references: [documentVersions.id],
  }),
}));

export const legalComparisonItemsRelations = relations(legalComparisonItems, ({ one }) => ({
  comparison: one(legalComparisons, {
    fields: [legalComparisonItems.comparisonId],
    references: [legalComparisons.id],
  }),
}));
