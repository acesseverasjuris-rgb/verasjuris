import { z } from "zod";

const uuid = z.string().uuid("O identificador não é válido.");
const optionalUuid = uuid.optional();
const limit = z.coerce.number().int().min(1).max(100).default(20);
const offset = z.coerce.number().int().min(0).max(10_000).default(0);
const idempotencyKey = z.string().trim().min(8).max(200);

export const LEGAL_REVIEW_TYPES = [
  "formal_review",
  "content_review",
  "cross_document_review",
  "procedural_risk_review",
  "claims_review",
  "evidence_review",
  "contract_review",
  "decision_response_review",
  "administrative_review",
] as const;

export const LEGAL_REVIEW_STATUSES = [
  "draft",
  "processing",
  "generated",
  "human_review",
  "reviewed",
  "closed",
  "failed",
  "not_configured",
] as const;

export const LEGAL_REVIEW_DOCUMENT_ROLES = [
  "initial_petition",
  "defense",
  "reply",
  "expert_report",
  "medical_report",
  "decision",
  "appeal",
  "contract",
  "evidence",
  "administrative_request",
  "administrative_decision",
  "other",
] as const;

export const LEGAL_REVIEW_ITEM_STATUSES = [
  "unreviewed",
  "confirmed",
  "rejected",
  "corrected",
] as const;

export const LEGAL_REVIEW_SEVERITIES = ["low", "medium", "high", "critical"] as const;

export const LEGAL_REVIEW_SECTIONS = [
  "formal_issues",
  "missing_documents",
  "unaddressed_claims",
  "unanswered_grounds",
  "risks",
  "inconsistencies",
  "contradictions",
] as const;

export const createLegalReviewSetSchema = z.object({
  name: z.string().trim().min(2).max(200),
  legalMatterId: optionalUuid,
  documents: z
    .array(
      z.object({
        documentId: uuid,
        documentVersionId: optionalUuid,
        roleInReview: z.enum(LEGAL_REVIEW_DOCUMENT_ROLES).default("other"),
        sortOrder: z.number().int().min(0).max(10_000).default(0),
      }),
    )
    .min(1)
    .max(50),
});

export const createLegalReviewSchema = z
  .object({
    reviewType: z.enum(LEGAL_REVIEW_TYPES).default("content_review"),
    legalMatterId: optionalUuid,
    judicialProcessId: optionalUuid,
    administrativeProcessId: optionalUuid,
    primaryDocumentId: optionalUuid,
    reviewSetId: optionalUuid,
    idempotencyKey: idempotencyKey.optional(),
  })
  .superRefine((value, ctx) => {
    if (
      !value.legalMatterId &&
      !value.judicialProcessId &&
      !value.administrativeProcessId &&
      !value.primaryDocumentId &&
      !value.reviewSetId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["primaryDocumentId"],
        message: "Informe um documento, conjunto, caso ou processo para revisar.",
      });
    }
  });

export const legalReviewListQuerySchema = z.object({
  legalMatterId: optionalUuid,
  primaryDocumentId: optionalUuid,
  reviewType: z.enum(LEGAL_REVIEW_TYPES).optional(),
  status: z.enum(LEGAL_REVIEW_STATUSES).optional(),
  limit,
  offset,
});

export const legalReviewSetListQuerySchema = z.object({
  legalMatterId: optionalUuid,
  limit,
  offset,
});

export const legalReviewSectionSchema = z.enum(LEGAL_REVIEW_SECTIONS);

export const reviewLegalReviewItemSchema = z
  .object({
    action: z.enum(["confirm", "reject", "correct"]),
    correctedText: z.string().trim().min(1).max(4000).optional(),
    comment: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === "correct" && !value.correctedText) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correctedText"],
        message: "Informe o texto corrigido.",
      });
    }
  });

export const reviewLegalReviewSchema = z.object({
  comment: z.string().trim().max(2000).optional(),
});

export const closeLegalReviewSchema = z.object({
  comment: z.string().trim().max(2000).optional(),
});
