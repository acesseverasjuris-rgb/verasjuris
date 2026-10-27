import { z } from "zod";

/**
 * Geração assistida de peças jurídicas (legal_draft.*).
 * Regras de produto:
 *  - Apoio assistivo: nunca substitui revisão/aprovação humana.
 *  - Não inventar jurisprudência, números de processo ou citações.
 *  - suggestedCitations só pode referenciar sourceIds fornecidos no contexto;
 *    sem lista verificada → array vazio.
 */

const confidence = z.number().int().min(0).max(100);
const text = (max = 8_000) => z.string().trim().min(1).max(max);
const optionalText = (max = 4_000) => z.string().trim().min(1).max(max).optional();
const sectionText = z.string().trim().max(50_000).default("");

export const LEGAL_DRAFT_SCHEMA_VERSION = "1" as const;

/** Features alinhadas ao gateway (`DEFAULT_AI_FEATURES`). */
export const LEGAL_DRAFT_FEATURES = [
  "legal_draft.initial_petition",
  "legal_draft.defense",
  "legal_draft.reply",
  "legal_draft.motion",
  "legal_draft.appeal",
  "legal_draft.counter_arguments",
  "legal_draft.opinion",
  "legal_draft.admin_request",
  "legal_draft.contract",
  "legal_draft.notice",
] as const;

export type LegalDraftFeature = (typeof LEGAL_DRAFT_FEATURES)[number];

export const LEGAL_DRAFT_SECTION_KEYS = [
  "addressing",
  "qualification",
  "facts",
  "grounds",
  "provisional_relief",
  "claims",
  "evidence",
  "final_requests",
  "closing",
  "signature_metadata",
] as const;

export type LegalDraftSectionKey = (typeof LEGAL_DRAFT_SECTION_KEYS)[number];

export const legalDraftSuggestedCitationSchema = z
  .object({
    /** Deve existir na lista de sourceIds verificados fornecidos ao modelo. */
    sourceId: z.string().trim().min(1).max(200),
    note: optionalText(1_000),
    confidence,
  })
  .strict();

export const legalDraftSectionsSchema = z
  .object({
    addressing: sectionText,
    qualification: sectionText,
    facts: sectionText,
    grounds: sectionText,
    provisional_relief: sectionText,
    claims: sectionText,
    evidence: sectionText,
    final_requests: sectionText,
    closing: sectionText,
    signature_metadata: sectionText,
  })
  .strict();

export const legalDraftOutputSchema = z
  .object({
    schemaVersion: z.literal(LEGAL_DRAFT_SCHEMA_VERSION),
    feature: z.enum(LEGAL_DRAFT_FEATURES),
    sections: legalDraftSectionsSchema,
    /**
     * Citações sugeridas. Sem sourceIds verificados no contexto → [].
     * Nunca inventar números de processo ou jurisprudência.
     */
    suggestedCitations: z.array(legalDraftSuggestedCitationSchema).max(100).default([]),
    unresolvedPoints: z.array(text(2_000)).max(100).default([]),
    confidence,
  })
  .strict();

export type LegalDraftSuggestedCitation = z.infer<typeof legalDraftSuggestedCitationSchema>;
export type LegalDraftSections = z.infer<typeof legalDraftSectionsSchema>;
export type LegalDraftOutput = z.infer<typeof legalDraftOutputSchema>;

/**
 * Garante que citações só referenciam sourceIds fornecidos.
 * Lista vazia de sourceIds ⇒ suggestedCitations deve ser vazia.
 */
export function filterSuggestedCitationsToSourceIds(
  citations: readonly LegalDraftSuggestedCitation[],
  allowedSourceIds: readonly string[],
): LegalDraftSuggestedCitation[] {
  if (allowedSourceIds.length === 0) return [];
  const allowed = new Set(allowedSourceIds);
  return citations.filter((item) => allowed.has(item.sourceId));
}

export function assertSuggestedCitationsFromSourceIds(
  output: LegalDraftOutput,
  allowedSourceIds: readonly string[],
): LegalDraftOutput {
  return {
    ...output,
    suggestedCitations: filterSuggestedCitationsToSourceIds(
      output.suggestedCitations,
      allowedSourceIds,
    ),
  };
}

export const LEGAL_DRAFT_INSTRUCTIONS = [
  "Gere uma minuta jurídica ASSISTIVA estruturada por seções.",
  "Nunca substitua revisão profissional humana; não emita parecer definitivo.",
  "NÃO invente jurisprudência, súmulas, números de processo, valores ou fatos.",
  "Citações (suggestedCitations): somente sourceIds da lista VERIFICADA fornecida no contexto.",
  "Se a lista de sourceIds verificados estiver vazia, suggestedCitations DEVE ser [].",
  "NUNCA invente números de processo (case numbers) nem invente fontes.",
  "Seções: addressing, qualification, facts, grounds, provisional_relief, claims,",
  "evidence, final_requests, closing, signature_metadata — adapte ao tipo de peça;",
  "seções inaplicáveis podem ficar vazias.",
  "Liste unresolvedPoints para lacunas que exigem input humano.",
  "confidence 0-100 é do modelo, não probabilidade jurídica. Use schemaVersion '1'.",
].join("\n");

export const LEGAL_DRAFT_FEATURE_INSTRUCTIONS: Readonly<Record<LegalDraftFeature, string>> = {
  "legal_draft.initial_petition": [
    "Elabore rascunho de petição inicial com endereçamento, qualificação, fatos,",
    "fundamentos, tutela (se cabível), pedidos, provas e requerimentos finais.",
    LEGAL_DRAFT_INSTRUCTIONS,
  ].join("\n"),
  "legal_draft.defense": [
    "Elabore rascunho de contestação/defesa respondendo aos fatos e pedidos da inicial,",
    "com preliminares e mérito quando o contexto indicar.",
    LEGAL_DRAFT_INSTRUCTIONS,
  ].join("\n"),
  "legal_draft.reply": [
    "Elabore rascunho de réplica, confrontando a defesa sem inventar fatos novos.",
    LEGAL_DRAFT_INSTRUCTIONS,
  ].join("\n"),
  "legal_draft.motion": [
    "Elabore rascunho de petição intermediária/requerimento processual (motion).",
    LEGAL_DRAFT_INSTRUCTIONS,
  ].join("\n"),
  "legal_draft.appeal": [
    "Elabore rascunho de peça recursal com capítulos atacados e pedidos recursais.",
    "Não afirme cabimento definitivo do recurso.",
    LEGAL_DRAFT_INSTRUCTIONS,
  ].join("\n"),
  "legal_draft.counter_arguments": [
    "Organize contra-argumentos assistivos às teses adversas, com fontes apenas verificadas.",
    LEGAL_DRAFT_INSTRUCTIONS,
  ].join("\n"),
  "legal_draft.opinion": [
    "Elabore parecer/opinião jurídica ASSISTIVA — não é parecer definitivo vinculante.",
    LEGAL_DRAFT_INSTRUCTIONS,
  ].join("\n"),
  "legal_draft.admin_request": [
    "Elabore rascunho de requerimento administrativo com fatos, fundamentos e pedidos.",
    LEGAL_DRAFT_INSTRUCTIONS,
  ].join("\n"),
  "legal_draft.contract": [
    "Elabore rascunho contratual assistivo; cláusulas são sugestões sujeitas a revisão.",
    LEGAL_DRAFT_INSTRUCTIONS,
  ].join("\n"),
  "legal_draft.notice": [
    "Elabore rascunho de notificação/notícia extrajudicial assistiva.",
    LEGAL_DRAFT_INSTRUCTIONS,
  ].join("\n"),
};
