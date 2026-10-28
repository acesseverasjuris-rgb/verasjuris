/**
 * Etapa 18 — Correspondentes e diligências.
 * Domínio operacional especializado; pode usar Marketplace Core para disputa/review.
 */
import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { crmClients } from "./crm.js";
import { documents } from "./documents.js";
import { organizationMembers, organizations } from "./identity.js";
import { legalMatters } from "./matters.js";
import { lawyerProfiles } from "./profiles.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const diligenceRequestStatusEnum = pgEnum("diligence_request_status", [
  "draft",
  "open",
  "receiving_proposals",
  "assigned",
  "in_progress",
  "evidence_pending",
  "under_review",
  "completed",
  "cancelled",
  "disputed",
]);

export const diligenceProposalStatusEnum = pgEnum("diligence_proposal_status", [
  "draft",
  "submitted",
  "accepted",
  "declined",
  "withdrawn",
  "expired",
]);

export const diligenceAssignmentStatusEnum = pgEnum("diligence_assignment_status", [
  "accepted",
  "in_progress",
  "evidence_pending",
  "under_review",
  "completed",
  "cancelled",
  "disputed",
]);

export const diligenceExecutionEventTypeEnum = pgEnum("diligence_execution_event_type", [
  "started",
  "arrived",
  "protocolled",
  "hearing_attended",
  "document_collected",
  "evidence_submitted",
  "completed",
  "issue_reported",
]);

export const diligenceEvidenceTypeEnum = pgEnum("diligence_evidence_type", [
  "document",
  "receipt",
  "protocol",
  "certificate",
  "photo",
  "location_proof",
  "signed_acknowledgement",
  "other",
]);

export const diligenceEvidenceStatusEnum = pgEnum("diligence_evidence_status", [
  "submitted",
  "under_review",
  "accepted",
  "rejected",
]);

export const diligenceTypes = pgTable(
  "diligence_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    requiresExclusivity: boolean("requires_exclusivity").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    isSystem: boolean("is_system").notNull().default(false),
    ...timestamps,
  },
  (table) => [uniqueIndex("diligence_types_key_unique").on(table.key)],
);

export const diligenceRequests = pgTable(
  "diligence_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    requesterMembershipId: uuid("requester_membership_id")
      .notNull()
      .references(() => organizationMembers.id, { onDelete: "restrict" }),
    clientId: uuid("client_id").references(() => crmClients.id, { onDelete: "set null" }),
    legalMatterId: uuid("legal_matter_id").references(() => legalMatters.id, {
      onDelete: "set null",
    }),
    typeId: uuid("type_id")
      .notNull()
      .references(() => diligenceTypes.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    country: text("country").notNull().default("BR"),
    state: text("state"),
    city: text("city"),
    addressText: text("address_text"),
    courtOrAgency: text("court_or_agency"),
    forum: text("forum"),
    registryOfficeName: text("registry_office_name"),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    urgency: text("urgency").notNull().default("normal"),
    budgetCents: bigint("budget_cents", { mode: "number" }),
    status: diligenceRequestStatusEnum("status").notNull().default("draft"),
    acceptedProposalId: uuid("accepted_proposal_id"),
    calendarEventId: uuid("calendar_event_id"),
    deadlineId: uuid("deadline_id"),
    taskId: uuid("task_id"),
    ...timestamps,
  },
  (table) => [
    index("diligence_requests_org_idx").on(table.organizationId),
    index("diligence_requests_status_idx").on(table.status),
    index("diligence_requests_due_idx").on(table.dueAt),
    index("diligence_requests_type_idx").on(table.typeId),
  ],
);

export const diligenceProposals = pgTable(
  "diligence_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => diligenceRequests.id, { onDelete: "cascade" }),
    professionalProfileId: uuid("professional_profile_id")
      .notNull()
      .references(() => lawyerProfiles.userId, { onDelete: "cascade" }),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    estimatedCompletionAt: timestamp("estimated_completion_at", {
      withTimezone: true,
      mode: "date",
    }),
    notes: text("notes"),
    status: diligenceProposalStatusEnum("status").notNull().default("draft"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("diligence_proposals_request_professional_unique").on(
      table.requestId,
      table.professionalProfileId,
    ),
    index("diligence_proposals_status_idx").on(table.status),
  ],
);

