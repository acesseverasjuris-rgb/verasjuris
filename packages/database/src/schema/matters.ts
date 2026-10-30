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
import { crmClients, crmContacts, crmTags } from "./crm.js";
import { organizationMembers, organizations } from "./identity.js";
import { crmIntakes, legalAreas } from "./intake.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const legalMatterStatusEnum = pgEnum("legal_matter_status", [
  "draft",
  "open",
  "active",
  "waiting",
  "suspended",
  "closed",
  "archived",
]);

/** customer = trabalho de cliente; internal_company = jurídico interno VerasJuris Control. */
export const legalMatterScopeEnum = pgEnum("legal_matter_scope", ["customer", "internal_company"]);

export const legalMatterPriorityEnum = pgEnum("legal_matter_priority", [
  "normal",
  "high",
  "urgent",
]);

export const matterPartyPositionEnum = pgEnum("legal_matter_party_position", [
  "client",
  "opposing",
  "interested",
  "claimant",
  "respondent",
  "third_party",
  "beneficiary",
  "representative",
  "other",
]);

export const matterPartyPersonTypeEnum = pgEnum("legal_matter_party_person_type", [
  "person",
  "organization",
  "public_body",
  "other",
]);

export const matterTeamRoleEnum = pgEnum("legal_matter_team_role", [
  "responsible",
  "lawyer",
  "collaborator",
  "intern",
  "paralegal",
  "reviewer",
  "coordinator",
  "other",
]);

export const matterFeeTypeEnum = pgEnum("legal_matter_fee_type", [
  "fixed",
  "success",
  "percentage",
  "hourly",
  "monthly",
  "hybrid",
  "pro_bono",
  "other",
]);

export const matterFeeStatusEnum = pgEnum("legal_matter_fee_status", [
  "draft",
  "active",
  "superseded",
  "cancelled",
]);

export const legalDemandTypes = pgTable(
  "legal_demand_types",
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
    uniqueIndex("legal_demand_types_org_slug_unique").on(table.organizationId, table.slug),
    index("legal_demand_types_org_idx").on(table.organizationId),
  ],
);

export const legalSubareas = pgTable(
  "legal_subareas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalAreaId: uuid("legal_area_id")
      .notNull()
      .references(() => legalAreas.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("legal_subareas_org_area_slug_unique").on(
      table.organizationId,
      table.legalAreaId,
      table.slug,
    ),
    index("legal_subareas_org_idx").on(table.organizationId),
    index("legal_subareas_area_idx").on(table.legalAreaId),
  ],
);

/** Sequência de referência humana por organização/ano — VJ-YYYY-NNNNNN */
export const legalMatterSequences = pgTable(
  "legal_matter_sequences",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    lastValue: integer("last_value").notNull().default(0),
  },
  (table) => [
    uniqueIndex("legal_matter_sequences_org_year_unique").on(table.organizationId, table.year),
  ],
);

/**
 * LegalMatter — agregado central de trabalho jurídico.
 * Persistência: tabela `legal_matters` (evolução de `legal_cases`).
 * FK opportunity via uuid sem references Drizzle (evita ciclo com pipeline).
 */
