import { z } from "zod";

/**
 * Features de IA trabalhista — explica/sugere apenas.
 * Nunca inventa jornada/salários; nunca calcula liquidação final como autoridade.
 */

export const LABOR_AI_FEATURES = [
  "labor.contract_analysis",
  "labor.time_record_analysis",
  "labor.payroll_analysis",
  "labor.claim_analysis",
  "labor.evidence_matrix",
  "labor.calculation_review",
  "labor.draft_assist",
] as const;

export type LaborAiFeature = (typeof LABOR_AI_FEATURES)[number];

export const LABOR_AI_SCHEMA_VERSION = "1" as const;

const confidence = z.number().int().min(0).max(100);
const text = (max = 4_000) => z.string().trim().min(1).max(max);
const optionalText = (max = 2_000) => z.string().trim().min(1).max(max).optional();
const page = z.number().int().positive().max(100_000).optional();

const SHARED_LABOR_RULES = [
  "IA ASSISTIVA: explique e sugere apenas; nunca confirme direito a verba nem liquidação final.",
  "NÃO invente jornada, salários, depósitos FGTS, vínculos ou pedidos.",
  "NÃO calcule liquidação/rescisão/FGTS como autoridade — motores determinísticos fazem isso.",
  "Cite fonte (documento, página, cálculo, rule set) quando disponível.",
  "Saída exige revisão humana. Use schemaVersion '1'.",
].join("\n");

export const laborFindingSchema = z
  .object({
    summary: text(),
    sourceLabel: optionalText(300),
    pageNumber: page,
    confidence,
    requiresHumanReview: z.literal(true),
  })
  .strict();

export const laborAiOutputSchema = z
  .object({
    schemaVersion: z.literal(LABOR_AI_SCHEMA_VERSION),
    feature: z.enum(LABOR_AI_FEATURES),
    findings: z.array(laborFindingSchema).max(100).default([]),
    missingItems: z.array(text(500)).max(100).default([]),
    suggestions: z.array(text(2_000)).max(100).default([]),
    unresolvedPoints: z.array(text(2_000)).max(100).default([]),
    confidence,
  })
  .strict();

export type LaborFinding = z.infer<typeof laborFindingSchema>;
export type LaborAiOutput = z.infer<typeof laborAiOutputSchema>;

export const LABOR_CONTRACT_ANALYSIS_INSTRUCTIONS = [
  "Analise o contrato de trabalho fornecido e extraia achados assistivos.",
  SHARED_LABOR_RULES,
].join("\n");

export const LABOR_TIME_RECORD_ANALYSIS_INSTRUCTIONS = [
  "Analise registros de ponto/jornada fornecidos; sinalize lacunas e inconsistências.",
  "Não invente horários ou horas extras.",
  SHARED_LABOR_RULES,
].join("\n");

export const LABOR_PAYROLL_ANALYSIS_INSTRUCTIONS = [
  "Analise holerites/folha fornecidos; não invente rubricas ou valores.",
  SHARED_LABOR_RULES,
].join("\n");

export const LABOR_CLAIM_ANALYSIS_INSTRUCTIONS = [
  "Organize pedidos trabalhistas com base no material; não confirme procedência.",
  SHARED_LABOR_RULES,
].join("\n");

export const LABOR_EVIDENCE_MATRIX_INSTRUCTIONS = [
  "Monte matriz assistiva fato×prova×pedido a partir do material fornecido.",
  "Lacunas devem ser explicitadas; não invente provas.",
  SHARED_LABOR_RULES,
].join("\n");

export const LABOR_CALCULATION_REVIEW_INSTRUCTIONS = [
  "Revise memória/resultado de cálculo trabalhista já produzido pelo motor determinístico.",
  "Não recalcule liquidação final como autoridade via LLM.",
  SHARED_LABOR_RULES,
].join("\n");

export const LABOR_DRAFT_ASSIST_INSTRUCTIONS = [
  "Auxilie minuta trabalhista de forma assistiva.",
  "Não invente fatos, jornadas ou valores ausentes no contexto.",
  SHARED_LABOR_RULES,
].join("\n");

export const LABOR_FEATURE_INSTRUCTIONS: Readonly<Record<LaborAiFeature, string>> = {
  "labor.contract_analysis": LABOR_CONTRACT_ANALYSIS_INSTRUCTIONS,
  "labor.time_record_analysis": LABOR_TIME_RECORD_ANALYSIS_INSTRUCTIONS,
  "labor.payroll_analysis": LABOR_PAYROLL_ANALYSIS_INSTRUCTIONS,
  "labor.claim_analysis": LABOR_CLAIM_ANALYSIS_INSTRUCTIONS,
  "labor.evidence_matrix": LABOR_EVIDENCE_MATRIX_INSTRUCTIONS,
  "labor.calculation_review": LABOR_CALCULATION_REVIEW_INSTRUCTIONS,
  "labor.draft_assist": LABOR_DRAFT_ASSIST_INSTRUCTIONS,
};
