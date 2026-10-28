/**
 * Etapa 17.1 — Verificação profissional.
 * Perfil ≠ verificação. OAB informada ≠ verificada. CPF format ≠ identidade.
 * Providers externos: NOT_CONFIGURED por padrão. Sem biometria simulada.
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
import { documents } from "./documents.js";
import { organizationMembers, users } from "./identity.js";
import { lawyerProfiles } from "./profiles.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const professionalVerificationTypeEnum = pgEnum("professional_verification_type", [
  "oab",
  "cpf",
  "identity",
  "document",
  "biometric",
  "address",
  "other",
]);

/**
 * Status do *caso* de verificação — enum distinto de
 * `professional_verification_status` em identity.ts (perfil legado: not_submitted/pending/verified/rejected).
 */
export const professionalVerificationCaseStatusEnum = pgEnum(
  "professional_verification_case_status",
  [
    "not_started",
    "pending",
    "in_review",
    "verified",
    "rejected",
    "expired",
    "suspended",
    "revalidation_required",
    "not_configured",
  ],
);

export const professionalVerificationRiskEnum = pgEnum("professional_verification_risk", [
  "low",
  "medium",
  "high",
  "critical",
  "unknown",
]);

export const professionalIdentityDocStatusEnum = pgEnum("professional_identity_doc_status", [
  "uploaded",
  "pending_validation",
  "validated",
  "rejected",
  "expired",
  "not_configured",
]);

export const biometricSessionStatusEnum = pgEnum("biometric_session_status", [
  "pending",
  "passed",
  "failed",
  "review_required",
  "expired",
  "not_configured",
]);

export const professionalSuspensionScopeEnum = pgEnum("professional_suspension_scope", [
  "marketplace",
  "proposals",
  "acceptance",
  "engagement",
  "receiving",
  "all",
]);

export const professionalSuspensionStatusEnum = pgEnum("professional_suspension_status", [
  "active",
  "lifted",
  "expired",
]);

export const professionalVerificationCases = pgTable(
  "professional_verification_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    professionalProfileId: uuid("professional_profile_id")
      .notNull()
      .references(() => lawyerProfiles.userId, { onDelete: "cascade" }),
    verificationType: professionalVerificationTypeEnum("verification_type").notNull(),
    status: professionalVerificationCaseStatusEnum("status").notNull().default("not_started"),
    riskLevel: professionalVerificationRiskEnum("risk_level").notNull().default("unknown"),
    providerKey: text("provider_key"),
    providerStatus: text("provider_status").notNull().default("not_configured"),
    externalReference: text("external_reference"),
    /** OAB/CPF metadata — nunca tratar format validation como verified. */
    subjectMetadata: jsonb("subject_metadata").$type<Record<string, unknown>>(),
    requestedAt: timestamp("requested_at", { withTimezone: true, mode: "date" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    suspendedAt: timestamp("suspended_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("professional_verification_cases_user_idx").on(table.userId),
    index("professional_verification_cases_profile_idx").on(table.professionalProfileId),
    index("professional_verification_cases_type_status_idx").on(
      table.verificationType,
      table.status,
    ),
  ],
);

export const professionalIdentityDocuments = pgTable(
  "professional_identity_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    verificationCaseId: uuid("verification_case_id")
      .notNull()
      .references(() => professionalVerificationCases.id, { onDelete: "cascade" }),
    documentType: text("document_type").notNull(),
    issuingCountry: text("issuing_country").notNull().default("BR"),
    issuingAuthority: text("issuing_authority"),
    /** Número mascarado para UI; ciphertext separado se necessário. */
    numberMasked: text("number_masked"),
    numberEncrypted: text("number_encrypted"),
    issueDate: timestamp("issue_date", { withTimezone: true, mode: "date" }),
    expirationDate: timestamp("expiration_date", { withTimezone: true, mode: "date" }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    status: professionalIdentityDocStatusEnum("status").notNull().default("uploaded"),
    ...timestamps,
  },
  (table) => [index("professional_identity_documents_case_idx").on(table.verificationCaseId)],
);

export const biometricVerificationSessions = pgTable(
  "biometric_verification_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    verificationCaseId: uuid("verification_case_id")
      .notNull()
      .references(() => professionalVerificationCases.id, { onDelete: "cascade" }),
    providerKey: text("provider_key"),
    externalSessionRef: text("external_session_ref"),
    status: biometricSessionStatusEnum("status").notNull().default("not_configured"),
    /** Score/result do provider — sem template biométrico bruto. */
    resultMetadata: jsonb("result_metadata").$type<Record<string, unknown>>(),
    consentRecordedAt: timestamp("consent_recorded_at", { withTimezone: true, mode: "date" }),
    consentTermVersion: text("consent_term_version"),
    retentionExpiresAt: timestamp("retention_expires_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("biometric_verification_sessions_case_idx").on(table.verificationCaseId),
    index("biometric_verification_sessions_external_idx").on(table.externalSessionRef),
  ],
);

export const professionalVerificationReviews = pgTable(
  "professional_verification_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => professionalVerificationCases.id, { onDelete: "cascade" }),
    reviewerMembershipId: uuid("reviewer_membership_id")
      .notNull()
      .references(() => organizationMembers.id, { onDelete: "restrict" }),
    decision: text("decision").notNull(),
    reasonCode: text("reason_code"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("professional_verification_reviews_case_idx").on(table.caseId)],
);

export const professionalSuspensions = pgTable(
  "professional_suspensions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    professionalProfileId: uuid("professional_profile_id")
      .notNull()
      .references(() => lawyerProfiles.userId, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    scope: professionalSuspensionScopeEnum("scope").notNull().default("all"),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }),
    status: professionalSuspensionStatusEnum("status").notNull().default("active"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("professional_suspensions_profile_idx").on(table.professionalProfileId),
    index("professional_suspensions_status_idx").on(table.status),
  ],
);

export const professionalRevalidationRequests = pgTable(
  "professional_revalidation_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    professionalProfileId: uuid("professional_profile_id")
      .notNull()
      .references(() => lawyerProfiles.userId, { onDelete: "cascade" }),
    caseId: uuid("case_id").references(() => professionalVerificationCases.id, {
      onDelete: "set null",
    }),
    trigger: text("trigger").notNull(),
    status: text("status").notNull().default("pending"),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("professional_revalidation_requests_profile_idx").on(table.professionalProfileId),
    index("professional_revalidation_requests_status_idx").on(table.status),
  ],
);