export const legalMatters = pgTable(
  "legal_matters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => crmClients.id, { onDelete: "restrict" }),
    /** Sem FK Drizzle — FK SQL aponta para crm_opportunities. */
    originatingOpportunityId: uuid("originating_opportunity_id"),
    intakeId: uuid("intake_id").references(() => crmIntakes.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    internalReference: text("internal_reference").notNull(),
    demandTypeId: uuid("demand_type_id").references(() => legalDemandTypes.id, {
      onDelete: "set null",
    }),
    legalAreaId: uuid("legal_area_id").references(() => legalAreas.id, { onDelete: "set null" }),
    legalSubareaId: uuid("legal_subarea_id").references(() => legalSubareas.id, {
      onDelete: "set null",
    }),
    summary: text("summary"),
    status: legalMatterStatusEnum("status").notNull().default("open"),
    matterScope: legalMatterScopeEnum("matter_scope").notNull().default("customer"),
    priority: legalMatterPriorityEnum("priority").notNull().default("normal"),
    responsibleMembershipId: uuid("responsible_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    openedAt: timestamp("opened_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "date" }),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("legal_matters_org_ref_unique").on(table.organizationId, table.internalReference),
    index("legal_matters_org_idx").on(table.organizationId),
    index("legal_matters_org_status_idx").on(table.organizationId, table.status),
    index("legal_matters_org_scope_idx").on(table.organizationId, table.matterScope),
    index("legal_matters_client_idx").on(table.clientId),
    index("legal_matters_opportunity_idx").on(table.originatingOpportunityId),
    index("legal_matters_responsible_idx").on(table.organizationId, table.responsibleMembershipId),
  ],
);

export const legalMatterParties = pgTable(
  "legal_matter_parties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    partyType: text("party_type").notNull().default("party"),
    position: matterPartyPositionEnum("position").notNull().default("other"),
    personType: matterPartyPersonTypeEnum("person_type").notNull().default("person"),
    clientId: uuid("client_id").references(() => crmClients.id, { onDelete: "set null" }),
    contactId: uuid("contact_id").references(() => crmContacts.id, { onDelete: "set null" }),
    displayName: text("display_name").notNull(),
    documentNormalized: text("document_normalized"),
    roleDescription: text("role_description"),
    isPrimary: boolean("is_primary").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("legal_matter_parties_org_idx").on(table.organizationId),
    index("legal_matter_parties_matter_idx").on(table.legalMatterId),
  ],
);

export const legalMatterTeamMembers = pgTable(
  "legal_matter_team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => organizationMembers.id, { onDelete: "cascade" }),
    teamRole: matterTeamRoleEnum("team_role").notNull().default("collaborator"),
    isPrimary: boolean("is_primary").notNull().default(false),
    assignedAt: timestamp("assigned_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    assignedByMembershipId: uuid("assigned_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    removedAt: timestamp("removed_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("legal_matter_team_matter_member_unique").on(
      table.legalMatterId,
      table.membershipId,
    ),
    index("legal_matter_team_org_idx").on(table.organizationId),
  ],
);

/**
 * Regra contratual/comercial de honorários — NÃO é pagamento, saldo ou invoice.
 */
export const legalMatterFeeArrangements = pgTable(
  "legal_matter_fee_arrangements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    type: matterFeeTypeEnum("type").notNull(),
    fixedAmountCents: integer("fixed_amount_cents"),
    percentageBasisPoints: integer("percentage_basis_points"),
    hourlyRateCents: integer("hourly_rate_cents"),
    successFeeBasisPoints: integer("success_fee_basis_points"),
    description: text("description"),
    status: matterFeeStatusEnum("status").notNull().default("active"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    effectiveUntil: timestamp("effective_until", { withTimezone: true, mode: "date" }),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("legal_matter_fees_org_idx").on(table.organizationId),
    index("legal_matter_fees_matter_idx").on(table.legalMatterId),
  ],
);

/** Reutiliza crm_tags (tenant-aware) via junction — ADR 033. */
export const legalMatterTags = pgTable(
  "legal_matter_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => crmTags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("legal_matter_tags_unique").on(table.legalMatterId, table.tagId),
    index("legal_matter_tags_org_idx").on(table.organizationId),
  ],
);

export const legalMatterTimelineEvents = pgTable(
  "legal_matter_timeline_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    actorMembershipId: uuid("actor_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    /** Deny-by-default: portal do cliente só vê eventos com clientVisible=true. */
    clientVisible: boolean("client_visible").notNull().default(false),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("legal_matter_timeline_matter_idx").on(table.legalMatterId, table.occurredAt),
    index("legal_matter_timeline_org_idx").on(table.organizationId),
    index("legal_matter_timeline_client_visible_idx").on(
      table.legalMatterId,
      table.clientVisible,
      table.occurredAt,
    ),
  ],
);

