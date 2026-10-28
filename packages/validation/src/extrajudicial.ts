import { z } from "zod";

const uuid = z.string().uuid("O identificador não é válido.");
const optionalUuid = uuid.optional();
const optionalDatetime = z.string().datetime({ offset: true }).optional();

export const createRegistryOfficeSchema = z.object({
  name: z.string().trim().min(2).max(200),
  officeType: z.string().trim().max(80).default("other"),
  state: z.string().trim().max(2).optional(),
  city: z.string().trim().max(120).optional(),
  address: z.string().trim().max(500).optional(),
  externalIdentifier: z.string().trim().max(120).optional(),
});

export const createExtrajudicialServiceRequestSchema = z.object({
  serviceTypeKey: z.string().trim().min(1),
  documentTypeKey: z.string().trim().optional(),
  registryOfficeId: optionalUuid,
  clientId: optionalUuid,
  legalMatterId: optionalUuid,
  jurisdictionState: z.string().trim().max(2).optional(),
  jurisdictionCity: z.string().trim().max(120).optional(),
  description: z.string().trim().min(3).max(8000),
});

export const createExtrajudicialQuoteSchema = z.object({
  serviceRequestId: uuid,
  serviceFeeCents: z.number().int().min(0).default(0),
  estimatedOfficialFeesCents: z.number().int().min(0).optional(),
  estimatedThirdPartyFeesCents: z.number().int().min(0).optional(),
  totalEstimateCents: z.number().int().min(0),
  estimatedDeliveryAt: optionalDatetime,
  expiresAt: optionalDatetime,
  notes: z.string().trim().max(2000).optional(),
  source: z.enum(["manual_estimate", "provider", "fee_table", "other"]).default("manual_estimate"),
  registryOfficeId: optionalUuid,
});

export const acceptExtrajudicialQuoteSchema = z.object({
  quoteId: uuid,
});

export const submitExtrajudicialOrderSchema = z.object({
  orderId: uuid,
});

export const recordManualExtrajudicialProtocolSchema = z.object({
  externalProtocol: z.string().trim().min(1).max(120),
  protocolEvidenceDocumentId: uuid,
});

export const createExtrajudicialRequirementSchema = z.object({
  description: z.string().trim().min(3).max(2000),
  dueAt: optionalDatetime,
});

export const fulfillExtrajudicialRequirementSchema = z.object({
  evidenceDocumentId: optionalUuid,
});
