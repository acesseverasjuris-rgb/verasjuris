/**
 * Etapa 28 — LGPD / privacy governance.
 * Consent storage: reuse communication_consents (reference, do not duplicate).
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { communicationConsents } from "./communication.js";
import { contracts } from "./contracts.js";
import { organizations, users } from "./identity.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const legalBasisTypeEnum = pgEnum("legal_basis_type", [
  "consent",
  "contract",
  "legal_obligation",
  "regulatory",
  "legitimate_interest",
  "legal_process",
  "credit_protection",
  "health",
  "other",
]);

export const dataSubjectCategoryEnum = pgEnum("data_subject_category", [
  "client",
  "user",
  "employee",
  "professional",
  "partner",
  "vendor",
  "visitor",
  "other",
]);

export const dataAssetStatusEnum = pgEnum("data_asset_status", [
  "draft",
  "active",
  "under_review",
  "retired",
]);

export const dataRetentionTriggerEnum = pgEnum("data_retention_trigger", [
  "created_at",
  "last_activity",
  "contract_end",
  "relationship_end",
  "legal_event",
  "manual",
]);

export const dataDisposalMethodEnum = pgEnum("data_disposal_method", [
  "delete",
  "anonymize",
  "archive",
  "legal_hold",
  "manual_review",
]);

export const dataSubjectRequestTypeEnum = pgEnum("data_subject_request_type", [
  "access",
  "portability",
  "correction",
  "deletion",
  "anonymization",
  "restriction",
  "objection",
  "consent_withdrawal",
]);

export const dataSubjectRequestStatusEnum = pgEnum("data_subject_request_status", [
  "received",
  "identity_pending",
  "under_review",
  "in_progress",
  "completed",
  "partially_completed",
  "rejected",
  "cancelled",
]);

export const privacyOfficerRoleEnum = pgEnum("privacy_officer_role", [
  "dpo",
  "deputy_dpo",
  "privacy_contact",
  "other",
]);

export const privacyIncidentAssessmentStatusEnum = pgEnum("privacy_incident_assessment_status", [
  "draft",
  "in_progress",
  "completed",
  "reported",
  "closed",
]);

export const legalBases = pgTable(
  "legal_bases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(),
    type: legalBasisTypeEnum("type").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("legal_bases_org_key_unique").on(table.organizationId, table.key),
    index("legal_bases_type_idx").on(table.type),
  ],
);

export const dataRetentionPolicies = pgTable(
  "data_retention_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    dataType: text("data_type").notNull(),
    durationDays: text("duration_days"),
    trigger: dataRetentionTriggerEnum("trigger").notNull().default("created_at"),
    legalHoldOverride: boolean("legal_hold_override").notNull().default(true),
    disposalMethod: dataDisposalMethodEnum("disposal_method").notNull().default("manual_review"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("data_retention_policies_org_key_unique").on(table.organizationId, table.key),
    index("data_retention_policies_data_type_idx").on(table.dataType),
  ],
);

export const dataAssets = pgTable(
  "data_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    systemDomain: text("system_domain").notNull(),
    dataCategory: text("data_category").notNull(),
    purpose: text("purpose").notNull(),
    ownerMembershipOrUser: text("owner_label"),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    processorLabel: text("processor_label"),
    storageLocation: text("storage_location"),
    retentionPolicyId: uuid("retention_policy_id").references(() => dataRetentionPolicies.id, {
      onDelete: "set null",
    }),
    legalBasisId: uuid("legal_basis_id").references(() => legalBases.id, { onDelete: "set null" }),
    sensitive: boolean("sensitive").notNull().default(false),
    internationalTransfer: boolean("international_transfer").notNull().default(false),
    status: dataAssetStatusEnum("status").notNull().default("draft"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("data_assets_org_idx").on(table.organizationId),
    index("data_assets_status_idx").on(table.status),
    index("data_assets_domain_idx").on(table.systemDomain),
  ],
);

export const processingActivities = pgTable(
  "processing_activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    purpose: text("purpose").notNull(),
    dataSubjects: jsonb("data_subjects").$type<string[]>().notNull().default([]),
    dataCategories: jsonb("data_categories").$type<string[]>().notNull().default([]),
    legalBasisId: uuid("legal_basis_id").references(() => legalBases.id, { onDelete: "set null" }),
    retentionPolicyId: uuid("retention_policy_id").references(() => dataRetentionPolicies.id, {
      onDelete: "set null",
    }),
    securityMeasures: text("security_measures"),
    transfers: text("transfers"),
    /** Optional link into communication consent registry (no duplicate consent store). */
    relatedConsentChannel: text("related_consent_channel"),
    active: boolean("active").notNull().default(true),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("processing_activities_org_key_unique").on(table.organizationId, table.key),
    index("processing_activities_org_idx").on(table.organizationId),
  ],
);

