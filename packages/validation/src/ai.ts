import { z } from "zod";

/**
 * Validação de entrada dos módulos de IA, inteligência documental, análise jurídica assistida e
 * oportunidades públicas (Etapa 6). Valores monetários são sempre inteiros (micros ou centavos).
 */

const uuid = z.string().uuid("O identificador não é válido.");
const optionalUuid = uuid.optional();
const datetime = z.string().datetime({ offset: true });
const microsInt = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const limit = z.coerce.number().int().min(1).max(100).default(20);
const offset = z.coerce.number().int().min(0).max(10_000).default(0);
const idempotencyKey = z.string().trim().min(8).max(200);
const q = z.string().trim().min(1).max(200);

/* ─── IA: uso, jobs, orçamento, prompts ─── */

export const aiUsageQuerySchema = z.object({
  feature: z.string().trim().min(1).max(80).optional(),
  from: datetime.optional(),
  to: datetime.optional(),
  limit,
  offset,
});

export const aiRequestListQuerySchema = z.object({
  feature: z.string().trim().min(1).max(80).optional(),
  status: z
    .enum(["pending", "running", "succeeded", "failed", "cancelled", "not_configured"])
    .optional(),
  limit,
  offset,
});

export const aiJobListQuerySchema = z.object({
  status: z
    .enum(["pending", "queued", "running", "succeeded", "failed", "cancelled", "not_configured"])
    .optional(),
  jobType: z.string().trim().min(1).max(80).optional(),
  limit,
  offset,
});

export const upsertAiBudgetSchema = z
  .object({
    period: z.enum(["daily", "monthly"]),
    softLimitMicros: microsInt.nullable().optional(),
    hardLimitMicros: microsInt.nullable().optional(),
    currency: z.string().trim().length(3).default("BRL"),
    active: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (
      value.softLimitMicros != null &&
      value.hardLimitMicros != null &&
      value.softLimitMicros > value.hardLimitMicros
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["softLimitMicros"],
        message: "O limite suave não pode exceder o limite rígido.",
      });
    }
  });

const promptKey = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(/^[a-z][a-z0-9_.-]*$/, "Use letras minúsculas, números, ponto, hífen ou sublinhado.");

export const aiPromptKeyParamSchema = promptKey;
export const aiPromptVersionParamSchema = z.coerce.number().int().min(1).max(100_000);

export const createAiPromptVersionSchema = z.object({
  key: promptKey,
  name: z.string().trim().min(2).max(160),
  feature: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1000).optional(),
  systemTemplate: z.string().trim().min(10).max(20_000),
  userTemplate: z.string().trim().max(20_000).default(""),
  safetyInstructions: z.string().trim().max(5000).optional(),
  changelog: z.string().trim().max(2000).optional(),
});

/* ─── Inteligência documental ─── */

export const processDocumentVersionSchema = z.object({
  strategy: z.enum(["auto", "native_only", "ocr"]).default("auto"),
  force: z.boolean().default(false),
});

const documentKind = z.enum([
  "identification",
  "evidence",
  "contract",
  "petition",
  "decision",
  "report",
  "power_of_attorney",
  "administrative",
  "correspondence",
  "other",
]);

export const classifyDocumentManualSchema = z.object({
  kind: documentKind,
  versionId: optionalUuid,
});

export const suggestDocumentClassificationSchema = z.object({
  versionId: optionalUuid,
  idempotencyKey: idempotencyKey.optional(),
});

export const reviewDocumentClassificationSchema = z
  .object({
    action: z.enum(["accept", "reject", "correct"]),
    kind: documentKind.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === "correct" && !value.kind) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["kind"],
        message: "Informe o tipo corrigido.",
      });
    }
  });

export const createDocumentMetadataSchema = z.object({
  versionId: optionalUuid,
  fieldKey: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[A-Za-z][A-Za-z0-9_.-]*$/, "Use letras, números, ponto, hífen ou sublinhado."),
  value: z.string().trim().min(1).max(2000),
  sourcePage: z.number().int().positive().max(100_000).optional(),
});

export const reviewDocumentMetadataSchema = z
  .object({
    action: z.enum(["reviewed", "corrected", "rejected"]),
    correctedValue: z.string().trim().min(1).max(2000).optional(),
    comment: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === "corrected" && !value.correctedValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correctedValue"],
        message: "Informe o valor corrigido.",
      });
    }
  });

export const documentPagesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset,
});

export const documentTextSearchQuerySchema = z.object({
  q,
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset,
});

/* ─── Análise jurídica assistida ─── */

export const LEGAL_ANALYSIS_TYPES = [
  "case_summary",
  "document_analysis",
  "facts_and_claims",
  "contradictions",
  "full_review",
] as const;

export const createLegalAnalysisSchema = z
  .object({
    analysisType: z.enum(LEGAL_ANALYSIS_TYPES).default("document_analysis"),
    legalMatterId: optionalUuid,
    judicialProcessId: optionalUuid,
    administrativeProcessId: optionalUuid,
    documentId: optionalUuid,
    idempotencyKey: idempotencyKey.optional(),
  })
  .superRefine((value, ctx) => {
    if (
      !value.legalMatterId &&
      !value.judicialProcessId &&
      !value.administrativeProcessId &&
      !value.documentId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["documentId"],
        message: "Informe um documento, caso ou processo para analisar.",
      });
    }
  });

