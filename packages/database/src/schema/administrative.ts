import { relations, sql } from "drizzle-orm";
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
import { organizationMembers, organizations } from "./identity.js";
import { legalMatters } from "./matters.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const administrativeProcessStatusEnum = pgEnum("administrative_process_status", [
  "draft",
  "active",
  "waiting_body",
  "waiting_client",
  "requirement_open",
  "under_analysis",
  "decided",
  "appeal",
  "suspended",
  "closed",
  "archived",
]);

export const administrativeBodyTypeEnum = pgEnum("administrative_body_type", [
  "federal",
  "state",
  "municipal",
  "autarchy",
  "council",
  "regulatory",
  "administrative_court",
  "other",
]);

export const administrativeDataSourceEnum = pgEnum("administrative_data_source", [
  "manual",
  "document",
  "import",
]);

export const administrativeProtocolSourceEnum = pgEnum("administrative_protocol_source", [
  "manual",
  "document",
  "import",
]);

export const administrativePriorityEnum = pgEnum("administrative_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);

export const administrativeRequestStatusEnum = pgEnum("administrative_request_status", [
  "draft",
  "review",
  "approved",
  "ready_to_submit",
  "submitted",
  "confirmed",
  "rejected",
  "cancelled",
]);

export const administrativeRequirementStatusEnum = pgEnum("administrative_requirement_status", [
  "open",
  "in_progress",
  "responded",
  "accepted",
  "not_applicable",
  "cancelled",
  "overdue",
]);

export const administrativeDeadlineStatusEnum = pgEnum("administrative_deadline_status", [
  "suggested",
  "pending_confirmation",
  "confirmed",
  "completed",
  "cancelled",
]);

export const administrativeAppealStatusEnum = pgEnum("administrative_appeal_status", [
  "draft",
  "review",
  "approved",
  "ready_to_file",
  "filed",
  "confirmed",
  "decided",
  "withdrawn",
  "cancelled",
]);

/** Catálogo global de referência — não tenant-specific. */
export const administrativeBodies = pgTable(
  "administrative_bodies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code"),
    name: text("name").notNull(),
    acronym: text("acronym"),
    bodyType: administrativeBodyTypeEnum("body_type").notNull().default("other"),
    jurisdiction: text("jurisdiction").notNull().default("other"),
    stateCode: text("state_code"),
    municipalityCode: text("municipality_code"),
    parentBodyId: uuid("parent_body_id"),
    source: text("source").notNull().default("seed_dev"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("administrative_bodies_name_unique").on(table.name),
    index("administrative_bodies_parent_idx").on(table.parentBodyId),
    index("administrative_bodies_code_idx").on(table.code),
  ],
);

export const administrativeProcesses = pgTable(
  "administrative_processes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    administrativeBodyId: uuid("administrative_body_id")
      .notNull()
      .references(() => administrativeBodies.id, { onDelete: "restrict" }),
    number: text("number"),
    normalizedNumber: text("normalized_number"),
    protocolNumber: text("protocol_number"),
    protocolDate: timestamp("protocol_date", { withTimezone: true, mode: "date" }),
    protocolSource: administrativeProtocolSourceEnum("protocol_source"),
    protocolReference: text("protocol_reference"),
    externalReference: text("external_reference"),
    subject: text("subject").notNull(),
    description: text("description"),
    status: administrativeProcessStatusEnum("status").notNull().default("draft"),
    currentPhase: text("current_phase"),
    priority: administrativePriorityEnum("priority").notNull().default("normal"),
    filedAt: timestamp("filed_at", { withTimezone: true, mode: "date" }),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true, mode: "date" }),
    closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "date" }),
    closureReason: text("closure_reason"),
    closureNotes: text("closure_notes"),
    source: administrativeDataSourceEnum("source").notNull().default("manual"),
    sourceReference: text("source_reference"),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true, mode: "date" }),
    responsibleMembershipId: uuid("responsible_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("administrative_processes_org_number_unique")
      .on(table.organizationId, table.normalizedNumber)
      .where(sql`${table.normalizedNumber} is not null`),
    index("administrative_processes_org_idx").on(table.organizationId),
    index("administrative_processes_matter_idx").on(table.legalMatterId),
    index("administrative_processes_org_status_idx").on(table.organizationId, table.status),
    index("administrative_processes_body_idx").on(table.administrativeBodyId),
  ],
);

