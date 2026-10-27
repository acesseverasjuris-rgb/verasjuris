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
import { auctionLots, auctions } from "./auctions.js";
import { documents } from "./documents.js";
import { organizationMembers, organizations } from "./identity.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const auctionParticipationStatusEnum = pgEnum("auction_participation_status", [
  "interested",
  "preparing",
  "registered_manually",
  "qualified_manually",
  "participated",
  "no_bid",
  "bid_placed_manually",
  "result_pending",
  "won",
  "lost",
  "cancelled",
]);

export const auctionParticipationRegistrationStatusEnum = pgEnum(
  "auction_participation_registration_status",
  [
    "not_started",
    "pending",
    "submitted_manually",
    "confirmed_manually",
    "rejected",
    "not_required",
  ],
);

export const auctionParticipationQualificationStatusEnum = pgEnum(
  "auction_participation_qualification_status",
  ["not_started", "pending", "qualified_manually", "disqualified", "not_required"],
);

export const auctionBidRecordSourceEnum = pgEnum("auction_bid_record_source", [
  "manual",
  "external",
  "provider",
  "import",
]);

export const auctionBidRecordStatusEnum = pgEnum("auction_bid_record_status", [
  "recorded",
  "cancelled",
  "superseded",
]);

export const auctionResultStatusEnum = pgEnum("auction_result_status", [
  "pending",
  "sold",
  "unsold",
  "cancelled",
  "suspended",
  "withdrawn",
  "failed",
  "other",
]);

export const auctionResultSourceEnum = pgEnum("auction_result_source", [
  "manual",
  "external",
  "provider",
  "import",
  "not_configured",
]);

export const auctionVerificationStatusEnum = pgEnum("auction_post_verification_status", [
  "unverified",
  "source_available",
  "verified",
  "source_unavailable",
  "not_configured",
]);

export const auctionAwardStatusEnum = pgEnum("auction_award_status", [
  "pending_confirmation",
  "confirmed",
  "payment_pending",
  "paid",
  "documentation_pending",
  "delivery_pending",
  "registration_pending",
  "completed",
  "cancelled",
  "reversed",
  "disputed",
]);

export const auctionPaymentTypeEnum = pgEnum("auction_payment_type", [
  "bid_price",
  "auctioneer_commission",
  "court_fee",
  "tax",
  "transfer_fee",
  "other",
]);

export const auctionPaymentStatusEnum = pgEnum("auction_payment_status", [
  "pending",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
  "disputed",
]);

export const auctionDeliveryTypeEnum = pgEnum("auction_delivery_type", [
  "possession",
  "physical_delivery",
  "pickup",
  "key_handover",
  "other",
]);

export const auctionDeliveryStatusEnum = pgEnum("auction_delivery_status", [
  "pending",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
  "failed",
  "not_required",
]);

export const auctionPossessionStatusEnum = pgEnum("auction_possession_status", [
  "not_required",
  "pending",
  "requested",
  "ordered",
  "scheduled",
  "completed",
  "disputed",
]);

export const auctionTransferTypeEnum = pgEnum("auction_transfer_type", [
  "real_estate_registration",
  "vehicle_transfer",
  "asset_transfer",
  "corporate_right_transfer",
  "other",
]);

export const auctionTransferStatusEnum = pgEnum("auction_transfer_status", [
  "pending",
  "in_progress",
  "submitted",
  "completed",
  "blocked",
  "cancelled",
  "not_required",
]);

export const auctionAwardEventTypeEnum = pgEnum("auction_award_event_type", [
  "cancelled",
  "reversed",
  "annulled",
  "disputed",
  "suspended",
  "reinstated",
  "adjudication",
]);

export const auctionRegularizationItemStatusEnum = pgEnum("auction_regularization_item_status", [
  "pending",
  "in_progress",
  "done",
  "not_applicable",
  "blocked",
]);

