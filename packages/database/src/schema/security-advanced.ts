/**
 * Etapa 27 — Segurança avançada (MFA, passkeys, devices, events, vulns, pentest).
 * Recovery codes: hash-only. MFA secrets: secretReference / ciphertext — never plaintext.
 * Extende sessions/users existentes (ver identity.ts + migration ALTER).
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
import { documents } from "./documents.js";
import { organizations, users } from "./identity.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const mfaMethodTypeEnum = pgEnum("mfa_method_type", ["totp"]);

export const mfaMethodStatusEnum = pgEnum("mfa_method_status", [
  "pending",
  "active",
  "disabled",
  "locked",
]);

export const securityEventTypeEnum = pgEnum("security_event_type", [
  "login_failure",
  "mfa_failure",
  "session_anomaly",
  "privilege_change",
  "secret_failure",
  "rate_limit",
  "suspicious_upload",
  "webhook_invalid",
  "payment_anomaly",
  "api_abuse",
  "other",
]);

export const securitySeverityEnum = pgEnum("security_severity", [
  "info",
  "low",
  "medium",
  "high",
  "critical",
]);

export const securityAlertStatusEnum = pgEnum("security_alert_status", [
  "open",
  "acknowledged",
  "investigating",
  "resolved",
  "dismissed",
]);

export const securityVulnerabilityStatusEnum = pgEnum("security_vulnerability_status", [
  "open",
  "triaged",
  "in_remediation",
  "fixed",
  "accepted",
  "false_positive",
]);

export const securityPentestStatusEnum = pgEnum("security_pentest_status", [
  "planned",
  "in_progress",
  "completed",
  "report_pending",
  /** Never auto-approved — requires real report review. */
  "approved",
  "rejected",
  "cancelled",
]);

export const mfaMethods = pgTable(
  "mfa_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: mfaMethodTypeEnum("type").notNull().default("totp"),
    /**
     * Prefer secret manager ref. Ciphertext at-rest via app secret when
     * KeyManagementProvider is NOT_CONFIGURED — never plaintext.
     */
    secretReference: text("secret_reference"),
    status: mfaMethodStatusEnum("status").notNull().default("pending"),
    verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "date" }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("mfa_methods_user_idx").on(table.userId),
    index("mfa_methods_status_idx").on(table.status),
  ],
);

export const mfaRecoveryCodes = pgTable(
  "mfa_recovery_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Hash only — never store plaintext recovery codes. */
    codeHash: text("code_hash").notNull(),
    usedAt: timestamp("used_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("mfa_recovery_codes_hash_unique").on(table.codeHash),
    index("mfa_recovery_codes_user_idx").on(table.userId),
  ],
);

export const passkeyCredentials = pgTable(
  "passkey_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    credentialId: text("credential_id").notNull(),
    publicKey: text("public_key").notNull(),
    counter: integer("counter").notNull().default(0),
    transports: jsonb("transports").$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    uniqueIndex("passkey_credentials_credential_id_unique").on(table.credentialId),
    index("passkey_credentials_user_idx").on(table.userId),
  ],
);

export const userDevices = pgTable(
  "user_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    deviceName: text("device_name"),
    browser: text("browser"),
    os: text("os"),
    trusted: boolean("trusted").notNull().default(false),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    uniqueIndex("user_devices_user_device_unique").on(table.userId, table.deviceId),
    index("user_devices_user_idx").on(table.userId),
  ],
);

export const securityEvents = pgTable(
  "security_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: securityEventTypeEnum("type").notNull(),
    severity: securitySeverityEnum("severity").notNull().default("info"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    /** Sanitized metadata only — no secrets / raw PII dumps. */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("security_events_type_idx").on(table.type),
    index("security_events_severity_idx").on(table.severity),
    index("security_events_user_idx").on(table.userId),
    index("security_events_org_idx").on(table.organizationId),
    index("security_events_created_idx").on(table.createdAt),
  ],
);

export const securityAlerts = pgTable(
  "security_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    status: securityAlertStatusEnum("status").notNull().default("open"),
    eventId: uuid("event_id").references(() => securityEvents.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    severity: securitySeverityEnum("severity").notNull().default("medium"),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true, mode: "date" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("security_alerts_status_idx").on(table.status),
    index("security_alerts_severity_idx").on(table.severity),
    index("security_alerts_org_idx").on(table.organizationId),
  ],
);

export const securityVulnerabilities = pgTable(
  "security_vulnerabilities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull(),
    identifier: text("identifier").notNull(),
    packageName: text("package_name"),
    severity: securitySeverityEnum("severity").notNull().default("medium"),
    status: securityVulnerabilityStatusEnum("status").notNull().default("open"),
    detectedAt: timestamp("detected_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    fixedAt: timestamp("fixed_at", { withTimezone: true, mode: "date" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("security_vulnerabilities_status_idx").on(table.status),
    index("security_vulnerabilities_severity_idx").on(table.severity),
    index("security_vulnerabilities_identifier_idx").on(table.identifier),
    uniqueIndex("security_vulnerabilities_source_identifier_unique").on(
      table.source,
      table.identifier,
    ),
  ],
);

export const securityPentests = pgTable(
  "security_pentests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    /** Never auto-approved without a real report. */
    status: securityPentestStatusEnum("status").notNull().default("planned"),
    reportDocumentId: uuid("report_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    conductedAt: timestamp("conducted_at", { withTimezone: true, mode: "date" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("security_pentests_status_idx").on(table.status),
    index("security_pentests_org_idx").on(table.organizationId),
  ],
);

export const mfaMethodsRelations = relations(mfaMethods, ({ one }) => ({
  user: one(users, { fields: [mfaMethods.userId], references: [users.id] }),
}));

export const mfaRecoveryCodesRelations = relations(mfaRecoveryCodes, ({ one }) => ({
  user: one(users, { fields: [mfaRecoveryCodes.userId], references: [users.id] }),
}));

export const passkeyCredentialsRelations = relations(passkeyCredentials, ({ one }) => ({
  user: one(users, { fields: [passkeyCredentials.userId], references: [users.id] }),
}));

export const userDevicesRelations = relations(userDevices, ({ one }) => ({
  user: one(users, { fields: [userDevices.userId], references: [users.id] }),
}));

export const securityEventsRelations = relations(securityEvents, ({ one }) => ({
  user: one(users, { fields: [securityEvents.userId], references: [users.id] }),
  organization: one(organizations, {
    fields: [securityEvents.organizationId],
    references: [organizations.id],
  }),
}));

export const securityAlertsRelations = relations(securityAlerts, ({ one }) => ({
  event: one(securityEvents, {
    fields: [securityAlerts.eventId],
    references: [securityEvents.id],
  }),
  organization: one(organizations, {
    fields: [securityAlerts.organizationId],
    references: [organizations.id],
  }),
}));

export const securityVulnerabilitiesRelations = relations(securityVulnerabilities, () => ({}));

export const securityPentestsRelations = relations(securityPentests, ({ one }) => ({
  reportDocument: one(documents, {
    fields: [securityPentests.reportDocumentId],
    references: [documents.id],
  }),
  organization: one(organizations, {
    fields: [securityPentests.organizationId],
    references: [organizations.id],
  }),
}));
