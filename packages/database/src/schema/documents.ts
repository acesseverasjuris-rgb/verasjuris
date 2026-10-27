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

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const documentOwnerTypeEnum = pgEnum("document_owner_type", [
  "organization",
  "legal_matter",
  "judicial_process",
  "administrative_process",
  "client",
  "intake",
]);

export const documentStatusEnum = pgEnum("document_status", ["draft", "active", "archived"]);

export const documentKindEnum = pgEnum("document_kind", [
  "identification",
  "evidence",
  "contract",
  "petition",
  "decision",
  "report",
  "power_of_attorney",
  "administrative",
  "correspondence",
  "other",
]);

export const documentLegalContextEnum = pgEnum("document_legal_context", [
  "client",
  "matter",
  "judicial",
  "administrative",
  "internal",
  "other",
]);

export const documentEvidentiaryRoleEnum = pgEnum("document_evidentiary_role", [
  "none",
  "evidence",
  "supporting",
  "rebuttal",
  "reference",
]);

export const documentConfidentialityEnum = pgEnum("document_confidentiality_level", [
  "normal",
  "restricted",
  "confidential",
]);

export const documentVersionStatusEnum = pgEnum("document_version_status", [
  "uploading",
  "quarantined",
  "available",
  "rejected",
  "failed",
]);

export const documentScanStatusEnum = pgEnum("document_scan_status", [
  "not_configured",
  "pending",
  "clean",
  "infected",
  "error",
]);

export const documentAclPrincipalTypeEnum = pgEnum("document_acl_principal_type", [
  "user",
  "membership",
  "role",
  "organization",
]);

export const documentAclPermissionEnum = pgEnum("document_acl_permission", [
  "read",
  "download",
  "upload_version",
  "update_metadata",
  "share",
  "archive",
  "delete",
]);

export const documentCategories = pgTable(
  "document_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("document_categories_org_slug_unique").on(table.organizationId, table.slug),
    index("document_categories_org_idx").on(table.organizationId),
  ],
);

export const documentFolders = pgTable(
  "document_folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    parentFolderId: uuid("parent_folder_id"),
    ownerType: documentOwnerTypeEnum("owner_type").notNull(),
    ownerId: uuid("owner_id").notNull(),
    name: text("name").notNull(),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("document_folders_org_idx").on(table.organizationId),
    index("document_folders_parent_idx").on(table.parentFolderId),
    index("document_folders_owner_idx").on(table.organizationId, table.ownerType, table.ownerId),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    ownerType: documentOwnerTypeEnum("owner_type").notNull(),
    ownerId: uuid("owner_id").notNull(),
    categoryId: uuid("category_id").references(() => documentCategories.id, {
      onDelete: "set null",
    }),
    folderId: uuid("folder_id").references(() => documentFolders.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    status: documentStatusEnum("status").notNull().default("active"),
    documentKind: documentKindEnum("document_kind").notNull().default("other"),
    legalContext: documentLegalContextEnum("legal_context").notNull().default("other"),
    evidentiaryRole: documentEvidentiaryRoleEnum("evidentiary_role").notNull().default("none"),
    confidentialityLevel: documentConfidentialityEnum("confidentiality_level")
      .notNull()
      .default("normal"),
    currentVersionId: uuid("current_version_id"),
    /** Metadata tipada/controlada (provas, contratos, procurações, petições). Tamanho validado na API. */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    retentionUntil: timestamp("retention_until", { withTimezone: true, mode: "date" }),
    legalHold: boolean("legal_hold").notNull().default(false),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("documents_org_idx").on(table.organizationId),
    index("documents_owner_idx").on(table.organizationId, table.ownerType, table.ownerId),
    index("documents_org_status_idx").on(table.organizationId, table.status),
    index("documents_category_idx").on(table.categoryId),
    index("documents_folder_idx").on(table.folderId),
  ],
);

