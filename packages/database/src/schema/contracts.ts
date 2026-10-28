/**
 * Etapa 13 — Contratos e Assinatura.
 * Contract ≠ Document ≠ LegalDraft. Assinatura via SignatureProvider (NOT_CONFIGURED).
 */
import { relations } from "drizzle-orm";
import {
  bigint,
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
import { crmClients } from "./crm.js";
import { documents, documentVersions } from "./documents.js";
import { organizationMembers, organizations } from "./identity.js";
import { legalDocumentDrafts } from "./legal-drafts.js";
import { legalDocumentTemplates } from "./legal-templates.js";
import { legalMatters } from "./matters.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const contractStatusEnum = pgEnum("contract_status", [
  "draft",
  "internal_review",
  "pending_approval",
  "approved",
  "pending_signature",
  "partially_signed",
  "signed",
  "active",
  "expiring",
  "expired",
  "terminated",
  "cancelled",
  "archived",
]);

export const contractRenewalTypeEnum = pgEnum("contract_renewal_type", [
  "automatic",
  "manual",
  "none",
]);

export const contractVersionStatusEnum = pgEnum("contract_version_status", [
  "draft",
  "in_review",
  "approved",
  "signed",
  "superseded",
  "cancelled",
]);

export const contractPartyRoleEnum = pgEnum("contract_party_role", [
  "contractor",
  "contractee",
  "buyer",
  "seller",
  "lessor",
  "lessee",
  "provider",
  "customer",
  "partner",
  "guarantor",
  "witness",
  "other",
]);

export const contractApprovalTypeEnum = pgEnum("contract_approval_type", [
  "single",
  "sequential",
  "parallel",
  "dual",
]);

export const contractApprovalStatusEnum = pgEnum("contract_approval_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

export const signatureRequestStatusEnum = pgEnum("signature_request_status", [
  "draft",
  "ready",
  "sent",
  "viewed",
  "partially_signed",
  "signed",
  "declined",
  "expired",
  "cancelled",
  "failed",
  "not_configured",
]);

export const signatureSignerStatusEnum = pgEnum("signature_signer_status", [
  "pending",
  "notified",
  "viewed",
  "signed",
  "declined",
  "expired",
  "cancelled",
]);

export const signatureMethodEnum = pgEnum("signature_method", [
  "provider",
  "manual",
  "wet_ink",
  "other",
]);

export const contractRenewalStatusEnum = pgEnum("contract_renewal_status", [
  "draft",
  "notice_pending",
  "proposed",
  "approved",
  "completed",
  "cancelled",
  "expired",
]);

export const contractObligationStatusEnum = pgEnum("contract_obligation_status", [
  "open",
  "pending",
  "fulfilled",
  "overdue",
  "waived",
  "cancelled",
]);

export const contractTerminationTypeEnum = pgEnum("contract_termination_type", [
  "mutual",
  "unilateral",
  "breach",
  "expiration",
  "other",
]);

export const contractTerminationStatusEnum = pgEnum("contract_termination_status", [
  "draft",
  "notice_pending",
  "notice_sent",
  "under_negotiation",
  "approved",
  "effective",
  "cancelled",
  "disputed",
]);

export const contractAmendmentStatusEnum = pgEnum("contract_amendment_status", [
  "draft",
  "pending_approval",
  "approved",
  "pending_signature",
  "signed",
  "effective",
  "cancelled",
]);

export const contractClauseSourceEnum = pgEnum("contract_clause_source", [
  "system",
  "organization",
]);

/** Templates de contrato compõem LegalDocumentTemplate (não duplicam engine). */
export const contractTemplates = pgTable(
  "contract_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    legalDocumentTemplateId: uuid("legal_document_template_id").references(
      () => legalDocumentTemplates.id,
      { onDelete: "set null" },
    ),
    title: text("title").notNull(),
    contractType: text("contract_type").notNull().default("other"),
    active: boolean("active").notNull().default(true),
    isSystem: boolean("is_system").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("contract_templates_org_idx").on(table.organizationId),
    index("contract_templates_active_idx").on(table.active),
  ],
);