export const DEFAULT_DEMAND_TYPES = [
  { slug: "consultive", name: "Consultivo", sortOrder: 10 },
  { slug: "litigation", name: "Contencioso", sortOrder: 20 },
  { slug: "administrative", name: "Administrativo", sortOrder: 30 },
  { slug: "judicial", name: "Judicial", sortOrder: 40 },
  { slug: "extrajudicial", name: "Extrajudicial", sortOrder: 50 },
  { slug: "preventive", name: "Preventivo", sortOrder: 60 },
  { slug: "contractual", name: "Contratual", sortOrder: 70 },
  { slug: "other", name: "Outros", sortOrder: 80 },
] as const;

export const legalDemandTypesRelations = relations(legalDemandTypes, ({ one }) => ({
  organization: one(organizations, {
    fields: [legalDemandTypes.organizationId],
    references: [organizations.id],
  }),
}));

export const legalSubareasRelations = relations(legalSubareas, ({ one }) => ({
  area: one(legalAreas, { fields: [legalSubareas.legalAreaId], references: [legalAreas.id] }),
  organization: one(organizations, {
    fields: [legalSubareas.organizationId],
    references: [organizations.id],
  }),
}));

export const legalMattersRelations = relations(legalMatters, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [legalMatters.organizationId],
    references: [organizations.id],
  }),
  client: one(crmClients, { fields: [legalMatters.clientId], references: [crmClients.id] }),
  demandType: one(legalDemandTypes, {
    fields: [legalMatters.demandTypeId],
    references: [legalDemandTypes.id],
  }),
  legalArea: one(legalAreas, { fields: [legalMatters.legalAreaId], references: [legalAreas.id] }),
  legalSubarea: one(legalSubareas, {
    fields: [legalMatters.legalSubareaId],
    references: [legalSubareas.id],
  }),
  parties: many(legalMatterParties),
  teamMembers: many(legalMatterTeamMembers),
  fees: many(legalMatterFeeArrangements),
  tags: many(legalMatterTags),
  timelineEvents: many(legalMatterTimelineEvents),
}));

export const legalMatterPartiesRelations = relations(legalMatterParties, ({ one }) => ({
  matter: one(legalMatters, {
    fields: [legalMatterParties.legalMatterId],
    references: [legalMatters.id],
  }),
}));

export const legalMatterTeamMembersRelations = relations(legalMatterTeamMembers, ({ one }) => ({
  matter: one(legalMatters, {
    fields: [legalMatterTeamMembers.legalMatterId],
    references: [legalMatters.id],
  }),
  membership: one(organizationMembers, {
    fields: [legalMatterTeamMembers.membershipId],
    references: [organizationMembers.id],
  }),
}));

export const legalMatterFeeArrangementsRelations = relations(
  legalMatterFeeArrangements,
  ({ one }) => ({
    matter: one(legalMatters, {
      fields: [legalMatterFeeArrangements.legalMatterId],
      references: [legalMatters.id],
    }),
  }),
);

export const legalMatterTagsRelations = relations(legalMatterTags, ({ one }) => ({
  matter: one(legalMatters, {
    fields: [legalMatterTags.legalMatterId],
    references: [legalMatters.id],
  }),
  tag: one(crmTags, { fields: [legalMatterTags.tagId], references: [crmTags.id] }),
}));

export const legalMatterTimelineEventsRelations = relations(
  legalMatterTimelineEvents,
  ({ one }) => ({
    matter: one(legalMatters, {
      fields: [legalMatterTimelineEvents.legalMatterId],
      references: [legalMatters.id],
    }),
  }),
);

/** Alias de transição — preferir `legalMatters`. */
export const legalCases = legalMatters;
export const legalCasesRelations = legalMattersRelations;