export const providerWebhookEvents = pgTable(
  "provider_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerKey: text("provider_key").notNull(),
    providerType: text("provider_type").notNull(),
    externalEventId: text("external_event_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    signatureValid: boolean("signature_valid"),
    payloadHash: text("payload_hash"),
    rawPayloadRef: text("raw_payload_ref"),
    processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" }),
    status: text("status").notNull().default("received"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("provider_webhook_events_idempotency_unique").on(table.idempotencyKey),
    index("provider_webhook_events_provider_idx").on(table.providerKey),
  ],
);

export const professionalVerificationCasesRelations = relations(
  professionalVerificationCases,
  ({ one, many }) => ({
    user: one(users, {
      fields: [professionalVerificationCases.userId],
      references: [users.id],
    }),
    profile: one(lawyerProfiles, {
      fields: [professionalVerificationCases.professionalProfileId],
      references: [lawyerProfiles.userId],
    }),
    documents: many(professionalIdentityDocuments),
    biometricSessions: many(biometricVerificationSessions),
    reviews: many(professionalVerificationReviews),
  }),
);

export const professionalIdentityDocumentsRelations = relations(
  professionalIdentityDocuments,
  ({ one }) => ({
    case: one(professionalVerificationCases, {
      fields: [professionalIdentityDocuments.verificationCaseId],
      references: [professionalVerificationCases.id],
    }),
  }),
);

export const biometricVerificationSessionsRelations = relations(
  biometricVerificationSessions,
  ({ one }) => ({
    case: one(professionalVerificationCases, {
      fields: [biometricVerificationSessions.verificationCaseId],
      references: [professionalVerificationCases.id],
    }),
  }),
);

export const professionalVerificationReviewsRelations = relations(
  professionalVerificationReviews,
  ({ one }) => ({
    case: one(professionalVerificationCases, {
      fields: [professionalVerificationReviews.caseId],
      references: [professionalVerificationCases.id],
    }),
  }),
);

export const professionalSuspensionsRelations = relations(professionalSuspensions, ({ one }) => ({
  profile: one(lawyerProfiles, {
    fields: [professionalSuspensions.professionalProfileId],
    references: [lawyerProfiles.userId],
  }),
}));

export const professionalRevalidationRequestsRelations = relations(
  professionalRevalidationRequests,
  ({ one }) => ({
    profile: one(lawyerProfiles, {
      fields: [professionalRevalidationRequests.professionalProfileId],
      references: [lawyerProfiles.userId],
    }),
  }),
);