export const contracts = pgTable(
  "contracts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id").references(() => legalMatters.id, {
      onDelete: "set null",
    }),
    clientId: uuid("client_id").references(() => crmClients.id, { onDelete: "set null" }),
    contractTemplateId: uuid("contract_template_id").references(() => contractTemplates.id, {
      onDelete: "set null",
    }),
    currentVersionId: uuid("current_version_id"),
    title: text("title").notNull(),
    contractType: text("contract_type").notNull().default("other"),
    status: contractStatusEnum("status").notNull().default("draft"),
    effectiveDate: timestamp("effective_date", { withTimezone: true, mode: "date" }),
    expirationDate: timestamp("expiration_date", { withTimezone: true, mode: "date" }),
    indefiniteTerm: boolean("indefinite_term").notNull().default(false),
    renewalType: contractRenewalTypeEnum("renewal_type").notNull().default("none"),
    renewalNoticeDays: integer("renewal_notice_days"),
    terminationDate: timestamp("termination_date", { withTimezone: true, mode: "date" }),
    governingLaw: text("governing_law"),
    jurisdiction: text("jurisdiction"),
    currency: text("currency").default("BRL"),
    totalValueCents: bigint("total_value_cents", { mode: "number" }),
    sourceDraftId: uuid("source_draft_id").references(() => legalDocumentDrafts.id, {
      onDelete: "set null",
    }),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("contracts_org_idx").on(table.organizationId),
    index("contracts_org_status_idx").on(table.organizationId, table.status),
    index("contracts_matter_idx").on(table.legalMatterId),
    index("contracts_client_idx").on(table.clientId),
    index("contracts_expiration_idx").on(table.expirationDate),
  ],
);

export const contractVersions = pgTable(
  "contract_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    sourceDraftId: uuid("source_draft_id").references(() => legalDocumentDrafts.id, {
      onDelete: "set null",
    }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    documentVersionId: uuid("document_version_id").references(() => documentVersions.id, {
      onDelete: "set null",
    }),
    contentSnapshot: text("content_snapshot"),
    clauseSnapshot: jsonb("clause_snapshot").$type<unknown[]>(),
    status: contractVersionStatusEnum("status").notNull().default("draft"),
    immutable: boolean("immutable").notNull().default(false),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    approvedByMembershipId: uuid("approved_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("contract_versions_contract_version_unique").on(table.contractId, table.version),
    index("contract_versions_org_idx").on(table.organizationId),
    index("contract_versions_status_idx").on(table.status),
  ],
);

export const contractParties = pgTable(
  "contract_parties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    partyRole: contractPartyRoleEnum("party_role").notNull().default("other"),
    displayName: text("display_name").notNull(),
    documentReference: text("document_reference"),
    representative: text("representative"),
    clientId: uuid("client_id").references(() => crmClients.id, { onDelete: "set null" }),
    signingOrder: integer("signing_order").notNull().default(1),
    signerRequired: boolean("signer_required").notNull().default(true),
    email: text("email"),
    phone: text("phone"),
    ...timestamps,
  },
  (table) => [
    index("contract_parties_contract_idx").on(table.contractId),
    index("contract_parties_org_idx").on(table.organizationId),
  ],
);

/** Biblioteca de cláusulas (SYSTEM / ORGANIZATION). Versões históricas imutáveis. */
export const contractClauses = pgTable(
  "contract_clauses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(),
    title: text("title").notNull(),
    category: text("category").notNull().default("general"),
    content: text("content").notNull(),
    version: text("version").notNull().default("1"),
    source: contractClauseSourceEnum("source").notNull().default("organization"),
    active: boolean("active").notNull().default(true),
    riskLevel: text("risk_level"),
    locked: boolean("locked").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("contract_clauses_org_key_version_unique").on(
      table.organizationId,
      table.key,
      table.version,
    ),
    index("contract_clauses_org_idx").on(table.organizationId),
    index("contract_clauses_active_idx").on(table.active),
  ],
);

