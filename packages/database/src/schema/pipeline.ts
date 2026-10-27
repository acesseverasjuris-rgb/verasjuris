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
import { crmClients, crmLeads } from "./crm.js";
import { organizationMembers, organizations } from "./identity.js";
import { crmIntakes, crmTriages, legalAreas } from "./intake.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const opportunityStageEnum = pgEnum("crm_opportunity_stage", [
  "lead",
  "intake",
  "triage",
  "analysis",
  "proposal",
  "contracting",
  "client",
  "case",
  "lost",
  "archived",
]);

export const opportunityStatusEnum = pgEnum("crm_opportunity_status", [
  "active",
  "won",
  "lost",
  "archived",
]);

export const analysisStatusEnum = pgEnum("crm_analysis_status", [
  "draft",
  "in_review",
  "completed",
]);

export const proposalStatusEnum = pgEnum("crm_proposal_status", [
  "draft",
  "internal_review",
  "approved",
  "sent",
  "accepted",
  "rejected",
  "expired",
  "cancelled",
]);

export const engagementStatusEnum = pgEnum("crm_engagement_status", [
  "pending",
  "ready",
  "active",
  "cancelled",
  "declined",
]);

export const crmLossReasons = pgTable(
  "crm_loss_reasons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    isSystem: boolean("is_system").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("crm_loss_reasons_org_slug_unique").on(table.organizationId, table.slug),
    index("crm_loss_reasons_org_idx").on(table.organizationId),
  ],
);

/**
 * Orquestra a jornada comercial/jurídica sem substituir Lead/Intake/Client/Case.
 * ADR: crm_opportunities como item de pipeline.
 */
