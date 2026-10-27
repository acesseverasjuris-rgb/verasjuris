import { z } from "zod";

const uuid = z.string().uuid("O identificador não é válido.");
const optionalUuid = uuid.optional();
const limit = z.coerce.number().int().min(1).max(100).default(20);
const offset = z.coerce.number().int().min(0).max(10_000).default(0);
const q = z.string().trim().min(1).max(500);
const httpsUrl = z
  .string()
  .trim()
  .url()
  .max(2000)
  .refine((value) => value.startsWith("https://"), "A URL deve usar https.");

export const LEGAL_RESEARCH_SOURCE_TYPES = [
  "legislation",
  "case_law",
  "summary",
  "theme",
  "general_repercussion",
  "precedent",
  "doctrine",
  "internal_document",
] as const;

export const legalResearchFiltersSchema = z.object({
  sourceType: z.enum(LEGAL_RESEARCH_SOURCE_TYPES).optional(),
  court: z.string().trim().max(120).optional(),
  jurisdiction: z.string().trim().max(120).optional(),
  subject: z.string().trim().max(200).optional(),
  proceduralClass: z.string().trim().max(120).optional(),
  rapporteur: z.string().trim().max(160).optional(),
  status: z.string().trim().max(40).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

export const executeLegalResearchSchema = z.object({
  query: q,
  filters: legalResearchFiltersSchema.optional(),
  sourceTypes: z.array(z.enum(LEGAL_RESEARCH_SOURCE_TYPES)).max(8).optional(),
});

export const legalResearchListQuerySchema = z.object({
  q: q.optional(),
  sourceType: z.enum(LEGAL_RESEARCH_SOURCE_TYPES).optional(),
  court: z.string().trim().max(120).optional(),
  status: z
    .enum(["pending", "running", "succeeded", "failed", "empty", "not_configured"])
    .optional(),
  limit,
  offset,
});

export const saveResearchSchema = z.object({
  name: z.string().trim().min(2).max(200),
  query: q,
  filters: legalResearchFiltersSchema.optional(),
  queryId: optionalUuid,
  legalMatterId: optionalUuid,
  selectedResultIds: z.array(uuid).max(100).optional(),
  notes: z.string().trim().max(4000).optional(),
});

export const updateSavedResearchSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    notes: z.string().trim().max(4000).nullable().optional(),
    selectedResultIds: z.array(uuid).max(100).optional(),
    legalMatterId: uuid.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const linkMatterResearchSchema = z.object({
  legalMatterId: uuid,
  sourceType: z.enum(LEGAL_RESEARCH_SOURCE_TYPES),
  sourceId: uuid,
  savedResearchId: optionalUuid,
  notes: z.string().trim().max(2000).optional(),
});

export const createLegalSourceSchema = z.object({
  sourceType: z
    .enum([
      "legislation",
      "constitution",
      "decree",
      "resolution",
      "instruction",
      "ordinance",
      "regulation",
      "other",
    ])
    .default("legislation"),
  title: z.string().trim().min(2).max(500),
  identifier: z.string().trim().max(120).optional(),
  jurisdiction: z.string().trim().max(120).optional(),
  authority: z.string().trim().max(200).optional(),
  /** Proveniência obrigatória para cadastro manual (https). */
  sourceUrl: httpsUrl,
  publicationDate: z.string().datetime({ offset: true }).optional(),
  effectiveDate: z.string().datetime({ offset: true }).optional(),
});

export const createCaseLawRecordSchema = z.object({
  court: z.string().trim().min(2).max(120),
  caseNumber: z.string().trim().min(2).max(120),
  caseNumberNormalized: z.string().trim().max(120).optional(),
  courtUnit: z.string().trim().max(200).optional(),
  rapporteur: z.string().trim().max(160).optional(),
  judgingBody: z.string().trim().max(200).optional(),
  judgmentDate: z.string().datetime({ offset: true }).optional(),
  publicationDate: z.string().datetime({ offset: true }).optional(),
  proceduralClass: z.string().trim().max(120).optional(),
  subject: z.string().trim().max(500).optional(),
  headnote: z.string().trim().max(8000).optional(),
  /** Proveniência obrigatória para cadastro manual (https). */
  sourceUrl: httpsUrl,
});

export const legalResearchRecordParamsSchema = z.object({
  sourceType: z.enum(LEGAL_RESEARCH_SOURCE_TYPES),
  sourceId: uuid,
});