/** Snapshot de cláusula usada em uma versão de contrato. */
export const contractClauseInstances = pgTable(
  "contract_clause_instances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contractVersionId: uuid("contract_version_id")
      .notNull()
      .references(() => contractVersions.id, { onDelete: "cascade" }),
    clauseId: uuid("clause_id").references(() => contractClauses.id, { onDelete: "set null" }),
    sortOrder: integer("sort_order").notNull().default(0),
    key: text("key").notNull(),
    title: text("title").notNull(),
    contentSnapshot: text("content_snapshot").notNull(),
    variablesSnapshot: jsonb("variables_snapshot").$type<Record<string, unknown>>(),
    negotiated: boolean("negotiated").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("contract_clause_instances_version_idx").on(table.contractVersionId),
    index("contract_clause_instances_org_idx").on(table.organizationId),
  ],
);

export const contractApprovalPolicies = pgTable(
  "contract_approval_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    approvalType: contractApprovalTypeEnum("approval_type").notNull().default("single"),
    minValueCents: bigint("min_value_cents", { mode: "number" }),
    contractType: text("contract_type"),
    department: text("department"),
    riskLevel: text("risk_level"),
    requireSecondApprover: boolean("require_second_approver").notNull().default(false),
    active: boolean("active").notNull().default(true),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("contract_approval_policies_org_idx").on(table.organizationId),
    index("contract_approval_policies_active_idx").on(table.active),
  ],
);

export const contractApprovals = pgTable(
  "contract_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    contractVersionId: uuid("contract_version_id")
      .notNull()
      .references(() => contractVersions.id, { onDelete: "cascade" }),
    approverMembershipId: uuid("approver_membership_id")
      .notNull()
      .references(() => organizationMembers.id, { onDelete: "restrict" }),
    approvalType: contractApprovalTypeEnum("approval_type").notNull().default("single"),
    status: contractApprovalStatusEnum("status").notNull().default("pending"),
    comment: text("comment"),
    sequenceOrder: integer("sequence_order").notNull().default(1),
    decidedAt: timestamp("decided_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("contract_approvals_org_contract_idx").on(table.organizationId, table.contractId),
    index("contract_approvals_version_idx").on(table.contractVersionId),
    index("contract_approvals_status_idx").on(table.status),
  ],
);

export const signatureRequests = pgTable(
  "signature_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    contractVersionId: uuid("contract_version_id")
      .notNull()
      .references(() => contractVersions.id, { onDelete: "cascade" }),
    providerKey: text("provider_key").notNull().default("not_configured"),
    externalEnvelopeId: text("external_envelope_id"),
    status: signatureRequestStatusEnum("status").notNull().default("draft"),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    evidenceDocumentId: uuid("evidence_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    certificateMetadata: jsonb("certificate_metadata").$type<Record<string, unknown>>(),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("signature_requests_org_contract_idx").on(table.organizationId, table.contractId),
    index("signature_requests_status_idx").on(table.status),
  ],
);

export const signatureSigners = pgTable(
  "signature_signers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    signatureRequestId: uuid("signature_request_id")
      .notNull()
      .references(() => signatureRequests.id, { onDelete: "cascade" }),
    contractPartyId: uuid("contract_party_id").references(() => contractParties.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    signingOrder: integer("signing_order").notNull().default(1),
    status: signatureSignerStatusEnum("status").notNull().default("pending"),
    signedAt: timestamp("signed_at", { withTimezone: true, mode: "date" }),
    externalSignerId: text("external_signer_id"),
    ...timestamps,
  },
  (table) => [
    index("signature_signers_request_idx").on(table.signatureRequestId),
    index("signature_signers_org_idx").on(table.organizationId),
  ],
);

/** Registro manual de assinatura — exige evidência; NÃO é assinatura eletrônica de provider. */
export const manualSignatureRecords = pgTable(
  "manual_signature_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    contractVersionId: uuid("contract_version_id")
      .notNull()
      .references(() => contractVersions.id, { onDelete: "cascade" }),
    contractPartyId: uuid("contract_party_id").references(() => contractParties.id, {
      onDelete: "set null",
    }),
    signedAt: timestamp("signed_at", { withTimezone: true, mode: "date" }).notNull(),
    evidenceDocumentId: uuid("evidence_document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "restrict" }),
    method: signatureMethodEnum("method").notNull().default("manual"),
    recordedByMembershipId: uuid("recorded_by_membership_id")
      .notNull()
      .references(() => organizationMembers.id, { onDelete: "restrict" }),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("manual_signature_records_org_contract_idx").on(table.organizationId, table.contractId),
  ],
);

