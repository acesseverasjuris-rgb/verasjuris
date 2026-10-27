import { z } from "zod";

const uuid = z.string().uuid("O identificador não é válido.");
const optionalUuid = uuid.optional();
const datetime = z.string().datetime({ offset: true });
const limit = z.coerce.number().int().min(1).max(100).default(20);
const offset = z.coerce.number().int().min(0).max(10_000).default(0);
const q = z.string().trim().min(1).max(200);
const cents = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const basisPoints = z.number().int().min(0).max(10_000);
const stateCode = z
  .string()
  .trim()
  .length(2)
  .transform((value) => value.toUpperCase());
const httpsUrl = z
  .string()
  .trim()
  .url()
  .max(2000)
  .refine((value) => value.startsWith("https://"), "A URL deve usar https.");

export const AUCTION_TYPES = [
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
] as const;

export const AUCTION_ASSET_TYPES = [
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
] as const;

export const AUCTION_STATUSES = [
  "draft",
  "published",
  "open",
  "closed",
  "cancelled",
  "archived",
  "not_configured",
] as const;

export const AUCTION_INTEREST_STATUSES = [
  "saved",
  "watching",
  "reviewing",
  "visit_planned",
  "intends_to_bid",
  "participated",
  "won",
  "lost",
  "archived",
] as const;

export const AUCTION_OCCUPANCY_STATUSES = [
  "unknown",
  "vacant",
  "occupied",
  "possession_disputed",
  "other",
] as const;

export const AUCTION_DUE_DILIGENCE_STATUSES = [
  "pending",
  "in_progress",
  "done",
  "not_applicable",
  "blocked",
  "unknown",
] as const;

export const createAuctionSchema = z.object({
  auctionType: z.enum(AUCTION_TYPES).default("other"),
  title: z.string().trim().min(2).max(300),
  description: z.string().trim().max(20_000).optional(),
  sellerType: z.string().trim().max(80).optional(),
  sellerName: z.string().trim().max(200).optional(),
  publicBodyId: optionalUuid,
  courtId: optionalUuid,
  judicialProcessId: optionalUuid,
  auctioneerId: optionalUuid,
  status: z.enum(AUCTION_STATUSES).default("draft"),
  publicationDate: datetime.optional(),
  registrationDeadline: datetime.optional(),
  inspectionStartAt: datetime.optional(),
  inspectionEndAt: datetime.optional(),
  firstEventAt: datetime.optional(),
  secondEventAt: datetime.optional(),
  closingAt: datetime.optional(),
  sourceUrl: httpsUrl.optional(),
  sourceReference: z.string().trim().max(200).optional(),
});

export const updateAuctionSchema = createAuctionSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const AUCTION_SOURCES = ["manual", "public_provider", "import", "not_configured"] as const;

export const auctionListQuerySchema = z.object({
  q: q.optional(),
  auctionType: z.enum(AUCTION_TYPES).optional(),
  assetType: z.enum(AUCTION_ASSET_TYPES).optional(),
  status: z.enum(AUCTION_STATUSES).optional(),
  source: z.enum(AUCTION_SOURCES).optional(),
  stateCode: stateCode.optional(),
  municipality: z.string().trim().max(200).optional(),
  auctioneerId: optionalUuid,
  courtId: optionalUuid,
  publicBodyId: optionalUuid,
  minValueCents: cents.optional(),
  maxValueCents: cents.optional(),
  eventFrom: datetime.optional(),
  eventTo: datetime.optional(),
  occupancyStatus: z.enum(AUCTION_OCCUPANCY_STATUSES).optional(),
  interestStatus: z.enum(AUCTION_INTEREST_STATUSES).optional(),
  onlySaved: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  limit,
  offset,
});

