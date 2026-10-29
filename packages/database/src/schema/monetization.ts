/**
 * Etapas 21.3 + 21.4 + 21.5 + 22 — Split/Repasses, Disputas financeiras,
 * Conciliação/Tesouraria, Planos e Monetização.
 *
 * Evolui (não duplica): PaymentProvider, Ledger, EntitlementService, refunds, payouts, allocations.
 * Providers externos: NOT_CONFIGURED. Money = centavos; % = basis points.
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
import { documents } from "./documents.js";
import {
  billingPlans,
  invoices,
  paymentAllocations,
  payments,
  payouts,
  refunds,
  subscriptions,
} from "./finance.js";
import { organizationMembers, organizations, users } from "./identity.js";
import { contracts } from "./contracts.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

/* ─── Split / retention / payable enums ─── */

export const splitBeneficiaryTypeEnum = pgEnum("split_beneficiary_type", [
  "platform",
  "professional",
  "partner",
  "organization",
  "instructor",
  "correspondent",
  "service_provider",
  "other",
]);

export const splitAllocationTypeEnum = pgEnum("split_allocation_type", [
  "platform_fee",
  "professional_fee",
  "partner_share",
  "service_fee",
  "technology_fee",
  "commission",
  "withholding",
  "tax_estimate",
  "other",
]);

export const splitCalculationTypeEnum = pgEnum("split_calculation_type", [
  "percentage",
  "fixed",
  "percentage_plus_fixed",
  "remainder",
  "custom_rule",
]);

export const splitRuleStatusEnum = pgEnum("split_rule_status", ["draft", "active", "archived"]);

export const financialRetentionTypeEnum = pgEnum("financial_retention_type", [
  "tax_withholding",
  "platform_reserve",
  "chargeback_reserve",
  "compliance_hold",
  "dispute_hold",
  "other",
]);

export const financialRetentionSourceEnum = pgEnum("financial_retention_source", [
  "manual",
  "estimated",
  "provider_confirmed",
]);

export const financialRetentionStatusEnum = pgEnum("financial_retention_status", [
  "pending",
  "applied",
  "released",
  "cancelled",
]);

export const payableStatusEnum = pgEnum("finance_payable_status", [
  "pending",
  "held",
  "available",
  "scheduled",
  "paid",
  "cancelled",
  "reversed",
]);

export const payoutFrequencyEnum = pgEnum("payout_frequency", [
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "manual",
]);

export const refundTypeEnum = pgEnum("refund_type", ["full", "partial", "credit"]);

export const financialDisputeTypeEnum = pgEnum("financial_dispute_type", [
  "service",
  "payment",
  "chargeback",
  "fraud",
  "refund",
  "delivery",
  "other",
]);

export const financialDisputeStatusEnum = pgEnum("financial_dispute_status", [
  "open",
  "under_review",
  "waiting_customer",
  "waiting_provider",
  "evidence_required",
  "submitted",
  "won",
  "lost",
  "partially_won",
  "resolved",
  "closed",
]);

export const externalFinancialSourceEnum = pgEnum("external_financial_source", [
  "payment_provider",
  "ledger",
  "bank",
  "manual_import",
  "erp",
]);

export const externalImportSourceEnum = pgEnum("external_import_source", [
  "api",
  "webhook",
  "csv",
  "ofx",
  "cnab",
  "manual",
]);

export const externalTxDirectionEnum = pgEnum("external_tx_direction", ["inflow", "outflow"]);

export const reconciliationRunStatusEnum = pgEnum("reconciliation_run_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const reconciliationItemStatusEnum = pgEnum("reconciliation_item_status", [
  "matched",
  "partial",
  "missing_left",
  "missing_right",
  "amount_mismatch",
  "date_mismatch",
  "duplicate",
  "review_required",
  "resolved",
]);

export const financialDiscrepancyTypeEnum = pgEnum("financial_discrepancy_type", [
  "missing_payment",
  "missing_ledger_entry",
  "missing_bank_entry",
  "amount_mismatch",
  "duplicate",
  "unexpected_fee",
  "unexpected_refund",
  "payout_mismatch",
  "other",
]);

