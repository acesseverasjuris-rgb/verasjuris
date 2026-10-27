import { relations } from "drizzle-orm";
import {
  bigint,
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
import { administrativeBodies } from "./administrative.js";
import { organizationMembers, organizations } from "./identity.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const publicOpportunityTypeEnum = pgEnum("public_opportunity_type", [
  "tender",
  "public_call",
  "accreditation",
  "partnership",
  "concession",
  "grant",
  "program",
  "notice",
  "other",
]);

export const publicOpportunitySourceEnum = pgEnum("public_opportunity_source", [
  "manual",
  "public_provider",
  "import",
]);

export const publicOpportunityStatusEnum = pgEnum("public_opportunity_status", [
  "draft",
  "published",
  "open",
  "closed",
  "cancelled",
  "archived",
]);

export const publicOpportunityInterestStatusEnum = pgEnum("public_opportunity_interest_status", [
  "saved",
  "reviewing",
  "interested",
  "preparing",
  "submitted",
  "not_interested",
  "won",
  "lost",
  "archived",
]);

export const publicOpportunityRequirementStatusEnum = pgEnum(
  "public_opportunity_requirement_status",
  ["pending", "met", "not_met", "waived", "unknown"],
);

/**
 * Oportunidade pública de referência.
 * Pode ser global (organizationId null) ou cadastrada por uma organização (manual).
 * Interest/requirements/docs internos são sempre tenant-specific.
 */
export const publicOpportunities = pgTable(
  "public_opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** null = referência global (futuro provider); não-null = cadastro manual da org. */
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    sourceProvider: publicOpportunitySourceEnum("source_provider").notNull().default("manual"),
    sourceReference: text("source_reference"),
    sourceUrl: text("source_url"),
    opportunityType: publicOpportunityTypeEnum("opportunity_type").notNull().default("tender"),
    title: text("title").notNull(),
    description: text("description"),
    publicBodyId: uuid("public_body_id").references(() => administrativeBodies.id, {
      onDelete: "set null",
    }),
    processNumber: text("process_number"),
    procurementNumber: text("procurement_number"),
    modality: text("modality"),
    object: text("object").notNull(),
    estimatedValueCents: bigint("estimated_value_cents", { mode: "number" }),
    currency: text("currency").notNull().default("BRL"),
    publicationDate: timestamp("publication_date", { withTimezone: true, mode: "date" }),
    proposalDeadline: timestamp("proposal_deadline", { withTimezone: true, mode: "date" }),
    timezone: text("timezone").notNull().default("America/Sao_Paulo"),
    status: publicOpportunityStatusEnum("status").notNull().default("draft"),
    region: text("region"),
    stateCode: text("state_code"),
    municipality: text("municipality"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("public_opportunities_org_idx").on(table.organizationId),
    index("public_opportunities_type_idx").on(table.opportunityType),
    index("public_opportunities_status_idx").on(table.status),
    index("public_opportunities_deadline_idx").on(table.proposalDeadline),
    index("public_opportunities_state_idx").on(table.stateCode),
    index("public_opportunities_body_idx").on(table.publicBodyId),
  ],
);

export const publicOpportunityInterests = pgTable(
  "public_opportunity_interests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => publicOpportunities.id, { onDelete: "cascade" }),
    status: publicOpportunityInterestStatusEnum("status").notNull().default("saved"),
    notes: text("notes"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("public_opportunity_interests_org_opp_unique").on(
      table.organizationId,
      table.opportunityId,
    ),
    index("public_opportunity_interests_org_idx").on(table.organizationId),
    index("public_opportunity_interests_status_idx").on(table.organizationId, table.status),
  ],
);

export const publicOpportunityRequirements = pgTable(
  "public_opportunity_requirements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => publicOpportunities.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    category: text("category"),
    mandatory: boolean("mandatory").notNull().default(true),
    status: publicOpportunityRequirementStatusEnum("status").notNull().default("pending"),
    source: text("source").notNull().default("manual"),
    sortOrder: integer("sort_order").notNull().default(0),
    reviewedByMembershipId: uuid("reviewed_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
    reviewComment: text("review_comment"),
    ...timestamps,
  },
  (table) => [
    index("public_opportunity_requirements_org_idx").on(table.organizationId),
    index("public_opportunity_requirements_opp_idx").on(table.opportunityId),
  ],
);

export const publicOpportunitiesRelations = relations(publicOpportunities, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [publicOpportunities.organizationId],
    references: [organizations.id],
  }),
  publicBody: one(administrativeBodies, {
    fields: [publicOpportunities.publicBodyId],
    references: [administrativeBodies.id],
  }),
  interests: many(publicOpportunityInterests),
  requirements: many(publicOpportunityRequirements),
}));

export const publicOpportunityInterestsRelations = relations(
  publicOpportunityInterests,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [publicOpportunityInterests.organizationId],
      references: [organizations.id],
    }),
    opportunity: one(publicOpportunities, {
      fields: [publicOpportunityInterests.opportunityId],
      references: [publicOpportunities.id],
    }),
  }),
);

export const publicOpportunityRequirementsRelations = relations(
  publicOpportunityRequirements,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [publicOpportunityRequirements.organizationId],
      references: [organizations.id],
    }),
    opportunity: one(publicOpportunities, {
      fields: [publicOpportunityRequirements.opportunityId],
      references: [publicOpportunities.id],
    }),
  }),
);