export const documentVersions = pgTable(
  "document_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    storageProvider: text("storage_provider").notNull(),
    storageKey: text("storage_key").notNull(),
    originalFilename: text("original_filename").notNull(),
    safeFilename: text("safe_filename").notNull(),
    mimeTypeDeclared: text("mime_type_declared").notNull(),
    mimeTypeDetected: text("mime_type_detected").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    etag: text("etag"),
    status: documentVersionStatusEnum("status").notNull().default("uploading"),
    scanStatus: documentScanStatusEnum("scan_status").notNull().default("not_configured"),
    scanProvider: text("scan_provider"),
    scanResult: text("scan_result"),
    idempotencyKey: text("idempotency_key"),
    uploadedByMembershipId: uuid("uploaded_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("document_versions_doc_version_unique").on(table.documentId, table.versionNumber),
    index("document_versions_idempotency_idx").on(
      table.organizationId,
      table.documentId,
      table.idempotencyKey,
    ),
    index("document_versions_org_idx").on(table.organizationId),
    index("document_versions_document_idx").on(table.documentId),
    index("document_versions_sha256_idx").on(table.organizationId, table.sha256),
  ],
);

export const documentAclEntries = pgTable(
  "document_acl_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    principalType: documentAclPrincipalTypeEnum("principal_type").notNull(),
    principalId: uuid("principal_id").notNull(),
    permission: documentAclPermissionEnum("permission").notNull(),
    grantedByMembershipId: uuid("granted_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("document_acl_unique").on(
      table.documentId,
      table.principalType,
      table.principalId,
      table.permission,
    ),
    index("document_acl_org_idx").on(table.organizationId),
    index("document_acl_document_idx").on(table.documentId),
  ],
);

export const documentTimelineEvents = pgTable(
  "document_timeline_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    versionId: uuid("version_id"),
    actorMembershipId: uuid("actor_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    eventAt: timestamp("event_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("document_timeline_document_idx").on(table.documentId),
    index("document_timeline_event_at_idx").on(table.documentId, table.eventAt),
  ],
);

/** Vínculo tipado opcional (requerimento, protocolo, etc.) sem acoplar Document ao módulo. */
export const documentLinks = pgTable(
  "document_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    linkType: text("link_type").notNull(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("document_links_org_idx").on(table.organizationId),
    index("document_links_document_idx").on(table.documentId),
    index("document_links_target_idx").on(table.organizationId, table.targetType, table.targetId),
  ],
);

export const documentCategoriesRelations = relations(documentCategories, ({ many }) => ({
  documents: many(documents),
}));

export const documentFoldersRelations = relations(documentFolders, ({ one, many }) => ({
  parent: one(documentFolders, {
    fields: [documentFolders.parentFolderId],
    references: [documentFolders.id],
    relationName: "folder_hierarchy",
  }),
  children: many(documentFolders, { relationName: "folder_hierarchy" }),
  documents: many(documents),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [documents.organizationId],
    references: [organizations.id],
  }),
  category: one(documentCategories, {
    fields: [documents.categoryId],
    references: [documentCategories.id],
  }),
  folder: one(documentFolders, {
    fields: [documents.folderId],
    references: [documentFolders.id],
  }),
  versions: many(documentVersions),
  aclEntries: many(documentAclEntries),
  timelineEvents: many(documentTimelineEvents),
  links: many(documentLinks),
}));

export const documentVersionsRelations = relations(documentVersions, ({ one }) => ({
  document: one(documents, {
    fields: [documentVersions.documentId],
    references: [documents.id],
  }),
}));

export const documentAclEntriesRelations = relations(documentAclEntries, ({ one }) => ({
  document: one(documents, {
    fields: [documentAclEntries.documentId],
    references: [documents.id],
  }),
}));

export const documentTimelineEventsRelations = relations(documentTimelineEvents, ({ one }) => ({
  document: one(documents, {
    fields: [documentTimelineEvents.documentId],
    references: [documents.id],
  }),
}));

export const documentLinksRelations = relations(documentLinks, ({ one }) => ({
  document: one(documents, {
    fields: [documentLinks.documentId],
    references: [documents.id],
  }),
}));
