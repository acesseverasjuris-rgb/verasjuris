import { z } from "zod";

/**
 * Saída estruturada da análise jurídica assistida (espelha as tabelas `legal_analysis_*`).
 * Regras de produto:
 *  - É apoio assistivo, nunca parecer definitivo: todo item nasce `unreviewed`.
 *  - Fundamentação PRESENTE no documento (com fonte) é separada de fundamentação SUGERIDA pela IA
 *    (sempre com `requiresHumanVerification: true`).
 *  - Valores monetários são centavos inteiros; datas são ISO (AAAA-MM-DD) válidas.
 */

const confidence = z.number().int().min(0).max(100);
const text = (max = 4_000) => z.string().trim().min(1).max(max);
const optionalText = (max = 2_000) => z.string().trim().min(1).max(max).optional();
const page = z.number().int().positive().max(100_000).optional();

/** Referência à fonte dentro dos documentos analisados. */
const source = {
  sourceLabel: optionalText(300),
  pageNumber: page,
};

export const DISPUTE_STATUSES = ["undisputed", "disputed", "unknown"] as const;
export const GROUND_KINDS = ["present_in_document", "suggested_by_ai"] as const;
export const CONTRADICTION_SEVERITIES = ["low", "medium", "high"] as const;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD.")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
  }, "Data inexistente no calendário.");

export const legalFactSchema = z
  .object({
    text: text(),
    category: optionalText(120),
    disputeStatus: z.enum(DISPUTE_STATUSES).default("unknown"),
    confidence,
    ...source,
  })
  .strict();

export const legalClaimSchema = z
  .object({
    text: text(),
    claimType: optionalText(120),
    relatedParty: optionalText(300),
    observation: optionalText(),
    ...source,
  })
  .strict();

/** Fundamento que consta no documento: exige fonte localizável. */
export const legalGroundPresentSchema = z
  .object({
    kind: z.literal("present_in_document"),
    text: text(),
    sourceLabel: text(300),
    pageNumber: page,
    confidence,
  })
  .strict();

/** Fundamento sugerido pela IA: nunca apresentado como constante no documento. */
export const legalGroundSuggestedSchema = z
  .object({
    kind: z.literal("suggested_by_ai"),
    text: text(),
    confidence,
    requiresHumanVerification: z.literal(true),
  })
  .strict();

export const legalEvidenceSchema = z
  .object({
    proposition: text(),
    /** Índice (0-based) do fato relacionado em `facts`, quando houver. */
    factIndex: z.number().int().nonnegative().optional(),
    claimIndex: z.number().int().nonnegative().optional(),
    excerptReference: optionalText(500),
    relevance: optionalText(500),
    ...source,
  })
  .strict();

export const legalContradictionSchema = z
  .object({
    statementA: text(),
    sourceA: optionalText(300),
    statementB: text(),
    sourceB: optionalText(300),
    explanation: optionalText(),
    severity: z.enum(CONTRADICTION_SEVERITIES).default("medium"),
    confidence,
  })
  .strict();

export const legalDateSchema = z
  .object({
    dateValue: isoDate,
    dateType: optionalText(120),
    description: optionalText(),
    sourcePage: page,
    confidence,
  })
  .strict();

export const legalPartySchema = z
  .object({
    name: text(300),
    inferredRole: optionalText(120),
    confidence,
    ...source,
  })
  .strict();

export const legalAmountSchema = z
  .object({
    originalText: text(300),
    /** Centavos inteiros; nunca float. */
    amountCents: z.number().int().nonnegative().safe().nullable(),
    currency: z.string().trim().length(3).default("BRL"),
    context: optionalText(),
    confidence,
    ...source,
  })
  .strict();

export const legalObligationSchema = z
  .object({
    obligor: optionalText(300),
    beneficiary: optionalText(300),
    action: text(),
    condition: optionalText(),
    deadlineText: optionalText(300),
    amountCents: z.number().int().nonnegative().safe().nullable().optional(),
    confidence,
    ...source,
  })
  .strict();

export const legalMissingInformationSchema = z
  .object({
    category: text(120),
    description: text(),
  })
  .strict();

export const LEGAL_ANALYSIS_SCHEMA_VERSION = "1" as const;

export const legalAnalysisOutputSchema = z
  .object({
    schemaVersion: z.literal(LEGAL_ANALYSIS_SCHEMA_VERSION),
    summary: optionalText(4_000),
    facts: z.array(legalFactSchema).max(200),
    claims: z.array(legalClaimSchema).max(100),
    groundsPresent: z.array(legalGroundPresentSchema).max(100),
    groundsSuggested: z.array(legalGroundSuggestedSchema).max(100),
    evidence: z.array(legalEvidenceSchema).max(200),
    contradictions: z.array(legalContradictionSchema).max(100),
    dates: z.array(legalDateSchema).max(200),
    parties: z.array(legalPartySchema).max(100),
    amounts: z.array(legalAmountSchema).max(200),
    obligations: z.array(legalObligationSchema).max(200),
    missingInformation: z.array(legalMissingInformationSchema).max(100),
  })
  .strict()
  .superRefine((value, ctx) => {
    value.evidence.forEach((item, index) => {
      if (item.factIndex !== undefined && item.factIndex >= value.facts.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["evidence", index, "factIndex"],
          message: "factIndex referencia um fato inexistente.",
        });
      }
      if (item.claimIndex !== undefined && item.claimIndex >= value.claims.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["evidence", index, "claimIndex"],
          message: "claimIndex referencia um pedido inexistente.",
        });
      }
    });
  });

export type LegalAnalysisOutput = z.infer<typeof legalAnalysisOutputSchema>;
export type LegalFact = z.infer<typeof legalFactSchema>;
export type LegalClaim = z.infer<typeof legalClaimSchema>;
export type LegalGroundPresent = z.infer<typeof legalGroundPresentSchema>;
export type LegalGroundSuggested = z.infer<typeof legalGroundSuggestedSchema>;
export type LegalEvidence = z.infer<typeof legalEvidenceSchema>;
export type LegalContradiction = z.infer<typeof legalContradictionSchema>;
export type LegalDate = z.infer<typeof legalDateSchema>;
export type LegalParty = z.infer<typeof legalPartySchema>;
export type LegalAmount = z.infer<typeof legalAmountSchema>;
export type LegalObligation = z.infer<typeof legalObligationSchema>;
export type LegalMissingInformation = z.infer<typeof legalMissingInformationSchema>;

export const LEGAL_ANALYSIS_INSTRUCTIONS = [
  "Analise o(s) documento(s) jurídicos fornecidos e extraia, sem inventar nada, as seções:",
  "facts, claims, groundsPresent (somente o que consta no documento, com fonte), groundsSuggested",
  "(sugestões suas, sempre com requiresHumanVerification=true), evidence, contradictions, dates (AAAA-MM-DD),",
  "parties, amounts (em centavos inteiros), obligations e missingInformation.",
  "Use schemaVersion '1'. Registre o que faltar em missingInformation em vez de supor.",
  "O resultado é apoio assistivo para revisão por advogado(a), não parecer jurídico.",
].join("\n");