export const dataSubjectRequests = pgTable(
  "data_subject_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: dataSubjectRequestTypeEnum("type").notNull(),
    status: dataSubjectRequestStatusEnum("status").notNull().default("received"),
    subjectCategory: dataSubjectCategoryEnum("subject_category").notNull().default("other"),
    subjectUserId: uuid("subject_user_id").references(() => users.id, { onDelete: "set null" }),
    subjectExternalRef: text("subject_external_ref"),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Unify with communication consents when request is consent_withdrawal. */
    communicationConsentId: uuid("communication_consent_id").references(
      () => communicationConsents.id,
      { onDelete: "set null" },
    ),
    identityVerifiedAt: timestamp("identity_verified_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("data_subject_requests_org_idx").on(table.organizationId),
    index("data_subject_requests_status_idx").on(table.status),
    index("data_subject_requests_type_idx").on(table.type),
  ],
);

export const privacyOfficers = pgTable(
  "privacy_officers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    role: privacyOfficerRoleEnum("role").notNull().default("dpo"),
    displayName: text("display_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("privacy_officers_org_idx").on(table.organizationId),
    index("privacy_officers_role_idx").on(table.role),
  ],
);

export const dataProcessors = pgTable(
  "data_processors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    vendorName: text("vendor_name").notNull(),
    purpose: text("purpose").notNull(),
    location: text("location"),
    contractId: uuid("contract_id").references(() => contracts.id, { onDelete: "set null" }),
    dpaDocumentRef: text("dpa_document_ref"),
    subprocessorSupport: boolean("subprocessor_support").notNull().default(false),
    active: boolean("active").notNull().default(true),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("data_processors_org_idx").on(table.organizationId),
    index("data_processors_vendor_idx").on(table.vendorName),
  ],
);

export const privacyIncidentAssessments = pgTable(
  "privacy_incident_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Soft link to compliance_incidents when present (privacy breach type). */
    complianceIncidentId: uuid("compliance_incident_id"),
    title: text("title").notNull(),
    status: privacyIncidentAssessmentStatusEnum("status").notNull().default("draft"),
    riskLevel: text("risk_level"),
    affectedSubjectsEstimate: text("affected_subjects_estimate"),
    authorityNotificationRequired: boolean("authority_notification_required")
      .notNull()
      .default(false),
    authorityNotifiedAt: timestamp("authority_notified_at", { withTimezone: true, mode: "date" }),
    assessment: jsonb("assessment").$type<Record<string, unknown>>(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("privacy_incident_assessments_org_idx").on(table.organizationId),
    index("privacy_incident_assessments_status_idx").on(table.status),
  ],
);

export const legalBasesRelations = relations(legalBases, ({ one }) => ({
  organization: one(organizations, {
    fields: [legalBases.organizationId],
    references: [organizations.id],
  }),
}));

export const dataRetentionPoliciesRelations = relations(dataRetentionPolicies, ({ one }) => ({
  organization: one(organizations, {
    fields: [dataRetentionPolicies.organizationId],
    references: [organizations.id],
  }),
}));

export const dataAssetsRelations = relations(dataAssets, ({ one }) => ({
  organization: one(organizations, {
    fields: [dataAssets.organizationId],
    references: [organizations.id],
  }),
  retentionPolicy: one(dataRetentionPolicies, {
    fields: [dataAssets.retentionPolicyId],
    references: [dataRetentionPolicies.id],
  }),
  legalBasis: one(legalBases, {
    fields: [dataAssets.legalBasisId],
    references: [legalBases.id],
  }),
}));

export const processingActivitiesRelations = relations(processingActivities, ({ one }) => ({
  organization: one(organizations, {
    fields: [processingActivities.organizationId],
    references: [organizations.id],
  }),
  legalBasis: one(legalBases, {
    fields: [processingActivities.legalBasisId],
    references: [legalBases.id],
  }),
  retentionPolicy: one(dataRetentionPolicies, {
    fields: [processingActivities.retentionPolicyId],
    references: [dataRetentionPolicies.id],
  }),
}));

export const dataSubjectRequestsRelations = relations(dataSubjectRequests, ({ one }) => ({
  organization: one(organizations, {
    fields: [dataSubjectRequests.organizationId],
    references: [organizations.id],
  }),
  communicationConsent: one(communicationConsents, {
    fields: [dataSubjectRequests.communicationConsentId],
    references: [communicationConsents.id],
  }),
}));

export const privacyOfficersRelations = relations(privacyOfficers, ({ one }) => ({
  organization: one(organizations, {
    fields: [privacyOfficers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, { fields: [privacyOfficers.userId], references: [users.id] }),
}));

export const dataProcessorsRelations = relations(dataProcessors, ({ one }) => ({
  organization: one(organizations, {
    fields: [dataProcessors.organizationId],
    references: [organizations.id],
  }),
  contract: one(contracts, {
    fields: [dataProcessors.contractId],
    references: [contracts.id],
  }),
}));

export const privacyIncidentAssessmentsRelations = relations(
  privacyIncidentAssessments,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [privacyIncidentAssessments.organizationId],
      references: [organizations.id],
    }),
  }),
);