export const createAuctionLotSchema = z.object({
  lotNumber: z.string().trim().min(1).max(40),
  title: z.string().trim().min(2).max(300),
  description: z.string().trim().max(20_000).optional(),
  assetType: z.enum(AUCTION_ASSET_TYPES).default("other"),
  appraisalValueCents: cents.optional(),
  firstMinimumBidCents: cents.optional(),
  secondMinimumBidCents: cents.optional(),
  currentReferenceValueCents: cents.optional(),
  currency: z.string().trim().length(3).default("BRL"),
  incrementCents: cents.optional(),
  commissionBasisPoints: basisPoints.optional(),
  buyerFeeCents: cents.optional(),
  depositRequiredCents: cents.optional(),
  location: z.string().trim().max(500).optional(),
  stateCode: stateCode.optional(),
  municipality: z.string().trim().max(200).optional(),
  latitude: z.string().trim().max(40).optional(),
  longitude: z.string().trim().max(40).optional(),
  occupancyStatus: z.enum(AUCTION_OCCUPANCY_STATUSES).default("unknown"),
});

export const updateAuctionLotSchema = createAuctionLotSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const upsertAuctionInterestSchema = z
  .object({
    lotId: optionalUuid,
    status: z.enum(AUCTION_INTEREST_STATUSES).default("saved"),
    notes: z.string().trim().max(4000).nullable().optional(),
    /** Obrigatório `true` ao marcar won/lost — confirmação explícita do usuário. */
    confirmOutcome: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.status === "won" || value.status === "lost") && value.confirmOutcome !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmOutcome"],
        message: "Confirme o resultado (won/lost) com confirmOutcome=true.",
      });
    }
  });

export const auctionInterestListQuerySchema = z.object({
  status: z.enum(AUCTION_INTEREST_STATUSES).optional(),
  auctionId: optionalUuid,
  lotId: optionalUuid,
  limit,
  offset,
});

export const createAuctionAlertRuleSchema = z.object({
  name: z.string().trim().min(2).max(160),
  active: z.boolean().default(true),
  auctionTypes: z.array(z.enum(AUCTION_TYPES)).max(20).optional(),
  assetTypes: z.array(z.enum(AUCTION_ASSET_TYPES)).max(20).optional(),
  stateCodes: z.array(stateCode).max(27).optional(),
  municipalities: z.array(z.string().trim().max(200)).max(50).optional(),
  minValueCents: cents.optional(),
  maxValueCents: cents.optional(),
  occupancyStatuses: z.array(z.enum(AUCTION_OCCUPANCY_STATUSES)).max(10).optional(),
});

export const updateAuctionAlertRuleSchema = createAuctionAlertRuleSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const upsertAuctionDueDiligenceSchema = z.object({
  lotId: optionalUuid,
  itemKey: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z][a-z0-9_]*$/, "Use snake_case minúsculo."),
  label: z.string().trim().min(2).max(200),
  category: z.string().trim().max(80).optional(),
  status: z.enum(AUCTION_DUE_DILIGENCE_STATUSES).default("pending"),
  notes: z.string().trim().max(4000).optional(),
});

export const createAuctionBidRuleSchema = z.object({
  lotId: optionalUuid,
  minimumBidCents: cents.optional(),
  incrementCents: cents.optional(),
  paymentTerms: z.string().trim().max(2000).optional(),
  commissionBasisPoints: basisPoints.optional(),
  depositRequired: z.boolean().default(false),
  depositRequiredCents: cents.optional(),
  registrationRequired: z.boolean().default(false),
  eligibilityDescription: z.string().trim().max(4000).optional(),
  notes: z.string().trim().max(4000).optional(),
});

export const createAuctioneerSchema = z.object({
  name: z.string().trim().min(2).max(200),
  registrationNumber: z.string().trim().max(80).optional(),
  stateCode: stateCode.optional(),
  entityName: z.string().trim().max(200).optional(),
  website: httpsUrl.optional(),
});

