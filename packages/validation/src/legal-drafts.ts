import { z } from "zod";
import { LEGAL_TEMPLATE_TYPES } from "./legal-templates.js";

const uuid = z.string().uuid("O identificador não é válido.");
const optionalUuid = uuid.optional();
const limit = z.coerce.number().int().min(1).max(100).default(20);
const offset = z.coerce.number().int().min(0).max(10_000).default(0);
const datetime = z.string().datetime({ offset: true });
const idempotencyKey = z.string().trim().min(8).max(200);

export const LEGAL_DRAFT_STATUSES = [
  "draft",
  "ai_assisted",
  "human_review",
  "approved",
  "ready_to_file",
  "filed",
  "confirmed",
  "rejected",
  "cancelled",
  "archived",
  "failed",
] as const;

export const LEGAL_DRAFT_SOURCE_ITEM_TYPES = [
  "document",
  "analysis",
  "research",
  "citation",
  "fact",
  "evidence",
  "instruction",
] as const;

export const LEGAL_DRAFT_FILING_METHODS = [
  "manual",
  "electronic",
  "provider",
  "not_configured",
] as const;

export const LEGAL_DRAFT_CONFIRMATION_METHODS = ["manual", "provider"] as const;

export const LEGAL_DRAFT_CHECKLIST_ITEM_STATUSES = [
  "pending",
  "done",
  "not_applicable",
  "blocked",
] as const;

export const LEGAL_DRAFT_CHECKLIST_ITEM_KEYS = [
  "competence",
  "parties",
  "power_of_attorney",
  "documents",
  "claims",
  "amounts",
  "citations",
  "signature",
  "attachments",
  "deadline",
  "review",
  "approval",
] as const;

export const createLegalDraftSchema = z.object({
  title: z.string().trim().min(2).max(300),
  documentType: z.enum(LEGAL_TEMPLATE_TYPES).default("other"),
  legalMatterId: optionalUuid,
  judicialProcessId: optionalUuid,
  administrativeProcessId: optionalUuid,
  clientId: optionalUuid,
  templateId: optionalUuid,
  templateVersionId: optionalUuid,
  content: z.string().max(500_000).optional(),
  structuredData: z.record(z.unknown()).optional(),
  variableValues: z.record(z.unknown()).optional(),
  sourceSetId: optionalUuid,
  idempotencyKey: idempotencyKey.optional(),
});

export const updateLegalDraftSchema = z
  .object({
    title: z.string().trim().min(2).max(300).optional(),
    documentType: z.enum(LEGAL_TEMPLATE_TYPES).optional(),
    content: z.string().max(500_000).nullable().optional(),
    structuredData: z.record(z.unknown()).nullable().optional(),
    variableValues: z.record(z.unknown()).optional(),
    reviewComment: z.string().trim().max(4000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const legalDraftListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(LEGAL_DRAFT_STATUSES).optional(),
  documentType: z.enum(LEGAL_TEMPLATE_TYPES).optional(),
  legalMatterId: optionalUuid,
  judicialProcessId: optionalUuid,
  administrativeProcessId: optionalUuid,
  clientId: optionalUuid,
  templateId: optionalUuid,
  limit,
  offset,
});

export const legalDraftWorkflowTransitionSchema = z.object({
  toStatus: z.enum(LEGAL_DRAFT_STATUSES),
  reason: z.string().trim().max(2000).optional(),
  evidenceDocumentId: optionalUuid,
});

export const fileLegalDraftSchema = z.object({
  filedAt: datetime,
  filingMethod: z.enum(LEGAL_DRAFT_FILING_METHODS).default("manual"),
  protocolNumber: z.string().trim().max(120).optional(),
  evidenceDocumentId: optionalUuid,
  filingNotes: z.string().trim().max(4000).optional(),
});

export const confirmLegalDraftFilingSchema = z.object({
  confirmedAt: datetime.optional(),
  confirmationMethod: z.enum(LEGAL_DRAFT_CONFIRMATION_METHODS).default("manual"),
  confirmationEvidenceDocumentId: uuid,
  notes: z.string().trim().max(4000).optional(),
});

export const createLegalDraftSourceSetSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  draftId: optionalUuid,
  items: z
    .array(
      z.object({
        itemType: z.enum(LEGAL_DRAFT_SOURCE_ITEM_TYPES),
        referenceId: optionalUuid,
        documentId: optionalUuid,
        documentVersionId: optionalUuid,
        instructionText: z.string().trim().max(8000).optional(),
        sortOrder: z.number().int().min(0).max(10_000).default(0),
        metadata: z.record(z.unknown()).optional(),
      }),
    )
    .max(200)
    .default([]),
});

export const createLegalDraftChecklistSchema = z.object({
  name: z.string().trim().min(2).max(200),
  draftId: optionalUuid,
  isTemplate: z.boolean().default(false),
  items: z
    .array(
      z.object({
        itemKey: z.string().trim().min(1).max(80),
        label: z.string().trim().min(1).max(200),
        category: z.string().trim().max(80).optional(),
        required: z.boolean().default(true),
        sortOrder: z.number().int().min(0).max(10_000).default(0),
      }),
    )
    .min(1)
    .max(100),
});

export const updateLegalDraftChecklistItemSchema = z
  .object({
    status: z.enum(LEGAL_DRAFT_CHECKLIST_ITEM_STATUSES).optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createLegalDraftVersionSchema = z.object({
  content: z.string().max(500_000).optional(),
  structuredData: z.record(z.unknown()).optional(),
  changeSummary: z.string().trim().max(2000).optional(),
});

export const legalDraftAiAssistSchema = z.object({
  instructions: z.string().trim().max(8000).optional(),
  idempotencyKey: idempotencyKey.optional(),
});

export const convertLegalDraftToDocumentSchema = z.object({
  format: z.enum(["plain_text", "html"]).default("plain_text"),
});

export const exportLegalDraftQuerySchema = z.object({
  format: z.enum(["html", "pdf", "docx"]).default("html"),
});

export const legalDraftReviewBodySchema = z.object({
  reason: z.string().trim().max(2000).optional(),
  reviewComment: z.string().trim().max(4000).nullable().optional(),
});

export const legalDraftReasonBodySchema = z.object({
  reason: z.string().trim().max(2000).optional(),
});