export const legalAnalysisListQuerySchema = z.object({
  legalMatterId: optionalUuid,
  documentId: optionalUuid,
  analysisType: z.enum(LEGAL_ANALYSIS_TYPES).optional(),
  status: z
    .enum([
      "pending",
      "running",
      "succeeded",
      "failed",
      "cancelled",
      "not_configured",
      "requires_review",
      "reviewed",
    ])
    .optional(),
  limit,
  offset,
});

export const LEGAL_ANALYSIS_SECTIONS = [
  "facts",
  "claims",
  "grounds",
  "evidence",
  "contradictions",
  "dates",
  "parties",
  "amounts",
  "obligations",
  "missing",
] as const;

export const legalAnalysisSectionSchema = z.enum(LEGAL_ANALYSIS_SECTIONS);

export const reviewLegalAnalysisItemSchema = z
  .object({
    action: z.enum(["accept", "reject", "correct"]),
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

export const reviewLegalAnalysisSchema = z.object({
  comment: z.string().trim().max(2000).optional(),
});

/* ─── Oportunidades públicas ─── */

export const PUBLIC_OPPORTUNITY_TYPE_VALUES = [
  "tender",
  "public_call",
  "accreditation",
  "partnership",
  "concession",
  "grant",
  "program",
  "notice",
  "other",
] as const;

export const PUBLIC_OPPORTUNITY_STATUS_VALUES = [
  "draft",
  "published",
  "open",
  "closed",
  "cancelled",
  "archived",
] as const;

const opportunityType = z.enum(PUBLIC_OPPORTUNITY_TYPE_VALUES);
const opportunityStatus = z.enum(PUBLIC_OPPORTUNITY_STATUS_VALUES);
const interestStatus = z.enum([
  "saved",
  "reviewing",
  "interested",
  "preparing",
  "submitted",
  "not_interested",
  "won",
  "lost",
  "archived",
]);
const requirementStatus = z.enum(["pending", "met", "not_met", "waived", "unknown"]);
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

export const createPublicOpportunitySchema = z.object({
  opportunityType: opportunityType.default("tender"),
  title: z.string().trim().min(2).max(300),
  object: z.string().trim().min(2).max(8000),
  description: z.string().trim().max(20_000).optional(),
  publicBodyId: optionalUuid,
  processNumber: z.string().trim().max(120).optional(),
  procurementNumber: z.string().trim().max(120).optional(),
  modality: z.string().trim().max(120).optional(),
  estimatedValueCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  currency: z.string().trim().length(3).default("BRL"),
  publicationDate: datetime.optional(),
  proposalDeadline: datetime.optional(),
  status: opportunityStatus.default("draft"),
  region: z.string().trim().max(120).optional(),
  stateCode: stateCode.optional(),
  municipality: z.string().trim().max(200).optional(),
  /** Referência informada pelo usuário (ex.: link do edital); não torna a fonte oficial. */
  sourceUrl: httpsUrl.optional(),
  sourceReference: z.string().trim().max(200).optional(),
});

export const updatePublicOpportunitySchema = z
  .object({
    opportunityType: opportunityType.optional(),
    title: z.string().trim().min(2).max(300).optional(),
    object: z.string().trim().min(2).max(8000).optional(),
    description: z.string().trim().max(20_000).nullable().optional(),
    publicBodyId: uuid.nullable().optional(),
    processNumber: z.string().trim().max(120).nullable().optional(),
    procurementNumber: z.string().trim().max(120).nullable().optional(),
    modality: z.string().trim().max(120).nullable().optional(),
    estimatedValueCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable().optional(),
    publicationDate: datetime.nullable().optional(),
    proposalDeadline: datetime.nullable().optional(),
    status: opportunityStatus.optional(),
    region: z.string().trim().max(120).nullable().optional(),
    stateCode: stateCode.nullable().optional(),
    municipality: z.string().trim().max(200).nullable().optional(),
    sourceUrl: httpsUrl.nullable().optional(),
    sourceReference: z.string().trim().max(200).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const publicOpportunityListQuerySchema = z.object({
  q: q.optional(),
  opportunityType: opportunityType.optional(),
  status: opportunityStatus.optional(),
  stateCode: stateCode.optional(),
  publicBodyId: optionalUuid,
  deadlineFrom: datetime.optional(),
  deadlineTo: datetime.optional(),
  interestStatus: interestStatus.optional(),
  onlySaved: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  limit,
  offset,
});

export const upsertPublicOpportunityInterestSchema = z.object({
  status: interestStatus.default("saved"),
  notes: z.string().trim().max(4000).nullable().optional(),
});

export const publicOpportunityInterestListQuerySchema = z.object({
  status: interestStatus.optional(),
  limit,
  offset,
});

export const createPublicOpportunityRequirementSchema = z.object({
  description: z.string().trim().min(2).max(2000),
  category: z.string().trim().max(120).optional(),
  mandatory: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});

export const updatePublicOpportunityRequirementSchema = z
  .object({
    description: z.string().trim().min(2).max(2000).optional(),
    category: z.string().trim().max(120).nullable().optional(),
    mandatory: z.boolean().optional(),
    status: requirementStatus.optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    reviewComment: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const linkPublicOpportunityDocumentSchema = z.object({
  documentId: uuid,
  linkType: z.enum(["requirement", "proposal", "reference", "attachment"]).default("attachment"),
});

export const publicOpportunityProviderSearchSchema = z.object({
  text: q.optional(),
  stateCode: stateCode.optional(),
});