export const linkAuctionDocumentSchema = z.object({
  documentId: uuid,
  /** targetType no document_links: auction | auction_lot (definido pelo recurso). */
  linkType: z
    .enum([
      "auction_notice",
      "appraisal",
      "registry",
      "certificate",
      "photo",
      "court_decision",
      "terms",
      "other",
    ])
    .default("other"),
  lotId: optionalUuid,
});

export const AUCTION_EVENT_TYPES = [
  "first_session",
  "second_session",
  "session",
  "closing",
  "direct_sale",
  "other",
] as const;

export const createAuctionEventSchema = z.object({
  eventType: z.enum(AUCTION_EVENT_TYPES).default("session"),
  startsAt: datetime,
  endsAt: datetime.optional(),
  timezone: z.string().trim().min(1).max(80).default("America/Sao_Paulo"),
  minimumRule: z.string().trim().max(500).optional(),
  status: z.enum(["scheduled", "open", "closed", "cancelled", "unknown"]).default("scheduled"),
});

export const createAuctionEncumbranceSchema = z.object({
  type: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(4000),
  source: z.string().trim().max(200).optional(),
  responsibility: z.string().trim().max(200).optional(),
  amountCents: cents.optional(),
});

export const auctionRealEstateDetailsSchema = z.object({
  propertyType: z.string().trim().max(120).optional(),
  registryNumber: z.string().trim().max(120).optional(),
  registryOffice: z.string().trim().max(200).optional(),
  area: z.string().trim().max(80).optional(),
  builtArea: z.string().trim().max(80).optional(),
  occupancyStatus: z.enum(AUCTION_OCCUPANCY_STATUSES).optional(),
  possessionStatus: z.string().trim().max(200).optional(),
  address: z.string().trim().max(500).optional(),
  propertyTaxReference: z.string().trim().max(120).optional(),
  condominiumInfo: z.string().trim().max(1000).optional(),
  liensSummary: z.string().trim().max(2000).optional(),
});

export const auctionVehicleDetailsSchema = z.object({
  make: z.string().trim().max(80).optional(),
  model: z.string().trim().max(120).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  modelYear: z.number().int().min(1900).max(2100).optional(),
  plateMasked: z.string().trim().max(20).optional(),
  renavamMasked: z.string().trim().max(20).optional(),
  mileage: z.number().int().min(0).max(10_000_000).optional(),
  condition: z.string().trim().max(200).optional(),
  documentationStatus: z.string().trim().max(200).optional(),
});

export const createAuctionLotWithDetailsSchema = createAuctionLotSchema.extend({
  realEstate: auctionRealEstateDetailsSchema.optional(),
  vehicle: auctionVehicleDetailsSchema.optional(),
});

export const updateAuctionLotWithDetailsSchema = createAuctionLotSchema
  .partial()
  .extend({
    realEstate: auctionRealEstateDetailsSchema.optional(),
    vehicle: auctionVehicleDetailsSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const auctionCostEstimateSchema = z
  .object({
    lotId: optionalUuid,
    bidCents: cents.optional(),
    commissionBasisPoints: basisPoints.optional(),
    knownFeesCents: cents.default(0),
    otherCostsCents: cents.default(0),
  })
  .superRefine((value, ctx) => {
    if (value.lotId == null && value.bidCents == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bidCents"],
        message: "Informe bidCents ou lotId.",
      });
    }
  });

export const compareAuctionLotsSchema = z.object({
  lotIds: z.array(uuid).min(2).max(20),
});

export const getOrCreateAuctionDueDiligenceSchema = z.object({
  auctionId: uuid,
  lotId: optionalUuid,
});

export const updateAuctionDueDiligenceSchema = z.object({
  status: z.enum(AUCTION_DUE_DILIGENCE_STATUSES).optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  label: z.string().trim().min(2).max(200).optional(),
  category: z.string().trim().max(80).nullable().optional(),
});

export const analyzeAuctionNoticeSchema = z.object({
  auctionId: uuid,
  documentId: optionalUuid,
  text: z.string().trim().min(1).max(100_000).optional(),
});
