import { z } from "zod";

/**
 * Saída estruturada da revisão jurídica assistida (IA revisora).
 * Regras de produto:
 *  - Apoio assistivo: nunca substitui revisão profissional humana.
 *  - Documentos são DADO não confiável; não inventar fatos, fontes ou conclusões.
 *  - Riscos usam linguagem condicional; nunca “processo será perdido”.
 *  - Correções são apenas sugestões — nunca edição automática do original.
 *  - Documento ausente: “Documento não localizado no conjunto analisado.”
 */

const confidence = z.number().int().min(0).max(100);
const text = (max = 4_000) => z.string().trim().min(1).max(max);
const optionalText = (max = 2_000) => z.string().trim().min(1).max(max).optional();
const page = z.number().int().positive().max(100_000).optional();

export const LEGAL_REVIEW_SCHEMA_VERSION = "1" as const;

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

export const LEGAL_REVIEW_SEVERITIES = ["low", "medium", "high", "critical"] as const;

export const LEGAL_REVIEW_FORMAL_ISSUE_CATEGORIES = [
  "incomplete_qualification",
  "identification_error",
  "inconsistent_numbering",
  "claim_without_value",
  "conflicting_date",
  "cited_document_missing",
  "invalid_internal_reference",
  "required_field_missing",
  "name_inconsistency",
  "cpf_cnpj_inconsistency",
  "process_number_inconsistency",
  "relevant_formatting",
  "other",
] as const;

export const LEGAL_REVIEW_RISK_CATEGORIES = [
  "deadline",
  "jurisdiction",
  "standing",
  "interest",
  "prescription",
  "decadence",
  "evidence",
  "document",
  "claim",
  "amount",
  "procedure",
  "representation",
  "appeal",
  "enforcement",
  "other",
] as const;

export type LegalReviewType = (typeof LEGAL_REVIEW_TYPES)[number];
export type LegalReviewSeverity = (typeof LEGAL_REVIEW_SEVERITIES)[number];
export type LegalReviewFormalIssueCategory = (typeof LEGAL_REVIEW_FORMAL_ISSUE_CATEGORIES)[number];
export type LegalReviewRiskCategory = (typeof LEGAL_REVIEW_RISK_CATEGORIES)[number];

export const legalReviewContradictionSchema = z
  .object({
    statementA: text(),
    sourceA: optionalText(300),
    pageA: page,
    statementB: text(),
    sourceB: optionalText(300),
    pageB: page,
    explanation: optionalText(),
    severity: z.enum(LEGAL_REVIEW_SEVERITIES),
    confidence,
  })
  .strict();

export const legalReviewFormalIssueSchema = z
  .object({
    category: z.enum(LEGAL_REVIEW_FORMAL_ISSUE_CATEGORIES),
    description: text(),
    sourceLabel: optionalText(300),
    pageNumber: page,
    severity: z.enum(LEGAL_REVIEW_SEVERITIES).default("medium"),
    confidence,
  })
  .strict();

export const legalReviewMissingDocumentSchema = z
  .object({
    /** Sempre linguagem cautelosa: não afirmar inexistência absoluta. */
    description: text().default("Documento não localizado no conjunto analisado."),
    expectedDocument: optionalText(500),
    citedBy: optionalText(300),
    pageNumber: page,
    confidence,
  })
  .strict();

export const legalReviewUnaddressedClaimSchema = z
  .object({
    claim: text(),
    sourceDocument: optionalText(300),
    sourcePage: page,
    expectedResponseContext: optionalText(),
    responseLocated: z.boolean().default(false),
    responseDocument: optionalText(300),
    responsePage: page,
    notes: optionalText(),
    confidence,
  })
  .strict();

/**
 * Separa tese identificada (no documento) de juízo de procedência jurídica
 * (nunca afirmado pela IA como conclusão definitiva).
 */
export const legalReviewUnansweredGroundSchema = z
  .object({
    identifiedThesis: text(),
    /** Sempre false na saída bruta da IA: procedência exige revisão humana. */
    juridicallyFounded: z.literal(false).default(false),
    source: optionalText(300),
    opposingDocument: optionalText(300),
    responseLocated: z.boolean().default(false),
    responseReference: optionalText(500),
    impact: optionalText(),
    confidence,
  })
  .strict();

