import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  bigint,
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

export const aiRequestStatusEnum = pgEnum("ai_request_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "not_configured",
]);

export const aiJobStatusEnum = pgEnum("ai_job_status", [
  "pending",
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "not_configured",
]);

export const aiPromptVersionStatusEnum = pgEnum("ai_prompt_version_status", [
  "draft",
  "review",
  "approved",
  "active",
  "deprecated",
]);

export const aiOutputDispositionEnum = pgEnum("ai_output_disposition", [
  "draft",
  "assistive",
  "requires_review",
]);

export const aiBudgetPeriodEnum = pgEnum("ai_budget_period", ["daily", "monthly"]);

/** Catálogo global de modelos — preços em micros da moeda (1 unidade = 1_000_000 micros). */
export const aiModels = pgTable(
  "ai_models",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerKey: text("provider_key").notNull(),
    externalModelId: text("external_model_id").notNull(),
    displayName: text("display_name").notNull(),
    modelFamily: text("model_family"),
    capabilities: jsonb("capabilities").$type<string[]>().notNull().default([]),
    contextWindow: integer("context_window"),
    inputCostPerMillionMicros: bigint("input_cost_per_million_micros", { mode: "number" })
      .notNull()
      .default(0),
    outputCostPerMillionMicros: bigint("output_cost_per_million_micros", { mode: "number" })
      .notNull()
      .default(0),
    currency: text("currency").notNull().default("BRL"),
    pricingUnit: text("pricing_unit").notNull().default("million_tokens"),
    active: boolean("active").notNull().default(true),
    configured: boolean("configured").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("ai_models_provider_external_unique").on(table.providerKey, table.externalModelId),
    index("ai_models_active_idx").on(table.active),
  ],
);

export const aiPrompts = pgTable(
  "ai_prompts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    feature: text("feature").notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex("ai_prompts_key_unique").on(table.key)],
);

