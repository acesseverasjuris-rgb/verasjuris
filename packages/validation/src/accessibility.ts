import { z } from "zod";

export const COLOR_BLINDNESS_MODES = [
  "none",
  "protanopia",
  "deuteranopia",
  "tritanopia",
  "achromatopsia",
] as const;

export const CONTRAST_MODES = ["normal", "high", "extra_high", "dark_high_contrast"] as const;

export const accessibilityPreferencesSchema = z.object({
  fontScalePercent: z.number().int().min(100).max(250).default(100),
  contrastMode: z.enum(CONTRAST_MODES).default("normal"),
  colorBlindnessMode: z.enum(COLOR_BLINDNESS_MODES).default("none"),
  reduceMotion: z.boolean().default(false),
  screenReaderHints: z.boolean().default(true),
  largeControls: z.boolean().default(false),
  captionsEnabled: z.boolean().default(true),
  signLanguageEnabled: z.boolean().default(false),
});

export const updateAccessibilityPreferencesSchema = accessibilityPreferencesSchema.partial();

export const mediaCaptionSchema = z.object({
  language: z.string().trim().min(2).max(16),
  captionUrl: z.string().trim().url().max(1_000).optional(),
  transcript: z.string().trim().max(100_000).optional(),
  audioDescriptionUrl: z.string().trim().url().max(1_000).optional(),
  signLanguageVideoUrl: z.string().trim().url().max(1_000).optional(),
});
