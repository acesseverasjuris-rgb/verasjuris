import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizationMembers, organizations, users } from "./identity.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const personTypeEnum = pgEnum("crm_person_type", ["person", "organization"]);
export const leadStatusEnum = pgEnum("crm_lead_status", [
  "new",
  "contacted",
  "qualifying",
  "qualified",
  "unqualified",
  "converted",
  "archived",
]);
export const clientStatusEnum = pgEnum("crm_client_status", ["active", "inactive", "archived"]);
export const noteVisibilityEnum = pgEnum("crm_note_visibility", [
  "organization",
  "internal",
  "private",
]);
export const interactionTypeEnum = pgEnum("crm_interaction_type", [
  "note",
  "call",
  "email",
  "meeting",
  "message",
  "status_change",
  "assignment",
  "lead_conversion",
]);
export const interactionOriginEnum = pgEnum("crm_interaction_origin", [
  "manual",
  "system",
  "integration",
]);
export const crmResourceTypeEnum = pgEnum("crm_resource_type", [
  "lead",
  "client",
  "contact",
  "intake",
  "opportunity",
  "case",
]);

export const crmSources = pgTable(
  "crm_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    isSystem: boolean("is_system").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("crm_sources_org_key_unique").on(table.organizationId, table.key),
    index("crm_sources_org_idx").on(table.organizationId),
  ],
);

export const crmChannels = pgTable(
  "crm_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    isSystem: boolean("is_system").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("crm_channels_org_key_unique").on(table.organizationId, table.key),
    index("crm_channels_org_idx").on(table.organizationId),
  ],
);

export const crmTags = pgTable(
  "crm_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    color: text("color"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("crm_tags_org_slug_unique").on(table.organizationId, table.slug),
    index("crm_tags_org_idx").on(table.organizationId),
  ],
);

export const crmLeads = pgTable(
  "crm_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    personType: personTypeEnum("person_type").notNull().default("person"),
    name: text("name").notNull(),
    tradeName: text("trade_name"),
    email: text("email"),
    phone: text("phone"),
    summary: text("summary"),
    status: leadStatusEnum("status").notNull().default("new"),
    sourceId: uuid("source_id").references(() => crmSources.id, { onDelete: "set null" }),
    channelId: uuid("channel_id").references(() => crmChannels.id, { onDelete: "set null" }),
    ownerMembershipId: uuid("owner_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    convertedAt: timestamp("converted_at", { withTimezone: true, mode: "date" }),
    convertedClientId: uuid("converted_client_id"),
    ...timestamps,
  },
  (table) => [
    index("crm_leads_org_idx").on(table.organizationId),
    index("crm_leads_org_status_idx").on(table.organizationId, table.status),
    index("crm_leads_org_owner_idx").on(table.organizationId, table.ownerMembershipId),
    index("crm_leads_org_name_idx").on(table.organizationId, table.name),
  ],
);

export const crmClients = pgTable(
  "crm_clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    personType: personTypeEnum("person_type").notNull(),
    status: clientStatusEnum("status").notNull().default("active"),
    // Pessoa física
    fullName: text("full_name"),
    socialName: text("social_name"),
    cpfNormalized: text("cpf_normalized"),
    birthDate: timestamp("birth_date", { withTimezone: true, mode: "date" }),
    // Pessoa jurídica
    legalName: text("legal_name"),
    tradeName: text("trade_name"),
    cnpjNormalized: text("cnpj_normalized"),
    website: text("website"),
    email: text("email"),
    phone: text("phone"),
    notes: text("notes"),
    sourceId: uuid("source_id").references(() => crmSources.id, { onDelete: "set null" }),
    channelId: uuid("channel_id").references(() => crmChannels.id, { onDelete: "set null" }),
    ownerMembershipId: uuid("owner_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    convertedFromLeadId: uuid("converted_from_lead_id").references(() => crmLeads.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    index("crm_clients_org_idx").on(table.organizationId),
    index("crm_clients_org_type_idx").on(table.organizationId, table.personType),
    index("crm_clients_org_cpf_idx").on(table.organizationId, table.cpfNormalized),
    index("crm_clients_org_cnpj_idx").on(table.organizationId, table.cnpjNormalized),
    index("crm_clients_org_name_idx").on(table.organizationId, table.fullName),
    index("crm_clients_org_legal_idx").on(table.organizationId, table.legalName),
  ],
);

export const crmContacts = pgTable(
  "crm_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => crmLeads.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => crmClients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    jobTitle: text("job_title"),
    notes: text("notes"),
    isPrimary: boolean("is_primary").notNull().default(false),
    contactPreferences: text("contact_preferences"),
    ...timestamps,
  },
  (table) => [
    index("crm_contacts_org_idx").on(table.organizationId),
    index("crm_contacts_lead_idx").on(table.leadId),
    index("crm_contacts_client_idx").on(table.clientId),
  ],
);

