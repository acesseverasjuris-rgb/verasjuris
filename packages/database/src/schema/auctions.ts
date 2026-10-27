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
import { courts, judicialProcesses } from "./judicial.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const auctionTypeEnum = pgEnum("auction_type", [
  "judicial",
  "extrajudicial",
  "administrative",
  "public_asset",
  "seized_asset",
  "tax",
  "bank",
  "insolvency",
  "bankruptcy",
  "other",
]);

export const auctionSourceEnum = pgEnum("auction_source", [
  "manual",
  "public_provider",
  "import",
  "not_configured",
]);

export const auctionStatusEnum = pgEnum("auction_status", [
  "draft",
  "published",
  "open",
  "closed",
  "cancelled",
  "archived",
  "not_configured",
]);

export const auctionAssetTypeEnum = pgEnum("auction_asset_type", [
  "real_estate",
  "vehicle",
  "machinery",
  "equipment",
  "vessel",
  "aircraft",
  "business_asset",
  "right",
  "shares",
  "movable_goods",
  "scrap",
  "material",
  "other",
]);

export const auctionEventTypeEnum = pgEnum("auction_event_type", [
  "first_session",
  "second_session",
  "session",
  "closing",
  "direct_sale",
  "other",
]);

export const auctionEventStatusEnum = pgEnum("auction_event_status", [
  "scheduled",
  "open",
  "closed",
  "cancelled",
  "unknown",
]);

export const auctionLotStatusEnum = pgEnum("auction_lot_status", [
  "draft",
  "open",
  "sold",
  "unsold",
  "cancelled",
  "archived",
  "unknown",
]);

export const auctionInterestStatusEnum = pgEnum("auction_interest_status", [
  "saved",
  "watching",
  "reviewing",
  "visit_planned",
  "intends_to_bid",
  "participated",
  "won",
  "lost",
  "archived",
]);

export const auctionSyncStatusEnum = pgEnum("auction_sync_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
  "not_configured",
]);

export const auctioneerVerificationStatusEnum = pgEnum("auctioneer_verification_status", [
  "unverified",
  "source_available",
  "verified",
  "source_unavailable",
  "not_configured",
]);

export const auctionOccupancyStatusEnum = pgEnum("auction_occupancy_status", [
  "unknown",
  "vacant",
  "occupied",
  "possession_disputed",
  "other",
]);

export const auctionDueDiligenceItemStatusEnum = pgEnum("auction_due_diligence_item_status", [
  "pending",
  "in_progress",
  "done",
  "not_applicable",
  "blocked",
  "unknown",
]);

export const auctioneers = pgTable(
  "auctioneers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    registrationNumber: text("registration_number"),
    stateCode: text("state_code"),
    entityName: text("entity_name"),
    website: text("website"),
    verificationStatus: auctioneerVerificationStatusEnum("verification_status")
      .notNull()
      .default("unverified"),
    source: text("source").notNull().default("manual"),
    ...timestamps,
  },
  (table) => [
    index("auctioneers_name_idx").on(table.name),
    index("auctioneers_state_idx").on(table.stateCode),
  ],
);

/**
 * Leilão de bens/ativos/direitos.
 * organizationId null = referência global (futuro provider); não-null = cadastro manual da org.
 * Interest/alerts/due diligence são sempre tenant-specific.
 */
export const auctions = pgTable(
  "auctions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    sourceProvider: auctionSourceEnum("source_provider").notNull().default("manual"),
    sourceReference: text("source_reference"),
    sourceUrl: text("source_url"),
    auctionType: auctionTypeEnum("auction_type").notNull().default("other"),
    title: text("title").notNull(),
    description: text("description"),
    sellerType: text("seller_type"),
    sellerName: text("seller_name"),
    publicBodyId: uuid("public_body_id").references(() => administrativeBodies.id, {
      onDelete: "set null",
    }),
    courtId: uuid("court_id").references(() => courts.id, { onDelete: "set null" }),
    judicialProcessId: uuid("judicial_process_id").references(() => judicialProcesses.id, {
      onDelete: "set null",
    }),
    auctioneerId: uuid("auctioneer_id").references(() => auctioneers.id, {
      onDelete: "set null",
    }),
    status: auctionStatusEnum("status").notNull().default("draft"),
    timezone: text("timezone").notNull().default("America/Sao_Paulo"),
    publicationDate: timestamp("publication_date", { withTimezone: true, mode: "date" }),
    registrationDeadline: timestamp("registration_deadline", { withTimezone: true, mode: "date" }),
    inspectionStartAt: timestamp("inspection_start_at", { withTimezone: true, mode: "date" }),
    inspectionEndAt: timestamp("inspection_end_at", { withTimezone: true, mode: "date" }),
    firstEventAt: timestamp("first_event_at", { withTimezone: true, mode: "date" }),
    secondEventAt: timestamp("second_event_at", { withTimezone: true, mode: "date" }),
    closingAt: timestamp("closing_at", { withTimezone: true, mode: "date" }),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true, mode: "date" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("auctions_org_idx").on(table.organizationId),
    index("auctions_type_idx").on(table.auctionType),
    index("auctions_status_idx").on(table.status),
    index("auctions_auctioneer_idx").on(table.auctioneerId),
    index("auctions_first_event_idx").on(table.firstEventAt),
    index("auctions_court_idx").on(table.courtId),
  ],
);

