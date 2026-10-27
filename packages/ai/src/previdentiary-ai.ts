import { z } from "zod";

/**
 * Features de IA previdenciária — explica/sugere apenas.
 * Nunca inventa períodos/salários/CNIS; nunca calcula RMI como autoridade.
 */

export const PREVIDENTIARY_AI_FEATURES = [
  "previdentiary.document_analysis",
  "previdentiary.cnis_review",
  "previdentiary.missing_documents",
  "previdentiary.benefit_comparison_explanation",
  "previdentiary.calculation_review",
  "previdentiary.admin_request_draft",
] as const;

export type PrevidentiaryAiFeature = (typeof PREVIDENTIARY_AI_FEATURES)[number];

export const PREVIDENTIARY_AI_SCHEMA_VERSION = "1" as const;

const confidence = z.number().int().min(0).max(100);
const text = (max = 4_000) => z.string().trim().min(1).max(max);
const optionalText = (max = 2_000) => z.string().trim().min(1).max(max).optional();
const page = z.number().int().positive().max(100_000).optional();

const SHARED_PREVIDENTIARY_RULES = [
  "IA ASSISTIVA: explique e sugira apenas; nunca decida benefício, qualidade de segurado ou RMI final.",
  "NÃO invente períodos, salários, contribuições, indicadores CNIS ou números de benefício.",
  "NÃO modifique CNIS. NÃO calcule RMI/atrasados como autoridade — motores determinísticos fazem isso.",
  "Cite fonte (documento, página, cálculo, rule set) quando disponível; lacunas = ausentes no material.",
  "Saída exige revisão humana. Use schemaVersion '1'.",
].join("\n");

export const previdentiaryFindingSchema = z
  .object({
    summary: text(),
    sourceLabel: optionalText(300),
    pageNumber: page,
    confidence,
    requiresHumanReview: z.literal(true),
  })
  .strict();

export const previdentiaryAiOutputSchema = z
  .object({
    schemaVersion: z.literal(PREVIDENTIARY_AI_SCHEMA_VERSION),
    feature: z.enum(PREVIDENTIARY_AI_FEATURES),
    findings: z.array(previdentiaryFindingSchema).max(100).default([]),
    missingItems: z.array(text(500)).max(100).default([]),
    suggestions: z.array(text(2_000)).max(100).default([]),
    unresolvedPoints: z.array(text(2_000)).max(100).default([]),
    confidence,
  })
  .strict();

export type PrevidentiaryFinding = z.infer<typeof previdentiaryFindingSchema>;
export type PrevidentiaryAiOutput = z.infer<typeof previdentiaryAiOutputSchema>;

export const PREVIDENTIARY_DOCUMENT_ANALYSIS_INSTRUCTIONS = [
  "Analise o documento previdenciário e extraia achados assistivos (datas, valores mencionados, lacunas).",
  SHARED_PREVIDENTIARY_RULES,
].join("\n");

export const PREVIDENTIARY_CNIS_REVIEW_INSTRUCTIONS = [
  "Revise o CNIS fornecido: sinalize inconsistências e lacunas possíveis.",
  "Não altere nem invente competências/salários/indicadores.",
  SHARED_PREVIDENTIARY_RULES,
].join("\n");

export const PREVIDENTIARY_MISSING_DOCUMENTS_INSTRUCTIONS = [
  "Liste documentos potencialmente ausentes com base apenas no material fornecido.",
  "Não invente exigências oficiais sem fonte no contexto.",
  SHARED_PREVIDENTIARY_RULES,
].join("\n");

export const PREVIDENTIARY_BENEFIT_COMPARISON_EXPLANATION_INSTRUCTIONS = [
  "Explique diferenças entre cenários de benefício já calculados deterministicamente.",
  "Não recomende 'melhor benefício definitivo'; use linguagem estimativa.",
  SHARED_PREVIDENTIARY_RULES,
].join("\n");

export const PREVIDENTIARY_CALCULATION_REVIEW_INSTRUCTIONS = [
  "Revise memória/resultado de cálculo previdenciário já produzido pelo motor determinístico.",
  "Aponte inconsistências e dados faltantes; não recalcule RMI como autoridade via LLM.",
  SHARED_PREVIDENTIARY_RULES,
].join("\n");

export const PREVIDENTIARY_ADMIN_REQUEST_DRAFT_INSTRUCTIONS = [
  "Auxilie minuta de requerimento administrativo previdenciário de forma assistiva.",
  "Não invente fatos, períodos ou salários ausentes no contexto.",
  SHARED_PREVIDENTIARY_RULES,
].join("\n");

export const PREVIDENTIARY_FEATURE_INSTRUCTIONS: Readonly<Record<PrevidentiaryAiFeature, string>> =
  {
    "previdentiary.document_analysis": PREVIDENTIARY_DOCUMENT_ANALYSIS_INSTRUCTIONS,
    "previdentiary.cnis_review": PREVIDENTIARY_CNIS_REVIEW_INSTRUCTIONS,
    "previdentiary.missing_documents": PREVIDENTIARY_MISSING_DOCUMENTS_INSTRUCTIONS,
    "previdentiary.benefit_comparison_explanation":
      PREVIDENTIARY_BENEFIT_COMPARISON_EXPLANATION_INSTRUCTIONS,
    "previdentiary.calculation_review": PREVIDENTIARY_CALCULATION_REVIEW_INSTRUCTIONS,
    "previdentiary.admin_request_draft": PREVIDENTIARY_ADMIN_REQUEST_DRAFT_INSTRUCTIONS,
  };