export const crmLeadTags = pgTable(
  "crm_lead_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => crmLeads.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => crmTags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("crm_lead_tags_unique").on(table.leadId, table.tagId),
    index("crm_lead_tags_org_idx").on(table.organizationId),
  ],
);

export const crmClientTags = pgTable(
  "crm_client_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => crmClients.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => crmTags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("crm_client_tags_unique").on(table.clientId, table.tagId),
    index("crm_client_tags_org_idx").on(table.organizationId),
  ],
);

export const crmNotes = pgTable(
  "crm_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    authorMembershipId: uuid("author_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    resourceType: crmResourceTypeEnum("resource_type").notNull(),
    resourceId: uuid("resource_id").notNull(),
    content: text("content").notNull(),
    visibility: noteVisibilityEnum("visibility").notNull().default("organization"),
    ...timestamps,
  },
  (table) => [
    index("crm_notes_org_resource_idx").on(
      table.organizationId,
      table.resourceType,
      table.resourceId,
    ),
  ],
);

export const crmInteractions = pgTable(
  "crm_interactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    resourceType: crmResourceTypeEnum("resource_type").notNull(),
    resourceId: uuid("resource_id").notNull(),
    type: interactionTypeEnum("type").notNull(),
    origin: interactionOriginEnum("origin").notNull().default("manual"),
    title: text("title").notNull(),
    body: text("body"),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("crm_interactions_org_resource_idx").on(
      table.organizationId,
      table.resourceType,
      table.resourceId,
    ),
    index("crm_interactions_occurred_idx").on(table.organizationId, table.occurredAt),
  ],
);

export const crmSourcesRelations = relations(crmSources, ({ one }) => ({
  organization: one(organizations, {
    fields: [crmSources.organizationId],
    references: [organizations.id],
  }),
}));

export const crmChannelsRelations = relations(crmChannels, ({ one }) => ({
  organization: one(organizations, {
    fields: [crmChannels.organizationId],
    references: [organizations.id],
  }),
}));

export const crmTagsRelations = relations(crmTags, ({ one }) => ({
  organization: one(organizations, {
    fields: [crmTags.organizationId],
    references: [organizations.id],
  }),
}));

export const crmLeadsRelations = relations(crmLeads, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [crmLeads.organizationId],
    references: [organizations.id],
  }),
  source: one(crmSources, { fields: [crmLeads.sourceId], references: [crmSources.id] }),
  channel: one(crmChannels, { fields: [crmLeads.channelId], references: [crmChannels.id] }),
  tags: many(crmLeadTags),
  contacts: many(crmContacts),
}));

export const crmClientsRelations = relations(crmClients, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [crmClients.organizationId],
    references: [organizations.id],
  }),
  source: one(crmSources, { fields: [crmClients.sourceId], references: [crmSources.id] }),
  channel: one(crmChannels, { fields: [crmClients.channelId], references: [crmChannels.id] }),
  tags: many(crmClientTags),
  contacts: many(crmContacts),
}));

export const crmContactsRelations = relations(crmContacts, ({ one }) => ({
  lead: one(crmLeads, { fields: [crmContacts.leadId], references: [crmLeads.id] }),
  client: one(crmClients, { fields: [crmContacts.clientId], references: [crmClients.id] }),
}));

export const crmLeadTagsRelations = relations(crmLeadTags, ({ one }) => ({
  lead: one(crmLeads, { fields: [crmLeadTags.leadId], references: [crmLeads.id] }),
  tag: one(crmTags, { fields: [crmLeadTags.tagId], references: [crmTags.id] }),
}));

export const crmClientTagsRelations = relations(crmClientTags, ({ one }) => ({
  client: one(crmClients, { fields: [crmClientTags.clientId], references: [crmClients.id] }),
  tag: one(crmTags, { fields: [crmClientTags.tagId], references: [crmTags.id] }),
}));

/** Constantes de catálogo padrão por organização. */
export const DEFAULT_CRM_SOURCES = [
  { key: "referral", name: "Indicação" },
  { key: "website", name: "Site" },
  { key: "instagram", name: "Instagram" },
  { key: "google", name: "Google" },
  { key: "ad", name: "Anúncio" },
  { key: "phone", name: "Telefone" },
  { key: "whatsapp", name: "WhatsApp" },
  { key: "event", name: "Evento" },
  { key: "partner", name: "Parceiro" },
  { key: "other", name: "Outro" },
] as const;

export const DEFAULT_CRM_CHANNELS = [
  { key: "email", name: "E-mail" },
  { key: "phone", name: "Telefone" },
  { key: "whatsapp", name: "WhatsApp" },
  { key: "in_person", name: "Presencial" },
  { key: "web_form", name: "Formulário web" },
  { key: "instagram", name: "Instagram" },
  { key: "other", name: "Outro" },
] as const;