export const auctionEvents = pgTable(
  "auction_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    auctionId: uuid("auction_id")
      .notNull()
      .references(() => auctions.id, { onDelete: "cascade" }),
    eventType: auctionEventTypeEnum("event_type").notNull().default("session"),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }),
    timezone: text("timezone").notNull().default("America/Sao_Paulo"),
    minimumRule: text("minimum_rule"),
    status: auctionEventStatusEnum("status").notNull().default("scheduled"),
    source: text("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("auction_events_auction_idx").on(table.auctionId),
    index("auction_events_starts_idx").on(table.startsAt),
  ],
);

export const auctionLots = pgTable(
  "auction_lots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    auctionId: uuid("auction_id")
      .notNull()
      .references(() => auctions.id, { onDelete: "cascade" }),
    lotNumber: text("lot_number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    assetType: auctionAssetTypeEnum("asset_type").notNull().default("other"),
    status: auctionLotStatusEnum("status").notNull().default("draft"),
    appraisalValueCents: bigint("appraisal_value_cents", { mode: "number" }),
    firstMinimumBidCents: bigint("first_minimum_bid_cents", { mode: "number" }),
    secondMinimumBidCents: bigint("second_minimum_bid_cents", { mode: "number" }),
    currentReferenceValueCents: bigint("current_reference_value_cents", { mode: "number" }),
    currency: text("currency").notNull().default("BRL"),
    incrementCents: bigint("increment_cents", { mode: "number" }),
    /** Comissão em basis points (0–10000). Nunca float. */
    commissionBasisPoints: integer("commission_basis_points"),
    buyerFeeCents: bigint("buyer_fee_cents", { mode: "number" }),
    depositRequiredCents: bigint("deposit_required_cents", { mode: "number" }),
    location: text("location"),
    stateCode: text("state_code"),
    municipality: text("municipality"),
    latitude: text("latitude"),
    longitude: text("longitude"),
    occupancyStatus: auctionOccupancyStatusEnum("occupancy_status").notNull().default("unknown"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("auction_lots_auction_number_unique").on(table.auctionId, table.lotNumber),
    index("auction_lots_auction_idx").on(table.auctionId),
    index("auction_lots_asset_type_idx").on(table.assetType),
    index("auction_lots_state_idx").on(table.stateCode),
    index("auction_lots_status_idx").on(table.status),
  ],
);

export const auctionRealEstateDetails = pgTable(
  "auction_real_estate_details",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => auctionLots.id, { onDelete: "cascade" }),
    propertyType: text("property_type"),
    registryNumber: text("registry_number"),
    registryOffice: text("registry_office"),
    area: text("area"),
    builtArea: text("built_area"),
    occupancyStatus: auctionOccupancyStatusEnum("occupancy_status").notNull().default("unknown"),
    possessionStatus: text("possession_status"),
    address: text("address"),
    propertyTaxReference: text("property_tax_reference"),
    condominiumInfo: text("condominium_info"),
    liensSummary: text("liens_summary"),
    ...timestamps,
  },
  (table) => [uniqueIndex("auction_real_estate_details_lot_unique").on(table.lotId)],
);

export const auctionVehicleDetails = pgTable(
  "auction_vehicle_details",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => auctionLots.id, { onDelete: "cascade" }),
    make: text("make"),
    model: text("model"),
    year: integer("year"),
    modelYear: integer("model_year"),
    plateMasked: text("plate_masked"),
    renavamMasked: text("renavam_masked"),
    mileage: integer("mileage"),
    condition: text("condition"),
    documentationStatus: text("documentation_status"),
    ...timestamps,
  },
  (table) => [uniqueIndex("auction_vehicle_details_lot_unique").on(table.lotId)],
);

