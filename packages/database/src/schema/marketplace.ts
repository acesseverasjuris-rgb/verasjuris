/**
 * Etapa 17 — Marketplace jurídico.
 * Distinto de Advogado Online (consulta rápida). Reutiliza lawyer_profiles, Contract, Document, Payment, Reviews.
 */
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
import { conversationThreads } from "./client-portal.js";
import { contracts } from "./contracts.js";
import { crmClients } from "./crm.js";
import { documents } from "./documents.js";
import { organizationMembers, organizations, users } from "./identity.js";
import { legalAreas } from "./intake.js";
import { legalMatters, legalSubareas } from "./matters.js";
import { lawyerProfiles } from "./profiles.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const marketplacePricingModelEnum = pgEnum("marketplace_pricing_model", [
  "fixed",
  "starting_at",
  "hourly",
  "quote_required",
  "custom",
]);

export const marketplaceDeliveryModeEnum = pgEnum("marketplace_delivery_mode", [
  "remote",
  "in_person",
  "hybrid",
  "other",
]);

export const marketplaceRequestStatusEnum = pgEnum("marketplace_request_status", [
  "draft",
  "open",
  "receiving_proposals",
  "proposal_selected",
  "contracting",
  "in_progress",
  "delivered",
  "completed",
  "cancelled",
  "disputed",
  "expired",
]);

export const marketplaceProposalStatusEnum = pgEnum("marketplace_proposal_status", [
  "draft",
  "submitted",
  "viewed",
  "accepted",
  "declined",
  "withdrawn",
  "expired",
]);

export const marketplaceEngagementStatusEnum = pgEnum("marketplace_engagement_status", [
  "pending_contract",
  "pending_payment",
  "active",
  "waiting_client",
  "waiting_provider",
  "delivered",
  "completed",
  "cancelled",
  "disputed",
]);

export const marketplaceDeliveryStatusEnum = pgEnum("marketplace_delivery_status", [
  "submitted",
  "under_review",
  "accepted",
  "revision_requested",
  "rejected",
]);

export const marketplaceDisputeStatusEnum = pgEnum("marketplace_dispute_status", [
  "open",
  "under_review",
  "waiting_client",
  "waiting_provider",
  "mediation",
  "resolved",
  "closed",
  "cancelled",
]);

export const marketplaceReviewOriginEnum = pgEnum("marketplace_review_origin", [
  "marketplace",
  "diligence",
  "extrajudicial",
  "online_lawyer",
]);

export const marketplaceServiceCategories = pgTable(
  "marketplace_service_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id"),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    legalAreaId: uuid("legal_area_id").references(() => legalAreas.id, { onDelete: "set null" }),
    legalSubareaId: uuid("legal_subarea_id").references(() => legalSubareas.id, {
      onDelete: "set null",
    }),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    isSystem: boolean("is_system").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("marketplace_service_categories_key_unique").on(table.key),
    index("marketplace_service_categories_parent_idx").on(table.parentId),
    index("marketplace_service_categories_active_idx").on(table.active),
  ],
);

