import { z } from "zod";

const uuid = z.string().uuid("O identificador não é válido.");
const optionalUuid = uuid.optional();
const datetime = z.string().datetime({ offset: true });
const limit = z.coerce.number().int().min(1).max(100).default(20);
const offset = z.coerce.number().int().min(0).max(10_000).default(0);
const cents = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const basisPoints = z.number().int().min(0).max(10_000);

export const AUCTION_PARTICIPATION_STATUSES = [
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
] as const;

export const AUCTION_PARTICIPATION_REGISTRATION_STATUSES = [
  "not_started",
  "pending",
  "submitted_manually",
  "confirmed_manually",
  "rejected",
  "not_required",
] as const;

export const AUCTION_PARTICIPATION_QUALIFICATION_STATUSES = [
  "not_started",
  "pending",
  "qualified_manually",
  "disqualified",
  "not_required",
] as const;

export const AUCTION_BID_RECORD_SOURCES = ["manual", "external", "provider", "import"] as const;

export const AUCTION_BID_RECORD_STATUSES = ["recorded", "cancelled", "superseded"] as const;

export const AUCTION_RESULT_STATUSES = [
  "pending",
  "sold",
  "unsold",
  "cancelled",
  "suspended",
  "withdrawn",
  "failed",
  "other",
] as const;

export const AUCTION_RESULT_SOURCES = [
  "manual",
  "external",
  "provider",
  "import",
  "not_configured",
] as const;

export const AUCTION_POST_VERIFICATION_STATUSES = [
  "unverified",
  "source_available",
  "verified",
  "source_unavailable",
  "not_configured",
] as const;

export const AUCTION_AWARD_STATUSES = [
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
] as const;

export const AUCTION_PAYMENT_TYPES = [
  "bid_price",
  "auctioneer_commission",
  "court_fee",
  "tax",
  "transfer_fee",
  "other",
] as const;

export const AUCTION_PAYMENT_STATUSES = [
  "pending",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
  "disputed",
] as const;

export const AUCTION_DELIVERY_TYPES = [
  "possession",
  "physical_delivery",
  "pickup",
  "key_handover",
  "other",
] as const;

export const AUCTION_DELIVERY_STATUSES = [
  "pending",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
  "failed",
  "not_required",
] as const;

export const AUCTION_POSSESSION_STATUSES = [
  "not_required",
  "pending",
  "requested",
  "ordered",
  "scheduled",
  "completed",
  "disputed",
] as const;

export const AUCTION_TRANSFER_TYPES = [
  "real_estate_registration",
  "vehicle_transfer",
  "asset_transfer",
  "corporate_right_transfer",
  "other",
] as const;

export const AUCTION_TRANSFER_STATUSES = [
  "pending",
  "in_progress",
  "submitted",
  "completed",
  "blocked",
  "cancelled",
  "not_required",
] as const;

export const AUCTION_AWARD_EVENT_TYPES = [
  "cancelled",
  "reversed",
  "annulled",
  "disputed",
  "suspended",
  "reinstated",
  "adjudication",
] as const;

export const AUCTION_REGULARIZATION_ITEM_STATUSES = [
  "pending",
  "in_progress",
  "done",
  "not_applicable",
  "blocked",
] as const;

export const createAuctionParticipationSchema = z.object({
  auctionId: uuid,
  lotId: optionalUuid,
  participantMembershipId: optionalUuid,
  status: z.enum(AUCTION_PARTICIPATION_STATUSES).default("interested"),
  registrationStatus: z.enum(AUCTION_PARTICIPATION_REGISTRATION_STATUSES).default("not_started"),
  qualificationStatus: z.enum(AUCTION_PARTICIPATION_QUALIFICATION_STATUSES).default("not_started"),
  notes: z.string().trim().max(4000).optional(),
});