export const financialDiscrepancySeverityEnum = pgEnum("financial_discrepancy_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const financialDiscrepancyStatusEnum = pgEnum("financial_discrepancy_status", [
  "open",
  "investigating",
  "resolved",
  "dismissed",
]);

export const receivableStatusEnum = pgEnum("treasury_receivable_status", [
  "open",
  "partial",
  "paid",
  "overdue",
  "disputed",
  "written_off",
  "cancelled",
]);

export const accountsPayableStatusEnum = pgEnum("treasury_accounts_payable_status", [
  "draft",
  "approved",
  "scheduled",
  "paid",
  "overdue",
  "cancelled",
  "disputed",
]);

export const delinquencyStageEnum = pgEnum("delinquency_stage", [
  "reminder",
  "notice",
  "negotiation",
  "collection",
  "legal",
  "written_off",
]);

export const delinquencyStatusEnum = pgEnum("delinquency_status", [
  "open",
  "in_progress",
  "resolved",
  "written_off",
  "cancelled",
]);

export const forecastScenarioEnum = pgEnum("treasury_forecast_scenario", [
  "pessimistic",
  "base",
  "favorable",
  "custom",
]);

export const planTierEnum = pgEnum("plan_tier", [
  "individual",
  "professional",
  "office",
  "business",
  "enterprise",
  "white_label",
]);

export const planTargetEnum = pgEnum("plan_target", [
  "user",
  "professional",
  "organization",
  "enterprise",
  "partner",
]);

export const usageAggregationTypeEnum = pgEnum("usage_aggregation_type", [
  "sum",
  "max",
  "count",
  "last",
  "unique_count",
]);

export const usageResetPeriodEnum = pgEnum("usage_reset_period", [
  "none",
  "daily",
  "monthly",
  "yearly",
  "billing_period",
]);

export const aiCreditTxTypeEnum = pgEnum("ai_credit_tx_type", [
  "grant",
  "purchase",
  "consumption",
  "refund",
  "expiration",
  "adjustment",
]);

export const monetizationProductTypeEnum = pgEnum("monetization_product_type", [
  "subscription",
  "one_time_service",
  "ai_credit_pack",
  "api_package",
  "license",
  "white_label_setup",
  "technology_fee",
  "other",
]);

export const apiClientStatusEnum = pgEnum("api_client_status", ["active", "suspended", "revoked"]);

export const softwareLicenseTypeEnum = pgEnum("software_license_type", [
  "subscription",
  "term",
  "perpetual",
  "enterprise",
  "white_label",
  "custom",
]);

export const softwareLicenseStatusEnum = pgEnum("software_license_status", [
  "draft",
  "active",
  "expired",
  "suspended",
  "cancelled",
]);

export const whiteLabelStatusEnum = pgEnum("white_label_status", [
  "draft",
  "pending_domain",
  "active",
  "suspended",
  "disabled",
]);

/* ─── Split rules ─── */

export const splitRules = pgTable(
  "split_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(),
    productType: text("product_type").notNull(),
    serviceType: text("service_type"),
    beneficiaryType: splitBeneficiaryTypeEnum("beneficiary_type").notNull(),
    calculationType: splitCalculationTypeEnum("calculation_type").notNull().default("percentage"),
    percentageBps: integer("percentage_bps"),
    fixedAmountCents: bigint("fixed_amount_cents", { mode: "number" }),
    priority: integer("priority").notNull().default(100),
    validFrom: timestamp("valid_from", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    validTo: timestamp("valid_to", { withTimezone: true, mode: "date" }),
    status: splitRuleStatusEnum("status").notNull().default("active"),
    version: integer("version").notNull().default(1),
    snapshotJson: jsonb("snapshot_json").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("split_rules_org_key_version_unique").on(
      table.organizationId,
      table.key,
      table.version,
    ),
    index("split_rules_product_idx").on(table.productType),
    index("split_rules_status_idx").on(table.status),
  ],
);

