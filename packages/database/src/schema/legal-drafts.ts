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
import { crmClients } from "./crm.js";
import { documents, documentVersions } from "./documents.js";
import { organizationMembers, organizations } from "./identity.js";
import { judicialProcesses } from "./judicial.js";
import {
  legalDocumentTemplates,
  legalDocumentTemplateTypeEnum,
  legalDocumentTemplateVersions,
} from "./legal-templates.js";
import { legalMatters } from "./matters.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const legalDocumentDraftStatusEnum = pgEnum("legal_document_draft_status", [
  "draft",
  "ai_assisted",
  "human_review",
  "approved",
  "ready_to_file",
  "filed",
  "confirmed",
  "rejected",
  "cancelled",
  "archived",
  "failed",
]);

export const legalDraftSourceItemTypeEnum = pgEnum("legal_draft_source_item_type", [
  "document",
  "analysis",
  "research",
  "citation",
  "fact",
  "evidence",
  "instruction",
]);

export const legalDraftFilingMethodEnum = pgEnum("legal_draft_filing_method", [
  "manual",
  "electronic",
  "provider",
  "not_configured",
]);

export const legalDraftConfirmationMethodEnum = pgEnum("legal_draft_confirmation_method", [
  "manual",
  "provider",
]);

export const legalDraftChecklistItemStatusEnum = pgEnum("legal_draft_checklist_item_status", [
  "pending",
  "done",
  "not_applicable",
  "blocked",
]);

export const legalDocumentDrafts = pgTable(
  "legal_document_drafts",
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
    clientId: uuid("client_id").references(() => crmClients.id, { onDelete: "set null" }),
    templateId: uuid("template_id").references(() => legalDocumentTemplates.id, {
      onDelete: "set null",
    }),
    templateVersionId: uuid("template_version_id").references(
      () => legalDocumentTemplateVersions.id,
      { onDelete: "set null" },
    ),
    documentType: legalDocumentTemplateTypeEnum("document_type").notNull().default("other"),
    title: text("title").notNull(),
    status: legalDocumentDraftStatusEnum("status").notNull().default("draft"),
    content: text("content"),
    structuredData: jsonb("structured_data").$type<Record<string, unknown>>(),
    aiRequestId: uuid("ai_request_id").references(() => aiRequests.id, { onDelete: "set null" }),
    sourceSetId: uuid("source_set_id"),
    currentDocumentId: uuid("current_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    reviewedByMembershipId: uuid("reviewed_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
    reviewComment: text("review_comment"),
    approvedByMembershipId: uuid("approved_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
    filedAt: timestamp("filed_at", { withTimezone: true, mode: "date" }),
    filedByMembershipId: uuid("filed_by_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    filingMethod: legalDraftFilingMethodEnum("filing_method"),
    protocolNumber: text("protocol_number"),
    evidenceDocumentId: uuid("evidence_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    filingNotes: text("filing_notes"),
    confirmationEvidenceDocumentId: uuid("confirmation_evidence_document_id").references(
      () => documents.id,
      { onDelete: "set null" },
    ),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true, mode: "date" }),
    confirmedByMembershipId: uuid("confirmed_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    confirmationMethod: legalDraftConfirmationMethodEnum("confirmation_method"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    updatedByMembershipId: uuid("updated_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("legal_document_drafts_org_idx").on(table.organizationId),
    index("legal_document_drafts_matter_idx").on(table.legalMatterId),
    index("legal_document_drafts_status_idx").on(table.organizationId, table.status),
    index("legal_document_drafts_template_idx").on(table.templateId),
    index("legal_document_drafts_judicial_idx").on(table.judicialProcessId),
    index("legal_document_drafts_admin_idx").on(table.administrativeProcessId),
  ],
);

export const legalDocumentDraftVersions = pgTable(
  "legal_document_draft_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => legalDocumentDrafts.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    content: text("content"),
    structuredData: jsonb("structured_data").$type<Record<string, unknown>>(),
    status: legalDocumentDraftStatusEnum("status").notNull().default("draft"),
    changeSummary: text("change_summary"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("legal_document_draft_versions_draft_version_unique").on(
      table.draftId,
      table.version,
    ),
    index("legal_document_draft_versions_draft_idx").on(table.draftId),
    index("legal_document_draft_versions_org_idx").on(table.organizationId),
  ],
);

/** Conjunto explícito de fontes usadas na geração/rastreabilidade do draft. */
export const legalDraftSourceSets = pgTable(
  "legal_draft_source_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    draftId: uuid("draft_id").references(() => legalDocumentDrafts.id, { onDelete: "cascade" }),
    name: text("name"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("legal_draft_source_sets_org_idx").on(table.organizationId),
    index("legal_draft_source_sets_draft_idx").on(table.draftId),
  ],
);

export const legalDraftSourceSetItems = pgTable(
  "legal_draft_source_set_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sourceSetId: uuid("source_set_id")
      .notNull()
      .references(() => legalDraftSourceSets.id, { onDelete: "cascade" }),
    itemType: legalDraftSourceItemTypeEnum("item_type").notNull(),
    /** Referência polimórfica (analysis/research/citation/fact/evidence ids). */
    referenceId: uuid("reference_id"),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    documentVersionId: uuid("document_version_id").references(() => documentVersions.id, {
      onDelete: "set null",
    }),
    instructionText: text("instruction_text"),
    sortOrder: integer("sort_order").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("legal_draft_source_set_items_set_idx").on(table.sourceSetId),
    index("legal_draft_source_set_items_org_idx").on(table.organizationId),
    index("legal_draft_source_set_items_type_idx").on(table.itemType),
  ],
);

export const legalDocumentWorkflowHistory = pgTable(
  "legal_document_workflow_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => legalDocumentDrafts.id, { onDelete: "cascade" }),
    fromStatus: legalDocumentDraftStatusEnum("from_status"),
    toStatus: legalDocumentDraftStatusEnum("to_status").notNull(),
    actorMembershipId: uuid("actor_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    reason: text("reason"),
    evidenceDocumentId: uuid("evidence_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("legal_document_workflow_history_draft_idx").on(table.draftId),
    index("legal_document_workflow_history_org_idx").on(table.organizationId),
    index("legal_document_workflow_history_created_idx").on(table.createdAt),
  ],
);

/**
 * Checklist pré-protocolo.
 * draftId null + isTemplate=true = definição configurável da organização.
 */
export const legalDraftChecklists = pgTable(
  "legal_draft_checklists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    draftId: uuid("draft_id").references(() => legalDocumentDrafts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isTemplate: boolean("is_template").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("legal_draft_checklists_org_idx").on(table.organizationId),
    index("legal_draft_checklists_draft_idx").on(table.draftId),
    index("legal_draft_checklists_template_idx").on(table.organizationId, table.isTemplate),
  ],
);

export const legalDraftChecklistItems = pgTable(
  "legal_draft_checklist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    checklistId: uuid("checklist_id")
      .notNull()
      .references(() => legalDraftChecklists.id, { onDelete: "cascade" }),
    itemKey: text("item_key").notNull(),
    label: text("label").notNull(),
    category: text("category"),
    required: boolean("required").notNull().default(true),
    status: legalDraftChecklistItemStatusEnum("status").notNull().default("pending"),
    sortOrder: integer("sort_order").notNull().default(0),
    notes: text("notes"),
    completedByMembershipId: uuid("completed_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("legal_draft_checklist_items_checklist_key_unique").on(
      table.checklistId,
      table.itemKey,
    ),
    index("legal_draft_checklist_items_checklist_idx").on(table.checklistId),
    index("legal_draft_checklist_items_org_idx").on(table.organizationId),
  ],
);

