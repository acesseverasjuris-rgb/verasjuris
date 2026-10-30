/**
 * Etapa 24 — Analytics / BI read-model.
 * Domínios originais permanecem source of truth. Snapshots versionados por formulaVersion.
 */
import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations, users } from "./identity.js";

export const analyticsExportStatusEnum = pgEnum("analytics_export_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const analyticsExportFormatEnum = pgEnum("analytics_export_format", ["csv", "xlsx"]);

export const analyticsMetricSnapshots = pgTable(
  "analytics_metric_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    metricKey: text("metric_key").notNull(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    periodStart: timestamp("period_start", { withTimezone: true, mode: "date" }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true, mode: "date" }).notNull(),
    dimensions: jsonb("dimensions").$type<Record<string, unknown>>().notNull().default({}),
    /** Canonical key for uniqueness when dimensions vary (e.g. sorted JSON). */
    dimensionsKey: text("dimensions_key").notNull().default(""),
    value: numeric("value").notNull(),
    formulaVersion: text("formula_version").notNull(),
    calculatedAt: timestamp("calculated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("analytics_metric_snapshots_unique").on(
      table.metricKey,
      table.periodStart,
      table.periodEnd,
      table.dimensionsKey,
      table.organizationId,
    ),
    index("analytics_metric_snapshots_metric_idx").on(table.metricKey),
    index("analytics_metric_snapshots_org_idx").on(table.organizationId),
    index("analytics_metric_snapshots_period_idx").on(table.periodStart, table.periodEnd),
  ],
);

export const analyticsExportJobs = pgTable(
  "analytics_export_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    status: analyticsExportStatusEnum("status").notNull().default("pending"),
    format: analyticsExportFormatEnum("format").notNull().default("csv"),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    errorCode: text("error_code"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  (table) => [
    index("analytics_export_jobs_org_idx").on(table.organizationId),
    index("analytics_export_jobs_status_idx").on(table.status),
  ],
);

export const analyticsMetricSnapshotsRelations = relations(analyticsMetricSnapshots, ({ one }) => ({
  organization: one(organizations, {
    fields: [analyticsMetricSnapshots.organizationId],
    references: [organizations.id],
  }),
}));

export const analyticsExportJobsRelations = relations(analyticsExportJobs, ({ one }) => ({
  organization: one(organizations, {
    fields: [analyticsExportJobs.organizationId],
    references: [organizations.id],
  }),
}));
