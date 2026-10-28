/**
 * Etapa 19 — Cartórios e serviços extrajudiciais.
 * Orquestra solicitações. Sem integração cartório fake. Emolumentos oficiais via FeeTableProvider (NOT_CONFIGURED).
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
import { contracts } from "./contracts.js";
import { crmClients } from "./crm.js";
import { documents } from "./documents.js";
import { organizations, users } from "./identity.js";
import { legalMatters } from "./matters.js";
import { lawyerProfiles } from "./profiles.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const registryOfficeSourceEnum = pgEnum("registry_office_source", [
  "manual",
  "provider",
  "official_import",
  "other",
]);

export const registryOfficeVerificationStatusEnum = pgEnum("registry_office_verification_status", [
  "unverified",
  "verified",
  "outdated",
  "not_configured",
]);

export const extrajudicialRequestStatusEnum = pgEnum("extrajudicial_request_status", [
  "draft",
  "quoting",
  "quote_received",
  "accepted",
  "ordered",
  "in_progress",
  "completed",
  "cancelled",
  "disputed",
]);

export const extrajudicialQuoteStatusEnum = pgEnum("extrajudicial_quote_status", [
  "draft",
  "submitted",
  "accepted",
  "declined",
  "expired",
  "revised",
]);

export const extrajudicialQuoteSourceEnum = pgEnum("extrajudicial_quote_source", [
  "manual_estimate",
  "provider",
  "fee_table",
  "other",
]);

export const extrajudicialOrderStatusEnum = pgEnum("extrajudicial_order_status", [
  "pending_documents",
  "ready_to_submit",
  "submitted",
  "protocolled",
  "under_processing",
  "pending_requirement",
  "ready_for_delivery",
  "delivered",
  "completed",
  "cancelled",
  "disputed",
  "not_configured_external",
]);

export const extrajudicialRequirementStatusEnum = pgEnum("extrajudicial_requirement_status", [
  "open",
  "fulfilled",
  "waived",
  "cancelled",
]);

export const extrajudicialDeliveryTypeEnum = pgEnum("extrajudicial_delivery_type", [
  "digital_document",
  "physical_pickup",
  "courier",
  "registry_portal",
  "other",
]);

export const extrajudicialDeliveryStatusEnum = pgEnum("extrajudicial_delivery_status", [
  "pending",
  "delivered",
  "confirmed",
  "failed",
]);

export const extrajudicialServiceTypes = pgTable(
  "extrajudicial_service_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    isSystem: boolean("is_system").notNull().default(false),
    /** NÃO afirma suporte oficial sem integração. */
    officialSupportClaim: text("official_support_claim").notNull().default("not_configured"),
    ...timestamps,
  },
  (table) => [uniqueIndex("extrajudicial_service_types_key_unique").on(table.key)],
);

export const extrajudicialDocumentTypes = pgTable(
  "extrajudicial_document_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    version: integer("version").notNull().default(1),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("extrajudicial_document_types_key_version_unique").on(table.key, table.version),
  ],
);

export const registryOffices = pgTable(
  "registry_offices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    officeType: text("office_type").notNull().default("other"),
    country: text("country").notNull().default("BR"),
    state: text("state"),
    city: text("city"),
    address: text("address"),
    externalIdentifier: text("external_identifier"),
    source: registryOfficeSourceEnum("source").notNull().default("manual"),
    verificationStatus: registryOfficeVerificationStatusEnum("verification_status")
      .notNull()
      .default("unverified"),
    ...timestamps,
  },
  (table) => [
    index("registry_offices_state_city_idx").on(table.state, table.city),
    index("registry_offices_verification_idx").on(table.verificationStatus),
    index("registry_offices_external_idx").on(table.externalIdentifier),
  ],
);

