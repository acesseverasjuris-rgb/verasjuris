import { z } from "zod";

const uuid = z.string().uuid("O identificador não é válido.");
const optionalUuid = uuid.optional();
const limit = z.coerce.number().int().min(1).max(100).default(20);
const offset = z.coerce.number().int().min(0).max(10_000).default(0);
const httpsUrl = z
  .string()
  .trim()
  .url()
  .max(2000)
  .refine((value) => value.startsWith("https://"), "A URL deve usar https.");

export const CITATION_SOURCE_TYPES = [
  "legislation",
  "case_law",
  "summary",
  "theme",
  "precedent",
  "doctrine",
  "internal_document",
] as const;

export const CITATION_VERIFICATION_STATUSES = [
  "unverified",
  "source_available",
  "verified",
  "source_unavailable",
  "invalid",
  "stale",
] as const;

export const CITATION_KINDS = ["SOURCE_DOCUMENT_CITATION", "EXTERNAL_LEGAL_CITATION"] as const;

export const createCitationSchema = z
  .object({
    sourceType: z.enum(CITATION_SOURCE_TYPES),
    sourceId: optionalUuid,
    citationStyle: z.string().trim().min(1).max(80).default("default"),
    formattedCitation: z.string().trim().min(2).max(4000).optional(),
    title: z.string().trim().max(500).optional(),
    legislationRef: z.string().trim().max(300).optional(),
    court: z.string().trim().max(120).optional(),
    caseNumber: z.string().trim().max(120).optional(),
    rapporteur: z.string().trim().max(160).optional(),
    judgingBody: z.string().trim().max(200).optional(),
    judgmentDate: z.string().datetime({ offset: true }).optional(),
    publicationDate: z.string().datetime({ offset: true }).optional(),
    sourceUrl: httpsUrl.optional(),
    excerpt: z.string().trim().max(8000).optional(),
    excerptLocation: z.string().trim().max(500).optional(),
    excerptStart: z.number().int().min(0).max(10_000_000).optional(),
    excerptEnd: z.number().int().min(0).max(10_000_000).optional(),
    pageNumber: z.number().int().positive().max(100_000).optional(),
    sourceHash: z.string().trim().max(128).optional(),
  })
  .refine(
    (value) =>
      Boolean(
        value.sourceId ||
          value.court ||
          value.caseNumber ||
          value.title ||
          value.legislationRef ||
          value.sourceUrl ||
          value.formattedCitation,
      ),
    { message: "Informe a fonte ou metadados da citação." },
  );

export const citationListQuerySchema = z.object({
  sourceType: z.enum(CITATION_SOURCE_TYPES).optional(),
  sourceId: optionalUuid,
  verificationStatus: z.enum(CITATION_VERIFICATION_STATUSES).optional(),
  limit,
  offset,
});

export const verifyCitationSchema = z.object({
  verificationStatus: z.enum([
    "source_available",
    "verified",
    "source_unavailable",
    "invalid",
    "stale",
  ]),
  sourceUrl: httpsUrl.optional(),
  sourceHash: z.string().trim().max(128).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const createSourceVerificationSchema = z.object({
  citationId: optionalUuid,
  sourceType: z.enum(CITATION_SOURCE_TYPES),
  sourceId: uuid,
  verificationStatus: z.enum(CITATION_VERIFICATION_STATUSES).default("unverified"),
  sourceUrl: httpsUrl.optional(),
  sourceHash: z.string().trim().max(128).optional(),
  provider: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(2000).optional(),
});