export const crmOpportunities = pgTable(
  "crm_opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => crmLeads.id, { onDelete: "set null" }),
    intakeId: uuid("intake_id").references(() => crmIntakes.id, { onDelete: "set null" }),
    triageId: uuid("triage_id").references(() => crmTriages.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => crmClients.id, { onDelete: "set null" }),
    /** FK para legal_cases adicionada na migration (evita ciclo Drizzle cases↔opportunities). */
    caseId: uuid("case_id"),
    responsibleMembershipId: uuid("responsible_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    legalAreaId: uuid("legal_area_id").references(() => legalAreas.id, { onDelete: "set null" }),
    stage: opportunityStageEnum("stage").notNull().default("lead"),
    status: opportunityStatusEnum("status").notNull().default("active"),
    title: text("title").notNull(),
    estimatedValueCents: integer("estimated_value_cents"),
    currency: text("currency").notNull().default("BRL"),
    lossReasonId: uuid("loss_reason_id").references(() => crmLossReasons.id, {
      onDelete: "set null",
    }),
    lossNotes: text("loss_notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "date" }),
    archiveReason: text("archive_reason"),
    wonAt: timestamp("won_at", { withTimezone: true, mode: "date" }),
    lostAt: timestamp("lost_at", { withTimezone: true, mode: "date" }),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("crm_opportunities_org_idx").on(table.organizationId),
    index("crm_opportunities_org_stage_idx").on(table.organizationId, table.stage),
    index("crm_opportunities_org_status_idx").on(table.organizationId, table.status),
    index("crm_opportunities_org_responsible_idx").on(
      table.organizationId,
      table.responsibleMembershipId,
    ),
    index("crm_opportunities_lead_idx").on(table.leadId),
    index("crm_opportunities_intake_idx").on(table.intakeId),
    index("crm_opportunities_client_idx").on(table.clientId),
  ],
);

export const crmAnalyses = pgTable(
  "crm_analyses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => crmOpportunities.id, { onDelete: "cascade" }),
    summary: text("summary"),
    feasibilityNotes: text("feasibility_notes"),
    riskNotes: text("risk_notes"),
    missingInformation: text("missing_information"),
    recommendedNextStep: text("recommended_next_step"),
    responsibleMembershipId: uuid("responsible_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    status: analysisStatusEnum("status").notNull().default("draft"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("crm_analyses_opportunity_unique").on(table.opportunityId),
    index("crm_analyses_org_idx").on(table.organizationId),
  ],
);

export const crmProposals = pgTable(
  "crm_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => crmOpportunities.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => crmLeads.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => crmClients.id, { onDelete: "set null" }),
    version: integer("version").notNull().default(1),
    title: text("title").notNull(),
    scope: text("scope"),
    exclusions: text("exclusions"),
    priceCents: integer("price_cents").notNull().default(0),
    currency: text("currency").notNull().default("BRL"),
    paymentTerms: text("payment_terms"),
    validityUntil: timestamp("validity_until", { withTimezone: true, mode: "date" }),
    status: proposalStatusEnum("status").notNull().default("draft"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    approvedByMembershipId: uuid("approved_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("crm_proposals_opportunity_version_unique").on(table.opportunityId, table.version),
    index("crm_proposals_org_idx").on(table.organizationId),
    index("crm_proposals_org_status_idx").on(table.organizationId, table.status),
  ],
);

export const crmEngagements = pgTable(
  "crm_engagements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => crmOpportunities.id, { onDelete: "cascade" }),
    proposalId: uuid("proposal_id").references(() => crmProposals.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => crmClients.id, { onDelete: "set null" }),
    status: engagementStatusEnum("status").notNull().default("pending"),
    contractReference: text("contract_reference"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" }),
    effectiveAt: timestamp("effective_at", { withTimezone: true, mode: "date" }),
    closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("crm_engagements_opportunity_unique").on(table.opportunityId),
    index("crm_engagements_org_idx").on(table.organizationId),
  ],
);

export const DEFAULT_LOSS_REASONS = [
  { slug: "no_response", name: "Sem retorno", sortOrder: 10 },
  { slug: "no_interest", name: "Sem interesse", sortOrder: 20 },
  { slug: "infeasible", name: "Inviabilidade", sortOrder: 30 },
  { slug: "price", name: "Valor", sortOrder: 40 },
  { slug: "conflict", name: "Conflito", sortOrder: 50 },
  { slug: "out_of_scope", name: "Fora do escopo", sortOrder: 60 },
  { slug: "chose_other", name: "Escolheu outro profissional", sortOrder: 70 },
  { slug: "duplicate", name: "Duplicado", sortOrder: 80 },
  { slug: "other", name: "Outro", sortOrder: 90 },
] as const;

export const crmLossReasonsRelations = relations(crmLossReasons, ({ one }) => ({
  organization: one(organizations, {
    fields: [crmLossReasons.organizationId],
    references: [organizations.id],
  }),
}));

export const crmOpportunitiesRelations = relations(crmOpportunities, ({ one }) => ({
  organization: one(organizations, {
    fields: [crmOpportunities.organizationId],
    references: [organizations.id],
  }),
  lead: one(crmLeads, { fields: [crmOpportunities.leadId], references: [crmLeads.id] }),
  intake: one(crmIntakes, { fields: [crmOpportunities.intakeId], references: [crmIntakes.id] }),
  triage: one(crmTriages, { fields: [crmOpportunities.triageId], references: [crmTriages.id] }),
  client: one(crmClients, { fields: [crmOpportunities.clientId], references: [crmClients.id] }),
  legalArea: one(legalAreas, {
    fields: [crmOpportunities.legalAreaId],
    references: [legalAreas.id],
  }),
  lossReason: one(crmLossReasons, {
    fields: [crmOpportunities.lossReasonId],
    references: [crmLossReasons.id],
  }),
}));

export const crmAnalysesRelations = relations(crmAnalyses, ({ one }) => ({
  opportunity: one(crmOpportunities, {
    fields: [crmAnalyses.opportunityId],
    references: [crmOpportunities.id],
  }),
}));

export const crmProposalsRelations = relations(crmProposals, ({ one }) => ({
  opportunity: one(crmOpportunities, {
    fields: [crmProposals.opportunityId],
    references: [crmOpportunities.id],
  }),
}));

export const crmEngagementsRelations = relations(crmEngagements, ({ one }) => ({
  opportunity: one(crmOpportunities, {
    fields: [crmEngagements.opportunityId],
    references: [crmOpportunities.id],
  }),
  proposal: one(crmProposals, {
    fields: [crmEngagements.proposalId],
    references: [crmProposals.id],
  }),
}));