export const extrajudicialServiceRequests = pgTable(
  "extrajudicial_service_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    requesterUserId: uuid("requester_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    clientId: uuid("client_id").references(() => crmClients.id, { onDelete: "set null" }),
    legalMatterId: uuid("legal_matter_id").references(() => legalMatters.id, {
      onDelete: "set null",
    }),
    serviceTypeId: uuid("service_type_id")
      .notNull()
      .references(() => extrajudicialServiceTypes.id, { onDelete: "restrict" }),
    documentTypeId: uuid("document_type_id").references(() => extrajudicialDocumentTypes.id, {
      onDelete: "set null",
    }),
    registryOfficeId: uuid("registry_office_id").references(() => registryOffices.id, {
      onDelete: "set null",
    }),
    providerProfileId: uuid("provider_profile_id").references(() => lawyerProfiles.userId, {
      onDelete: "set null",
    }),
    jurisdictionState: text("jurisdiction_state"),
    jurisdictionCity: text("jurisdiction_city"),
    description: text("description").notNull(),
    status: extrajudicialRequestStatusEnum("status").notNull().default("draft"),
    acceptedQuoteId: uuid("accepted_quote_id"),
    ...timestamps,
  },
  (table) => [
    index("extrajudicial_service_requests_org_idx").on(table.organizationId),
    index("extrajudicial_service_requests_status_idx").on(table.status),
    index("extrajudicial_service_requests_type_idx").on(table.serviceTypeId),
  ],
);

export const extrajudicialQuoteRequests = pgTable(
  "extrajudicial_quote_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serviceRequestId: uuid("service_request_id")
      .notNull()
      .references(() => extrajudicialServiceRequests.id, { onDelete: "cascade" }),
    targetRegistryOfficeId: uuid("target_registry_office_id").references(() => registryOffices.id, {
      onDelete: "set null",
    }),
    targetProviderProfileId: uuid("target_provider_profile_id").references(
      () => lawyerProfiles.userId,
      { onDelete: "set null" },
    ),
    notes: text("notes"),
    status: text("status").notNull().default("open"),
    ...timestamps,
  },
  (table) => [index("extrajudicial_quote_requests_service_idx").on(table.serviceRequestId)],
);

export const extrajudicialQuotes = pgTable(
  "extrajudicial_quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serviceRequestId: uuid("service_request_id")
      .notNull()
      .references(() => extrajudicialServiceRequests.id, { onDelete: "cascade" }),
    quoteRequestId: uuid("quote_request_id").references(() => extrajudicialQuoteRequests.id, {
      onDelete: "set null",
    }),
    providerProfileId: uuid("provider_profile_id").references(() => lawyerProfiles.userId, {
      onDelete: "set null",
    }),
    registryOfficeId: uuid("registry_office_id").references(() => registryOffices.id, {
      onDelete: "set null",
    }),
    serviceFeeCents: bigint("service_fee_cents", { mode: "number" }).notNull().default(0),
    /** Emolumentos oficiais — NUNCA hardcode como verdade permanente. */
    estimatedOfficialFeesCents: bigint("estimated_official_fees_cents", { mode: "number" }),
    estimatedThirdPartyFeesCents: bigint("estimated_third_party_fees_cents", { mode: "number" }),
    totalEstimateCents: bigint("total_estimate_cents", { mode: "number" }).notNull(),
    estimatedDeliveryAt: timestamp("estimated_delivery_at", { withTimezone: true, mode: "date" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    notes: text("notes"),
    source: extrajudicialQuoteSourceEnum("source").notNull().default("manual_estimate"),
    status: extrajudicialQuoteStatusEnum("status").notNull().default("draft"),
    ...timestamps,
  },
  (table) => [
    index("extrajudicial_quotes_service_idx").on(table.serviceRequestId),
    index("extrajudicial_quotes_status_idx").on(table.status),
  ],
);

export const extrajudicialOrders = pgTable(
  "extrajudicial_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => extrajudicialServiceRequests.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => extrajudicialQuotes.id, { onDelete: "restrict" }),
    contractId: uuid("contract_id").references(() => contracts.id, { onDelete: "set null" }),
    paymentRecordId: uuid("payment_record_id"),
    status: extrajudicialOrderStatusEnum("status").notNull().default("pending_documents"),
    externalProtocol: text("external_protocol"),
    protocolSource: text("protocol_source"),
    protocolEvidenceDocumentId: uuid("protocol_evidence_document_id").references(
      () => documents.id,
      { onDelete: "set null" },
    ),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("extrajudicial_orders_request_unique").on(table.requestId),
    uniqueIndex("extrajudicial_orders_quote_unique").on(table.quoteId),
    index("extrajudicial_orders_status_idx").on(table.status),
  ],
);

