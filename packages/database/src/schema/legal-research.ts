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
import { organizationMembers, organizations, users } from "./identity.js";
import { legalMatters } from "./matters.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const legalSourceTypeEnum = pgEnum("legal_source_type", [
  "legislation",
  "constitution",
  "decree",
  "resolution",
  "instruction",
  "ordinance",
  "regulation",
  "other",
]);

export const legalSourceProviderEnum = pgEnum("legal_source_provider", [
  "manual",
  "official_provider",
  "import",
  "not_configured",
]);

export const caseLawRecordStatusEnum = pgEnum("case_law_record_status", [
  "draft",
  "available",
  "verified",
  "unavailable",
  "stale",
  "not_configured",
]);

export const legalSummaryBindingEnum = pgEnum("legal_summary_binding", [
  "binding",
  "non_binding",
  "cancelled",
  "superseded",
  "unknown",
]);

export const legalThemeStatusEnum = pgEnum("legal_theme_status", [
  "pending",
  "judged",
  "affected",
  "cancelled",
  "superseded",
  "unknown",
]);

export const legalPrecedentBindingEnum = pgEnum("legal_precedent_binding", [
  "binding",
  "persuasive",
  "non_binding",
  "unknown",
]);

export const legalResearchQueryStatusEnum = pgEnum("legal_research_query_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
  "empty",
  "not_configured",
]);

export const legalResearchResultSourceTypeEnum = pgEnum("legal_research_result_source_type", [
  "legislation",
  "case_law",
  "summary",
  "theme",
  "general_repercussion",
  "precedent",
  "doctrine",
  "internal_document",
]);

/**
 * Fontes legais de referência (legislação e atos normativos).
 * Podem ser globais (organizationId null) ou cadastradas pela organização.
 */
export const legalSources = pgTable(
  "legal_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    sourceProvider: legalSourceProviderEnum("source_provider").notNull().default("manual"),
    sourceType: legalSourceTypeEnum("source_type").notNull().default("legislation"),
    jurisdiction: text("jurisdiction"),
    authority: text("authority"),
    identifier: text("identifier"),
    title: text("title").notNull(),
    publicationDate: timestamp("publication_date", { withTimezone: true, mode: "date" }),
    effectiveDate: timestamp("effective_date", { withTimezone: true, mode: "date" }),
    repealedAt: timestamp("repealed_at", { withTimezone: true, mode: "date" }),
    sourceUrl: text("source_url"),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true, mode: "date" }),
    contentHash: text("content_hash"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("legal_sources_org_idx").on(table.organizationId),
    index("legal_sources_type_idx").on(table.sourceType),
    index("legal_sources_identifier_idx").on(table.identifier),
  ],
);

export const caseLawRecords = pgTable(
  "case_law_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    provider: legalSourceProviderEnum("provider").notNull().default("manual"),
    court: text("court").notNull(),
    courtUnit: text("court_unit"),
    caseNumber: text("case_number").notNull(),
    caseNumberNormalized: text("case_number_normalized"),
    rapporteur: text("rapporteur"),
    judgingBody: text("judging_body"),
    judgmentDate: timestamp("judgment_date", { withTimezone: true, mode: "date" }),
    publicationDate: timestamp("publication_date", { withTimezone: true, mode: "date" }),
    proceduralClass: text("procedural_class"),
    subject: text("subject"),
    headnote: text("headnote"),
    fullTextReference: text("full_text_reference"),
    sourceUrl: text("source_url"),
    sourceHash: text("source_hash"),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true, mode: "date" }),
    status: caseLawRecordStatusEnum("status").notNull().default("draft"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("case_law_records_org_idx").on(table.organizationId),
    index("case_law_records_court_idx").on(table.court),
    index("case_law_records_case_number_idx").on(table.caseNumberNormalized),
    index("case_law_records_status_idx").on(table.status),
  ],
);

export const legalSummaries = pgTable(
  "legal_summaries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    court: text("court").notNull(),
    number: text("number").notNull(),
    text: text("text").notNull(),
    approvalDate: timestamp("approval_date", { withTimezone: true, mode: "date" }),
    binding: legalSummaryBindingEnum("binding").notNull().default("unknown"),
    status: text("status").notNull().default("active"),
    sourceUrl: text("source_url"),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true, mode: "date" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("legal_summaries_court_number_unique").on(table.court, table.number),
    index("legal_summaries_org_idx").on(table.organizationId),
  ],
);