export const diligenceAssignments = pgTable(
  "diligence_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => diligenceRequests.id, { onDelete: "cascade" }),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => diligenceProposals.id, { onDelete: "restrict" }),
    correspondentProfileId: uuid("correspondent_profile_id")
      .notNull()
      .references(() => lawyerProfiles.userId, { onDelete: "restrict" }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    status: diligenceAssignmentStatusEnum("status").notNull().default("accepted"),
    paymentRecordId: uuid("payment_record_id"),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("diligence_assignments_request_unique").on(table.requestId),
    uniqueIndex("diligence_assignments_proposal_unique").on(table.proposalId),
    index("diligence_assignments_correspondent_idx").on(table.correspondentProfileId),
    index("diligence_assignments_status_idx").on(table.status),
  ],
);

export const diligenceExecutionEvents = pgTable(
  "diligence_execution_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => diligenceAssignments.id, { onDelete: "cascade" }),
    eventType: diligenceExecutionEventTypeEnum("event_type").notNull(),
    notes: text("notes"),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    createdByUserId: uuid("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("diligence_execution_events_assignment_idx").on(table.assignmentId),
    index("diligence_execution_events_type_idx").on(table.eventType),
  ],
);

export const diligenceEvidence = pgTable(
  "diligence_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => diligenceAssignments.id, { onDelete: "cascade" }),
    evidenceType: diligenceEvidenceTypeEnum("evidence_type").notNull(),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    description: text("description"),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    status: diligenceEvidenceStatusEnum("status").notNull().default("submitted"),
    /** Autenticidade NÃO afirmada automaticamente. */
    authenticityClaim: text("authenticity_claim").notNull().default("unverified"),
    ...timestamps,
  },
  (table) => [
    index("diligence_evidence_assignment_idx").on(table.assignmentId),
    index("diligence_evidence_status_idx").on(table.status),
  ],
);

export const diligenceTypesRelations = relations(diligenceTypes, ({ many }) => ({
  requests: many(diligenceRequests),
}));

export const diligenceRequestsRelations = relations(diligenceRequests, ({ one, many }) => ({
  type: one(diligenceTypes, {
    fields: [diligenceRequests.typeId],
    references: [diligenceTypes.id],
  }),
  proposals: many(diligenceProposals),
  assignment: one(diligenceAssignments),
}));

export const diligenceProposalsRelations = relations(diligenceProposals, ({ one }) => ({
  request: one(diligenceRequests, {
    fields: [diligenceProposals.requestId],
    references: [diligenceRequests.id],
  }),
  professional: one(lawyerProfiles, {
    fields: [diligenceProposals.professionalProfileId],
    references: [lawyerProfiles.userId],
  }),
}));

export const diligenceAssignmentsRelations = relations(diligenceAssignments, ({ one, many }) => ({
  request: one(diligenceRequests, {
    fields: [diligenceAssignments.requestId],
    references: [diligenceRequests.id],
  }),
  proposal: one(diligenceProposals, {
    fields: [diligenceAssignments.proposalId],
    references: [diligenceProposals.id],
  }),
  events: many(diligenceExecutionEvents),
  evidence: many(diligenceEvidence),
}));

export const diligenceExecutionEventsRelations = relations(diligenceExecutionEvents, ({ one }) => ({
  assignment: one(diligenceAssignments, {
    fields: [diligenceExecutionEvents.assignmentId],
    references: [diligenceAssignments.id],
  }),
}));

export const diligenceEvidenceRelations = relations(diligenceEvidence, ({ one }) => ({
  assignment: one(diligenceAssignments, {
    fields: [diligenceEvidence.assignmentId],
    references: [diligenceAssignments.id],
  }),
}));
