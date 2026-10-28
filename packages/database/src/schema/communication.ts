/**
 * Etapa 15 — Comunicação omnichannel (templates, preferências, consent, outbox).
 * IN_APP reutiliza notifications; canais externos via NotConfigured* providers.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations, users } from "./identity.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const communicationChannelEnum = pgEnum("communication_channel", [
  "in_app",
  "email",
  "sms",
  "whatsapp",
  "push",
]);

export const communicationCategoryEnum = pgEnum("communication_category", [
  "transactional",
  "case_update",
  "appointment",
  "document",
  "payment",
  "contract",
  "marketing",
  "security",
  "system",
]);

export const communicationConsentStatusEnum = pgEnum("communication_consent_status", [
  "unknown",
  "opted_in",
  "opted_out",
  "required",
  "not_applicable",
]);

export const communicationMessageStatusEnum = pgEnum("communication_message_status", [
  "draft",
  "queued",
  "sending",
  "sent",
  "delivered",
  "failed",
  "cancelled",
  "not_configured",
]);

export const communicationOutboxStatusEnum = pgEnum("communication_outbox_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "not_configured",
]);

export const communicationTemplates = pgTable(
  "communication_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    scope: text("scope").notNull().default("organization"),
    channel: communicationChannelEnum("channel").notNull(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    subjectTemplate: text("subject_template"),
    bodyTemplate: text("body_template").notNull(),
    variableSchema: jsonb("variable_schema").$type<Record<string, unknown>>(),
    category: communicationCategoryEnum("category").notNull().default("system"),
    active: boolean("active").notNull().default(true),
    currentVersionId: uuid("current_version_id"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("communication_templates_org_channel_key_unique").on(
      table.organizationId,
      table.channel,
      table.key,
    ),
    index("communication_templates_channel_idx").on(table.channel),
    index("communication_templates_active_idx").on(table.active),
  ],
);

export const communicationTemplateVersions = pgTable(
  "communication_template_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => communicationTemplates.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    subjectTemplate: text("subject_template"),
    bodyTemplate: text("body_template").notNull(),
    variableSchema: jsonb("variable_schema").$type<Record<string, unknown>>(),
    locked: boolean("locked").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("communication_template_versions_template_version_unique").on(
      table.templateId,
      table.version,
    ),
  ],
);

export const communicationPreferences = pgTable(
  "communication_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: communicationChannelEnum("channel").notNull(),
    category: communicationCategoryEnum("category").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    quietHoursStart: text("quiet_hours_start"),
    quietHoursEnd: text("quiet_hours_end"),
    language: text("language").notNull().default("pt-BR"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("communication_preferences_user_channel_category_unique").on(
      table.userId,
      table.organizationId,
      table.channel,
      table.category,
    ),
    index("communication_preferences_org_idx").on(table.organizationId),
  ],
);

export const communicationConsents = pgTable(
  "communication_consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    subjectType: text("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    channel: communicationChannelEnum("channel").notNull(),
    category: communicationCategoryEnum("category").notNull(),
    status: communicationConsentStatusEnum("status").notNull().default("unknown"),
    source: text("source").notNull().default("manual"),
    grantedAt: timestamp("granted_at", { withTimezone: true, mode: "date" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    evidence: text("evidence"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("communication_consents_subject_idx").on(
      table.organizationId,
      table.subjectType,
      table.subjectId,
    ),
    index("communication_consents_channel_category_idx").on(table.channel, table.category),
  ],
);

export const communicationMessages = pgTable(
  "communication_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    recipientType: text("recipient_type").notNull(),
    recipientId: uuid("recipient_id").notNull(),
    channel: communicationChannelEnum("channel").notNull(),
    category: communicationCategoryEnum("category").notNull().default("system"),
    templateVersionId: uuid("template_version_id").references(
      () => communicationTemplateVersions.id,
      { onDelete: "set null" },
    ),
    subject: text("subject"),
    bodySnapshot: text("body_snapshot").notNull(),
    status: communicationMessageStatusEnum("status").notNull().default("draft"),
    providerKey: text("provider_key").notNull().default("not_configured"),
    externalMessageId: text("external_message_id"),
    idempotencyKey: text("idempotency_key"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "date" }),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true, mode: "date" }),
    failedAt: timestamp("failed_at", { withTimezone: true, mode: "date" }),
    errorCode: text("error_code"),
    attemptCount: integer("attempt_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("communication_messages_org_idx").on(table.organizationId),
    index("communication_messages_status_idx").on(table.status),
    index("communication_messages_recipient_idx").on(table.recipientType, table.recipientId),
    uniqueIndex("communication_messages_org_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
  ],
);

export const communicationMessageHistory = pgTable(
  "communication_message_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    messageId: uuid("message_id")
      .notNull()
      .references(() => communicationMessages.id, { onDelete: "cascade" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    detail: text("detail"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("communication_message_history_message_idx").on(table.messageId, table.createdAt),
  ],
);

export const communicationOutbox = pgTable(
  "communication_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    communicationMessageId: uuid("communication_message_id")
      .notNull()
      .references(() => communicationMessages.id, { onDelete: "cascade" }),
    idempotencyKey: text("idempotency_key").notNull(),
    status: communicationOutboxStatusEnum("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true, mode: "date" }),
    lastErrorCode: text("last_error_code"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("communication_outbox_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    index("communication_outbox_status_next_idx").on(table.status, table.nextAttemptAt),
  ],
);

export const communicationTemplatesRelations = relations(communicationTemplates, ({ many }) => ({
  versions: many(communicationTemplateVersions),
}));

export const communicationTemplateVersionsRelations = relations(
  communicationTemplateVersions,
  ({ one }) => ({
    template: one(communicationTemplates, {
      fields: [communicationTemplateVersions.templateId],
      references: [communicationTemplates.id],
    }),
  }),
);

export const communicationPreferencesRelations = relations(communicationPreferences, ({ one }) => ({
  user: one(users, { fields: [communicationPreferences.userId], references: [users.id] }),
  organization: one(organizations, {
    fields: [communicationPreferences.organizationId],
    references: [organizations.id],
  }),
}));

export const communicationConsentsRelations = relations(communicationConsents, ({ one }) => ({
  organization: one(organizations, {
    fields: [communicationConsents.organizationId],
    references: [organizations.id],
  }),
}));

export const communicationMessagesRelations = relations(communicationMessages, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [communicationMessages.organizationId],
    references: [organizations.id],
  }),
  history: many(communicationMessageHistory),
}));

export const communicationMessageHistoryRelations = relations(
  communicationMessageHistory,
  ({ one }) => ({
    message: one(communicationMessages, {
      fields: [communicationMessageHistory.messageId],
      references: [communicationMessages.id],
    }),
  }),
);

export const communicationOutboxRelations = relations(communicationOutbox, ({ one }) => ({
  message: one(communicationMessages, {
    fields: [communicationOutbox.communicationMessageId],
    references: [communicationMessages.id],
  }),
}));