export const professionalServices = pgTable(
  "professional_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    professionalProfileId: uuid("professional_profile_id")
      .notNull()
      .references(() => lawyerProfiles.userId, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => marketplaceServiceCategories.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    description: text("description"),
    deliveryMode: marketplaceDeliveryModeEnum("delivery_mode").notNull().default("remote"),
    pricingModel: marketplacePricingModelEnum("pricing_model").notNull().default("quote_required"),
    basePriceCents: bigint("base_price_cents", { mode: "number" }),
    minPriceCents: bigint("min_price_cents", { mode: "number" }),
    maxPriceCents: bigint("max_price_cents", { mode: "number" }),
    estimatedDuration: text("estimated_duration"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("professional_services_profile_idx").on(table.professionalProfileId),
    index("professional_services_category_idx").on(table.categoryId),
    index("professional_services_active_idx").on(table.active),
  ],
);

export const marketplaceRequests = pgTable(
  "marketplace_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    requesterUserId: uuid("requester_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => crmClients.id, { onDelete: "set null" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => marketplaceServiceCategories.id, { onDelete: "restrict" }),
    legalAreaId: uuid("legal_area_id").references(() => legalAreas.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    urgency: text("urgency").notNull().default("normal"),
    locationState: text("location_state"),
    locationCity: text("location_city"),
    remoteAllowed: boolean("remote_allowed").notNull().default(true),
    budgetMinCents: bigint("budget_min_cents", { mode: "number" }),
    budgetMaxCents: bigint("budget_max_cents", { mode: "number" }),
    deadlineAt: timestamp("deadline_at", { withTimezone: true, mode: "date" }),
    status: marketplaceRequestStatusEnum("status").notNull().default("draft"),
    acceptedProposalId: uuid("accepted_proposal_id"),
    ...timestamps,
  },
  (table) => [
    index("marketplace_requests_requester_idx").on(table.requesterUserId),
    index("marketplace_requests_org_idx").on(table.organizationId),
    index("marketplace_requests_status_idx").on(table.status),
    index("marketplace_requests_category_idx").on(table.categoryId),
  ],
);

export const marketplaceProposals = pgTable(
  "marketplace_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => marketplaceRequests.id, { onDelete: "cascade" }),
    professionalProfileId: uuid("professional_profile_id")
      .notNull()
      .references(() => lawyerProfiles.userId, { onDelete: "cascade" }),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    feeBreakdown: jsonb("fee_breakdown").$type<Record<string, number>>(),
    estimatedDeliveryAt: timestamp("estimated_delivery_at", { withTimezone: true, mode: "date" }),
    message: text("message"),
    terms: text("terms"),
    status: marketplaceProposalStatusEnum("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("marketplace_proposals_request_professional_active_unique").on(
      table.requestId,
      table.professionalProfileId,
    ),
    index("marketplace_proposals_status_idx").on(table.status),
    index("marketplace_proposals_professional_idx").on(table.professionalProfileId),
  ],
);

export const marketplaceProposalHistory = pgTable(
  "marketplace_proposal_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => marketplaceProposals.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    message: text("message"),
    terms: text("terms"),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("marketplace_proposal_history_proposal_version_unique").on(
      table.proposalId,
      table.version,
    ),
  ],
);

export const marketplaceEngagements = pgTable(
  "marketplace_engagements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    requestId: uuid("request_id")
      .notNull()
      .references(() => marketplaceRequests.id, { onDelete: "cascade" }),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => marketplaceProposals.id, { onDelete: "restrict" }),
    clientId: uuid("client_id").references(() => crmClients.id, { onDelete: "set null" }),
    professionalProfileId: uuid("professional_profile_id")
      .notNull()
      .references(() => lawyerProfiles.userId, { onDelete: "restrict" }),
    contractId: uuid("contract_id").references(() => contracts.id, { onDelete: "set null" }),
    paymentRecordId: uuid("payment_record_id"),
    conversationThreadId: uuid("conversation_thread_id").references(() => conversationThreads.id, {
      onDelete: "set null",
    }),
    legalMatterId: uuid("legal_matter_id").references(() => legalMatters.id, {
      onDelete: "set null",
    }),
    status: marketplaceEngagementStatusEnum("status").notNull().default("pending_contract"),
    revisionLimit: integer("revision_limit").notNull().default(2),
    revisionCount: integer("revision_count").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("marketplace_engagements_request_unique").on(table.requestId),
    uniqueIndex("marketplace_engagements_proposal_unique").on(table.proposalId),
    index("marketplace_engagements_professional_idx").on(table.professionalProfileId),
    index("marketplace_engagements_status_idx").on(table.status),
  ],
);

export const marketplaceDeliveries = pgTable(
  "marketplace_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    engagementId: uuid("engagement_id")
      .notNull()
      .references(() => marketplaceEngagements.id, { onDelete: "cascade" }),
    deliveredByUserId: uuid("delivered_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    description: text("description").notNull(),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    status: marketplaceDeliveryStatusEnum("status").notNull().default("submitted"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true, mode: "date" }),
    revisionNotes: text("revision_notes"),
    ...timestamps,
  },
  (table) => [
    index("marketplace_deliveries_engagement_idx").on(table.engagementId),
    index("marketplace_deliveries_status_idx").on(table.status),
  ],
);