export const repetitiveThemes = pgTable(
  "repetitive_themes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    court: text("court").notNull(),
    themeNumber: text("theme_number").notNull(),
    title: text("title").notNull(),
    controversy: text("controversy"),
    thesis: text("thesis"),
    status: legalThemeStatusEnum("status").notNull().default("unknown"),
    affectedCasesInfo: text("affected_cases_info"),
    judgmentDate: timestamp("judgment_date", { withTimezone: true, mode: "date" }),
    sourceUrl: text("source_url"),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true, mode: "date" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("repetitive_themes_court_number_unique").on(table.court, table.themeNumber),
    index("repetitive_themes_org_idx").on(table.organizationId),
  ],
);

export const generalRepercussionThemes = pgTable(
  "general_repercussion_themes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    themeNumber: text("theme_number").notNull(),
    title: text("title").notNull(),
    controversy: text("controversy"),
    thesis: text("thesis"),
    status: legalThemeStatusEnum("status").notNull().default("unknown"),
    leadingCaseNumber: text("leading_case_number"),
    judgmentDate: timestamp("judgment_date", { withTimezone: true, mode: "date" }),
    sourceUrl: text("source_url"),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true, mode: "date" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("general_repercussion_themes_number_unique").on(table.themeNumber),
    index("general_repercussion_themes_org_idx").on(table.organizationId),
  ],
);

export const legalPrecedents = pgTable(
  "legal_precedents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    jurisdiction: text("jurisdiction"),
    hierarchy: text("hierarchy"),
    bindingStatus: legalPrecedentBindingEnum("binding_status").notNull().default("unknown"),
    applicabilityNotes: text("applicability_notes"),
    caseLawRecordId: uuid("case_law_record_id").references(() => caseLawRecords.id, {
      onDelete: "set null",
    }),
    legalSummaryId: uuid("legal_summary_id").references(() => legalSummaries.id, {
      onDelete: "set null",
    }),
    repetitiveThemeId: uuid("repetitive_theme_id").references(() => repetitiveThemes.id, {
      onDelete: "set null",
    }),
    generalRepercussionThemeId: uuid("general_repercussion_theme_id").references(
      () => generalRepercussionThemes.id,
      { onDelete: "set null" },
    ),
    decisionReference: text("decision_reference"),
    sourceUrl: text("source_url"),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true, mode: "date" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("legal_precedents_org_idx").on(table.organizationId),
    index("legal_precedents_binding_idx").on(table.bindingStatus),
  ],
);

/**
 * Doutrina: conteúdo integral somente com licença.
 * Sem licença, apenas referência bibliográfica e metadata.
 */
export const doctrineSources = pgTable(
  "doctrine_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    author: text("author"),
    publisher: text("publisher"),
    edition: text("edition"),
    year: integer("year"),
    identifier: text("identifier"),
    isbn: text("isbn"),
    licensed: boolean("licensed").notNull().default(false),
    licenseReference: text("license_reference"),
    source: text("source"),
    sourceUrl: text("source_url"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("doctrine_sources_org_idx").on(table.organizationId),
    index("doctrine_sources_author_idx").on(table.author),
  ],
);

export const legalResearchQueries = pgTable(
  "legal_research_queries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    query: text("query").notNull(),
    filters: jsonb("filters").$type<Record<string, unknown>>(),
    status: legalResearchQueryStatusEnum("status").notNull().default("pending"),
    provider: legalSourceProviderEnum("provider").notNull().default("not_configured"),
    resultCount: integer("result_count").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("legal_research_queries_org_idx").on(table.organizationId),
    index("legal_research_queries_user_idx").on(table.userId),
    index("legal_research_queries_status_idx").on(table.organizationId, table.status),
  ],
);

export const legalResearchResults = pgTable(
  "legal_research_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    queryId: uuid("query_id")
      .notNull()
      .references(() => legalResearchQueries.id, { onDelete: "cascade" }),
    sourceType: legalResearchResultSourceTypeEnum("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    rank: integer("rank").notNull().default(0),
    relevance: integer("relevance"),
    provider: legalSourceProviderEnum("provider").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("legal_research_results_query_idx").on(table.queryId),
    index("legal_research_results_org_idx").on(table.organizationId),
    index("legal_research_results_source_idx").on(table.sourceType, table.sourceId),
  ],
);