export const auctionParticipations = pgTable(
  "auction_participations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    auctionId: uuid("auction_id")
      .notNull()
      .references(() => auctions.id, { onDelete: "cascade" }),
    lotId: uuid("lot_id").references(() => auctionLots.id, { onDelete: "cascade" }),
    participantMembershipId: uuid("participant_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    status: auctionParticipationStatusEnum("status").notNull().default("interested"),
    registrationStatus: auctionParticipationRegistrationStatusEnum("registration_status")
      .notNull()
      .default("not_started"),
    qualificationStatus: auctionParticipationQualificationStatusEnum("qualification_status")
      .notNull()
      .default("not_started"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("auction_participations_org_idx").on(table.organizationId),
    index("auction_participations_auction_idx").on(table.auctionId),
    index("auction_participations_lot_idx").on(table.lotId),
    index("auction_participations_status_idx").on(table.organizationId, table.status),
  ],
);

/** Registro interno de lance manual/externo — NUNCA envia lance ao portal. */
export const auctionBidRecords = pgTable(
  "auction_bid_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    participationId: uuid("participation_id")
      .notNull()
      .references(() => auctionParticipations.id, { onDelete: "cascade" }),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("BRL"),
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    source: auctionBidRecordSourceEnum("source").notNull().default("manual"),
    providerReference: text("provider_reference"),
    status: auctionBidRecordStatusEnum("status").notNull().default("recorded"),
    notes: text("notes"),
    recordedByMembershipId: uuid("recorded_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("auction_bid_records_participation_idx").on(table.participationId),
    index("auction_bid_records_org_idx").on(table.organizationId),
  ],
);

export const auctionResults = pgTable(
  "auction_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    auctionId: uuid("auction_id")
      .notNull()
      .references(() => auctions.id, { onDelete: "cascade" }),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => auctionLots.id, { onDelete: "cascade" }),
    status: auctionResultStatusEnum("status").notNull().default("pending"),
    winningBidCents: bigint("winning_bid_cents", { mode: "number" }),
    winnerReference: text("winner_reference"),
    resultDate: timestamp("result_date", { withTimezone: true, mode: "date" }),
    source: auctionResultSourceEnum("source").notNull().default("manual"),
    sourceReference: text("source_reference"),
    verificationStatus: auctionVerificationStatusEnum("verification_status")
      .notNull()
      .default("unverified"),
    notes: text("notes"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("auction_results_lot_unique").on(table.lotId),
    index("auction_results_auction_idx").on(table.auctionId),
    index("auction_results_org_idx").on(table.organizationId),
    index("auction_results_status_idx").on(table.status),
  ],
);

export const auctionAwards = pgTable(
  "auction_awards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    auctionId: uuid("auction_id")
      .notNull()
      .references(() => auctions.id, { onDelete: "cascade" }),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => auctionLots.id, { onDelete: "cascade" }),
    participationId: uuid("participation_id").references(() => auctionParticipations.id, {
      onDelete: "set null",
    }),
    resultId: uuid("result_id").references(() => auctionResults.id, { onDelete: "set null" }),
    awardStatus: auctionAwardStatusEnum("award_status").notNull().default("pending_confirmation"),
    winningBidCents: bigint("winning_bid_cents", { mode: "number" }).notNull().default(0),
    /** Comissão em basis points (0–10000). Nunca float. */
    commissionBasisPoints: integer("commission_basis_points"),
    commissionBaseAmountCents: bigint("commission_base_amount_cents", { mode: "number" }),
    calculatedCommissionCents: bigint("calculated_commission_cents", { mode: "number" }),
    actualCommissionCents: bigint("actual_commission_cents", { mode: "number" }),
    commissionCents: bigint("commission_cents", { mode: "number" }),
    feesCents: bigint("fees_cents", { mode: "number" }),
    totalKnownCostCents: bigint("total_known_cost_cents", { mode: "number" }).notNull().default(0),
    currency: text("currency").notNull().default("BRL"),
    awardedAt: timestamp("awarded_at", { withTimezone: true, mode: "date" }),
    verificationStatus: auctionVerificationStatusEnum("verification_status")
      .notNull()
      .default("unverified"),
    source: auctionResultSourceEnum("source").notNull().default("manual"),
    commissionSource: text("commission_source"),
    notes: text("notes"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("auction_awards_org_idx").on(table.organizationId),
    index("auction_awards_auction_idx").on(table.auctionId),
    index("auction_awards_lot_idx").on(table.lotId),
    index("auction_awards_status_idx").on(table.organizationId, table.awardStatus),
    index("auction_awards_participation_idx").on(table.participationId),
  ],
);

export const auctionPayments = pgTable(
  "auction_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    awardId: uuid("award_id")
      .notNull()
      .references(() => auctionAwards.id, { onDelete: "cascade" }),
    paymentType: auctionPaymentTypeEnum("payment_type").notNull().default("bid_price"),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("BRL"),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
    status: auctionPaymentStatusEnum("status").notNull().default("pending"),
    paymentReference: text("payment_reference"),
    evidenceDocumentId: uuid("evidence_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("auction_payments_award_idx").on(table.awardId),
    index("auction_payments_org_idx").on(table.organizationId),
    index("auction_payments_status_idx").on(table.status),
  ],
);

