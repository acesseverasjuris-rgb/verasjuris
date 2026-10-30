/**
 * Acessibilidade universal — preferências por usuário (WCAG 2.2 AA+).
 */
import { relations } from "drizzle-orm";
import { boolean, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./identity.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const accessibilityContrastModeEnum = pgEnum("accessibility_contrast_mode", [
  "default",
  "high",
  "inverted",
  "custom",
]);

export const accessibilityColorVisionModeEnum = pgEnum("accessibility_color_vision_mode", [
  "none",
  "protanopia",
  "deuteranopia",
  "tritanopia",
  "achromatopsia",
]);

export const accessibilityInterfaceDensityEnum = pgEnum("accessibility_interface_density", [
  "comfortable",
  "compact",
  "spacious",
]);

export const accessibilityPreferences = pgTable(
  "accessibility_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fontScale: text("font_scale").notNull().default("100"),
    lineSpacing: text("line_spacing").notNull().default("normal"),
    contrastMode: accessibilityContrastModeEnum("contrast_mode").notNull().default("default"),
    colorVisionMode: accessibilityColorVisionModeEnum("color_vision_mode")
      .notNull()
      .default("none"),
    reducedMotion: boolean("reduced_motion").notNull().default(false),
    reducedTransparency: boolean("reduced_transparency").notNull().default(false),
    focusEnhancement: boolean("focus_enhancement").notNull().default(false),
    screenReaderOptimized: boolean("screen_reader_optimized").notNull().default(false),
    simplifiedLanguage: boolean("simplified_language").notNull().default(false),
    dyslexiaFriendlyMode: boolean("dyslexia_friendly_mode").notNull().default(false),
    cognitiveSupportMode: boolean("cognitive_support_mode").notNull().default(false),
    captionsPreferred: boolean("captions_preferred").notNull().default(false),
    signLanguagePreferred: boolean("sign_language_preferred").notNull().default(false),
    keyboardOnly: boolean("keyboard_only").notNull().default(false),
    highVisibilityCursor: boolean("high_visibility_cursor").notNull().default(false),
    readingGuide: boolean("reading_guide").notNull().default(false),
    interfaceDensity: accessibilityInterfaceDensityEnum("interface_density")
      .notNull()
      .default("comfortable"),
    activeProfile: text("active_profile"),
    ...timestamps,
  },
  (table) => [uniqueIndex("accessibility_preferences_user_unique").on(table.userId)],
);

export const accessibilityPreferencesRelations = relations(accessibilityPreferences, ({ one }) => ({
  user: one(users, { fields: [accessibilityPreferences.userId], references: [users.id] }),
}));