export const contractRenewals = pgTable(
  "contract_renewals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    renewalType: contractRenewalTypeEnum("renewal_type").notNull().default("manual"),
    noticeDate: timestamp("notice_date", { withTimezone: true, mode: "date" }),
    proposedNewExpiration: timestamp("proposed_new_expiration", {
      withTimezone: true,
      mode: "date",
    }),
    status: contractRenewalStatusEnum("status").notNull().default("draft"),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    approvalId: uuid("approval_id").references(() => contractApprovals.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("contract_renewals_org_contract_idx").on(table.organizationId, table.contractId),
    index("contract_renewals_status_idx").on(table.status),
  ],
);

export const contractObligations = pgTable(
  "contract_obligations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    contractPartyId: uuid("contract_party_id").references(() => contractParties.id, {
      onDelete: "set null",
    }),
    sourceClauseInstanceId: uuid("source_clause_instance_id").references(
      () => contractClauseInstances.id,
      { onDelete: "set null" },
    ),
    description: text("description").notNull(),
    dueDate: timestamp("due_date", { withTimezone: true, mode: "date" }),
    recurrence: text("recurrence"),
    amountCents: bigint("amount_cents", { mode: "number" }),
    status: contractObligationStatusEnum("status").notNull().default("open"),
    ...timestamps,
  },
  (table) => [
    index("contract_obligations_org_contract_idx").on(table.organizationId, table.contractId),
    index("contract_obligations_due_date_idx").on(table.dueDate),
    index("contract_obligations_status_idx").on(table.status),
  ],
);

export const contractTerminations = pgTable(
  "contract_terminations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    terminationType: contractTerminationTypeEnum("termination_type").notNull().default("other"),
    requestedAt: timestamp("requested_at", { withTimezone: true, mode: "date" }).notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true, mode: "date" }),
    reason: text("reason"),
    noticePeriodDays: integer("notice_period_days"),
    penaltyCents: bigint("penalty_cents", { mode: "number" }),
    status: contractTerminationStatusEnum("status").notNull().default("draft"),
    sourceDocumentId: uuid("source_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    index("contract_terminations_org_contract_idx").on(table.organizationId, table.contractId),
    index("contract_terminations_status_idx").on(table.status),
  ],
);

export const contractAmendments = pgTable(
  "contract_amendments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    parentContractId: uuid("parent_contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    amendmentType: text("amendment_type").notNull().default("other"),
    effectiveDate: timestamp("effective_date", { withTimezone: true, mode: "date" }),
    changedClauses: jsonb("changed_clauses").$type<unknown[]>(),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    approvalStatus: contractApprovalStatusEnum("approval_status").notNull().default("pending"),
    signatureStatus: signatureRequestStatusEnum("signature_status").notNull().default("draft"),
    status: contractAmendmentStatusEnum("status").notNull().default("draft"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("contract_amendments_parent_version_unique").on(
      table.parentContractId,
      table.version,
    ),
    index("contract_amendments_org_idx").on(table.organizationId),
  ],
);

export const contractTimelineEvents = pgTable(
  "contract_timeline_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    summary: text("summary").notNull(),
    actorMembershipId: uuid("actor_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("contract_timeline_events_contract_idx").on(table.contractId),
    index("contract_timeline_events_org_idx").on(table.organizationId),
  ],
);

/* Relations */

export const contractTemplatesRelations = relations(contractTemplates, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [contractTemplates.organizationId],
    references: [organizations.id],
  }),
  legalTemplate: one(legalDocumentTemplates, {
    fields: [contractTemplates.legalDocumentTemplateId],
    references: [legalDocumentTemplates.id],
  }),
  contracts: many(contracts),
}));

