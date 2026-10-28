import { z } from "zod";

const uuid = z.string().uuid("O identificador não é válido.");
const optionalUuid = uuid.optional();
const datetime = z.string().datetime({ offset: true });
const optionalDatetime = datetime.optional();
const cents = z
  .number()
  .int("Informe um valor inteiro em centavos.")
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);

export const MARKETPLACE_PRICING_MODELS = [
  "fixed",
  "starting_at",
  "hourly",
  "quote_required",
  "custom",
] as const;

export const MARKETPLACE_DELIVERY_MODES = ["remote", "in_person", "hybrid", "other"] as const;

export const MARKETPLACE_REQUEST_STATUSES = [
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
] as const;

export const MARKETPLACE_PROPOSAL_STATUSES = [
  "draft",
  "submitted",
  "viewed",
  "accepted",
  "declined",
  "withdrawn",
  "expired",
] as const;

export const MARKETPLACE_ENGAGEMENT_STATUSES = [
  "pending_contract",
  "pending_payment",
  "active",
  "waiting_client",
  "waiting_provider",
  "delivered",
  "completed",
  "cancelled",
  "disputed",
] as const;

export const MARKETPLACE_DELIVERY_STATUSES = [
  "submitted",
  "under_review",
  "accepted",
  "revision_requested",
  "rejected",
] as const;

export const MARKETPLACE_DISPUTE_STATUSES = [
  "open",
  "under_review",
  "waiting_client",
  "waiting_provider",
  "mediation",
  "resolved",
  "closed",
  "cancelled",
] as const;

const stateCodeSchema = z
  .string()
  .trim()
  .length(2, "Informe a UF com 2 letras.")
  .transform((v) => v.toUpperCase())
  .optional();

function stripControlChars(value: string): string {
  let out = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127)) {
      out += char;
    }
  }
  return out;
}

const safeText = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .transform((v) => stripControlChars(v));

export const createMarketplaceServiceSchema = z.object({
  categoryId: uuid,
  title: safeText(3, 200),
  description: safeText(10, 8000).optional(),
  deliveryMode: z.enum(MARKETPLACE_DELIVERY_MODES).default("remote"),
  pricingModel: z.enum(MARKETPLACE_PRICING_MODELS).default("quote_required"),
  basePriceCents: cents.nullable().optional(),
  minPriceCents: cents.nullable().optional(),
  maxPriceCents: cents.nullable().optional(),
  estimatedDuration: z.string().trim().max(120).optional(),
  active: z.boolean().default(true),
});

export const updateMarketplaceServiceSchema = createMarketplaceServiceSchema.partial();

export const patchMarketplaceProfileSchema = z.object({
  marketplaceEnabled: z.boolean().optional(),
  marketplaceHeadline: z.string().trim().max(200).optional(),
  marketplaceDescription: safeText(10, 8000).optional(),
  serviceCities: z.string().trim().max(500).optional(),
  marketplaceCategories: z.string().trim().max(500).optional(),
  specialties: z.string().trim().max(500).optional(),
  responseTimeEstimate: z.string().trim().max(80).optional(),
  basePriceMinCents: cents.nullable().optional(),
  basePriceMaxCents: cents.nullable().optional(),
  remoteAvailable: z.boolean().optional(),
  inPersonAvailable: z.boolean().optional(),
  marketplaceStatus: z.enum(["draft", "pending", "active", "suspended"]).optional(),
});

export const createMarketplaceRequestSchema = z.object({
  clientId: optionalUuid,
  categoryId: uuid,
  legalAreaId: optionalUuid,
  title: safeText(3, 200),
  description: safeText(20, 8000),
  urgency: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  locationState: stateCodeSchema,
  locationCity: z.string().trim().max(120).optional(),
  remoteAllowed: z.boolean().default(true),
  budgetMinCents: cents.nullable().optional(),
  budgetMaxCents: cents.nullable().optional(),
  deadlineAt: optionalDatetime,
  status: z.enum(["draft", "open"]).default("draft"),
});

export const updateMarketplaceRequestSchema = createMarketplaceRequestSchema
  .partial()
  .extend({ status: z.enum(MARKETPLACE_REQUEST_STATUSES).optional() });

export const submitMarketplaceProposalSchema = z.object({
  amountCents: cents.refine((v) => v > 0, "Informe um valor positivo em centavos."),
  feeBreakdown: z.record(z.string(), cents).optional(),
  estimatedDeliveryAt: optionalDatetime,
  message: safeText(10, 4000).optional(),
  terms: safeText(10, 8000).optional(),
  expiresAt: optionalDatetime,
});

export const updateMarketplaceProposalSchema = submitMarketplaceProposalSchema.partial();

export const acceptMarketplaceProposalSchema = z.object({
  revisionLimit: z.coerce.number().int().min(0).max(10).default(2),
});

export const createMarketplaceDeliverySchema = z.object({
  description: safeText(10, 4000),
  documentId: optionalUuid,
});

export const reviewMarketplaceDeliverySchema = z.object({
  action: z.enum(["accept", "request_revision", "reject"]),
  revisionNotes: safeText(5, 4000).optional(),
});

export const openMarketplaceDisputeSchema = z.object({
  reasonCode: z.string().trim().min(2).max(80),
  description: safeText(20, 4000),
});

export const resolveMarketplaceDisputeSchema = z.object({
  resolution: safeText(10, 4000),
  status: z.enum(["resolved", "closed"]).default("resolved"),
});

export const createMarketplaceReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: safeText(5, 2000).optional(),
});

export const manualMarketplacePaymentSchema = z.object({
  amountCents: cents.refine((v) => v > 0, "Informe um valor positivo."),
  description: safeText(3, 500).default("Pagamento marketplace"),
  evidenceDocumentId: uuid,
  externalReference: z.string().trim().max(120).optional(),
});

export const marketplaceListQuerySchema = z.object({
  status: z.string().trim().max(40).optional(),
  categoryId: optionalUuid,
  legalAreaId: optionalUuid,
  locationState: stateCodeSchema,
  locationCity: z.string().trim().max(120).optional(),
  remoteAllowed: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  minPriceCents: z.coerce.number().int().min(0).optional(),
  maxPriceCents: z.coerce.number().int().min(0).optional(),
  verifiedOnly: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
  availabilityOnly: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const marketplaceProfessionalSearchSchema = marketplaceListQuerySchema.omit({
  status: true,
});
