/**
 * Etapa 33 — Enterprise (SSO/SCIM/policies/SLA).
 * Branding/domínio: reutiliza white_label_configs (extend via ALTER) — não duplicar.
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
import { organizations } from "./identity.js";
import { whiteLabelConfigs } from "./monetization.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const enterpriseSsoProtocolEnum = pgEnum("enterprise_sso_protocol", ["saml", "oidc"]);

export const enterpriseSsoStatusEnum = pgEnum("enterprise_sso_status", [
  "not_configured",
  "draft",
  "configured",
  "active",
  "disabled",
  "failed",
]);

export const enterpriseSlaStatusEnum = pgEnum("enterprise_sla_status", [
  "draft",
  "active",
  "paused",
  "expired",
  "breached",
]);

export const enterpriseSsoConfigs = pgTable(
  "enterprise_sso_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    protocol: enterpriseSsoProtocolEnum("protocol").notNull().default("oidc"),
    status: enterpriseSsoStatusEnum("status").notNull().default("not_configured"),
    /** Non-secret IdP metadata (entity IDs, endpoints, attribute maps). */
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    /** Secret manager reference for client secret / signing key — never plaintext. */
    secretReference: text("secret_reference"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("enterprise_sso_configs_org_protocol_unique").on(
      table.organizationId,
      table.protocol,
    ),
    index("enterprise_sso_configs_status_idx").on(table.status),
  ],
);

export const organizationSecurityPolicies = pgTable(
  "organization_security_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    mfaRequired: boolean("mfa_required").notNull().default(false),
    mfaPolicy: text("mfa_policy").notNull().default("optional"),
    sessionTimeoutMinutes: integer("session_timeout_minutes").notNull().default(480),
    ipRestrictions: jsonb("ip_restrictions").$type<string[]>().notNull().default([]),
    ssoRequired: boolean("sso_required").notNull().default(false),
    allowedAuthMethods: jsonb("allowed_auth_methods")
      .$type<string[]>()
      .notNull()
      .default(["password"]),
    documentRetentionDays: integer("document_retention_days"),
    apiPolicy: jsonb("api_policy").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [uniqueIndex("organization_security_policies_org_unique").on(table.organizationId)],
);

export const enterpriseSlas = pgTable(
  "enterprise_slas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: enterpriseSlaStatusEnum("status").notNull().default("draft"),
    availabilityTarget: text("availability_target"),
    supportTier: text("support_tier"),
    responseTimeMinutes: integer("response_time_minutes"),
    resolutionTimeHours: integer("resolution_time_hours"),
    /** Optional branding/domain context via white-label — no duplicate domain table. */
    whiteLabelConfigId: uuid("white_label_config_id").references(() => whiteLabelConfigs.id, {
      onDelete: "set null",
    }),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("enterprise_slas_org_idx").on(table.organizationId),
    index("enterprise_slas_status_idx").on(table.status),
  ],
);

export const enterpriseSsoConfigsRelations = relations(enterpriseSsoConfigs, ({ one }) => ({
  organization: one(organizations, {
    fields: [enterpriseSsoConfigs.organizationId],
    references: [organizations.id],
  }),
}));

export const organizationSecurityPoliciesRelations = relations(
  organizationSecurityPolicies,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationSecurityPolicies.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const enterpriseSlasRelations = relations(enterpriseSlas, ({ one }) => ({
  organization: one(organizations, {
    fields: [enterpriseSlas.organizationId],
    references: [organizations.id],
  }),
  whiteLabelConfig: one(whiteLabelConfigs, {
    fields: [enterpriseSlas.whiteLabelConfigId],
    references: [whiteLabelConfigs.id],
  }),
}));