export const contractsRelations = relations(contracts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [contracts.organizationId],
    references: [organizations.id],
  }),
  matter: one(legalMatters, { fields: [contracts.legalMatterId], references: [legalMatters.id] }),
  client: one(crmClients, { fields: [contracts.clientId], references: [crmClients.id] }),
  template: one(contractTemplates, {
    fields: [contracts.contractTemplateId],
    references: [contractTemplates.id],
  }),
  versions: many(contractVersions),
  parties: many(contractParties),
  approvals: many(contractApprovals),
  signatureRequests: many(signatureRequests),
  renewals: many(contractRenewals),
  obligations: many(contractObligations),
  terminations: many(contractTerminations),
  amendments: many(contractAmendments),
  timeline: many(contractTimelineEvents),
}));

export const contractVersionsRelations = relations(contractVersions, ({ one, many }) => ({
  contract: one(contracts, { fields: [contractVersions.contractId], references: [contracts.id] }),
  clauseInstances: many(contractClauseInstances),
  approvals: many(contractApprovals),
}));

export const contractPartiesRelations = relations(contractParties, ({ one }) => ({
  contract: one(contracts, { fields: [contractParties.contractId], references: [contracts.id] }),
}));

export const contractClausesRelations = relations(contractClauses, ({ one }) => ({
  organization: one(organizations, {
    fields: [contractClauses.organizationId],
    references: [organizations.id],
  }),
}));

export const contractClauseInstancesRelations = relations(contractClauseInstances, ({ one }) => ({
  version: one(contractVersions, {
    fields: [contractClauseInstances.contractVersionId],
    references: [contractVersions.id],
  }),
  clause: one(contractClauses, {
    fields: [contractClauseInstances.clauseId],
    references: [contractClauses.id],
  }),
}));

export const contractApprovalPoliciesRelations = relations(contractApprovalPolicies, ({ one }) => ({
  organization: one(organizations, {
    fields: [contractApprovalPolicies.organizationId],
    references: [organizations.id],
  }),
}));

export const contractApprovalsRelations = relations(contractApprovals, ({ one }) => ({
  contract: one(contracts, { fields: [contractApprovals.contractId], references: [contracts.id] }),
  version: one(contractVersions, {
    fields: [contractApprovals.contractVersionId],
    references: [contractVersions.id],
  }),
}));

export const signatureRequestsRelations = relations(signatureRequests, ({ one, many }) => ({
  contract: one(contracts, { fields: [signatureRequests.contractId], references: [contracts.id] }),
  version: one(contractVersions, {
    fields: [signatureRequests.contractVersionId],
    references: [contractVersions.id],
  }),
  signers: many(signatureSigners),
}));

export const signatureSignersRelations = relations(signatureSigners, ({ one }) => ({
  request: one(signatureRequests, {
    fields: [signatureSigners.signatureRequestId],
    references: [signatureRequests.id],
  }),
  party: one(contractParties, {
    fields: [signatureSigners.contractPartyId],
    references: [contractParties.id],
  }),
}));

export const manualSignatureRecordsRelations = relations(manualSignatureRecords, ({ one }) => ({
  contract: one(contracts, {
    fields: [manualSignatureRecords.contractId],
    references: [contracts.id],
  }),
  evidence: one(documents, {
    fields: [manualSignatureRecords.evidenceDocumentId],
    references: [documents.id],
  }),
}));

export const contractRenewalsRelations = relations(contractRenewals, ({ one }) => ({
  contract: one(contracts, { fields: [contractRenewals.contractId], references: [contracts.id] }),
}));

export const contractObligationsRelations = relations(contractObligations, ({ one }) => ({
  contract: one(contracts, {
    fields: [contractObligations.contractId],
    references: [contracts.id],
  }),
}));

export const contractTerminationsRelations = relations(contractTerminations, ({ one }) => ({
  contract: one(contracts, {
    fields: [contractTerminations.contractId],
    references: [contracts.id],
  }),
}));

export const contractAmendmentsRelations = relations(contractAmendments, ({ one }) => ({
  parent: one(contracts, {
    fields: [contractAmendments.parentContractId],
    references: [contracts.id],
  }),
}));

export const contractTimelineEventsRelations = relations(contractTimelineEvents, ({ one }) => ({
  contract: one(contracts, {
    fields: [contractTimelineEvents.contractId],
    references: [contracts.id],
  }),
}));