export const auctionEncumbrances = pgTable(
  "auction_encumbrances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => auctionLots.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    description: text("description").notNull(),
    source: text("source"),
    responsibility: text("responsibility"),
    status: text("status").notNull().default("informed"),
    amountCents: bigint("amount_cents", { mode: "number" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("auction_encumbrances_lot_idx").on(table.lotId)],
);

export const auctionBidRules = pgTable(
  "auction_bid_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    auctionId: uuid("auction_id").references(() => auctions.id, { onDelete: "cascade" }),
    lotId: uuid("lot_id").references(() => auctionLots.id, { onDelete: "cascade" }),
    minimumBidCents: bigint("minimum_bid_cents", { mode: "number" }),
    incrementCents: bigint("increment_cents", { mode: "number" }),
    paymentTerms: text("payment_terms"),
    commissionBasisPoints: integer("commission_basis_points"),
    depositRequired: boolean("deposit_required").notNull().default(false),
    depositRequiredCents: bigint("deposit_required_cents", { mode: "number" }),
    registrationRequired: boolean("registration_required").notNull().default(false),
    eligibilityDescription: text("eligibility_description"),
    notes: text("notes"),
    source: text("source").notNull().default("manual"),
    ...timestamps,
  },
  (table) => [
    index("auction_bid_rules_auction_idx").on(table.auctionId),
    index("auction_bid_rules_lot_idx").on(table.lotId),
  ],
);

/** Interesse tenant-specific em leilão/lote. */
export const auctionInterests = pgTable(
  "auction_interests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    auctionId: uuid("auction_id")
      .notNull()
      .references(() => auctions.id, { onDelete: "cascade" }),
    lotId: uuid("lot_id").references(() => auctionLots.id, { onDelete: "cascade" }),
    status: auctionInterestStatusEnum("status").notNull().default("saved"),
    notes: text("notes"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("auction_interests_org_auction_lot_unique").on(
      table.organizationId,
      table.auctionId,
      table.lotId,
    ),
    index("auction_interests_org_idx").on(table.organizationId),
    index("auction_interests_status_idx").on(table.organizationId, table.status),
  ],
);

export const auctionAlertRules = pgTable(
  "auction_alert_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    auctionTypes: jsonb("auction_types").$type<string[]>(),
    assetTypes: jsonb("asset_types").$type<string[]>(),
    stateCodes: jsonb("state_codes").$type<string[]>(),
    municipalities: jsonb("municipalities").$type<string[]>(),
    minValueCents: bigint("min_value_cents", { mode: "number" }),
    maxValueCents: bigint("max_value_cents", { mode: "number" }),
    occupancyStatuses: jsonb("occupancy_statuses").$type<string[]>(),
    filters: jsonb("filters").$type<Record<string, unknown>>(),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("auction_alert_rules_org_idx").on(table.organizationId),
    index("auction_alert_rules_active_idx").on(table.organizationId, table.active),
  ],
);

export const auctionDueDiligence = pgTable(
  "auction_due_diligence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    auctionId: uuid("auction_id")
      .notNull()
      .references(() => auctions.id, { onDelete: "cascade" }),
    lotId: uuid("lot_id").references(() => auctionLots.id, { onDelete: "cascade" }),
    itemKey: text("item_key").notNull(),
    label: text("label").notNull(),
    category: text("category"),
    status: auctionDueDiligenceItemStatusEnum("status").notNull().default("pending"),
    notes: text("notes"),
    reviewedByMembershipId: uuid("reviewed_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("auction_due_diligence_org_lot_item_unique").on(
      table.organizationId,
      table.auctionId,
      table.lotId,
      table.itemKey,
    ),
    index("auction_due_diligence_org_idx").on(table.organizationId),
    index("auction_due_diligence_auction_idx").on(table.auctionId),
  ],
);

export const auctionSyncRuns = pgTable(
  "auction_sync_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    provider: text("provider").notNull().default("not_configured"),
    status: auctionSyncStatusEnum("status").notNull().default("not_configured"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "date" }),
    recordsFetched: integer("records_fetched").notNull().default(0),
    recordsUpserted: integer("records_upserted").notNull().default(0),
    lastErrorCode: text("last_error_code"),
    lastErrorSafeMessage: text("last_error_safe_message"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("auction_sync_runs_org_idx").on(table.organizationId),
    index("auction_sync_runs_status_idx").on(table.status),
  ],
);

