/**
 * Assistente virtual itinerante — histórico + feedback.
 * Sem ações críticas autônomas; subject a permissões.
 */
import { relations } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations, users } from "./identity.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const assistantConversationStatusEnum = pgEnum("assistant_conversation_status", [
  "active",
  "archived",
  "deleted",
]);

export const assistantMessageRoleEnum = pgEnum("assistant_message_role", [
  "user",
  "assistant",
  "system",
  "tool",
]);

export const assistantFeedbackRatingEnum = pgEnum("assistant_feedback_rating", [
  "positive",
  "negative",
  "neutral",
]);

export const assistantConversations = pgTable(
  "assistant_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title"),
    locale: text("locale").notNull().default("pt-BR"),
    status: assistantConversationStatusEnum("status").notNull().default("active"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("assistant_conversations_user_idx").on(table.userId),
    index("assistant_conversations_org_idx").on(table.organizationId),
    index("assistant_conversations_status_idx").on(table.status),
  ],
);

export const assistantMessages = pgTable(
  "assistant_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => assistantConversations.id, { onDelete: "cascade" }),
    role: assistantMessageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    providerKey: text("provider_key").notNull().default("not_configured"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("assistant_messages_conversation_idx").on(table.conversationId),
    index("assistant_messages_created_idx").on(table.createdAt),
  ],
);

export const assistantFeedback = pgTable(
  "assistant_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").references(() => assistantConversations.id, {
      onDelete: "cascade",
    }),
    messageId: uuid("message_id").references(() => assistantMessages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: assistantFeedbackRatingEnum("rating").notNull().default("neutral"),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("assistant_feedback_user_idx").on(table.userId),
    index("assistant_feedback_message_idx").on(table.messageId),
  ],
);

export const assistantConversationsRelations = relations(
  assistantConversations,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [assistantConversations.organizationId],
      references: [organizations.id],
    }),
    user: one(users, { fields: [assistantConversations.userId], references: [users.id] }),
    messages: many(assistantMessages),
  }),
);

export const assistantMessagesRelations = relations(assistantMessages, ({ one, many }) => ({
  conversation: one(assistantConversations, {
    fields: [assistantMessages.conversationId],
    references: [assistantConversations.id],
  }),
  feedback: many(assistantFeedback),
}));

export const assistantFeedbackRelations = relations(assistantFeedback, ({ one }) => ({
  conversation: one(assistantConversations, {
    fields: [assistantFeedback.conversationId],
    references: [assistantConversations.id],
  }),
  message: one(assistantMessages, {
    fields: [assistantFeedback.messageId],
    references: [assistantMessages.id],
  }),
  user: one(users, { fields: [assistantFeedback.userId], references: [users.id] }),
}));
