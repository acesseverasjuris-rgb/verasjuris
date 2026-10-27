import { z } from "zod";

const uuid = z.string().uuid("O identificador não é válido.");
const optionalUuid = uuid.optional();
const limit = z.coerce.number().int().min(1).max(100).default(20);
const offset = z.coerce.number().int().min(0).max(10_000).default(0);
const idempotencyKey = z.string().trim().min(8).max(200);

export const LEGAL_COMPARISON_TYPES = [
  "petition_vs_defense",
  "evidence_vs_allegations",
  "claim_vs_decision",
  "judgment_vs_appeal",
  "admin_process_vs_judicial_action",
] as const;

export const LEGAL_COMPARISON_STATUSES = [
  "draft",
  "processing",
  "generated",
  "human_review",
  "reviewed",
  "closed",
  "failed",
  "not_configured",
] as const;

export const LEGAL_COMPARISON_SOURCE_ROLES = [
  "side_a",
  "side_b",
  "petition",
  "defense",
  "evidence",
  "allegation",
  "claim",
  "decision",
  "judgment",
  "appeal",
  "administrative_request",
  "administrative_decision",
  "other",
] as const;

export const LEGAL_COMPARISON_ITEM_SEVERITIES = ["low", "medium", "high", "critical"] as const;

export const LEGAL_COMPARISON_ITEM_REVIEW_STATUSES = [
  "unreviewed",
  "confirmed",
  "rejected",
  "corrected",
] as const;

export const createLegalComparisonSchema = z.object({
  comparisonType: z.enum(LEGAL_COMPARISON_TYPES),
  legalMatterId: optionalUuid,
  title: z.string().trim().min(2).max(300).optional(),
  sources: z
    .array(
      z.object({
        documentId: uuid,
        documentVersionId: optionalUuid,
        roleInComparison: z.enum(LEGAL_COMPARISON_SOURCE_ROLES).default("other"),
        sortOrder: z.number().int().min(0).max(10_000).default(0),
      }),
    )
    .min(2)
    .max(20),
  idempotencyKey: idempotencyKey.optional(),
});

export const legalComparisonListQuerySchema = z.object({
  legalMatterId: optionalUuid,
  comparisonType: z.enum(LEGAL_COMPARISON_TYPES).optional(),
  status: z.enum(LEGAL_COMPARISON_STATUSES).optional(),
  limit,
  offset,
});

export const runLegalComparisonSchema = z.object({
  idempotencyKey: idempotencyKey.optional(),
});

export const reviewLegalComparisonItemSchema = z.object({
  reviewStatus: z.enum(LEGAL_COMPARISON_ITEM_REVIEW_STATUSES),
  reviewerComment: z.string().trim().max(4000).optional(),
});

export const reviewLegalComparisonSchema = z.object({
  reviewComment: z.string().trim().max(4000).optional(),
  status: z.enum(["human_review", "reviewed", "closed"]).default("reviewed"),
});