export const administrativeRequests = pgTable(
  "administrative_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    administrativeProcessId: uuid("administrative_process_id")
      .notNull()
      .references(() => administrativeProcesses.id, { onDelete: "cascade" }),
    requestType: text("request_type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: administrativeRequestStatusEnum("status").notNull().default("draft"),
    requestedAt: timestamp("requested_at", { withTimezone: true, mode: "date" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" }),
    protocolNumber: text("protocol_number"),
    protocolReference: text("protocol_reference"),
    /** Justificativa humana quando SUBMITTED sem número de protocolo. */
    justification: text("justification"),
    source: administrativeDataSourceEnum("source").notNull().default("manual"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    reviewedByMembershipId: uuid("reviewed_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("administrative_requests_process_idx").on(table.administrativeProcessId),
    index("administrative_requests_org_idx").on(table.organizationId),
  ],
);

export const administrativeRequirements = pgTable(
  "administrative_requirements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    administrativeProcessId: uuid("administrative_process_id")
      .notNull()
      .references(() => administrativeProcesses.id, { onDelete: "cascade" }),
    relatedRequestId: uuid("related_request_id").references(() => administrativeRequests.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    issuedAt: timestamp("issued_at", { withTimezone: true, mode: "date" }),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    status: administrativeRequirementStatusEnum("status").notNull().default("open"),
    source: administrativeDataSourceEnum("source").notNull().default("manual"),
    sourceReference: text("source_reference"),
    respondedAt: timestamp("responded_at", { withTimezone: true, mode: "date" }),
    responseSummary: text("response_summary"),
    responsibleMembershipId: uuid("responsible_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("administrative_requirements_process_idx").on(table.administrativeProcessId),
    index("administrative_requirements_org_idx").on(table.organizationId),
  ],
);

export const administrativeDeadlines = pgTable(
  "administrative_deadlines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    administrativeProcessId: uuid("administrative_process_id")
      .notNull()
      .references(() => administrativeProcesses.id, { onDelete: "cascade" }),
    requirementId: uuid("requirement_id").references(() => administrativeRequirements.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }).notNull(),
    timezone: text("timezone").notNull().default("America/Sao_Paulo"),
    status: administrativeDeadlineStatusEnum("status").notNull().default("suggested"),
    calculationSource: text("calculation_source").notNull().default("manual"),
    calculationNotes: text("calculation_notes"),
    confirmedByMembershipId: uuid("confirmed_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true, mode: "date" }),
    /** Vínculo opcional ao domínio central de prazos (Etapa 5.2). */
    centralDeadlineId: uuid("central_deadline_id"),
    ...timestamps,
  },
  (table) => [
    index("administrative_deadlines_process_idx").on(table.administrativeProcessId),
    index("administrative_deadlines_org_idx").on(table.organizationId),
    index("administrative_deadlines_central_idx").on(table.centralDeadlineId),
  ],
);

export const administrativeDecisions = pgTable(
  "administrative_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    administrativeProcessId: uuid("administrative_process_id")
      .notNull()
      .references(() => administrativeProcesses.id, { onDelete: "cascade" }),
    relatedRequestId: uuid("related_request_id").references(() => administrativeRequests.id, {
      onDelete: "set null",
    }),
    decisionType: text("decision_type").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    outcome: text("outcome"),
    decidedAt: timestamp("decided_at", { withTimezone: true, mode: "date" }),
    notifiedAt: timestamp("notified_at", { withTimezone: true, mode: "date" }),
    source: administrativeDataSourceEnum("source").notNull().default("manual"),
    sourceReference: text("source_reference"),
    /** FK documental adiada — uuid opaco até o domínio Document existir. */
    documentId: uuid("document_id"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("administrative_decisions_process_idx").on(table.administrativeProcessId),
    index("administrative_decisions_org_idx").on(table.organizationId),
  ],
);

export const administrativeAppeals = pgTable(
  "administrative_appeals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    administrativeProcessId: uuid("administrative_process_id")
      .notNull()
      .references(() => administrativeProcesses.id, { onDelete: "cascade" }),
    parentDecisionId: uuid("parent_decision_id").references(() => administrativeDecisions.id, {
      onDelete: "set null",
    }),
    appealType: text("appeal_type").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    status: administrativeAppealStatusEnum("status").notNull().default("draft"),
    deadlineId: uuid("deadline_id").references(() => administrativeDeadlines.id, {
      onDelete: "set null",
    }),
    filedAt: timestamp("filed_at", { withTimezone: true, mode: "date" }),
    protocolNumber: text("protocol_number"),
    source: administrativeDataSourceEnum("source").notNull().default("manual"),
    documentId: uuid("document_id"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    approvedByMembershipId: uuid("approved_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("administrative_appeals_process_idx").on(table.administrativeProcessId),
    index("administrative_appeals_org_idx").on(table.organizationId),
  ],
);

export const administrativeProcessStatusHistory = pgTable(
  "administrative_process_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    administrativeProcessId: uuid("administrative_process_id")
      .notNull()
      .references(() => administrativeProcesses.id, { onDelete: "cascade" }),
    fromStatus: administrativeProcessStatusEnum("from_status"),
    toStatus: administrativeProcessStatusEnum("to_status").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    notes: text("notes"),
    actorMembershipId: uuid("actor_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("administrative_process_status_history_process_idx").on(
      table.administrativeProcessId,
      table.changedAt,
    ),
  ],
);

export const administrativeProcessTimelineEvents = pgTable(
  "administrative_process_timeline_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    administrativeProcessId: uuid("administrative_process_id")
      .notNull()
      .references(() => administrativeProcesses.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    source: administrativeDataSourceEnum("source").notNull().default("manual"),
    actorMembershipId: uuid("actor_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("administrative_process_timeline_process_idx").on(
      table.administrativeProcessId,
      table.occurredAt,
    ),
    index("administrative_process_timeline_matter_idx").on(table.legalMatterId, table.occurredAt),
    index("administrative_process_timeline_org_idx").on(table.organizationId),
  ],
);

/** Seed mínimo de desenvolvimento — NÃO é catálogo oficial. */
export const SEED_ADMINISTRATIVE_BODIES = [
  {
    code: "INSS",
    name: "Instituto Nacional do Seguro Social",
    acronym: "INSS",
    bodyType: "autarchy" as const,
    jurisdiction: "federal",
    stateCode: null,
  },
  {
    code: "RFB",
    name: "Receita Federal do Brasil",
    acronym: "RFB",
    bodyType: "federal" as const,
    jurisdiction: "federal",
    stateCode: null,
  },
  {
    code: "PROCON-SP",
    name: "Fundação de Proteção e Defesa do Consumidor — São Paulo",
    acronym: "Procon-SP",
    bodyType: "state" as const,
    jurisdiction: "state",
    stateCode: "SP",
  },
] as const;

export const SEED_ADMIN_DEV_SOURCE = "seed_dev";
export const SEED_ADMIN_DEV_VERSION = "2026-10-etapa3.2";

export function normalizeAdministrativeNumber(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export const administrativeBodiesRelations = relations(administrativeBodies, ({ one, many }) => ({
  parent: one(administrativeBodies, {
    fields: [administrativeBodies.parentBodyId],
    references: [administrativeBodies.id],
    relationName: "administrative_body_parent",
  }),
  children: many(administrativeBodies, { relationName: "administrative_body_parent" }),
  processes: many(administrativeProcesses),
}));

export const administrativeProcessesRelations = relations(
  administrativeProcesses,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [administrativeProcesses.organizationId],
      references: [organizations.id],
    }),
    matter: one(legalMatters, {
      fields: [administrativeProcesses.legalMatterId],
      references: [legalMatters.id],
    }),
    body: one(administrativeBodies, {
      fields: [administrativeProcesses.administrativeBodyId],
      references: [administrativeBodies.id],
    }),
    requests: many(administrativeRequests),
    requirements: many(administrativeRequirements),
    deadlines: many(administrativeDeadlines),
    decisions: many(administrativeDecisions),
    appeals: many(administrativeAppeals),
  }),
);

export const administrativeRequestsRelations = relations(administrativeRequests, ({ one }) => ({
  process: one(administrativeProcesses, {
    fields: [administrativeRequests.administrativeProcessId],
    references: [administrativeProcesses.id],
  }),
}));

export const administrativeRequirementsRelations = relations(
  administrativeRequirements,
  ({ one }) => ({
    process: one(administrativeProcesses, {
      fields: [administrativeRequirements.administrativeProcessId],
      references: [administrativeProcesses.id],
    }),
  }),
);

export const administrativeDeadlinesRelations = relations(administrativeDeadlines, ({ one }) => ({
  process: one(administrativeProcesses, {
    fields: [administrativeDeadlines.administrativeProcessId],
    references: [administrativeProcesses.id],
  }),
}));

export const administrativeDecisionsRelations = relations(administrativeDecisions, ({ one }) => ({
  process: one(administrativeProcesses, {
    fields: [administrativeDecisions.administrativeProcessId],
    references: [administrativeProcesses.id],
  }),
}));

export const administrativeAppealsRelations = relations(administrativeAppeals, ({ one }) => ({
  process: one(administrativeProcesses, {
    fields: [administrativeAppeals.administrativeProcessId],
    references: [administrativeProcesses.id],
  }),
}));

export const administrativeProcessStatusHistoryRelations = relations(
  administrativeProcessStatusHistory,
  ({ one }) => ({
    process: one(administrativeProcesses, {
      fields: [administrativeProcessStatusHistory.administrativeProcessId],
      references: [administrativeProcesses.id],
    }),
  }),
);

export const administrativeProcessTimelineEventsRelations = relations(
  administrativeProcessTimelineEvents,
  ({ one }) => ({
    process: one(administrativeProcesses, {
      fields: [administrativeProcessTimelineEvents.administrativeProcessId],
      references: [administrativeProcesses.id],
    }),
  }),
);
