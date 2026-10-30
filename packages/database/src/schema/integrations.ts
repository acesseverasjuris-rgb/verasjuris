/**
 * Etapa 26 — Integrações externas / API pública / fontes judiciais.
 * Credenciais: apenas secret-ref (nunca plaintext). Reutiliza api_clients.
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
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./identity.js";
import { judicialProcesses } from "./judicial.js";
import { legalMatters } from "./matters.js";
import { apiClients } from "./monetization.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const integrationCredentialStatusEnum = pgEnum("integration_credential_status", [
  "configured",
  "not_configured",
  "degraded",
  "failed",
  "disabled",
  "expired",
  "rotated",
]);

export const integrationEnvironmentEnum = pgEnum("integration_environment", [
  "production",
  "sandbox",
  "staging",
  "development",
]);

export const integrationHealthStatusEnum = pgEnum("integration_health_status", [
  "healthy",
  "degraded",
  "failed",
  "not_configured",
  "unknown",
]);

export const courtDataSyncStatusEnum = pgEnum("court_data_sync_status", [
  "pending",
  "syncing",
  "synced",
  "stale",
  "failed",
  "not_configured",
]);

export const integrationCredentials = pgTable(
  "integration_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Null = platform-level credential. */
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    providerKey: text("provider_key").notNull(),
    /** Secret manager / env reference only — never plaintext secret. */
    credentialReference: text("credential_reference").notNull(),
    environment: integrationEnvironmentEnum("environment").notNull().default("production"),
    status: integrationCredentialStatusEnum("status").notNull().default("not_configured"),
    rotatedAt: timestamp("rotated_at", { withTimezone: true, mode: "date" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("integration_credentials_provider_idx").on(table.providerKey),
    index("integration_credentials_org_idx").on(table.organizationId),
    index("integration_credentials_status_idx").on(table.status),
  ],
);

export const integrationHealthChecks = pgTable(
  "integration_health_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    providerKey: text("provider_key").notNull(),
    status: integrationHealthStatusEnum("status").notNull().default("unknown"),
    checkedAt: timestamp("checked_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    latencyMs: integer("latency_ms"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("integration_health_checks_provider_idx").on(table.providerKey),
    index("integration_health_checks_checked_idx").on(table.checkedAt),
    index("integration_health_checks_org_idx").on(table.organizationId),
  ],
);

export const publicApiWebhookEndpoints = pgTable(
  "public_api_webhook_endpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    apiClientId: uuid("api_client_id").references(() => apiClients.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    /** Webhook signing secret reference — never plaintext. */
    secretReference: text("secret_reference").notNull(),
    active: boolean("active").notNull().default(true),
    events: jsonb("events").$type<string[]>().notNull().default([]),
    retryPolicy: jsonb("retry_policy").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("public_api_webhook_endpoints_org_idx").on(table.organizationId),
    index("public_api_webhook_endpoints_client_idx").on(table.apiClientId),
    index("public_api_webhook_endpoints_active_idx").on(table.active),
  ],
);

export const courtDataSources = pgTable(
  "court_data_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    tribunal: text("tribunal").notNull(),
    providerKey: text("provider_key").notNull(),
    externalReference: text("external_reference").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: "date" }),
    source: text("source"),
    confidence: text("confidence"),
    syncStatus: courtDataSyncStatusEnum("sync_status").notNull().default("pending"),
    legalMatterId: uuid("legal_matter_id").references(() => legalMatters.id, {
      onDelete: "set null",
    }),
    judicialProcessId: uuid("judicial_process_id").references(() => judicialProcesses.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("court_data_sources_org_idx").on(table.organizationId),
    index("court_data_sources_provider_idx").on(table.providerKey),
    index("court_data_sources_external_idx").on(table.externalReference),
    index("court_data_sources_sync_idx").on(table.syncStatus),
    index("court_data_sources_matter_idx").on(table.legalMatterId),
    index("court_data_sources_process_idx").on(table.judicialProcessId),
  ],
);

export const integrationCredentialsRelations = relations(integrationCredentials, ({ one }) => ({
  organization: one(organizations, {
    fields: [integrationCredentials.organizationId],
    references: [organizations.id],
  }),
}));

export const integrationHealthChecksRelations = relations(integrationHealthChecks, ({ one }) => ({
  organization: one(organizations, {
    fields: [integrationHealthChecks.organizationId],
    references: [organizations.id],
  }),
}));

export const publicApiWebhookEndpointsRelations = relations(
  publicApiWebhookEndpoints,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [publicApiWebhookEndpoints.organizationId],
      references: [organizations.id],
    }),
    apiClient: one(apiClients, {
      fields: [publicApiWebhookEndpoints.apiClientId],
      references: [apiClients.id],
    }),
  }),
);

export const courtDataSourcesRelations = relations(courtDataSources, ({ one }) => ({
  organization: one(organizations, {
    fields: [courtDataSources.organizationId],
    references: [organizations.id],
  }),
  legalMatter: one(legalMatters, {
    fields: [courtDataSources.legalMatterId],
    references: [legalMatters.id],
  }),
  judicialProcess: one(judicialProcesses, {
    fields: [courtDataSources.judicialProcessId],
    references: [judicialProcesses.id],
  }),
}));
