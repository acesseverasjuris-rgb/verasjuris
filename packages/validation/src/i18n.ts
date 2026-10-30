import { z } from "zod";

export const TRANSLATION_STATUSES = [
  "pending",
  "machine_translated",
  "reviewed",
  "failed",
  "not_configured",
] as const;

export const jurisdictionContextSchema = z.object({
  country: z
    .string()
    .trim()
    .length(2, "Informe o código de país ISO 3166-1 alpha-2.")
    .transform((v) => v.toUpperCase()),
  region: z.string().trim().max(80).optional(),
  legalSystem: z.string().trim().max(80).optional(),
  language: z.string().trim().min(2).max(16),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((v) => v.toUpperCase()),
  timezone: z.string().trim().min(2).max(64),
});

export const createContentTranslationSchema = z.object({
  sourceType: z.string().trim().min(2).max(80),
  sourceId: z.string().trim().min(1).max(120),
  sourceLanguage: z.string().trim().min(2).max(16),
  targetLanguage: z.string().trim().min(2).max(16),
  translatedText: z.string().trim().min(1).max(100_000).optional(),
  provider: z.string().trim().max(80).optional(),
  status: z.enum(TRANSLATION_STATUSES).default("pending"),
  reviewed: z.boolean().default(false),
});

export const requestMachineTranslationSchema = z.object({
  text: z.string().trim().min(1).max(16_000),
  sourceLanguage: z.string().trim().min(2).max(16).optional(),
  targetLanguage: z.string().trim().min(2).max(16),
});

export const updateLocalePreferencesSchema = z.object({
  locale: z.string().trim().min(2).max(16),
  timeZone: z.string().trim().min(2).max(64),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((v) => v.toUpperCase())
    .optional(),
});
