/**
 * Etapa 14 — Portal do Cliente (projection layer + solicitações/mensagens/pagamentos).
 * Não duplica LegalMatter/Document/Contract/Calendar/Notification.
 */
import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { contracts } from "./contracts.js";
import { crmClients } from "./crm.js";
import { documents } from "./documents.js";
import { organizationMembers, organizations, users } from "./identity.js";
import { legalMatters } from "./matters.js";
import { calendarEvents } from "./productivity.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const clientDocumentRequestStatusEnum = pgEnum("client_document_request_status", [
  "open",
  "viewed",
  "uploaded",
  "under_review",
  "accepted",
  "rejected",
  "cancelled",
]);

export const clientRequestTypeEnum = pgEnum("client_request_type", [
  "document_request",
  "status_request",
  "appointment_request",
  "call_request",
  "contract_request",
  "payment_question",
  "general",
  "other",
]);

export const clientRequestStatusEnum = pgEnum("client_request_status", [
  "open",
  "in_review",
  "assigned",
  "waiting_client",
  "resolved",
  "closed",
  "cancelled",
]);

export const clientAppointmentRequestStatusEnum = pgEnum("client_appointment_request_status", [
  "open",
  "in_review",
  "scheduled",
  "declined",
  "cancelled",
]);

export const conversationThreadStatusEnum = pgEnum("conversation_thread_status", [
  "open",
  "waiting_client",
  "waiting_staff",
  "closed",
  "archived",
]);

export const messageSenderTypeEnum = pgEnum("message_sender_type", ["client", "staff", "system"]);

export const clientPaymentStatusEnum = pgEnum("client_payment_status", [
  "pending",
  "paid",
  "partial",
  "overdue",
  "cancelled",
  "refunded",
  "disputed",
]);

export const clientDocumentRequests = pgTable(
  "client_document_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => crmClients.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id").references(() => legalMatters.id, {
      onDelete: "set null",
    }),
    requestedByMembershipId: uuid("requested_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    title: text("title").notNull(),
    description: text("description"),
    documentKind: text("document_kind"),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    status: clientDocumentRequestStatusEnum("status").notNull().default("open"),
    fulfilledDocumentId: uuid("fulfilled_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("client_document_requests_org_client_idx").on(table.organizationId, table.clientId),
    index("client_document_requests_status_idx").on(table.status),
    index("client_document_requests_matter_idx").on(table.legalMatterId),
  ],
);

export const clientRequests = pgTable(
  "client_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => crmClients.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id").references(() => legalMatters.id, {
      onDelete: "set null",
    }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    requestType: clientRequestTypeEnum("request_type").notNull().default("general"),
    title: text("title").notNull(),
    description: text("description"),
    status: clientRequestStatusEnum("status").notNull().default("open"),
    assignedMembershipId: uuid("assigned_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    resultingTaskId: uuid("resulting_task_id"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("client_requests_org_client_idx").on(table.organizationId, table.clientId),
    index("client_requests_status_idx").on(table.status),
  ],
);

export const clientAppointmentRequests = pgTable(
  "client_appointment_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => crmClients.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id").references(() => legalMatters.id, {
      onDelete: "set null",
    }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    preferredDateRanges:
      jsonb("preferred_date_ranges").$type<Array<{ start: string; end: string }>>(),
    appointmentType: text("appointment_type").notNull().default("general"),
    notes: text("notes"),
    status: clientAppointmentRequestStatusEnum("status").notNull().default("open"),
    resultingCalendarEventId: uuid("resulting_calendar_event_id").references(
      () => calendarEvents.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("client_appointment_requests_org_client_idx").on(table.organizationId, table.clientId),
    index("client_appointment_requests_status_idx").on(table.status),
  ],
);

export const conversationThreads = pgTable(
  "conversation_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => crmClients.id, { onDelete: "set null" }),
    legalMatterId: uuid("legal_matter_id").references(() => legalMatters.id, {
      onDelete: "set null",
    }),
    subject: text("subject").notNull(),
    status: conversationThreadStatusEnum("status").notNull().default("open"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    contextType: text("context_type"),
    contextId: uuid("context_id"),
    ...timestamps,
  },
  (table) => [
    index("conversation_threads_org_idx").on(table.organizationId),
    index("conversation_threads_org_client_idx").on(table.organizationId, table.clientId),
    index("conversation_threads_matter_idx").on(table.legalMatterId),
    index("conversation_threads_status_idx").on(table.status),
  ],
);

