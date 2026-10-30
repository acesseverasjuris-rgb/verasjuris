/**
 * Etapa 29 — Observabilidade operacional mínima (SLO + DR exercises).
 * Logs/métricas/tracing ficam em providers — não dump em SQL.
 */
import { relations } from "drizzle-orm";
import {
  index,
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

export const serviceSloStatusEnum = pgEnum("service_slo_status", [
  "meeting",
  "at_risk",
  "breached",
  "unknown",
  "not_configured",
]);

export const disasterRecoveryExerciseStatusEnum = pgEnum("disaster_recovery_exercise_status", [
  "planned",
  "in_progress",
  "completed",
  "failed",
  "cancelled",
]);

export const serviceSlos = pgTable(
  "service_slos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    service: text("service").notNull(),
    metric: text("metric").notNull(),
    target: text("target").notNull(),
    window: text("window").notNull(),
    status: serviceSloStatusEnum("status").notNull().default("unknown"),
    lastEvaluatedAt: timestamp("last_evaluated_at", { withTimezone: true, mode: "date" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("service_slos_org_service_metric_window_unique").on(
      table.organizationId,
      table.service,
      table.metric,
      table.window,
    ),
    index("service_slos_status_idx").on(table.status),
    index("service_slos_service_idx").on(table.service),
  ],
);

export const disasterRecoveryExercises = pgTable(
  "disaster_recovery_exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    status: disasterRecoveryExerciseStatusEnum("status").notNull().default("planned"),
    conductedAt: timestamp("conducted_at", { withTimezone: true, mode: "date" }),
    conductedByUserId: uuid("conducted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    rtoResult: text("rto_result"),
    rpoResult: text("rpo_result"),
    restoreVerified: text("restore_verified"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("disaster_recovery_exercises_status_idx").on(table.status),
    index("disaster_recovery_exercises_org_idx").on(table.organizationId),
  ],
);

export const serviceSlosRelations = relations(serviceSlos, ({ one }) => ({
  organization: one(organizations, {
    fields: [serviceSlos.organizationId],
    references: [organizations.id],
  }),
}));

export const disasterRecoveryExercisesRelations = relations(
  disasterRecoveryExercises,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [disasterRecoveryExercises.organizationId],
      references: [organizations.id],
    }),
    conductedBy: one(users, {
      fields: [disasterRecoveryExercises.conductedByUserId],
      references: [users.id],
    }),
  }),
);
