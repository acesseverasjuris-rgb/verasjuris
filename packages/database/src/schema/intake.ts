import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { crmChannels, crmClients, crmContacts, crmLeads, crmSources } from "./crm.js";
import { organizationMembers, organizations, users } from "./identity.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const intakeStatusEnum = pgEnum("crm_intake_status", [
  "open",
  "triage",
  "waiting_client",
  "under_review",
  "qualified",
  "not_qualified",
  "converted",
  "closed",
  "archived",
]);

export const triageStatusEnum = pgEnum("crm_triage_status", [
  "draft",
  "in_progress",
  "waiting_information",
  "ready_for_analysis",
  "reviewed",
  "closed",
]);

export const intakeUrgencyEnum = pgEnum("crm_intake_urgency", [
  "normal",
  "attention",
  "urgent",
  "critical",
]);

export const intakeServiceModeEnum = pgEnum("crm_intake_service_mode", [
  "online",
  "in_person",
  "phone",
  "video",
  "message",
  "other",
]);

export const intakeDocumentStatusEnum = pgEnum("crm_intake_document_status", [
  "pending",
  "received",
  "unavailable",
  "rejected",
]);

/** Catálogo de áreas jurídicas por organização. */
export const legalAreas = pgTable(
  "legal_areas",
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
    isSystem: boolean("is_system").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("legal_areas_org_slug_unique").on(table.organizationId, table.slug),
    index("legal_areas_org_idx").on(table.organizationId),
  ],
);

export const crmIntakes = pgTable(
  "crm_intakes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => crmLeads.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => crmClients.id, { onDelete: "set null" }),
    contactId: uuid("contact_id").references(() => crmContacts.id, { onDelete: "set null" }),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    responsibleMembershipId: uuid("responsible_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    sourceId: uuid("source_id").references(() => crmSources.id, { onDelete: "set null" }),
    channelId: uuid("channel_id").references(() => crmChannels.id, { onDelete: "set null" }),
    legalAreaId: uuid("legal_area_id").references(() => legalAreas.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    summary: text("summary"),
    serviceMode: intakeServiceModeEnum("service_mode").notNull().default("online"),
    urgency: intakeUrgencyEnum("urgency").notNull().default("normal"),
    status: intakeStatusEnum("status").notNull().default("open"),
    preferredContactMethod: text("preferred_contact_method"),
    externalReference: text("external_reference"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
    convertedAt: timestamp("converted_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("crm_intakes_org_idx").on(table.organizationId),
    index("crm_intakes_org_status_idx").on(table.organizationId, table.status),
    index("crm_intakes_org_urgency_idx").on(table.organizationId, table.urgency),
    index("crm_intakes_org_responsible_idx").on(
      table.organizationId,
      table.responsibleMembershipId,
    ),
    index("crm_intakes_org_legal_area_idx").on(table.organizationId, table.legalAreaId),
    index("crm_intakes_lead_idx").on(table.leadId),
    index("crm_intakes_client_idx").on(table.clientId),
  ],
);

export const crmTriages = pgTable(
  "crm_triages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    intakeId: uuid("intake_id")
      .notNull()
      .references(() => crmIntakes.id, { onDelete: "cascade" }),
    legalAreaId: uuid("legal_area_id").references(() => legalAreas.id, { onDelete: "set null" }),
    urgency: intakeUrgencyEnum("urgency").notNull().default("normal"),
    summary: text("summary"),
    facts: text("facts"),
    requestNeed: text("request_need"),
    relevantDates: text("relevant_dates"),
    riskNotes: text("risk_notes"),
    missingInformation: text("missing_information"),
    nextAction: text("next_action"),
    responsibleMembershipId: uuid("responsible_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    status: triageStatusEnum("status").notNull().default("draft"),
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
    uniqueIndex("crm_triages_intake_unique").on(table.intakeId),
    index("crm_triages_org_idx").on(table.organizationId),
    index("crm_triages_org_status_idx").on(table.organizationId, table.status),
  ],
);

/** Metadados de documentos iniciais. Upload real depende de storage configurado. */
export const crmIntakeDocuments = pgTable(
  "crm_intake_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    intakeId: uuid("intake_id")
      .notNull()
      .references(() => crmIntakes.id, { onDelete: "cascade" }),
    uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    filename: text("filename").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    storageKey: text("storage_key"),
    contentHash: text("content_hash"),
    status: intakeDocumentStatusEnum("status").notNull().default("pending"),
    unavailableReason: text("unavailable_reason"),
    ...timestamps,
  },
  (table) => [
    index("crm_intake_documents_org_idx").on(table.organizationId),
    index("crm_intake_documents_intake_idx").on(table.intakeId),
  ],
);

export const DEFAULT_LEGAL_AREAS = [
  { slug: "previdenciario", name: "Previdenciário", sortOrder: 10 },
  { slug: "trabalhista", name: "Trabalhista", sortOrder: 20 },
  { slug: "civel", name: "Cível", sortOrder: 30 },
  { slug: "consumidor", name: "Consumidor", sortOrder: 40 },
  { slug: "familia", name: "Família", sortOrder: 50 },
  { slug: "empresarial", name: "Empresarial", sortOrder: 60 },
  { slug: "tributario", name: "Tributário", sortOrder: 70 },
  { slug: "administrativo", name: "Administrativo", sortOrder: 80 },
  { slug: "penal", name: "Penal", sortOrder: 90 },
  { slug: "saude", name: "Saúde / médico", sortOrder: 100 },
  { slug: "outros", name: "Outros", sortOrder: 110 },
] as const;

export const legalAreasRelations = relations(legalAreas, ({ one }) => ({
  organization: one(organizations, {
    fields: [legalAreas.organizationId],
    references: [organizations.id],
  }),
}));

export const crmIntakesRelations = relations(crmIntakes, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [crmIntakes.organizationId],
    references: [organizations.id],
  }),
  lead: one(crmLeads, { fields: [crmIntakes.leadId], references: [crmLeads.id] }),
  client: one(crmClients, { fields: [crmIntakes.clientId], references: [crmClients.id] }),
  contact: one(crmContacts, { fields: [crmIntakes.contactId], references: [crmContacts.id] }),
  legalArea: one(legalAreas, { fields: [crmIntakes.legalAreaId], references: [legalAreas.id] }),
  source: one(crmSources, { fields: [crmIntakes.sourceId], references: [crmSources.id] }),
  channel: one(crmChannels, { fields: [crmIntakes.channelId], references: [crmChannels.id] }),
  triage: one(crmTriages, { fields: [crmIntakes.id], references: [crmTriages.intakeId] }),
  documents: many(crmIntakeDocuments),
}));

export const crmTriagesRelations = relations(crmTriages, ({ one }) => ({
  intake: one(crmIntakes, { fields: [crmTriages.intakeId], references: [crmIntakes.id] }),
  legalArea: one(legalAreas, { fields: [crmTriages.legalAreaId], references: [legalAreas.id] }),
}));

export const crmIntakeDocumentsRelations = relations(crmIntakeDocuments, ({ one }) => ({
  intake: one(crmIntakes, {
    fields: [crmIntakeDocuments.intakeId],
    references: [crmIntakes.id],
  }),
}));