export const extrajudicialRequirements = pgTable(
  "extrajudicial_requirements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => extrajudicialOrders.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    status: extrajudicialRequirementStatusEnum("status").notNull().default("open"),
    source: text("source").notNull().default("manual"),
    evidenceDocumentId: uuid("evidence_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    index("extrajudicial_requirements_order_idx").on(table.orderId),
    index("extrajudicial_requirements_status_idx").on(table.status),
  ],
);

export const extrajudicialDeliveries = pgTable(
  "extrajudicial_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => extrajudicialOrders.id, { onDelete: "cascade" }),
    deliveryType: extrajudicialDeliveryTypeEnum("delivery_type").notNull().default("other"),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    externalReference: text("external_reference"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true, mode: "date" }),
    evidenceNotes: text("evidence_notes"),
    status: extrajudicialDeliveryStatusEnum("status").notNull().default("pending"),
    ...timestamps,
  },
  (table) => [
    index("extrajudicial_deliveries_order_idx").on(table.orderId),
    index("extrajudicial_deliveries_status_idx").on(table.status),
  ],
);

export const extrajudicialServiceTypesRelations = relations(
  extrajudicialServiceTypes,
  ({ many }) => ({
    requests: many(extrajudicialServiceRequests),
  }),
);

export const registryOfficesRelations = relations(registryOffices, ({ many }) => ({
  requests: many(extrajudicialServiceRequests),
}));

export const extrajudicialServiceRequestsRelations = relations(
  extrajudicialServiceRequests,
  ({ one, many }) => ({
    serviceType: one(extrajudicialServiceTypes, {
      fields: [extrajudicialServiceRequests.serviceTypeId],
      references: [extrajudicialServiceTypes.id],
    }),
    registryOffice: one(registryOffices, {
      fields: [extrajudicialServiceRequests.registryOfficeId],
      references: [registryOffices.id],
    }),
    quotes: many(extrajudicialQuotes),
    order: one(extrajudicialOrders),
  }),
);

export const extrajudicialQuotesRelations = relations(extrajudicialQuotes, ({ one }) => ({
  request: one(extrajudicialServiceRequests, {
    fields: [extrajudicialQuotes.serviceRequestId],
    references: [extrajudicialServiceRequests.id],
  }),
}));

export const extrajudicialOrdersRelations = relations(extrajudicialOrders, ({ one, many }) => ({
  request: one(extrajudicialServiceRequests, {
    fields: [extrajudicialOrders.requestId],
    references: [extrajudicialServiceRequests.id],
  }),
  quote: one(extrajudicialQuotes, {
    fields: [extrajudicialOrders.quoteId],
    references: [extrajudicialQuotes.id],
  }),
  requirements: many(extrajudicialRequirements),
  deliveries: many(extrajudicialDeliveries),
}));

export const extrajudicialRequirementsRelations = relations(
  extrajudicialRequirements,
  ({ one }) => ({
    order: one(extrajudicialOrders, {
      fields: [extrajudicialRequirements.orderId],
      references: [extrajudicialOrders.id],
    }),
  }),
);

export const extrajudicialDeliveriesRelations = relations(extrajudicialDeliveries, ({ one }) => ({
  order: one(extrajudicialOrders, {
    fields: [extrajudicialDeliveries.orderId],
    references: [extrajudicialOrders.id],
  }),
}));
