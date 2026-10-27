import { relations } from "drizzle-orm";
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizationMembers, organizations } from "./identity.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const citationSourceTypeEnum = pgEnum("citation_source_type", [
  "legislation",
  "case_law",
  "summary",
  "theme",
  "precedent",
  "doctrine",
  "internal_document",
]);

export const citationVerificationStatusEnum = pgEnum("citation_verification_status", [
  "unverified",
  "source_available",
  "verified",
  "source_unavailable",
  "invalid",
  "stale",
]);

/**
 * Citação jurídica verificável.
 * Nunca marcar verified sem validação real da fonte.
 */
export const legalCitations = pgTable(
  "legal_citations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    sourceType: citationSourceTypeEnum("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    citationStyle: text("citation_style").notNull().default("default"),
    formattedCitation: text("formatted_citation").notNull(),
    court: text("court"),
    caseNumber: text("case_number"),
    rapporteur: text("rapporteur"),
    judgingBody: text("judging_body"),
    judgmentDate: timestamp("judgment_date", { withTimezone: true, mode: "date" }),
    publicationDate: timestamp("publication_date", { withTimezone: true, mode: "date" }),
    sourceUrl: text("source_url"),
    excerpt: text("excerpt"),
    excerptLocation: text("excerpt_location"),
    excerptStart: integer("excerpt_start"),
    excerptEnd: integer("excerpt_end"),
    pageNumber: integer("page_number"),
    sourceHash: text("source_hash"),
    verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "date" }),
    verificationStatus: citationVerificationStatusEnum("verification_status")
      .notNull()
      .default("unverified"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("legal_citations_org_idx").on(table.organizationId),
    index("legal_citations_source_idx").on(table.sourceType, table.sourceId),
    index("legal_citations_verification_idx").on(table.verificationStatus),
  ],
);

/**
 * Registro de verificação de fonte (histórico / auditoria de proveniência).
 */
export const sourceVerifications = pgTable(
  "source_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    citationId: uuid("citation_id").references(() => legalCitations.id, {
      onDelete: "cascade",
    }),
    sourceType: citationSourceTypeEnum("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    verificationStatus: citationVerificationStatusEnum("verification_status")
      .notNull()
      .default("unverified"),
    sourceUrl: text("source_url"),
    sourceHash: text("source_hash"),
    provider: text("provider"),
    notes: text("notes"),
    verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "date" }),
    verifiedByMembershipId: uuid("verified_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("source_verifications_org_idx").on(table.organizationId),
    index("source_verifications_citation_idx").on(table.citationId),
    index("source_verifications_source_idx").on(table.sourceType, table.sourceId),
    index("source_verifications_status_idx").on(table.verificationStatus),
  ],
);

export const legalCitationsRelations = relations(legalCitations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [legalCitations.organizationId],
    references: [organizations.id],
  }),
  verifications: many(sourceVerifications),
}));

export const sourceVerificationsRelations = relations(sourceVerifications, ({ one }) => ({
  organization: one(organizations, {
    fields: [sourceVerifications.organizationId],
    references: [organizations.id],
  }),
  citation: one(legalCitations, {
    fields: [sourceVerifications.citationId],
    references: [legalCitations.id],
  }),
}));