export const auctionDeliveryProcesses = pgTable(
  "auction_delivery_processes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    awardId: uuid("award_id")
      .notNull()
      .references(() => auctionAwards.id, { onDelete: "cascade" }),
    deliveryType: auctionDeliveryTypeEnum("delivery_type").notNull().default("other"),
    status: auctionDeliveryStatusEnum("status").notNull().default("pending"),
    possessionStatus: auctionPossessionStatusEnum("possession_status")
      .notNull()
      .default("not_required"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    location: text("location"),
    responsibleMembershipId: uuid("responsible_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    evidenceDocumentId: uuid("evidence_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("auction_delivery_processes_award_idx").on(table.awardId),
    index("auction_delivery_processes_org_idx").on(table.organizationId),
    index("auction_delivery_processes_status_idx").on(table.status),
  ],
);

export const auctionTransferProcesses = pgTable(
  "auction_transfer_processes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    awardId: uuid("award_id")
      .notNull()
      .references(() => auctionAwards.id, { onDelete: "cascade" }),
    transferType: auctionTransferTypeEnum("transfer_type").notNull().default("other"),
    status: auctionTransferStatusEnum("status").notNull().default("pending"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    authority: text("authority"),
    protocol: text("protocol"),
    evidenceDocumentId: uuid("evidence_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("auction_transfer_processes_award_idx").on(table.awardId),
    index("auction_transfer_processes_org_idx").on(table.organizationId),
    index("auction_transfer_processes_status_idx").on(table.status),
  ],
);

export const auctionAwardEvents = pgTable(
  "auction_award_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    awardId: uuid("award_id")
      .notNull()
      .references(() => auctionAwards.id, { onDelete: "cascade" }),
    eventType: auctionAwardEventTypeEnum("event_type").notNull(),
    reason: text("reason"),
    source: text("source").notNull().default("manual"),
    actorMembershipId: uuid("actor_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    relatedDocumentId: uuid("related_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("auction_award_events_award_idx").on(table.awardId),
    index("auction_award_events_org_idx").on(table.organizationId),
    index("auction_award_events_type_idx").on(table.eventType),
  ],
);

export const auctionRegularizationChecklists = pgTable(
  "auction_regularization_checklists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    awardId: uuid("award_id")
      .notNull()
      .references(() => auctionAwards.id, { onDelete: "cascade" }),
    itemKey: text("item_key").notNull(),
    label: text("label").notNull(),
    category: text("category"),
    status: auctionRegularizationItemStatusEnum("status").notNull().default("pending"),
    required: boolean("required").notNull().default(true),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    completedByMembershipId: uuid("completed_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    evidenceDocumentId: uuid("evidence_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("auction_regularization_checklists_award_key_unique").on(
      table.awardId,
      table.itemKey,
    ),
    index("auction_regularization_checklists_award_idx").on(table.awardId),
    index("auction_regularization_checklists_org_idx").on(table.organizationId),
  ],
);

export const auctionParticipationsRelations = relations(auctionParticipations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [auctionParticipations.organizationId],
    references: [organizations.id],
  }),
  auction: one(auctions, {
    fields: [auctionParticipations.auctionId],
    references: [auctions.id],
  }),
  lot: one(auctionLots, {
    fields: [auctionParticipations.lotId],
    references: [auctionLots.id],
  }),
  bidRecords: many(auctionBidRecords),
  awards: many(auctionAwards),
}));

export const auctionBidRecordsRelations = relations(auctionBidRecords, ({ one }) => ({
  participation: one(auctionParticipations, {
    fields: [auctionBidRecords.participationId],
    references: [auctionParticipations.id],
  }),
}));

export const auctionResultsRelations = relations(auctionResults, ({ one }) => ({
  organization: one(organizations, {
    fields: [auctionResults.organizationId],
    references: [organizations.id],
  }),
  auction: one(auctions, {
    fields: [auctionResults.auctionId],
    references: [auctions.id],
  }),
  lot: one(auctionLots, {
    fields: [auctionResults.lotId],
    references: [auctionLots.id],
  }),
}));

export const auctionAwardsRelations = relations(auctionAwards, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [auctionAwards.organizationId],
    references: [organizations.id],
  }),
  auction: one(auctions, {
    fields: [auctionAwards.auctionId],
    references: [auctions.id],
  }),
  lot: one(auctionLots, {
    fields: [auctionAwards.lotId],
    references: [auctionLots.id],
  }),
  participation: one(auctionParticipations, {
    fields: [auctionAwards.participationId],
    references: [auctionParticipations.id],
  }),
  result: one(auctionResults, {
    fields: [auctionAwards.resultId],
    references: [auctionResults.id],
  }),
  payments: many(auctionPayments),
  deliveryProcesses: many(auctionDeliveryProcesses),
  transferProcesses: many(auctionTransferProcesses),
  events: many(auctionAwardEvents),
  regularizationItems: many(auctionRegularizationChecklists),
}));

export const auctionPaymentsRelations = relations(auctionPayments, ({ one }) => ({
  award: one(auctionAwards, {
    fields: [auctionPayments.awardId],
    references: [auctionAwards.id],
  }),
  evidenceDocument: one(documents, {
    fields: [auctionPayments.evidenceDocumentId],
    references: [documents.id],
  }),
}));

export const auctionDeliveryProcessesRelations = relations(auctionDeliveryProcesses, ({ one }) => ({
  award: one(auctionAwards, {
    fields: [auctionDeliveryProcesses.awardId],
    references: [auctionAwards.id],
  }),
}));

export const auctionTransferProcessesRelations = relations(auctionTransferProcesses, ({ one }) => ({
  award: one(auctionAwards, {
    fields: [auctionTransferProcesses.awardId],
    references: [auctionAwards.id],
  }),
}));

export const auctionAwardEventsRelations = relations(auctionAwardEvents, ({ one }) => ({
  award: one(auctionAwards, {
    fields: [auctionAwardEvents.awardId],
    references: [auctionAwards.id],
  }),
}));

export const auctionRegularizationChecklistsRelations = relations(
  auctionRegularizationChecklists,
  ({ one }) => ({
    award: one(auctionAwards, {
      fields: [auctionRegularizationChecklists.awardId],
      references: [auctionAwards.id],
    }),
  }),
);