export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => conversationThreads.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    participantRole: text("participant_role").notNull().default("member"),
    lastReadAt: timestamp("last_read_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("conversation_participants_thread_user_unique").on(table.threadId, table.userId),
    index("conversation_participants_org_idx").on(table.organizationId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => conversationThreads.id, { onDelete: "cascade" }),
    senderUserId: uuid("sender_user_id").references(() => users.id, { onDelete: "set null" }),
    senderType: messageSenderTypeEnum("sender_type").notNull().default("staff"),
    body: text("body").notNull(),
    clientVisible: boolean("client_visible").notNull().default(true),
    editedAt: timestamp("edited_at", { withTimezone: true, mode: "date" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("messages_thread_idx").on(table.threadId, table.createdAt),
    index("messages_org_idx").on(table.organizationId),
  ],
);

/** Ledger mínimo de pagamentos do cliente — PAID só com evidência ou provider real. */
export const clientPaymentRecords = pgTable(
  "client_payment_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => crmClients.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id").references(() => legalMatters.id, {
      onDelete: "set null",
    }),
    contractId: uuid("contract_id").references(() => contracts.id, { onDelete: "set null" }),
    description: text("description").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
    status: clientPaymentStatusEnum("status").notNull().default("pending"),
    paymentMethod: text("payment_method"),
    externalReference: text("external_reference"),
    source: text("source").notNull().default("manual"),
    evidenceDocumentId: uuid("evidence_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    recordedByMembershipId: uuid("recorded_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("client_payment_records_org_client_idx").on(table.organizationId, table.clientId),
    index("client_payment_records_status_idx").on(table.status),
    index("client_payment_records_due_idx").on(table.dueAt),
  ],
);

export const clientDocumentRequestsRelations = relations(clientDocumentRequests, ({ one }) => ({
  organization: one(organizations, {
    fields: [clientDocumentRequests.organizationId],
    references: [organizations.id],
  }),
  client: one(crmClients, {
    fields: [clientDocumentRequests.clientId],
    references: [crmClients.id],
  }),
  matter: one(legalMatters, {
    fields: [clientDocumentRequests.legalMatterId],
    references: [legalMatters.id],
  }),
}));

export const clientRequestsRelations = relations(clientRequests, ({ one }) => ({
  client: one(crmClients, { fields: [clientRequests.clientId], references: [crmClients.id] }),
  matter: one(legalMatters, {
    fields: [clientRequests.legalMatterId],
    references: [legalMatters.id],
  }),
}));

export const clientAppointmentRequestsRelations = relations(
  clientAppointmentRequests,
  ({ one }) => ({
    client: one(crmClients, {
      fields: [clientAppointmentRequests.clientId],
      references: [crmClients.id],
    }),
  }),
);

export const conversationThreadsRelations = relations(conversationThreads, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [conversationThreads.organizationId],
    references: [organizations.id],
  }),
  client: one(crmClients, {
    fields: [conversationThreads.clientId],
    references: [crmClients.id],
  }),
  participants: many(conversationParticipants),
  messages: many(messages),
}));

export const conversationParticipantsRelations = relations(conversationParticipants, ({ one }) => ({
  thread: one(conversationThreads, {
    fields: [conversationParticipants.threadId],
    references: [conversationThreads.id],
  }),
  user: one(users, { fields: [conversationParticipants.userId], references: [users.id] }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  thread: one(conversationThreads, {
    fields: [messages.threadId],
    references: [conversationThreads.id],
  }),
  sender: one(users, { fields: [messages.senderUserId], references: [users.id] }),
}));

export const clientPaymentRecordsRelations = relations(clientPaymentRecords, ({ one }) => ({
  client: one(crmClients, {
    fields: [clientPaymentRecords.clientId],
    references: [crmClients.id],
  }),
  contract: one(contracts, {
    fields: [clientPaymentRecords.contractId],
    references: [contracts.id],
  }),
}));
