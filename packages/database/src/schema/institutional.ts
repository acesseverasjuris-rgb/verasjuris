/**
 * Rodapé institucional — políticas versionáveis (draft → published).
 * Conteúdo jurídico definitivo requer aprovação humana.
 */
import { relations } from "drizzle-orm";
import {
  index,
  integer,
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

export const institutionalPolicyStatusEnum = pgEnum("institutional_policy_status", [
  "draft",
  "reviewed",
  "approved",
  "published",
  "superseded",
]);

export const institutionalPolicies = pgTable(
  "institutional_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Null = platform-wide policy. */
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(),
    title: text("title").notNull(),
    category: text("category").notNull().default("legal"),
    locale: text("locale").notNull().default("pt-BR"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("institutional_policies_org_key_locale_unique").on(
      table.organizationId,
      table.key,
      table.locale,
    ),
    index("institutional_policies_key_idx").on(table.key),
  ],
);

export const institutionalPolicyVersions = pgTable(
  "institutional_policy_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => institutionalPolicies.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: institutionalPolicyStatusEnum("status").notNull().default("draft"),
    content: text("content").notNull(),
    locale: text("locale").notNull().default("pt-BR"),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("institutional_policy_versions_policy_version_unique").on(
      table.policyId,
      table.version,
    ),
    index("institutional_policy_versions_status_idx").on(table.status),
  ],
);

export const institutionalPoliciesRelations = relations(institutionalPolicies, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [institutionalPolicies.organizationId],
    references: [organizations.id],
  }),
  versions: many(institutionalPolicyVersions),
}));

export const institutionalPolicyVersionsRelations = relations(
  institutionalPolicyVersions,
  ({ one }) => ({
    policy: one(institutionalPolicies, {
      fields: [institutionalPolicyVersions.policyId],
      references: [institutionalPolicies.id],
    }),
  }),
);