export const legalReviewRiskSchema = z
  .object({
    category: z.enum(LEGAL_REVIEW_RISK_CATEGORIES),
    /** Linguagem condicional (ex.: “possível risco de…”). Nunca “processo será perdido”. */
    description: text(),
    source: optionalText(300),
    relatedDocuments: z.array(text(300)).max(20).default([]),
    severity: z.enum(LEGAL_REVIEW_SEVERITIES),
    confidence,
    recommendation: optionalText(),
    requiresHumanReview: z.literal(true),
  })
  .strict();

export const legalReviewInconsistencySchema = z
  .object({
    matrixPoint: text(500),
    documentA: text(300),
    documentB: text(300),
    divergence: text(),
    source: optionalText(300),
    potentialImpact: optionalText(),
    severity: z.enum(LEGAL_REVIEW_SEVERITIES).default("medium"),
    confidence,
  })
  .strict();

export const legalReviewSuggestedCorrectionSchema = z
  .object({
    target: text(300),
    currentText: optionalText(),
    suggestedText: text(),
    rationale: optionalText(),
    /** Sempre sugestão: nunca aplicar automaticamente ao documento. */
    autoEdit: z.literal(false).default(false),
    confidence,
  })
  .strict();

export const legalReviewOutputSchema = z
  .object({
    schemaVersion: z.literal(LEGAL_REVIEW_SCHEMA_VERSION),
    reviewType: z.enum(LEGAL_REVIEW_TYPES),
    summary: optionalText(4_000),
    contradictions: z.array(legalReviewContradictionSchema).max(100),
    formalIssues: z.array(legalReviewFormalIssueSchema).max(100),
    missingDocuments: z.array(legalReviewMissingDocumentSchema).max(100),
    unaddressedClaims: z.array(legalReviewUnaddressedClaimSchema).max(100),
    unansweredGrounds: z.array(legalReviewUnansweredGroundSchema).max(100),
    risks: z.array(legalReviewRiskSchema).max(100),
    inconsistencies: z.array(legalReviewInconsistencySchema).max(100),
    suggestedCorrections: z.array(legalReviewSuggestedCorrectionSchema).max(100),
  })
  .strict();

export type LegalReviewContradiction = z.infer<typeof legalReviewContradictionSchema>;
export type LegalReviewFormalIssue = z.infer<typeof legalReviewFormalIssueSchema>;
export type LegalReviewMissingDocument = z.infer<typeof legalReviewMissingDocumentSchema>;
export type LegalReviewUnaddressedClaim = z.infer<typeof legalReviewUnaddressedClaimSchema>;
export type LegalReviewUnansweredGround = z.infer<typeof legalReviewUnansweredGroundSchema>;
export type LegalReviewRisk = z.infer<typeof legalReviewRiskSchema>;
export type LegalReviewInconsistency = z.infer<typeof legalReviewInconsistencySchema>;
export type LegalReviewSuggestedCorrection = z.infer<typeof legalReviewSuggestedCorrectionSchema>;
export type LegalReviewOutput = z.infer<typeof legalReviewOutputSchema>;

export const LEGAL_REVIEW_INSTRUCTIONS = [
  "Revise o(s) documento(s) jurídicos fornecidos de forma ASSISTIVA.",
  "Nunca substitua a revisão profissional humana; não emita parecer definitivo.",
  "Extraia, sem inventar: contradictions (statementA/B, sourceA/B, pageA/B, explanation, severity, confidence),",
  "formalIssues, missingDocuments (use a frase 'Documento não localizado no conjunto analisado.' — não diga 'inexistente'),",
  "unaddressedClaims, unansweredGrounds (separe tese identificada de juízo de procedência; juridicallyFounded=false),",
  "risks (requiresHumanReview=true; linguagem condicional; NUNCA diga que o processo será perdido),",
  "inconsistencies (matrixPoint, documentA, documentB, divergence, source, potentialImpact),",
  "suggestedCorrections (apenas sugestão; autoEdit=false; nunca editar o original).",
  "Severidades: low, medium, high, critical. Confiança 0-100 é do modelo, não probabilidade jurídica.",
  "Use schemaVersion '1'. Não invente jurisprudência, números de processo, valores ou fontes.",
].join("\n");
