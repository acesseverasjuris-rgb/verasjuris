/**
 * Etapa 32 — Traduções de conteúdo (nunca substitui original).
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations, users } from "./identity.js";

export const contentTranslationStatusEnum = pgEnum("content_translation_status", [
  "pending",
  "machine_translated",
  "reviewed",
  "failed",
  "not_configured",
]);

export const contentTranslations = pgTable(
  "content_translations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    sourceLanguage: text("source_language").notNull(),
    targetLanguage: text("target_language").notNull(),
    translatedText: text("translated_text").notNull(),
    provider: text("provider").notNull().default("not_configured"),
    status: contentTranslationStatusEnum("status").notNull().default("pending"),
    reviewed: boolean("reviewed").notNull().default(false),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("content_translations_source_lang_unique").on(
      table.sourceType,
      table.sourceId,
      table.sourceLanguage,
      table.targetLanguage,
    ),
    index("content_translations_org_idx").on(table.organizationId),
    index("content_translations_status_idx").on(table.status),
  ],
);

export const contentTranslationsRelations = relations(contentTranslations, ({ one }) => ({
  organization: one(organizations, {
    fields: [contentTranslations.organizationId],
    references: [organizations.id],
  }),
}));
