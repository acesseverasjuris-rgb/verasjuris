/**
 * Etapa 16 — Advogado Online (request, match, consultation, review).
 * Reutiliza lawyer_profiles, Calendar, Documents, Contracts, Communication, PaymentProvider.
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
import { calendarEvents } from "./productivity.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const onlineLegalUrgencyEnum = pgEnum("online_legal_urgency", [
  "low",
  "normal",
  "high",
  "urgent",
]);

export const onlineLegalRequestStatusEnum = pgEnum("online_legal_request_status", [
  "draft",
  "submitted",
  "matching",
  "matched",
  "cancelled",
  "expired",
  "converted",
]);

export const onlineMatchCandidateStatusEnum = pgEnum("online_match_candidate_status", [
  "pending",
  "offered",
  "accepted",
  "declined",
  "expired",
  "cancelled",
]);

export const onlineConsultationModeEnum = pgEnum("online_consultation_mode", [
  "text",
  "audio",
  "video",
  "in_person",
  "other",
]);

export const onlineConsultationStatusEnum = pgEnum("online_consultation_status", [
  "matched",
  "awaiting_payment",
  "scheduled",
  "ready",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
  "disputed",
]);

export const onlineReviewStatusEnum = pgEnum("online_review_status", [
  "pending",
  "published",
  "hidden",
  "reported",
  "removed",
]);

export const onlineConsultationPaymentStatusEnum = pgEnum("online_consultation_payment_status", [
  "pending",
  "paid_manual",
  "paid_provider",
  "failed",
  "cancelled",
  "refunded",
  "not_configured",
]);

export const onlineLegalRequests = pgTable(
  "online_legal_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    requesterUserId: uuid("requester_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => crmClients.id, { onDelete: "set null" }),
    legalAreaId: uuid("legal_area_id").references(() => legalAreas.id, { onDelete: "set null" }),
    subareaId: uuid("subarea_id").references(() => legalSubareas.id, { onDelete: "set null" }),
    urgency: onlineLegalUrgencyEnum("urgency").notNull().default("normal"),
    stateCode: text("state_code").notNull(),
    summary: text("summary").notNull(),
    preferredMode: onlineConsultationModeEnum("preferred_mode").notNull().default("text"),
    status: onlineLegalRequestStatusEnum("status").notNull().default("draft"),
    acceptedMatchId: uuid("accepted_match_id"),
    ...timestamps,
  },
  (table) => [
    index("online_legal_requests_requester_idx").on(table.requesterUserId),
    index("online_legal_requests_org_idx").on(table.organizationId),
    index("online_legal_requests_status_idx").on(table.status),
    index("online_legal_requests_state_idx").on(table.stateCode),
  ],
);

export const lawyerAvailability = pgTable(
  "lawyer_availability",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lawyerProfileId: uuid("lawyer_profile_id")
      .notNull()
      .references(() => lawyerProfiles.userId, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week"),
    specificDate: timestamp("specific_date", { withTimezone: true, mode: "date" }),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    timezone: text("timezone").notNull().default("America/Sao_Paulo"),
    mode: onlineConsultationModeEnum("mode").notNull().default("text"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("lawyer_availability_profile_idx").on(table.lawyerProfileId),
    index("lawyer_availability_active_idx").on(table.active),
  ],
);

export const lawyerAvailabilityOverrides = pgTable(
  "lawyer_availability_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lawyerProfileId: uuid("lawyer_profile_id")
      .notNull()
      .references(() => lawyerProfiles.userId, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }).notNull(),
    overrideType: text("override_type").notNull().default("unavailable"),
    reason: text("reason"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("lawyer_availability_overrides_profile_idx").on(table.lawyerProfileId),
    index("lawyer_availability_overrides_range_idx").on(table.startsAt, table.endsAt),
  ],
);

export const onlineLegalMatchCandidates = pgTable(
  "online_legal_match_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => onlineLegalRequests.id, { onDelete: "cascade" }),
    lawyerProfileId: uuid("lawyer_profile_id")
      .notNull()
      .references(() => lawyerProfiles.userId, { onDelete: "cascade" }),
    scoreBreakdown: jsonb("score_breakdown").$type<Record<string, number>>().notNull(),
    totalScore: integer("total_score").notNull().default(0),
    status: onlineMatchCandidateStatusEnum("status").notNull().default("pending"),
    offeredAt: timestamp("offered_at", { withTimezone: true, mode: "date" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    respondedAt: timestamp("responded_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("online_legal_match_candidates_request_lawyer_unique").on(
      table.requestId,
      table.lawyerProfileId,
    ),
    index("online_legal_match_candidates_status_idx").on(table.status),
    index("online_legal_match_candidates_lawyer_idx").on(table.lawyerProfileId),
  ],
);

export const onlineConsultations = pgTable(
  "online_consultations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    requestId: uuid("request_id")
      .notNull()
      .references(() => onlineLegalRequests.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => crmClients.id, { onDelete: "set null" }),
    lawyerProfileId: uuid("lawyer_profile_id")
      .notNull()
      .references(() => lawyerProfiles.userId, { onDelete: "restrict" }),
    matchCandidateId: uuid("match_candidate_id").references(() => onlineLegalMatchCandidates.id, {
      onDelete: "set null",
    }),
    status: onlineConsultationStatusEnum("status").notNull().default("matched"),
    mode: onlineConsultationModeEnum("mode").notNull().default("text"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "date" }),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
    timezone: text("timezone").notNull().default("America/Sao_Paulo"),
    calendarEventId: uuid("calendar_event_id").references(() => calendarEvents.id, {
      onDelete: "set null",
    }),
    contractId: uuid("contract_id").references(() => contracts.id, { onDelete: "set null" }),
    conversationThreadId: uuid("conversation_thread_id").references(() => conversationThreads.id, {
      onDelete: "set null",
    }),
    priceCents: bigint("price_cents", { mode: "number" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("online_consultations_request_unique").on(table.requestId),
    index("online_consultations_lawyer_idx").on(table.lawyerProfileId),
    index("online_consultations_status_idx").on(table.status),
  ],
);

export const consultationTermsAcceptances = pgTable(
  "consultation_terms_acceptances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consultationId: uuid("consultation_id")
      .notNull()
      .references(() => onlineConsultations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    termsVersion: text("terms_version").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" }).notNull(),
    source: text("source").notNull().default("portal"),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("consultation_terms_acceptances_consultation_user_version_unique").on(
      table.consultationId,
      table.userId,
      table.termsVersion,
    ),
  ],
);

export const onlineConsultationPayments = pgTable(
  "online_consultation_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consultationId: uuid("consultation_id")
      .notNull()
      .references(() => onlineConsultations.id, { onDelete: "cascade" }),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    platformFeeCents: bigint("platform_fee_cents", { mode: "number" }).notNull().default(0),
    lawyerAmountCents: bigint("lawyer_amount_cents", { mode: "number" }).notNull().default(0),
    status: onlineConsultationPaymentStatusEnum("status").notNull().default("pending"),
    providerKey: text("provider_key").notNull().default("not_configured"),
    externalReference: text("external_reference"),
    evidenceDocumentId: uuid("evidence_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    recordedByMembershipId: uuid("recorded_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("online_consultation_payments_consultation_idx").on(table.consultationId),
    index("online_consultation_payments_status_idx").on(table.status),
  ],
);

export const consultationClosures = pgTable(
  "consultation_closures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consultationId: uuid("consultation_id")
      .notNull()
      .references(() => onlineConsultations.id, { onDelete: "cascade" }),
    closedByUserId: uuid("closed_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    outcome: text("outcome").notNull().default("completed"),
    summary: text("summary"),
    followUpRecommended: boolean("follow_up_recommended").notNull().default(false),
    legalMatterCreatedId: uuid("legal_matter_created_id").references(() => legalMatters.id, {
      onDelete: "set null",
    }),
    closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("consultation_closures_consultation_unique").on(table.consultationId)],
);

export const onlineConsultationReviews = pgTable(
  "online_consultation_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consultationId: uuid("consultation_id")
      .notNull()
      .references(() => onlineConsultations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => crmClients.id, { onDelete: "set null" }),
    reviewerUserId: uuid("reviewer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lawyerProfileId: uuid("lawyer_profile_id")
      .notNull()
      .references(() => lawyerProfiles.userId, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    status: onlineReviewStatusEnum("status").notNull().default("pending"),
    moderatedByMembershipId: uuid("moderated_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    moderatedAt: timestamp("moderated_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("online_consultation_reviews_consultation_unique").on(table.consultationId),
    index("online_consultation_reviews_lawyer_idx").on(table.lawyerProfileId),
    index("online_consultation_reviews_status_idx").on(table.status),
  ],
);

export const onlineLegalRequestsRelations = relations(onlineLegalRequests, ({ one, many }) => ({
  requester: one(users, {
    fields: [onlineLegalRequests.requesterUserId],
    references: [users.id],
  }),
  client: one(crmClients, {
    fields: [onlineLegalRequests.clientId],
    references: [crmClients.id],
  }),
  candidates: many(onlineLegalMatchCandidates),
  consultation: one(onlineConsultations),
}));

export const lawyerAvailabilityRelations = relations(lawyerAvailability, ({ one }) => ({
  lawyer: one(lawyerProfiles, {
    fields: [lawyerAvailability.lawyerProfileId],
    references: [lawyerProfiles.userId],
  }),
}));

export const lawyerAvailabilityOverridesRelations = relations(
  lawyerAvailabilityOverrides,
  ({ one }) => ({
    lawyer: one(lawyerProfiles, {
      fields: [lawyerAvailabilityOverrides.lawyerProfileId],
      references: [lawyerProfiles.userId],
    }),
  }),
);

export const onlineLegalMatchCandidatesRelations = relations(
  onlineLegalMatchCandidates,
  ({ one }) => ({
    request: one(onlineLegalRequests, {
      fields: [onlineLegalMatchCandidates.requestId],
      references: [onlineLegalRequests.id],
    }),
    lawyer: one(lawyerProfiles, {
      fields: [onlineLegalMatchCandidates.lawyerProfileId],
      references: [lawyerProfiles.userId],
    }),
  }),
);

export const onlineConsultationsRelations = relations(onlineConsultations, ({ one, many }) => ({
  request: one(onlineLegalRequests, {
    fields: [onlineConsultations.requestId],
    references: [onlineLegalRequests.id],
  }),
  lawyer: one(lawyerProfiles, {
    fields: [onlineConsultations.lawyerProfileId],
    references: [lawyerProfiles.userId],
  }),
  payments: many(onlineConsultationPayments),
  closure: one(consultationClosures),
  review: one(onlineConsultationReviews),
}));

export const consultationTermsAcceptancesRelations = relations(
  consultationTermsAcceptances,
  ({ one }) => ({
    consultation: one(onlineConsultations, {
      fields: [consultationTermsAcceptances.consultationId],
      references: [onlineConsultations.id],
    }),
  }),
);

export const onlineConsultationPaymentsRelations = relations(
  onlineConsultationPayments,
  ({ one }) => ({
    consultation: one(onlineConsultations, {
      fields: [onlineConsultationPayments.consultationId],
      references: [onlineConsultations.id],
    }),
  }),
);

export const consultationClosuresRelations = relations(consultationClosures, ({ one }) => ({
  consultation: one(onlineConsultations, {
    fields: [consultationClosures.consultationId],
    references: [onlineConsultations.id],
  }),
}));

export const onlineConsultationReviewsRelations = relations(
  onlineConsultationReviews,
  ({ one }) => ({
    consultation: one(onlineConsultations, {
      fields: [onlineConsultationReviews.consultationId],
      references: [onlineConsultations.id],
    }),
  }),
);