export const financialRetentions = pgTable(
  "financial_retentions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    allocationId: uuid("allocation_id")
      .notNull()
      .references(() => paymentAllocations.id, { onDelete: "cascade" }),
    type: financialRetentionTypeEnum("type").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("BRL"),
    source: financialRetentionSourceEnum("source").notNull().default("manual"),
    ruleSetId: text("rule_set_id"),
    status: financialRetentionStatusEnum("status").notNull().default("pending"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("financial_retentions_allocation_idx").on(table.allocationId),
    index("financial_retentions_org_idx").on(table.organizationId),
    index("financial_retentions_status_idx").on(table.status),
  ],
);

export const payables = pgTable(
  "payables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    beneficiaryType: text("beneficiary_type").notNull(),
    beneficiaryId: uuid("beneficiary_id").notNull(),
    sourceAllocationId: uuid("source_allocation_id").references(() => paymentAllocations.id, {
      onDelete: "set null",
    }),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("BRL"),
    availableAt: timestamp("available_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    status: payableStatusEnum("status").notNull().default("pending"),
    holdReason: text("hold_reason"),
    heldByDisputeId: uuid("held_by_dispute_id"),
    ...timestamps,
  },
  (table) => [
    index("payables_org_idx").on(table.organizationId),
    index("payables_beneficiary_idx").on(table.beneficiaryType, table.beneficiaryId),
    index("payables_status_idx").on(table.status),
    index("payables_available_idx").on(table.availableAt),
  ],
);

export const payoutSchedules = pgTable(
  "payout_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    beneficiaryType: text("beneficiary_type").notNull(),
    beneficiaryId: uuid("beneficiary_id").notNull(),
    frequency: payoutFrequencyEnum("frequency").notNull().default("manual"),
    dayOfWeek: integer("day_of_week"),
    dayOfMonth: integer("day_of_month"),
    minimumAmountCents: bigint("minimum_amount_cents", { mode: "number" }),
    delayDays: integer("delay_days").notNull().default(0),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("payout_schedules_beneficiary_unique").on(
      table.organizationId,
      table.beneficiaryType,
      table.beneficiaryId,
    ),
    index("payout_schedules_active_idx").on(table.active),
  ],
);

/* ─── Refund / dispute history ─── */

export const refundHistory = pgTable(
  "refund_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    refundId: uuid("refund_id")
      .notNull()
      .references(() => refunds.id, { onDelete: "cascade" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    note: text("note"),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("refund_history_refund_idx").on(table.refundId)],
);

export const financialDisputes = pgTable(
  "financial_disputes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "set null" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id"),
    disputeType: financialDisputeTypeEnum("dispute_type").notNull().default("payment"),
    openedByUserId: uuid("opened_by_user_id").references(() => users.id, { onDelete: "set null" }),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("BRL"),
    reasonCode: text("reason_code"),
    description: text("description"),
    status: financialDisputeStatusEnum("status").notNull().default("open"),
    providerKey: text("provider_key").notNull().default("not_configured"),
    externalDisputeId: text("external_dispute_id"),
    holdApplied: boolean("hold_applied").notNull().default(false),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
    resolutionNote: text("resolution_note"),
    ...timestamps,
  },
  (table) => [
    index("financial_disputes_org_idx").on(table.organizationId),
    index("financial_disputes_payment_idx").on(table.paymentId),
    index("financial_disputes_status_idx").on(table.status),
    uniqueIndex("financial_disputes_external_unique").on(
      table.providerKey,
      table.externalDisputeId,
    ),
  ],
);

export const financialDisputeEvidence = pgTable(
  "financial_dispute_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    disputeId: uuid("dispute_id")
      .notNull()
      .references(() => financialDisputes.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "restrict" }),
    evidenceType: text("evidence_type").notNull().default("other"),
    submittedByUserId: uuid("submitted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("financial_dispute_evidence_dispute_idx").on(table.disputeId)],
);

