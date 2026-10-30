/**
 * Etapa 25 — WorkflowEngine central.
 * Versões publicadas imutáveis (body jsonb). Sem eval / arbitrary SQL / shell.
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
import { organizationMembers, organizations, users } from "./identity.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const workflowDefinitionStatusEnum = pgEnum("workflow_definition_status", [
  "draft",
  "published",
  "paused",
  "archived",
]);

export const workflowTriggerTypeEnum = pgEnum("workflow_trigger_type", [
  "domain_event",
  "schedule",
  "manual",
  "webhook",
  "threshold",
  "state_change",
]);

export const workflowConditionOperatorEnum = pgEnum("workflow_condition_operator", [
  "equals",
  "not_equals",
  "in",
  "not_in",
  "greater_than",
  "less_than",
  "exists",
  "not_exists",
  "and",
  "or",
]);

export const workflowActionTypeEnum = pgEnum("workflow_action_type", [
  "create_task",
  "create_notification",
  "send_communication",
  "request_approval",
  "create_deadline",
  "update_allowed_field",
  "create_document_request",
  "create_incident",
  "create_payable",
  "call_internal_service",
  "enqueue_job",
  "wait",
  "webhook_external",
]);

export const workflowFailurePolicyEnum = pgEnum("workflow_failure_policy", [
  "stop",
  "continue",
  "retry",
  "escalate",
  "wait_for_review",
]);

export const workflowRunStatusEnum = pgEnum("workflow_run_status", [
  "queued",
  "running",
  "waiting",
  "completed",
  "failed",
  "cancelled",
  "timed_out",
  "partially_completed",
]);

export const workflowStepStatusEnum = pgEnum("workflow_step_status", [
  "pending",
  "running",
  "waiting",
  "completed",
  "failed",
  "skipped",
  "cancelled",
  "timed_out",
]);

export const workflowDefinitions = pgTable(
  "workflow_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    domain: text("domain"),
    version: integer("version").notNull().default(1),
    status: workflowDefinitionStatusEnum("status").notNull().default("draft"),
    activeFrom: timestamp("active_from", { withTimezone: true, mode: "date" }),
    activeUntil: timestamp("active_until", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("workflow_definitions_org_key_version_unique").on(
      table.organizationId,
      table.key,
      table.version,
    ),
    index("workflow_definitions_org_idx").on(table.organizationId),
    index("workflow_definitions_key_idx").on(table.key),
  ],
);

/** Published body is immutable — do not mutate after status=published. */
export const workflowVersions = pgTable(
  "workflow_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    definitionId: uuid("definition_id")
      .notNull()
      .references(() => workflowDefinitions.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    body: jsonb("body").$type<Record<string, unknown>>().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    publishedByMembershipId: uuid("published_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("workflow_versions_definition_version_unique").on(
      table.definitionId,
      table.version,
    ),
    index("workflow_versions_definition_idx").on(table.definitionId),
  ],
);

export const workflowTriggers = pgTable(
  "workflow_triggers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    definitionId: uuid("definition_id")
      .notNull()
      .references(() => workflowDefinitions.id, { onDelete: "cascade" }),
    versionId: uuid("version_id").references(() => workflowVersions.id, { onDelete: "cascade" }),
    triggerType: workflowTriggerTypeEnum("trigger_type").notNull(),
    eventKey: text("event_key"),
    scheduleCron: text("schedule_cron"),
    config: jsonb("config").$type<Record<string, unknown>>(),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("workflow_triggers_definition_idx").on(table.definitionId),
    index("workflow_triggers_type_idx").on(table.triggerType),
  ],
);

export const workflowConditions = pgTable(
  "workflow_conditions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    definitionId: uuid("definition_id")
      .notNull()
      .references(() => workflowDefinitions.id, { onDelete: "cascade" }),
    versionId: uuid("version_id").references(() => workflowVersions.id, { onDelete: "cascade" }),
    parentConditionId: uuid("parent_condition_id"),
    operator: workflowConditionOperatorEnum("operator").notNull(),
    fieldPath: text("field_path"),
    value: jsonb("value").$type<unknown>(),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index("workflow_conditions_definition_idx").on(table.definitionId),
    index("workflow_conditions_version_idx").on(table.versionId),
  ],
);