export const aiPromptVersions = pgTable(
  "ai_prompt_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    promptId: uuid("prompt_id")
      .notNull()
      .references(() => aiPrompts.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    systemTemplate: text("system_template").notNull(),
    userTemplate: text("user_template").notNull(),
    outputSchema: jsonb("output_schema").$type<Record<string, unknown>>(),
    safetyInstructions: text("safety_instructions"),
    changelog: text("changelog"),
    status: aiPromptVersionStatusEnum("status").notNull().default("draft"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    activatedAt: timestamp("activated_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("ai_prompt_versions_prompt_version_unique").on(table.promptId, table.version),
    index("ai_prompt_versions_status_idx").on(table.promptId, table.status),
  ],
);

export const aiSafetyRules = pgTable(
  "ai_safety_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    ruleType: text("rule_type").notNull(),
    description: text("description").notNull(),
    active: boolean("active").notNull().default(true),
    config: jsonb("config").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [uniqueIndex("ai_safety_rules_key_unique").on(table.key)],
);

export const aiRequests = pgTable(
  "ai_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    feature: text("feature").notNull(),
    provider: text("provider").notNull(),
    modelId: uuid("model_id").references(() => aiModels.id, { onDelete: "set null" }),
    promptVersionId: uuid("prompt_version_id").references(() => aiPromptVersions.id, {
      onDelete: "set null",
    }),
    status: aiRequestStatusEnum("status").notNull().default("pending"),
    outputDisposition: aiOutputDispositionEnum("output_disposition")
      .notNull()
      .default("requires_review"),
    inputReference: text("input_reference"),
    correlationId: text("correlation_id"),
    idempotencyKey: text("idempotency_key"),
    requestedAt: timestamp("requested_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "date" }),
    durationMs: integer("duration_ms"),
    errorCode: text("error_code"),
    errorSafeMessage: text("error_safe_message"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_requests_org_idx").on(table.organizationId),
    index("ai_requests_org_feature_idx").on(table.organizationId, table.feature),
    uniqueIndex("ai_requests_idempotency_unique").on(
      table.organizationId,
      table.feature,
      table.idempotencyKey,
    ),
  ],
);

export const aiResponses = pgTable(
  "ai_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    aiRequestId: uuid("ai_request_id")
      .notNull()
      .references(() => aiRequests.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    outputType: text("output_type").notNull().default("structured"),
    structuredResult: jsonb("structured_result").$type<Record<string, unknown>>(),
    rawProviderReference: text("raw_provider_reference"),
    finishReason: text("finish_reason"),
    modelVersion: text("model_version"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_responses_request_idx").on(table.aiRequestId),
    index("ai_responses_org_idx").on(table.organizationId),
  ],
);

/** Custos em micros (inteiro). estimated ≠ providerReported. */
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    aiRequestId: uuid("ai_request_id")
      .notNull()
      .references(() => aiRequests.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    modelExternalId: text("model_external_id"),
    feature: text("feature").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    cachedInputTokens: integer("cached_input_tokens"),
    totalTokens: integer("total_tokens"),
    tokensAreEstimate: boolean("tokens_are_estimate").notNull().default(false),
    estimatedCostMicros: bigint("estimated_cost_micros", { mode: "number" }).notNull().default(0),
    providerReportedCostMicros: bigint("provider_reported_cost_micros", { mode: "number" }),
    currency: text("currency").notNull().default("BRL"),
    durationMs: integer("duration_ms"),
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("ai_usage_request_unique").on(table.aiRequestId),
    index("ai_usage_org_recorded_idx").on(table.organizationId, table.recordedAt),
  ],
);

export const aiJobs = pgTable(
  "ai_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    jobType: text("job_type").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id").notNull(),
    status: aiJobStatusEnum("status").notNull().default("pending"),
    progress: integer("progress").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    idempotencyKey: text("idempotency_key"),
    runtime: text("runtime").notNull().default("local_in_process"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "date" }),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    failedAt: timestamp("failed_at", { withTimezone: true, mode: "date" }),
    lastErrorCode: text("last_error_code"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("ai_jobs_org_status_idx").on(table.organizationId, table.status),
    uniqueIndex("ai_jobs_idempotency_unique").on(
      table.organizationId,
      table.jobType,
      table.idempotencyKey,
    ),
  ],
);

export const aiResultSources = pgTable(
  "ai_result_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    aiRequestId: uuid("ai_request_id")
      .notNull()
      .references(() => aiRequests.id, { onDelete: "cascade" }),
    resourceType: text("resource_type"),
    resourceId: uuid("resource_id"),
    documentId: uuid("document_id"),
    documentVersionId: uuid("document_version_id"),
    pageNumber: integer("page_number"),
    textStart: integer("text_start"),
    textEnd: integer("text_end"),
    sourceLabel: text("source_label").notNull(),
    sourceHash: text("source_hash"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_result_sources_request_idx").on(table.aiRequestId),
    index("ai_result_sources_org_idx").on(table.organizationId),
  ],
);

export const aiBudgets = pgTable(
  "ai_budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    period: aiBudgetPeriodEnum("period").notNull().default("monthly"),
    softLimitMicros: bigint("soft_limit_micros", { mode: "number" }),
    hardLimitMicros: bigint("hard_limit_micros", { mode: "number" }),
    currency: text("currency").notNull().default("BRL"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex("ai_budgets_org_period_unique").on(table.organizationId, table.period)],
);

export const aiModelsRelations = relations(aiModels, ({ many }) => ({
  requests: many(aiRequests),
}));

export const aiPromptsRelations = relations(aiPrompts, ({ many }) => ({
  versions: many(aiPromptVersions),
}));

export const aiPromptVersionsRelations = relations(aiPromptVersions, ({ one }) => ({
  prompt: one(aiPrompts, { fields: [aiPromptVersions.promptId], references: [aiPrompts.id] }),
}));

export const aiRequestsRelations = relations(aiRequests, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [aiRequests.organizationId],
    references: [organizations.id],
  }),
  response: one(aiResponses),
  usage: one(aiUsage),
  sources: many(aiResultSources),
}));

export const aiResponsesRelations = relations(aiResponses, ({ one }) => ({
  request: one(aiRequests, { fields: [aiResponses.aiRequestId], references: [aiRequests.id] }),
}));

export const aiUsageRelations = relations(aiUsage, ({ one }) => ({
  request: one(aiRequests, { fields: [aiUsage.aiRequestId], references: [aiRequests.id] }),
}));

export const aiJobsRelations = relations(aiJobs, ({ one }) => ({
  organization: one(organizations, {
    fields: [aiJobs.organizationId],
    references: [organizations.id],
  }),
}));

export const aiResultSourcesRelations = relations(aiResultSources, ({ one }) => ({
  request: one(aiRequests, {
    fields: [aiResultSources.aiRequestId],
    references: [aiRequests.id],
  }),
}));

export const aiBudgetsRelations = relations(aiBudgets, ({ one }) => ({
  organization: one(organizations, {
    fields: [aiBudgets.organizationId],
    references: [organizations.id],
  }),
}));