export const financialDisputeHistory = pgTable(
  "financial_dispute_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    disputeId: uuid("dispute_id")
      .notNull()
      .references(() => financialDisputes.id, { onDelete: "cascade" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    note: text("note"),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("financial_dispute_history_dispute_idx").on(table.disputeId)],
);

/* ─── Reconciliation / treasury ─── */

export const externalFinancialTransactions = pgTable(
  "external_financial_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sourceType: externalFinancialSourceEnum("source_type").notNull(),
    importSource: externalImportSourceEnum("import_source").notNull().default("manual"),
    providerKey: text("provider_key").notNull().default("not_configured"),
    externalId: text("external_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("BRL"),
    direction: externalTxDirectionEnum("direction").notNull(),
    description: text("description"),
    rawReference: text("raw_reference"),
    status: text("status").notNull().default("imported"),
    importedAt: timestamp("imported_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  (table) => [
    uniqueIndex("external_financial_tx_provider_ext_unique").on(
      table.organizationId,
      table.providerKey,
      table.externalId,
    ),
    index("external_financial_tx_org_idx").on(table.organizationId),
    index("external_financial_tx_occurred_idx").on(table.occurredAt),
  ],
);

export const reconciliationRuns = pgTable(
  "reconciliation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sourceA: externalFinancialSourceEnum("source_a").notNull(),
    sourceB: externalFinancialSourceEnum("source_b").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true, mode: "date" }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true, mode: "date" }).notNull(),
    status: reconciliationRunStatusEnum("status").notNull().default("pending"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    summary: jsonb("summary").$type<Record<string, unknown>>(),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("reconciliation_runs_org_idx").on(table.organizationId),
    index("reconciliation_runs_status_idx").on(table.status),
  ],
);

export const reconciliationItems = pgTable(
  "reconciliation_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => reconciliationRuns.id, { onDelete: "cascade" }),
    sourceAType: text("source_a_type").notNull(),
    sourceAId: uuid("source_a_id"),
    sourceBType: text("source_b_type"),
    sourceBId: uuid("source_b_id"),
    amountDifferenceCents: bigint("amount_difference_cents", { mode: "number" })
      .notNull()
      .default(0),
    dateDifferenceHours: integer("date_difference_hours"),
    status: reconciliationItemStatusEnum("status").notNull().default("review_required"),
    confidence: integer("confidence"),
    resolution: text("resolution"),
    resolvedByMembershipId: uuid("resolved_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("reconciliation_items_run_idx").on(table.runId),
    index("reconciliation_items_status_idx").on(table.status),
  ],
);

export const financialDiscrepancies = pgTable(
  "financial_discrepancies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    runId: uuid("run_id").references(() => reconciliationRuns.id, { onDelete: "set null" }),
    source: text("source").notNull(),
    type: financialDiscrepancyTypeEnum("type").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }),
    currency: text("currency").notNull().default("BRL"),
    status: financialDiscrepancyStatusEnum("status").notNull().default("open"),
    severity: financialDiscrepancySeverityEnum("severity").notNull().default("medium"),
    ownerMembershipId: uuid("owner_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    description: text("description"),
    openedAt: timestamp("opened_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("financial_discrepancies_org_idx").on(table.organizationId),
    index("financial_discrepancies_status_idx").on(table.status),
  ],
);

export const receivables = pgTable(
  "receivables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    debtorType: text("debtor_type"),
    debtorId: uuid("debtor_id"),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    amountPaidCents: bigint("amount_paid_cents", { mode: "number" }).notNull().default(0),
    currency: text("currency").notNull().default("BRL"),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    expectedAt: timestamp("expected_at", { withTimezone: true, mode: "date" }),
    status: receivableStatusEnum("status").notNull().default("open"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("receivables_source_unique").on(
      table.organizationId,
      table.sourceType,
      table.sourceId,
    ),
    index("receivables_org_status_idx").on(table.organizationId, table.status),
    index("receivables_due_idx").on(table.dueAt),
  ],
);

export const accountsPayable = pgTable(
  "accounts_payable",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    vendorName: text("vendor_name"),
    beneficiaryType: text("beneficiary_type"),
    beneficiaryId: uuid("beneficiary_id"),
    category: text("category").notNull().default("other"),
    description: text("description").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("BRL"),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    status: accountsPayableStatusEnum("status").notNull().default("draft"),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    sourceType: text("source_type"),
    sourceId: uuid("source_id"),
    approvedByMembershipId: uuid("approved_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("accounts_payable_org_idx").on(table.organizationId),
    index("accounts_payable_status_idx").on(table.status),
    index("accounts_payable_due_idx").on(table.dueAt),
  ],
);