export const workflowActions = pgTable(
  "workflow_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    definitionId: uuid("definition_id")
      .notNull()
      .references(() => workflowDefinitions.id, { onDelete: "cascade" }),
    versionId: uuid("version_id").references(() => workflowVersions.id, { onDelete: "cascade" }),
    actionType: workflowActionTypeEnum("action_type").notNull(),
    name: text("name"),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    sortOrder: integer("sort_order").notNull().default(0),
    timeoutMs: integer("timeout_ms"),
    maxAttempts: integer("max_attempts").notNull().default(1),
    failurePolicy: workflowFailurePolicyEnum("failure_policy").notNull().default("stop"),
    ...timestamps,
  },
  (table) => [
    index("workflow_actions_definition_idx").on(table.definitionId),
    index("workflow_actions_version_idx").on(table.versionId),
  ],
);

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    definitionId: uuid("definition_id")
      .notNull()
      .references(() => workflowDefinitions.id, { onDelete: "restrict" }),
    versionId: uuid("version_id").references(() => workflowVersions.id, {
      onDelete: "restrict",
    }),
    version: integer("version").notNull(),
    triggerType: workflowTriggerTypeEnum("trigger_type").notNull(),
    triggerReference: text("trigger_reference"),
    status: workflowRunStatusEnum("status").notNull().default("queued"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    failedAt: timestamp("failed_at", { withTimezone: true, mode: "date" }),
    idempotencyKey: text("idempotency_key").notNull(),
    dryRun: boolean("dry_run").notNull().default(false),
    errorCode: text("error_code"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("workflow_runs_org_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    index("workflow_runs_definition_idx").on(table.definitionId),
    index("workflow_runs_org_status_idx").on(table.organizationId, table.status),
  ],
);

export const workflowStepRuns = pgTable(
  "workflow_step_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowRunId: uuid("workflow_run_id")
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "cascade" }),
    actionId: uuid("action_id").references(() => workflowActions.id, { onDelete: "set null" }),
    status: workflowStepStatusEnum("status").notNull().default("pending"),
    attempt: integer("attempt").notNull().default(1),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    errorCode: text("error_code"),
    outputMetadata: jsonb("output_metadata").$type<Record<string, unknown>>(),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("workflow_step_runs_run_idx").on(table.workflowRunId),
    index("workflow_step_runs_action_idx").on(table.actionId),
  ],
);

export const workflowTemplates = pgTable(
  "workflow_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    domain: text("domain"),
    version: integer("version").notNull().default(1),
    body: jsonb("body").$type<Record<string, unknown>>().notNull(),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex("workflow_templates_key_version_unique").on(table.key, table.version)],
);

/** Append-only history of run lifecycle events. */
export const workflowRunHistory = pgTable(
  "workflow_run_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowRunId: uuid("workflow_run_id")
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("workflow_run_history_run_idx").on(table.workflowRunId),
    index("workflow_run_history_created_idx").on(table.createdAt),
  ],
);

export const workflowDefinitionsRelations = relations(workflowDefinitions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [workflowDefinitions.organizationId],
    references: [organizations.id],
  }),
  versions: many(workflowVersions),
  triggers: many(workflowTriggers),
  conditions: many(workflowConditions),
  actions: many(workflowActions),
  runs: many(workflowRuns),
}));

export const workflowVersionsRelations = relations(workflowVersions, ({ one }) => ({
  definition: one(workflowDefinitions, {
    fields: [workflowVersions.definitionId],
    references: [workflowDefinitions.id],
  }),
}));

export const workflowTriggersRelations = relations(workflowTriggers, ({ one }) => ({
  definition: one(workflowDefinitions, {
    fields: [workflowTriggers.definitionId],
    references: [workflowDefinitions.id],
  }),
}));

export const workflowConditionsRelations = relations(workflowConditions, ({ one }) => ({
  definition: one(workflowDefinitions, {
    fields: [workflowConditions.definitionId],
    references: [workflowDefinitions.id],
  }),
}));

export const workflowActionsRelations = relations(workflowActions, ({ one }) => ({
  definition: one(workflowDefinitions, {
    fields: [workflowActions.definitionId],
    references: [workflowDefinitions.id],
  }),
}));

export const workflowRunsRelations = relations(workflowRuns, ({ one, many }) => ({
  definition: one(workflowDefinitions, {
    fields: [workflowRuns.definitionId],
    references: [workflowDefinitions.id],
  }),
  organization: one(organizations, {
    fields: [workflowRuns.organizationId],
    references: [organizations.id],
  }),
  stepRuns: many(workflowStepRuns),
  history: many(workflowRunHistory),
}));

export const workflowStepRunsRelations = relations(workflowStepRuns, ({ one }) => ({
  run: one(workflowRuns, {
    fields: [workflowStepRuns.workflowRunId],
    references: [workflowRuns.id],
  }),
  action: one(workflowActions, {
    fields: [workflowStepRuns.actionId],
    references: [workflowActions.id],
  }),
}));

export const workflowRunHistoryRelations = relations(workflowRunHistory, ({ one }) => ({
  run: one(workflowRuns, {
    fields: [workflowRunHistory.workflowRunId],
    references: [workflowRuns.id],
  }),
}));
