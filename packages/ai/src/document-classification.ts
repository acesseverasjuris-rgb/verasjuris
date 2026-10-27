import { z } from "zod";

/**
 * Tipos de documento. Espelha `documentKind` de `@verasjuris/validation` (documents-domain) e a coluna
 * `documents.document_kind`. Mantido aqui para o pacote de IA não depender de validation.
 */
export const DOCUMENT_KINDS = [
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
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const documentKindSchema = z.enum(DOCUMENT_KINDS);

/** Método registrado em `document_classifications.method`. */
export const DOCUMENT_CLASSIFICATION_METHODS = ["manual", "ai", "rule"] as const;
export type DocumentClassificationMethod = (typeof DOCUMENT_CLASSIFICATION_METHODS)[number];

const confidence = z.number().int().min(0).max(100);

/** Saída estruturada esperada da IA ao classificar. É SUGESTÃO: só vira `appliedKind` após revisão humana. */
export const documentClassificationOutputSchema = z
  .object({
    suggestedKind: documentKindSchema,
    confidence,
    rationale: z.string().trim().min(1).max(1_000),
    alternatives: z
      .array(z.object({ kind: documentKindSchema, confidence }).strict())
      .max(5)
      .default([]),
  })
  .strict();

export type DocumentClassificationOutput = z.infer<typeof documentClassificationOutputSchema>;

export const DOCUMENT_CLASSIFICATION_INSTRUCTIONS = [
  "Classifique o tipo do documento fornecido em exatamente um dos valores permitidos:",
  DOCUMENT_KINDS.join(", "),
  "Devolva JSON com suggestedKind, confidence (inteiro 0-100), rationale (curta) e alternatives.",
  "Se o conteúdo for insuficiente ou ambíguo, use 'other' com confiança baixa.",
].join("\n");