export const delinquencyCases = pgTable(
  "delinquency_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    receivableId: uuid("receivable_id")
      .notNull()
      .references(() => receivables.id, { onDelete: "cascade" }),
    daysOverdue: integer("days_overdue").notNull().default(0),
    stage: delinquencyStageEnum("stage").notNull().default("reminder"),
    status: delinquencyStatusEnum("status").notNull().default("open"),
    lastContactAt: timestamp("last_contact_at", { withTimezone: true, mode: "date" }),
    nextActionAt: timestamp("next_action_at", { withTimezone: true, mode: "date" }),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("delinquency_cases_receivable_unique").on(table.receivableId),
    index("delinquency_cases_org_idx").on(table.organizationId),
    index("delinquency_cases_stage_idx").on(table.stage),
  ],
);

export const treasuryCashPositions = pgTable(
  "treasury_cash_positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    currency: text("currency").notNull().default("BRL"),
    sourceAccountKey: text("source_account_key").notNull().default("ledger_derived"),
    asOfDate: timestamp("as_of_date", { withTimezone: true, mode: "date" }).notNull(),
    balanceCents: bigint("balance_cents", { mode: "number" }).notNull(),
    derivedFrom: text("derived_from").notNull().default("ledger"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("treasury_cash_positions_unique").on(
      table.organizationId,
      table.currency,
      table.sourceAccountKey,
      table.asOfDate,
    ),
    index("treasury_cash_positions_org_idx").on(table.organizationId),
  ],
);

export const treasuryForecasts = pgTable(
  "treasury_forecasts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    scenario: forecastScenarioEnum("scenario").notNull().default("base"),
    currency: text("currency").notNull().default("BRL"),
    periodStart: timestamp("period_start", { withTimezone: true, mode: "date" }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true, mode: "date" }).notNull(),
    currentVersionId: uuid("current_version_id"),
    ...timestamps,
  },
  (table) => [
    index("treasury_forecasts_org_idx").on(table.organizationId),
    index("treasury_forecasts_scenario_idx").on(table.scenario),
  ],
);

export const treasuryForecastVersions = pgTable(
  "treasury_forecast_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    forecastId: uuid("forecast_id")
      .notNull()
      .references(() => treasuryForecasts.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    openingBalanceCents: bigint("opening_balance_cents", { mode: "number" }).notNull().default(0),
    projectedInflowsCents: bigint("projected_inflows_cents", { mode: "number" })
      .notNull()
      .default(0),
    projectedOutflowsCents: bigint("projected_outflows_cents", { mode: "number" })
      .notNull()
      .default(0),
    closingBalanceCents: bigint("closing_balance_cents", { mode: "number" }).notNull().default(0),
    actualOpeningCents: bigint("actual_opening_cents", { mode: "number" }),
    actualInflowsCents: bigint("actual_inflows_cents", { mode: "number" }),
    actualOutflowsCents: bigint("actual_outflows_cents", { mode: "number" }),
    snapshotJson: jsonb("snapshot_json").$type<Record<string, unknown>>(),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("treasury_forecast_versions_unique").on(table.forecastId, table.version),
    index("treasury_forecast_versions_forecast_idx").on(table.forecastId),
  ],
);

/* ─── Monetization ─── */

export const monetizationProducts = pgTable(
  "monetization_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    productType: monetizationProductTypeEnum("product_type").notNull(),
    planTier: planTierEnum("plan_tier"),
    planTarget: planTargetEnum("plan_target"),
    billingPlanId: uuid("billing_plan_id").references(() => billingPlans.id, {
      onDelete: "set null",
    }),
    active: boolean("active").notNull().default(true),
    public: boolean("public").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("monetization_products_key_unique").on(table.key),
    index("monetization_products_type_idx").on(table.productType),
  ],
);

export const productPrices = pgTable(
  "product_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => monetizationProducts.id, { onDelete: "cascade" }),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("BRL"),
    interval: text("interval"),
    usageBased: boolean("usage_based").notNull().default(false),
    validFrom: timestamp("valid_from", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    validTo: timestamp("valid_to", { withTimezone: true, mode: "date" }),
    active: boolean("active").notNull().default(true),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("product_prices_product_version_unique").on(table.productId, table.version),
    index("product_prices_product_idx").on(table.productId),
  ],
);