export const marketplaceDisputes = pgTable(
  "marketplace_disputes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Opcional para sourceType diligence/extrajudicial sem engagement de marketplace. */
    engagementId: uuid("engagement_id").references(() => marketplaceEngagements.id, {
      onDelete: "cascade",
    }),
    sourceEntityType: text("source_entity_type"),
    sourceEntityId: uuid("source_entity_id"),
    sourceType: text("source_type").notNull().default("marketplace"),
    openedByUserId: uuid("opened_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reasonCode: text("reason_code").notNull(),
    description: text("description").notNull(),
    status: marketplaceDisputeStatusEnum("status").notNull().default("open"),
    resolution: text("resolution"),
    resolvedByMembershipId: uuid("resolved_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("marketplace_disputes_engagement_idx").on(table.engagementId),
    index("marketplace_disputes_status_idx").on(table.status),
  ],
);

/** Review compartilhado (origem MARKETPLACE / DILIGENCE / etc.). */
export const serviceReviews = pgTable(
  "service_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    origin: marketplaceReviewOriginEnum("origin").notNull().default("marketplace"),
    engagementId: uuid("engagement_id").references(() => marketplaceEngagements.id, {
      onDelete: "cascade",
    }),
    sourceEntityType: text("source_entity_type"),
    sourceEntityId: uuid("source_entity_id"),
    reviewerUserId: uuid("reviewer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    professionalProfileId: uuid("professional_profile_id")
      .notNull()
      .references(() => lawyerProfiles.userId, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    status: text("status").notNull().default("pending"),
    moderatedByMembershipId: uuid("moderated_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("service_reviews_engagement_unique").on(table.engagementId),
    index("service_reviews_professional_idx").on(table.professionalProfileId),
    index("service_reviews_origin_idx").on(table.origin),
  ],
);

export const marketplaceServiceCategoriesRelations = relations(
  marketplaceServiceCategories,
  ({ many }) => ({
    services: many(professionalServices),
  }),
);

export const professionalServicesRelations = relations(professionalServices, ({ one }) => ({
  professional: one(lawyerProfiles, {
    fields: [professionalServices.professionalProfileId],
    references: [lawyerProfiles.userId],
  }),
  category: one(marketplaceServiceCategories, {
    fields: [professionalServices.categoryId],
    references: [marketplaceServiceCategories.id],
  }),
}));

export const marketplaceRequestsRelations = relations(marketplaceRequests, ({ one, many }) => ({
  requester: one(users, {
    fields: [marketplaceRequests.requesterUserId],
    references: [users.id],
  }),
  category: one(marketplaceServiceCategories, {
    fields: [marketplaceRequests.categoryId],
    references: [marketplaceServiceCategories.id],
  }),
  proposals: many(marketplaceProposals),
  engagement: one(marketplaceEngagements),
}));

export const marketplaceProposalsRelations = relations(marketplaceProposals, ({ one, many }) => ({
  request: one(marketplaceRequests, {
    fields: [marketplaceProposals.requestId],
    references: [marketplaceRequests.id],
  }),
  professional: one(lawyerProfiles, {
    fields: [marketplaceProposals.professionalProfileId],
    references: [lawyerProfiles.userId],
  }),
  history: many(marketplaceProposalHistory),
}));

export const marketplaceProposalHistoryRelations = relations(
  marketplaceProposalHistory,
  ({ one }) => ({
    proposal: one(marketplaceProposals, {
      fields: [marketplaceProposalHistory.proposalId],
      references: [marketplaceProposals.id],
    }),
  }),
);

export const marketplaceEngagementsRelations = relations(
  marketplaceEngagements,
  ({ one, many }) => ({
    request: one(marketplaceRequests, {
      fields: [marketplaceEngagements.requestId],
      references: [marketplaceRequests.id],
    }),
    proposal: one(marketplaceProposals, {
      fields: [marketplaceEngagements.proposalId],
      references: [marketplaceProposals.id],
    }),
    deliveries: many(marketplaceDeliveries),
    disputes: many(marketplaceDisputes),
    review: one(serviceReviews),
  }),
);

export const marketplaceDeliveriesRelations = relations(marketplaceDeliveries, ({ one }) => ({
  engagement: one(marketplaceEngagements, {
    fields: [marketplaceDeliveries.engagementId],
    references: [marketplaceEngagements.id],
  }),
}));

export const marketplaceDisputesRelations = relations(marketplaceDisputes, ({ one }) => ({
  engagement: one(marketplaceEngagements, {
    fields: [marketplaceDisputes.engagementId],
    references: [marketplaceEngagements.id],
  }),
}));

export const serviceReviewsRelations = relations(serviceReviews, ({ one }) => ({
  engagement: one(marketplaceEngagements, {
    fields: [serviceReviews.engagementId],
    references: [marketplaceEngagements.id],
  }),
}));
