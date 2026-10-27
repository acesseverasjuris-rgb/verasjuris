import { z } from "zod";

/**
 * Comparador jurídico assistivo (feature `legal_comparison`).
 * Linguagem sempre assistiva: nunca afirmar omissão definitiva sem revisão humana.
 */

const confidence = z.number().int().min(0).max(100);
const text = (max = 4_000) => z.string().trim().min(1).max(max);
const optionalText = (max = 2_000) => z.string().trim().min(1).max(max).optional();

export const LEGAL_COMPARISON_SCHEMA_VERSION = "1" as const;

export const LEGAL_COMPARISON_FEATURE = "legal_comparison" as const;

export const LEGAL_COMPARISON_TYPES = [
  "petition_vs_defense",
  "evidence_vs_allegations",
  "claim_vs_decision",
  "judgment_vs_appeal",
  "admin_process_vs_judicial_action",
] as const;

export type LegalComparisonType = (typeof LEGAL_COMPARISON_TYPES)[number];

export const LEGAL_COMPARISON_SEVERITIES = ["low", "medium", "high", "critical"] as const;

export type LegalComparisonSeverity = (typeof LEGAL_COMPARISON_SEVERITIES)[number];

export const LEGAL_COMPARISON_CATEGORIES = [
  "facts",
  "claims",
  "preliminary",
  "thesis",
  "challenge",
  "documents",
  "undisputed",
  "divergence",
  "possible_omission",
  "evidence_favorable",
  "evidence_contrary",
  "evidence_absent",
  "decision_granted",
  "decision_denied",
  "decision_partial",
  "possibly_unaddressed",
  "judgment_chapter",
  "appeal_ground",
  "appeal_gap",
  "admin_vs_judicial",
  "new_facts",
  "new_evidence",
  "other",
] as const;

export type LegalComparisonCategory = (typeof LEGAL_COMPARISON_CATEGORIES)[number];

export const legalComparisonProvenanceSchema = z
  .object({
    sourceALabel: optionalText(300),
    sourceBLabel: optionalText(300),
    pageA: z.number().int().positive().max(100_000).optional(),
    pageB: z.number().int().positive().max(100_000).optional(),
    excerptA: optionalText(2_000),
    excerptB: optionalText(2_000),
    notes: optionalText(1_000),
  })
  .strict();

export const legalComparisonItemSchema = z
  .object({
    category: z.enum(LEGAL_COMPARISON_CATEGORIES),
    sourceA: text(2_000),
    sourceB: text(2_000),
    /** Achado assistivo; nunca omissão definitiva. */
    finding: text(),
    severity: z.enum(LEGAL_COMPARISON_SEVERITIES),
    confidence,
    /** Proveniência obrigatória para rastrear fontes do achado. */
    provenance: legalComparisonProvenanceSchema,
  })
  .strict();

export const legalComparisonOutputSchema = z
  .object({
    schemaVersion: z.literal(LEGAL_COMPARISON_SCHEMA_VERSION),
    comparisonType: z.enum(LEGAL_COMPARISON_TYPES),
    summary: optionalText(4_000),
    items: z.array(legalComparisonItemSchema).max(200),
    /** Pontos que exigem revisão humana (ex.: possível omissão). */
    requiresHumanReview: z.array(text(2_000)).max(100).default([]),
  })
  .strict();

export type LegalComparisonProvenance = z.infer<typeof legalComparisonProvenanceSchema>;
export type LegalComparisonItem = z.infer<typeof legalComparisonItemSchema>;
export type LegalComparisonOutput = z.infer<typeof legalComparisonOutputSchema>;

const SHARED_COMPARISON_RULES = [
  "Compare as fontes fornecidas de forma ASSISTIVA.",
  "Nunca afirme omissão definitiva, procedência ou improcedência sem revisão humana.",
  "Use linguagem condicional para lacunas (ex.: 'possível ponto não enfrentado').",
  "Cada item exige category, sourceA, sourceB, finding, severity, confidence e provenance.",
  "Não invente trechos, páginas, números de processo ou jurisprudência.",
  "confidence 0-100 é do modelo. Use schemaVersion '1'.",
].join("\n");

export const LEGAL_COMPARISON_TYPE_INSTRUCTIONS: Readonly<Record<LegalComparisonType, string>> = {
  petition_vs_defense: [
    "Compare petição e contestação: fatos, pedidos, preliminares, teses, impugnações,",
    "documentos, pontos incontroversos, divergências e possíveis omissões.",
    SHARED_COMPARISON_RULES,
  ].join("\n"),
  evidence_vs_allegations: [
    "Monte matriz alegação → prova favorável / contrária / ausente no conjunto,",
    "com fonte e necessidade de revisão.",
    SHARED_COMPARISON_RULES,
  ].join("\n"),
  claim_vs_decision: [
    "Relacione pedido e decisão correspondente: acolhido, rejeitado,",
    "parcialmente enfrentado ou possivelmente não enfrentado.",
    "NÃO afirme omissão definitiva.",
    SHARED_COMPARISON_RULES,
  ].join("\n"),
  judgment_vs_appeal: [
    "Compare capítulos da sentença com o recurso: fundamentos atacados/não atacados,",
    "pedidos recursais, possíveis lacunas e risco de ausência de impugnação específica.",
    SHARED_COMPARISON_RULES,
  ].join("\n"),
  admin_process_vs_judicial_action: [
    "Compare processo administrativo e ação judicial: fatos, pedidos, decisão administrativa,",
    "documentos, fundamentos, diferenças, fatos/provas novos e pontos não levados à via administrativa.",
    SHARED_COMPARISON_RULES,
  ].join("\n"),
};

export const LEGAL_COMPARISON_INSTRUCTIONS = [
  "Execute comparação jurídica assistiva conforme o comparisonType informado.",
  SHARED_COMPARISON_RULES,
].join("\n");