export const usageMeters = pgTable(
  "usage_meters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    unit: text("unit").notNull(),
    aggregationType: usageAggregationTypeEnum("aggregation_type").notNull().default("sum"),
    resetPeriod: usageResetPeriodEnum("reset_period").notNull().default("monthly"),
    billable: boolean("billable").notNull().default(true),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex("usage_meters_key_unique").on(table.key)],
);

export const usageRecords = pgTable(
  "usage_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    meterId: uuid("meter_id")
      .notNull()
      .references(() => usageMeters.id, { onDelete: "restrict" }),
    quantity: bigint("quantity", { mode: "number" }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("usage_records_idempotency_unique").on(table.organizationId, table.idempotencyKey),
    index("usage_records_meter_idx").on(table.meterId),
    index("usage_records_org_idx").on(table.organizationId),
    index("usage_records_occurred_idx").on(table.occurredAt),
  ],
);

export const aiCreditWallets = pgTable(
  "ai_credit_wallets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    balanceCredits: bigint("balance_credits", { mode: "number" }).notNull().default(0),
    currencyLabel: text("currency_label").notNull().default("credit"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("ai_credit_wallets_org_unique").on(table.organizationId),
    uniqueIndex("ai_credit_wallets_user_unique").on(table.userId),
  ],
);

export const aiCreditTransactions = pgTable(
  "ai_credit_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => aiCreditWallets.id, { onDelete: "cascade" }),
    type: aiCreditTxTypeEnum("type").notNull(),
    amountCredits: bigint("amount_credits", { mode: "number" }).notNull(),
    balanceAfterCredits: bigint("balance_after_credits", { mode: "number" }).notNull(),
    reason: text("reason"),
    sourceType: text("source_type"),
    sourceId: uuid("source_id"),
    providerTokens: bigint("provider_tokens", { mode: "number" }),
    providerCostMicros: bigint("provider_cost_micros", { mode: "number" }),
    featureKey: text("feature_key"),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("ai_credit_transactions_idempotency_unique").on(
      table.walletId,
      table.idempotencyKey,
    ),
    index("ai_credit_transactions_wallet_idx").on(table.walletId),
    index("ai_credit_transactions_type_idx").on(table.type),
  ],
);

export const technologyFeeRules = pgTable(
  "technology_fee_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    appliesTo: text("applies_to").notNull(),
    percentageBps: integer("percentage_bps"),
    fixedAmountCents: bigint("fixed_amount_cents", { mode: "number" }),
    currency: text("currency").notNull().default("BRL"),
    version: integer("version").notNull().default(1),
    active: boolean("active").notNull().default(true),
    validFrom: timestamp("valid_from", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    validTo: timestamp("valid_to", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("technology_fee_rules_key_version_unique").on(table.key, table.version),
    index("technology_fee_rules_applies_idx").on(table.appliesTo),
  ],
);

export const apiClients = pgTable(
  "api_clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: apiClientStatusEnum("status").notNull().default("active"),
    planId: uuid("plan_id").references(() => billingPlans.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    index("api_clients_org_idx").on(table.organizationId),
    index("api_clients_status_idx").on(table.status),
  ],
);

export const apiCredentials = pgTable(
  "api_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    apiClientId: uuid("api_client_id")
      .notNull()
      .references(() => apiClients.id, { onDelete: "cascade" }),
    credentialId: text("credential_id").notNull(),
    secretHash: text("secret_hash").notNull(),
    prefix: text("prefix").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "date" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("api_credentials_credential_id_unique").on(table.credentialId),
    index("api_credentials_client_idx").on(table.apiClientId),
  ],
);

export const apiScopes = pgTable(
  "api_scopes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("api_scopes_key_unique").on(table.key)],
);

export const apiClientScopes = pgTable(
  "api_client_scopes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    apiClientId: uuid("api_client_id")
      .notNull()
      .references(() => apiClients.id, { onDelete: "cascade" }),
    scopeId: uuid("scope_id")
      .notNull()
      .references(() => apiScopes.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("api_client_scopes_unique").on(table.apiClientId, table.scopeId)],
);

