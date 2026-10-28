import { z } from "zod";

const uuid = z.string().uuid("O identificador não é válido.");
const optionalUuid = uuid.optional();
const nullableUuid = uuid.nullable().optional();
const datetime = z.string().datetime({ offset: true });
const optionalDatetime = datetime.optional();
const nullableDatetime = datetime.nullable().optional();
const cents = z
  .number()
  .int("Informe um valor inteiro em centavos.")
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);

export const ONLINE_LEGAL_URGENCIES = ["low", "normal", "high", "urgent"] as const;

export const ONLINE_LEGAL_REQUEST_STATUSES = [
  "draft",
  "submitted",
  "matching",
  "matched",
  "cancelled",
  "expired",
  "converted",
] as const;

export const ONLINE_MATCH_CANDIDATE_STATUSES = [
  "pending",
  "offered",
  "accepted",
  "declined",
  "expired",
  "cancelled",
] as const;

export const ONLINE_CONSULTATION_MODES = ["text", "audio", "video", "in_person", "other"] as const;

export const ONLINE_CONSULTATION_STATUSES = [
  "matched",
  "awaiting_payment",
  "scheduled",
  "ready",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
  "disputed",
] as const;

export const ONLINE_REVIEW_STATUSES = [
  "pending",
  "published",
  "hidden",
  "reported",
  "removed",
] as const;

export const ONLINE_CONSULTATION_PAYMENT_STATUSES = [
  "pending",
  "paid_manual",
  "paid_provider",
  "failed",
  "cancelled",
  "refunded",
  "not_configured",
] as const;

const stateCodeSchema = z
  .string()
  .trim()
  .length(2, "Informe a UF com 2 letras.")
  .transform((v) => v.toUpperCase());

const documentIdsSchema = z.array(uuid).max(20).optional();

export const createOnlineLegalRequestSchema = z.object({
  organizationId: optionalUuid,
  clientId: optionalUuid,
  legalAreaId: optionalUuid,
  subareaId: optionalUuid,
  urgency: z.enum(ONLINE_LEGAL_URGENCIES).default("normal"),
  stateCode: stateCodeSchema,
  summary: z.string().trim().min(10).max(8000),
  preferredMode: z.enum(ONLINE_CONSULTATION_MODES).default("text"),
  status: z.enum(ONLINE_LEGAL_REQUEST_STATUSES).default("draft"),
  documentIds: documentIdsSchema,
});

export const generateOnlineMatchCandidatesSchema = z.object({
  offerTtlMinutes: z.coerce
    .number()
    .int()
    .min(5)
    .max(24 * 60)
    .default(30),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const scheduleOnlineConsultationSchema = z.object({
  scheduledAt: datetime,
  timezone: z.string().trim().min(2).max(64).default("America/Sao_Paulo"),
  mode: z.enum(ONLINE_CONSULTATION_MODES).optional(),
});

export const closeOnlineConsultationSchema = z.object({
  outcome: z.string().trim().min(1).max(80).default("completed"),
  summary: z.string().trim().max(8000).optional(),
  followUpRecommended: z.boolean().default(false),
  legalMatterCreatedId: optionalUuid,
});

export const completeOnlineConsultationSchema = closeOnlineConsultationSchema.extend({
  createLegalMatter: z.boolean().default(false),
  matterTitle: z.string().trim().min(2).max(200).optional(),
});

export const manualOnlineConsultationPaymentSchema = z.object({
  amountCents: cents,
  platformFeeCents: cents.default(0),
  lawyerAmountCents: cents.default(0),
  evidenceDocumentId: uuid,
  externalReference: z.string().trim().max(200).optional(),
});

export const patchOnlineLawyerProfileSchema = z
  .object({
    onlineServiceEnabled: z.boolean().optional(),
    serviceStates: z.string().trim().max(500).optional(),
    consultationModes: z.string().trim().max(200).optional(),
    availabilityStatus: z.enum(["available", "busy", "away", "offline"] as const).optional(),
    acceptsUrgent: z.boolean().optional(),
    consultationPriceCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
    practiceAreas: z.string().trim().max(1000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const updateOnlineLegalRequestSchema = z
  .object({
    clientId: nullableUuid,
    legalAreaId: nullableUuid,
    subareaId: nullableUuid,
    urgency: z.enum(ONLINE_LEGAL_URGENCIES).optional(),
    stateCode: stateCodeSchema.optional(),
    summary: z.string().trim().min(10).max(8000).optional(),
    preferredMode: z.enum(ONLINE_CONSULTATION_MODES).optional(),
    status: z.enum(ONLINE_LEGAL_REQUEST_STATUSES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createLawyerAvailabilitySchema = z.object({
  lawyerProfileId: uuid,
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  specificDate: optionalDatetime,
  startTime: z.string().trim().min(4).max(8),
  endTime: z.string().trim().min(4).max(8),
  timezone: z.string().trim().min(2).max(64).default("America/Sao_Paulo"),
  mode: z.enum(ONLINE_CONSULTATION_MODES).default("text"),
  active: z.boolean().default(true),
});

export const updateLawyerAvailabilitySchema = createLawyerAvailabilitySchema
  .omit({ lawyerProfileId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createLawyerAvailabilityOverrideSchema = z.object({
  lawyerProfileId: uuid,
  startsAt: datetime,
  endsAt: datetime,
  overrideType: z.string().trim().min(1).max(40).default("unavailable"),
  reason: z.string().trim().max(500).optional(),
  active: z.boolean().default(true),
});

export const respondOnlineMatchCandidateSchema = z.object({
  status: z.enum(["accepted", "declined"] as const),
});

export const updateOnlineConsultationSchema = z
  .object({
    status: z.enum(ONLINE_CONSULTATION_STATUSES).optional(),
    mode: z.enum(ONLINE_CONSULTATION_MODES).optional(),
    scheduledAt: nullableDatetime,
    startedAt: nullableDatetime,
    endedAt: nullableDatetime,
    timezone: z.string().trim().min(2).max(64).optional(),
    calendarEventId: nullableUuid,
    contractId: nullableUuid,
    conversationThreadId: nullableUuid,
    priceCents: cents.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const acceptConsultationTermsSchema = z.object({
  termsVersion: z.string().trim().min(1).max(40),
  source: z.string().trim().min(1).max(40).default("portal"),
});

export const createOnlineConsultationPaymentSchema = z.object({
  consultationId: uuid,
  amountCents: cents,
  platformFeeCents: cents.default(0),
  lawyerAmountCents: cents.default(0),
  status: z.enum(ONLINE_CONSULTATION_PAYMENT_STATUSES).default("pending"),
  providerKey: z.string().trim().min(1).max(40).default("not_configured"),
  externalReference: z.string().trim().max(200).optional(),
  evidenceDocumentId: optionalUuid,
});

export const createOnlineConsultationReviewSchema = z.object({
  consultationId: uuid,
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(4000).optional(),
});

export const moderateOnlineConsultationReviewSchema = z.object({
  status: z.enum(ONLINE_REVIEW_STATUSES),
});

export const onlineLawyerListQuerySchema = z.object({
  status: z.string().trim().max(40).optional(),
  stateCode: z.string().trim().length(2).optional(),
  lawyerProfileId: optionalUuid,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});
