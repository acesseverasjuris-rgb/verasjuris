import type { SessionAccount } from "@verasjuris/auth";
import type { AppDatabase } from "@verasjuris/database";
import { accessibilityPreferences } from "@verasjuris/database";
import { eq } from "drizzle-orm";

function mapContrast(mode?: string): "default" | "high" | "inverted" | "custom" {
  if (mode === "high" || mode === "extra_high") return "high";
  if (mode === "dark_high_contrast" || mode === "inverted") return "inverted";
  if (mode === "custom") return "custom";
  return "default";
}

function toApi(row: typeof accessibilityPreferences.$inferSelect) {
  return {
    fontScalePercent: Number(row.fontScale) || 100,
    contrastMode:
      row.contrastMode === "high"
        ? "high"
        : row.contrastMode === "inverted"
          ? "dark_high_contrast"
          : "normal",
    colorBlindnessMode: row.colorVisionMode,
    reduceMotion: row.reducedMotion,
    screenReaderHints: row.screenReaderOptimized,
    largeControls: row.interfaceDensity === "spacious",
    captionsEnabled: row.captionsPreferred,
    signLanguageEnabled: row.signLanguagePreferred,
    fontScale: row.fontScale,
    lineSpacing: row.lineSpacing,
    focusEnhancement: row.focusEnhancement,
    simplifiedLanguage: row.simplifiedLanguage,
    dyslexiaFriendlyMode: row.dyslexiaFriendlyMode,
    cognitiveSupportMode: row.cognitiveSupportMode,
    keyboardOnly: row.keyboardOnly,
    highVisibilityCursor: row.highVisibilityCursor,
    readingGuide: row.readingGuide,
    interfaceDensity: row.interfaceDensity,
  };
}

export class AccessibilityService {
  constructor(private readonly db: AppDatabase) {}

  async get(account: SessionAccount) {
    const row = await this.db.query.accessibilityPreferences.findFirst({
      where: eq(accessibilityPreferences.userId, account.user.id),
    });
    if (!row) {
      return {
        preferences: {
          fontScalePercent: 100,
          contrastMode: "normal",
          colorBlindnessMode: "none",
          reduceMotion: false,
          screenReaderHints: true,
          largeControls: false,
          captionsEnabled: true,
          signLanguageEnabled: false,
        },
      };
    }
    return { preferences: toApi(row) };
  }

  async put(
    account: SessionAccount,
    input: Partial<{
      fontScalePercent: number;
      contrastMode: string;
      colorBlindnessMode: "none" | "protanopia" | "deuteranopia" | "tritanopia" | "achromatopsia";
      reduceMotion: boolean;
      screenReaderHints: boolean;
      largeControls: boolean;
      captionsEnabled: boolean;
      signLanguageEnabled: boolean;
    }>,
  ) {
    const existing = await this.db.query.accessibilityPreferences.findFirst({
      where: eq(accessibilityPreferences.userId, account.user.id),
    });
    const values = {
      fontScale: String(input.fontScalePercent ?? (existing ? Number(existing.fontScale) : 100)),
      contrastMode: mapContrast(input.contrastMode ?? existing?.contrastMode),
      colorVisionMode: input.colorBlindnessMode ?? existing?.colorVisionMode ?? "none",
      reducedMotion: input.reduceMotion ?? existing?.reducedMotion ?? false,
      screenReaderOptimized: input.screenReaderHints ?? existing?.screenReaderOptimized ?? false,
      interfaceDensity:
        input.largeControls === true
          ? ("spacious" as const)
          : input.largeControls === false
            ? ("comfortable" as const)
            : (existing?.interfaceDensity ?? ("comfortable" as const)),
      captionsPreferred: input.captionsEnabled ?? existing?.captionsPreferred ?? false,
      signLanguagePreferred: input.signLanguageEnabled ?? existing?.signLanguagePreferred ?? false,
      updatedAt: new Date(),
    };
    if (existing) {
      const [row] = await this.db
        .update(accessibilityPreferences)
        .set(values)
        .where(eq(accessibilityPreferences.id, existing.id))
        .returning();
      return { preferences: toApi(row!) };
    }
    const [row] = await this.db
      .insert(accessibilityPreferences)
      .values({ userId: account.user.id, ...values })
      .returning();
    return { preferences: toApi(row!) };
  }
}
