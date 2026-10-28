import { z } from "zod";

const uuid = z.string().uuid("O identificador não é válido.");
const optionalUuid = uuid.optional();
const optionalDatetime = z.string().datetime({ offset: true }).optional();

export const createDiligenceRequestSchema = z.object({
  typeKey: z.string().trim().min(1, "Informe o tipo de diligência."),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(3).max(8000),
  clientId: optionalUuid,
  legalMatterId: optionalUuid,
  state: z.string().trim().max(2).optional(),
  city: z.string().trim().max(120).optional(),
  addressText: z.string().trim().max(500).optional(),
  courtOrAgency: z.string().trim().max(200).optional(),
  dueAt: optionalDatetime,
  urgency: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  budgetCents: z.number().int().min(0).optional(),
});

export const updateDiligenceRequestSchema = createDiligenceRequestSchema.partial();

export const publishDiligenceRequestSchema = z.object({});

export const createDiligenceProposalSchema = z.object({
  requestId: uuid,
  amountCents: z.number().int().min(1, "Informe o valor da proposta."),
  estimatedCompletionAt: optionalDatetime,
  notes: z.string().trim().max(2000).optional(),
});

export const acceptDiligenceProposalSchema = z.object({
  proposalId: uuid,
});

export const createDiligenceExecutionEventSchema = z.object({
  eventType: z.enum([
    "started",
    "arrived",
    "protocolled",
    "hearing_attended",
    "document_collected",
    "evidence_submitted",
    "completed",
    "issue_reported",
  ]),
  notes: z.string().trim().max(2000).optional(),
  occurredAt: optionalDatetime,
});

export const submitDiligenceEvidenceSchema = z.object({
  evidenceType: z.enum([
    "document",
    "receipt",
    "protocol",
    "certificate",
    "photo",
    "location_proof",
    "signed_acknowledgement",
    "other",
  ]),
  documentId: optionalUuid,
  description: z.string().trim().max(2000).optional(),
  occurredAt: optionalDatetime,
});

export const reviewDiligenceEvidenceSchema = z.object({
  status: z.enum(["accepted", "rejected"]),
  notes: z.string().trim().max(2000).optional(),
});

export const completeDiligenceAssignmentSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
});