export const apiUsageRecords = pgTable(
  "api_usage_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    apiClientId: uuid("api_client_id")
      .notNull()
      .references(() => apiClients.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    endpointKey: text("endpoint_key").notNull(),
    quantity: integer("quantity").notNull().default(1),
    units: bigint("units", { mode: "number" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    status: text("status").notNull().default("ok"),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("api_usage_records_idempotency_unique").on(table.apiClientId, table.idempotencyKey),
    index("api_usage_records_client_idx").on(table.apiClientId),
    index("api_usage_records_occurred_idx").on(table.occurredAt),
  ],
);

export const softwareLicenses = pgTable(
  "software_licenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    product: text("product").notNull(),
    licenseType: softwareLicenseTypeEnum("license_type").notNull().default("subscription"),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }),
    seats: integer("seats"),
    status: softwareLicenseStatusEnum("status").notNull().default("draft"),
    contractId: uuid("contract_id").references(() => contracts.id, { onDelete: "set null" }),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    index("software_licenses_org_idx").on(table.organizationId),
    index("software_licenses_status_idx").on(table.status),
  ],
);

export const whiteLabelConfigs = pgTable(
  "white_label_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(false),
    brandName: text("brand_name"),
    logoDocumentId: uuid("logo_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    primaryColor: text("primary_color"),
    secondaryColor: text("secondary_color"),
    customDomain: text("custom_domain"),
    customDomainVerified: boolean("custom_domain_verified").notNull().default(false),
    supportBranding: boolean("support_branding").notNull().default(true),
    status: whiteLabelStatusEnum("status").notNull().default("draft"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("white_label_configs_org_unique").on(table.organizationId),
    uniqueIndex("white_label_configs_domain_unique").on(table.customDomain),
  ],
);

/* ─── Relations (subset) ─── */

export const splitRulesRelations = relations(splitRules, () => ({}));

export const financialRetentionsRelations = relations(financialRetentions, ({ one }) => ({
  allocation: one(paymentAllocations, {
    fields: [financialRetentions.allocationId],
    references: [paymentAllocations.id],
  }),
}));

export const payablesRelations = relations(payables, ({ one }) => ({
  allocation: one(paymentAllocations, {
    fields: [payables.sourceAllocationId],
    references: [paymentAllocations.id],
  }),
  organization: one(organizations, {
    fields: [payables.organizationId],
    references: [organizations.id],
  }),
}));

export const payoutSchedulesRelations = relations(payoutSchedules, ({ one }) => ({
  organization: one(organizations, {
    fields: [payoutSchedules.organizationId],
    references: [organizations.id],
  }),
}));

export const financialDisputesRelations = relations(financialDisputes, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [financialDisputes.organizationId],
    references: [organizations.id],
  }),
  payment: one(payments, {
    fields: [financialDisputes.paymentId],
    references: [payments.id],
  }),
  evidence: many(financialDisputeEvidence),
  history: many(financialDisputeHistory),
}));

export const financialDisputeEvidenceRelations = relations(financialDisputeEvidence, ({ one }) => ({
  dispute: one(financialDisputes, {
    fields: [financialDisputeEvidence.disputeId],
    references: [financialDisputes.id],
  }),
  document: one(documents, {
    fields: [financialDisputeEvidence.documentId],
    references: [documents.id],
  }),
}));

export const financialDisputeHistoryRelations = relations(financialDisputeHistory, ({ one }) => ({
  dispute: one(financialDisputes, {
    fields: [financialDisputeHistory.disputeId],
    references: [financialDisputes.id],
  }),
}));

export const refundHistoryRelations = relations(refundHistory, ({ one }) => ({
  refund: one(refunds, {
    fields: [refundHistory.refundId],
    references: [refunds.id],
  }),
}));

export const reconciliationRunsRelations = relations(reconciliationRuns, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [reconciliationRuns.organizationId],
    references: [organizations.id],
  }),
  items: many(reconciliationItems),
}));

export const reconciliationItemsRelations = relations(reconciliationItems, ({ one }) => ({
  run: one(reconciliationRuns, {
    fields: [reconciliationItems.runId],
    references: [reconciliationRuns.id],
  }),
}));