export const updateAuctionParticipationSchema = z
  .object({
    status: z.enum(AUCTION_PARTICIPATION_STATUSES).optional(),
    registrationStatus: z.enum(AUCTION_PARTICIPATION_REGISTRATION_STATUSES).optional(),
    qualificationStatus: z.enum(AUCTION_PARTICIPATION_QUALIFICATION_STATUSES).optional(),
    notes: z.string().trim().max(4000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createAuctionBidRecordSchema = z.object({
  participationId: uuid,
  amountCents: cents,
  currency: z.string().trim().length(3).default("BRL"),
  recordedAt: datetime.optional(),
  source: z.enum(AUCTION_BID_RECORD_SOURCES).default("manual"),
  providerReference: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const createAuctionResultSchema = z.object({
  auctionId: uuid,
  lotId: uuid,
  status: z.enum(AUCTION_RESULT_STATUSES).default("pending"),
  winningBidCents: cents.optional(),
  winnerReference: z.string().trim().max(200).optional(),
  resultDate: datetime.optional(),
  source: z.enum(AUCTION_RESULT_SOURCES).default("manual"),
  sourceReference: z.string().trim().max(200).optional(),
  verificationStatus: z.enum(AUCTION_POST_VERIFICATION_STATUSES).default("unverified"),
  notes: z.string().trim().max(4000).optional(),
});

export const updateAuctionResultSchema = createAuctionResultSchema
  .omit({ auctionId: true, lotId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createAuctionAwardSchema = z.object({
  auctionId: uuid,
  lotId: uuid,
  participationId: optionalUuid,
  resultId: optionalUuid,
  awardStatus: z.enum(AUCTION_AWARD_STATUSES).default("pending_confirmation"),
  winningBidCents: cents.default(0),
  commissionBasisPoints: basisPoints.optional(),
  commissionBaseAmountCents: cents.optional(),
  calculatedCommissionCents: cents.optional(),
  actualCommissionCents: cents.optional(),
  commissionCents: cents.optional(),
  feesCents: cents.optional(),
  totalKnownCostCents: cents.default(0),
  currency: z.string().trim().length(3).default("BRL"),
  awardedAt: datetime.optional(),
  verificationStatus: z.enum(AUCTION_POST_VERIFICATION_STATUSES).default("unverified"),
  source: z.enum(AUCTION_RESULT_SOURCES).default("manual"),
  commissionSource: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(4000).optional(),
});

export const updateAuctionAwardSchema = createAuctionAwardSchema
  .omit({ auctionId: true, lotId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createAuctionPaymentSchema = z.object({
  awardId: uuid,
  paymentType: z.enum(AUCTION_PAYMENT_TYPES).default("bid_price"),
  amountCents: cents,
  currency: z.string().trim().length(3).default("BRL"),
  dueAt: datetime.optional(),
  paidAt: datetime.optional(),
  status: z.enum(AUCTION_PAYMENT_STATUSES).default("pending"),
  paymentReference: z.string().trim().max(200).optional(),
  evidenceDocumentId: optionalUuid,
  notes: z.string().trim().max(4000).optional(),
});

export const updateAuctionPaymentSchema = createAuctionPaymentSchema
  .omit({ awardId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createAuctionDeliveryProcessSchema = z.object({
  awardId: uuid,
  deliveryType: z.enum(AUCTION_DELIVERY_TYPES).default("other"),
  status: z.enum(AUCTION_DELIVERY_STATUSES).default("pending"),
  possessionStatus: z.enum(AUCTION_POSSESSION_STATUSES).default("not_required"),
  scheduledAt: datetime.optional(),
  completedAt: datetime.optional(),
  location: z.string().trim().max(500).optional(),
  responsibleMembershipId: optionalUuid,
  evidenceDocumentId: optionalUuid,
  notes: z.string().trim().max(4000).optional(),
});

export const updateAuctionDeliveryProcessSchema = createAuctionDeliveryProcessSchema
  .omit({ awardId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createAuctionTransferProcessSchema = z.object({
  awardId: uuid,
  transferType: z.enum(AUCTION_TRANSFER_TYPES).default("other"),
  status: z.enum(AUCTION_TRANSFER_STATUSES).default("pending"),
  startedAt: datetime.optional(),
  completedAt: datetime.optional(),
  authority: z.string().trim().max(200).optional(),
  protocol: z.string().trim().max(120).optional(),
  evidenceDocumentId: optionalUuid,
  notes: z.string().trim().max(4000).optional(),
});

export const updateAuctionTransferProcessSchema = createAuctionTransferProcessSchema
  .omit({ awardId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createAuctionAwardEventSchema = z.object({
  awardId: uuid,
  eventType: z.enum(AUCTION_AWARD_EVENT_TYPES),
  reason: z.string().trim().max(4000).optional(),
  source: z.string().trim().max(80).default("manual"),
  relatedDocumentId: optionalUuid,
  metadata: z.record(z.unknown()).optional(),
});

export const upsertAuctionRegularizationItemSchema = z.object({
  awardId: uuid,
  itemKey: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(200),
  category: z.string().trim().max(80).optional(),
  status: z.enum(AUCTION_REGULARIZATION_ITEM_STATUSES).default("pending"),
  required: z.boolean().default(true),
  notes: z.string().trim().max(2000).optional(),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  evidenceDocumentId: optionalUuid,
});

export const auctionPostListQuerySchema = z.object({
  auctionId: optionalUuid,
  lotId: optionalUuid,
  awardId: optionalUuid,
  status: z.string().trim().max(60).optional(),
  limit,
  offset,
});

export const auctionBidListQuerySchema = auctionPostListQuerySchema.extend({
  participationId: optionalUuid,
});

export const linkAuctionAwardDocumentSchema = z.object({
  documentId: uuid,
  linkType: z.string().trim().min(1).max(80),
});

export const suggestAuctionAwardTasksSchema = z.object({
  keys: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
});

export const suggestAuctionAwardDeadlinesSchema = z.object({
  baseDate: datetime,
  titles: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
});
