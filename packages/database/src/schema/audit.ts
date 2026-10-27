import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations, users } from "./identity.js";

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "restrict",
    }),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    source: text("source").notNull(),
    requestId: text("request_id"),
    ip: text("ip"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    before: jsonb("before_state").$type<Record<string, unknown>>(),
    after: jsonb("after_state").$type<Record<string, unknown>>(),
  },
  (table) => [
    index("audit_events_organization_occurred_idx").on(table.organizationId, table.occurredAt),
    index("audit_events_actor_idx").on(table.actorUserId),
  ],
);