export const receivablesRelations = relations(receivables, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [receivables.organizationId],
    references: [organizations.id],
  }),
  delinquency: many(delinquencyCases),
}));

export const delinquencyCasesRelations = relations(delinquencyCases, ({ one }) => ({
  receivable: one(receivables, {
    fields: [delinquencyCases.receivableId],
    references: [receivables.id],
  }),
}));

export const treasuryForecastsRelations = relations(treasuryForecasts, ({ many }) => ({
  versions: many(treasuryForecastVersions),
}));

export const treasuryForecastVersionsRelations = relations(treasuryForecastVersions, ({ one }) => ({
  forecast: one(treasuryForecasts, {
    fields: [treasuryForecastVersions.forecastId],
    references: [treasuryForecasts.id],
  }),
}));

export const monetizationProductsRelations = relations(monetizationProducts, ({ many }) => ({
  prices: many(productPrices),
}));

export const productPricesRelations = relations(productPrices, ({ one }) => ({
  product: one(monetizationProducts, {
    fields: [productPrices.productId],
    references: [monetizationProducts.id],
  }),
}));

export const usageMetersRelations = relations(usageMeters, ({ many }) => ({
  records: many(usageRecords),
}));

export const usageRecordsRelations = relations(usageRecords, ({ one }) => ({
  meter: one(usageMeters, {
    fields: [usageRecords.meterId],
    references: [usageMeters.id],
  }),
}));

export const aiCreditWalletsRelations = relations(aiCreditWallets, ({ many }) => ({
  transactions: many(aiCreditTransactions),
}));

export const aiCreditTransactionsRelations = relations(aiCreditTransactions, ({ one }) => ({
  wallet: one(aiCreditWallets, {
    fields: [aiCreditTransactions.walletId],
    references: [aiCreditWallets.id],
  }),
}));

export const apiClientsRelations = relations(apiClients, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [apiClients.organizationId],
    references: [organizations.id],
  }),
  credentials: many(apiCredentials),
  scopes: many(apiClientScopes),
  usage: many(apiUsageRecords),
}));

export const apiCredentialsRelations = relations(apiCredentials, ({ one }) => ({
  client: one(apiClients, {
    fields: [apiCredentials.apiClientId],
    references: [apiClients.id],
  }),
}));

export const apiClientScopesRelations = relations(apiClientScopes, ({ one }) => ({
  client: one(apiClients, {
    fields: [apiClientScopes.apiClientId],
    references: [apiClients.id],
  }),
  scope: one(apiScopes, {
    fields: [apiClientScopes.scopeId],
    references: [apiScopes.id],
  }),
}));

export const softwareLicensesRelations = relations(softwareLicenses, ({ one }) => ({
  organization: one(organizations, {
    fields: [softwareLicenses.organizationId],
    references: [organizations.id],
  }),
}));

export const whiteLabelConfigsRelations = relations(whiteLabelConfigs, ({ one }) => ({
  organization: one(organizations, {
    fields: [whiteLabelConfigs.organizationId],
    references: [organizations.id],
  }),
}));

export const accountsPayableRelations = relations(accountsPayable, ({ one }) => ({
  organization: one(organizations, {
    fields: [accountsPayable.organizationId],
    references: [organizations.id],
  }),
}));

export const externalFinancialTransactionsRelations = relations(
  externalFinancialTransactions,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [externalFinancialTransactions.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const financialDiscrepanciesRelations = relations(financialDiscrepancies, ({ one }) => ({
  organization: one(organizations, {
    fields: [financialDiscrepancies.organizationId],
    references: [organizations.id],
  }),
}));

export const treasuryCashPositionsRelations = relations(treasuryCashPositions, ({ one }) => ({
  organization: one(organizations, {
    fields: [treasuryCashPositions.organizationId],
    references: [organizations.id],
  }),
}));

export const technologyFeeRulesRelations = relations(technologyFeeRules, () => ({}));
export const apiScopesRelations = relations(apiScopes, ({ many }) => ({
  clients: many(apiClientScopes),
}));
export const apiUsageRecordsRelations = relations(apiUsageRecords, ({ one }) => ({
  client: one(apiClients, {
    fields: [apiUsageRecords.apiClientId],
    references: [apiClients.id],
  }),
}));