export const auctioneersRelations = relations(auctioneers, ({ many }) => ({
  auctions: many(auctions),
}));

export const auctionsRelations = relations(auctions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [auctions.organizationId],
    references: [organizations.id],
  }),
  auctioneer: one(auctioneers, {
    fields: [auctions.auctioneerId],
    references: [auctioneers.id],
  }),
  publicBody: one(administrativeBodies, {
    fields: [auctions.publicBodyId],
    references: [administrativeBodies.id],
  }),
  court: one(courts, {
    fields: [auctions.courtId],
    references: [courts.id],
  }),
  judicialProcess: one(judicialProcesses, {
    fields: [auctions.judicialProcessId],
    references: [judicialProcesses.id],
  }),
  events: many(auctionEvents),
  lots: many(auctionLots),
  bidRules: many(auctionBidRules),
  interests: many(auctionInterests),
  dueDiligence: many(auctionDueDiligence),
}));

export const auctionEventsRelations = relations(auctionEvents, ({ one }) => ({
  auction: one(auctions, {
    fields: [auctionEvents.auctionId],
    references: [auctions.id],
  }),
}));

export const auctionLotsRelations = relations(auctionLots, ({ one, many }) => ({
  auction: one(auctions, {
    fields: [auctionLots.auctionId],
    references: [auctions.id],
  }),
  realEstateDetails: one(auctionRealEstateDetails, {
    fields: [auctionLots.id],
    references: [auctionRealEstateDetails.lotId],
  }),
  vehicleDetails: one(auctionVehicleDetails, {
    fields: [auctionLots.id],
    references: [auctionVehicleDetails.lotId],
  }),
  encumbrances: many(auctionEncumbrances),
  bidRules: many(auctionBidRules),
  interests: many(auctionInterests),
  dueDiligence: many(auctionDueDiligence),
}));

export const auctionRealEstateDetailsRelations = relations(auctionRealEstateDetails, ({ one }) => ({
  lot: one(auctionLots, {
    fields: [auctionRealEstateDetails.lotId],
    references: [auctionLots.id],
  }),
}));

export const auctionVehicleDetailsRelations = relations(auctionVehicleDetails, ({ one }) => ({
  lot: one(auctionLots, {
    fields: [auctionVehicleDetails.lotId],
    references: [auctionLots.id],
  }),
}));

export const auctionEncumbrancesRelations = relations(auctionEncumbrances, ({ one }) => ({
  lot: one(auctionLots, {
    fields: [auctionEncumbrances.lotId],
    references: [auctionLots.id],
  }),
}));

export const auctionBidRulesRelations = relations(auctionBidRules, ({ one }) => ({
  auction: one(auctions, {
    fields: [auctionBidRules.auctionId],
    references: [auctions.id],
  }),
  lot: one(auctionLots, {
    fields: [auctionBidRules.lotId],
    references: [auctionLots.id],
  }),
}));

export const auctionInterestsRelations = relations(auctionInterests, ({ one }) => ({
  organization: one(organizations, {
    fields: [auctionInterests.organizationId],
    references: [organizations.id],
  }),
  auction: one(auctions, {
    fields: [auctionInterests.auctionId],
    references: [auctions.id],
  }),
  lot: one(auctionLots, {
    fields: [auctionInterests.lotId],
    references: [auctionLots.id],
  }),
}));

export const auctionAlertRulesRelations = relations(auctionAlertRules, ({ one }) => ({
  organization: one(organizations, {
    fields: [auctionAlertRules.organizationId],
    references: [organizations.id],
  }),
}));

export const auctionDueDiligenceRelations = relations(auctionDueDiligence, ({ one }) => ({
  organization: one(organizations, {
    fields: [auctionDueDiligence.organizationId],
    references: [organizations.id],
  }),
  auction: one(auctions, {
    fields: [auctionDueDiligence.auctionId],
    references: [auctions.id],
  }),
  lot: one(auctionLots, {
    fields: [auctionDueDiligence.lotId],
    references: [auctionLots.id],
  }),
}));

export const auctionSyncRunsRelations = relations(auctionSyncRuns, ({ one }) => ({
  organization: one(organizations, {
    fields: [auctionSyncRuns.organizationId],
    references: [organizations.id],
  }),
}));