export const legalDocumentDraftsRelations = relations(legalDocumentDrafts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [legalDocumentDrafts.organizationId],
    references: [organizations.id],
  }),
  legalMatter: one(legalMatters, {
    fields: [legalDocumentDrafts.legalMatterId],
    references: [legalMatters.id],
  }),
  judicialProcess: one(judicialProcesses, {
    fields: [legalDocumentDrafts.judicialProcessId],
    references: [judicialProcesses.id],
  }),
  administrativeProcess: one(administrativeProcesses, {
    fields: [legalDocumentDrafts.administrativeProcessId],
    references: [administrativeProcesses.id],
  }),
  client: one(crmClients, {
    fields: [legalDocumentDrafts.clientId],
    references: [crmClients.id],
  }),
  template: one(legalDocumentTemplates, {
    fields: [legalDocumentDrafts.templateId],
    references: [legalDocumentTemplates.id],
  }),
  templateVersion: one(legalDocumentTemplateVersions, {
    fields: [legalDocumentDrafts.templateVersionId],
    references: [legalDocumentTemplateVersions.id],
  }),
  aiRequest: one(aiRequests, {
    fields: [legalDocumentDrafts.aiRequestId],
    references: [aiRequests.id],
  }),
  currentDocument: one(documents, {
    fields: [legalDocumentDrafts.currentDocumentId],
    references: [documents.id],
  }),
  versions: many(legalDocumentDraftVersions),
  workflowHistory: many(legalDocumentWorkflowHistory),
  checklists: many(legalDraftChecklists),
}));

export const legalDocumentDraftVersionsRelations = relations(
  legalDocumentDraftVersions,
  ({ one }) => ({
    draft: one(legalDocumentDrafts, {
      fields: [legalDocumentDraftVersions.draftId],
      references: [legalDocumentDrafts.id],
    }),
  }),
);

export const legalDraftSourceSetsRelations = relations(legalDraftSourceSets, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [legalDraftSourceSets.organizationId],
    references: [organizations.id],
  }),
  draft: one(legalDocumentDrafts, {
    fields: [legalDraftSourceSets.draftId],
    references: [legalDocumentDrafts.id],
  }),
  items: many(legalDraftSourceSetItems),
}));

export const legalDraftSourceSetItemsRelations = relations(legalDraftSourceSetItems, ({ one }) => ({
  sourceSet: one(legalDraftSourceSets, {
    fields: [legalDraftSourceSetItems.sourceSetId],
    references: [legalDraftSourceSets.id],
  }),
  document: one(documents, {
    fields: [legalDraftSourceSetItems.documentId],
    references: [documents.id],
  }),
  documentVersion: one(documentVersions, {
    fields: [legalDraftSourceSetItems.documentVersionId],
    references: [documentVersions.id],
  }),
}));

export const legalDocumentWorkflowHistoryRelations = relations(
  legalDocumentWorkflowHistory,
  ({ one }) => ({
    draft: one(legalDocumentDrafts, {
      fields: [legalDocumentWorkflowHistory.draftId],
      references: [legalDocumentDrafts.id],
    }),
  }),
);

export const legalDraftChecklistsRelations = relations(legalDraftChecklists, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [legalDraftChecklists.organizationId],
    references: [organizations.id],
  }),
  draft: one(legalDocumentDrafts, {
    fields: [legalDraftChecklists.draftId],
    references: [legalDocumentDrafts.id],
  }),
  items: many(legalDraftChecklistItems),
}));

export const legalDraftChecklistItemsRelations = relations(legalDraftChecklistItems, ({ one }) => ({
  checklist: one(legalDraftChecklists, {
    fields: [legalDraftChecklistItems.checklistId],
    references: [legalDraftChecklists.id],
  }),
}));