export const savedResearches = pgTable(
  "saved_researches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    queryId: uuid("query_id").references(() => legalResearchQueries.id, {
      onDelete: "set null",
    }),
    legalMatterId: uuid("legal_matter_id").references(() => legalMatters.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    query: text("query").notNull(),
    filters: jsonb("filters").$type<Record<string, unknown>>(),
    selectedResultIds: jsonb("selected_result_ids").$type<string[]>(),
    notes: text("notes"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("saved_researches_org_idx").on(table.organizationId),
    index("saved_researches_matter_idx").on(table.legalMatterId),
  ],
);

export const legalMatterResearchLinks = pgTable(
  "legal_matter_research_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    sourceType: legalResearchResultSourceTypeEnum("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    savedResearchId: uuid("saved_research_id").references(() => savedResearches.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("legal_matter_research_links_unique").on(
      table.legalMatterId,
      table.sourceType,
      table.sourceId,
    ),
    index("legal_matter_research_links_org_idx").on(table.organizationId),
    index("legal_matter_research_links_matter_idx").on(table.legalMatterId),
  ],
);

export const legalSourcesRelations = relations(legalSources, ({ one }) => ({
  organization: one(organizations, {
    fields: [legalSources.organizationId],
    references: [organizations.id],
  }),
}));

export const caseLawRecordsRelations = relations(caseLawRecords, ({ one }) => ({
  organization: one(organizations, {
    fields: [caseLawRecords.organizationId],
    references: [organizations.id],
  }),
}));

export const legalSummariesRelations = relations(legalSummaries, ({ one }) => ({
  organization: one(organizations, {
    fields: [legalSummaries.organizationId],
    references: [organizations.id],
  }),
}));

export const repetitiveThemesRelations = relations(repetitiveThemes, ({ one }) => ({
  organization: one(organizations, {
    fields: [repetitiveThemes.organizationId],
    references: [organizations.id],
  }),
}));

export const generalRepercussionThemesRelations = relations(
  generalRepercussionThemes,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [generalRepercussionThemes.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const legalPrecedentsRelations = relations(legalPrecedents, ({ one }) => ({
  organization: one(organizations, {
    fields: [legalPrecedents.organizationId],
    references: [organizations.id],
  }),
  caseLawRecord: one(caseLawRecords, {
    fields: [legalPrecedents.caseLawRecordId],
    references: [caseLawRecords.id],
  }),
  legalSummary: one(legalSummaries, {
    fields: [legalPrecedents.legalSummaryId],
    references: [legalSummaries.id],
  }),
  repetitiveTheme: one(repetitiveThemes, {
    fields: [legalPrecedents.repetitiveThemeId],
    references: [repetitiveThemes.id],
  }),
  generalRepercussionTheme: one(generalRepercussionThemes, {
    fields: [legalPrecedents.generalRepercussionThemeId],
    references: [generalRepercussionThemes.id],
  }),
}));

export const doctrineSourcesRelations = relations(doctrineSources, ({ one }) => ({
  organization: one(organizations, {
    fields: [doctrineSources.organizationId],
    references: [organizations.id],
  }),
}));

export const legalResearchQueriesRelations = relations(legalResearchQueries, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [legalResearchQueries.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [legalResearchQueries.userId],
    references: [users.id],
  }),
  results: many(legalResearchResults),
}));

export const legalResearchResultsRelations = relations(legalResearchResults, ({ one }) => ({
  query: one(legalResearchQueries, {
    fields: [legalResearchResults.queryId],
    references: [legalResearchQueries.id],
  }),
}));

export const savedResearchesRelations = relations(savedResearches, ({ one }) => ({
  organization: one(organizations, {
    fields: [savedResearches.organizationId],
    references: [organizations.id],
  }),
  matter: one(legalMatters, {
    fields: [savedResearches.legalMatterId],
    references: [legalMatters.id],
  }),
  query: one(legalResearchQueries, {
    fields: [savedResearches.queryId],
    references: [legalResearchQueries.id],
  }),
}));

export const legalMatterResearchLinksRelations = relations(legalMatterResearchLinks, ({ one }) => ({
  organization: one(organizations, {
    fields: [legalMatterResearchLinks.organizationId],
    references: [organizations.id],
  }),
  matter: one(legalMatters, {
    fields: [legalMatterResearchLinks.legalMatterId],
    references: [legalMatters.id],
  }),
  savedResearch: one(savedResearches, {
    fields: [legalMatterResearchLinks.savedResearchId],
    references: [savedResearches.id],
  }),
}));
