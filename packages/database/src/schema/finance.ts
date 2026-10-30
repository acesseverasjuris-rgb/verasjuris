/**
 * Etapas 21 + 21.1 + 21.2 — Financeiro, Ledger double-entry, Pagamentos.
 * Catálogo ≠ Assinatura ≠ Invoice ≠ PaymentIntent ≠ Payment ≠ Ledger ≠ Saldo ≠ Repasse.
 * Money: integer minor units (centavos). Saldo derivado do ledger.
 * PaymentProvider existente em @verasjuris/ai — evoluir, não duplicar.
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
import { contracts } from "./contracts.js";
import { crmClients } from "./crm.js";
import { documents } from "./documents.js";
import { organizationMembers, organizations, users } from "./identity.js";
import { legalMatters } from "./matters.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

/* ─── Billing enums ─── */

export const billingIntervalEnum = pgEnum("billing_interval", [
  "monthly",
  "quarterly",
  "yearly",
  "one_time",
  "custom",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "incomplete",
  "trialing",
  "active",
  "past_due",
  "suspended",
  "cancelled",
  "expired",
  "not_configured",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "open",
  "partially_paid",
  "paid",
  "past_due",
  "void",
  "uncollectible",
  "refunded",
]);

export const billableItemTypeEnum = pgEnum("billable_item_type", [
  "subscription",
  "service",
  "legal_fee",
  "platform_fee",
  "registry_fee",
  "diligence",
  "consultation",
  "course",
  "credit",
  "adjustment",
  "other",
]);

export const billingChargeStatusEnum = pgEnum("billing_charge_status", [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "cancelled",
  "not_configured",
]);

export const billingCreditStatusEnum = pgEnum("billing_credit_status", [
  "available",
  "applied",
  "expired",
  "void",
]);

export const legalFeeTypeEnum = pgEnum("legal_fee_type", [
  "fixed",
  "hourly",
  "percentage",
  "success",
  "mixed",
  "installment",
  "other",
]);

export const legalFeeAgreementStatusEnum = pgEnum("legal_fee_agreement_status", [
  "draft",
  "active",
  "completed",
  "cancelled",
  "suspended",
]);

export const legalFeeAccrualStatusEnum = pgEnum("legal_fee_accrual_status", [
  "accrued",
  "invoiced",
  "waived",
  "cancelled",
]);

export const platformFeeBaseEnum = pgEnum("platform_fee_base", [
  "marketplace",
  "online_consultation",
  "diligence",
  "extrajudicial",
  "education",
  "subscription",
  "other",
]);

export const costCategoryEnum = pgEnum("cost_category", [
  "infrastructure",
  "ai",
  "provider",
  "registry",
  "court",
  "travel",
  "marketing",
  "personnel",
  "refund",
  "processing_fee",
  "other",
]);

export const entitlementLimitTypeEnum = pgEnum("entitlement_limit_type", [
  "boolean",
  "count",
  "amount_cents",
  "unlimited",
  "storage",
  "rate",
  "credit",
  "currency",
]);

/* ─── Ledger enums ─── */

export const ledgerAccountTypeEnum = pgEnum("ledger_account_type", [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
  "clearing",
]);

export const ledgerTransactionStatusEnum = pgEnum("ledger_transaction_status", [
  "draft",
  "posted",
  "reversed",
]);

export const ledgerEntryDirectionEnum = pgEnum("ledger_entry_direction", ["debit", "credit"]);

export const ledgerTransactionTypeEnum = pgEnum("ledger_transaction_type", [
  "payment_received",
  "payment_failed",
  "refund",
  "invoice_recognition",
  "credit_applied",
  "fee_accrual",
  "platform_fee",
  "payout",
  "chargeback",
  "manual_journal",
  "reversal",
  "cost",
  "other",
]);

export const reconciliationStatusEnum = pgEnum("financial_reconciliation_status", [
  "unmatched",
  "matched",
  "partial",
  "review_required",
  "resolved",
  "not_configured",
]);

/* ─── Payment enums ─── */

export const paymentIntentStatusEnum = pgEnum("payment_intent_status", [
  "created",
  "requires_action",
  "processing",
  "authorized",
  "confirmed",
  "failed",
  "cancelled",
  "expired",
  "not_configured",
]);

export const platformPaymentStatusEnum = pgEnum("platform_payment_status", [
  "pending",
  "authorized",
  "confirmed",
  "failed",
  "cancelled",
  "refunded",
  "partially_refunded",
  "chargeback",
  "disputed",
]);

export const paymentMethodEnum = pgEnum("platform_payment_method", [
  "pix",
  "credit_card",
  "debit_card",
  "boleto",
  "bank_transfer",
  "wallet",
  "manual",
  "other",
]);

export const refundStatusEnum = pgEnum("platform_refund_status", [
  "requested",
  "processing",
  "confirmed",
  "failed",
  "cancelled",
  "not_configured",
]);

export const paymentDisputeTypeEnum = pgEnum("payment_dispute_type", [
  "chargeback",
  "payment_dispute",
  "fraud_review",
]);

export const paymentDisputeStatusEnum = pgEnum("payment_dispute_status", [
  "open",
  "under_review",
  "won",
  "lost",
  "cancelled",
  "not_configured",
]);

export const paymentAllocationStatusEnum = pgEnum("payment_allocation_status", [
  "pending",
  "reserved",
  "released",
  "paid_out",
  "cancelled",
  "not_configured",
]);

export const payoutStatusEnum = pgEnum("payout_status", [
  "pending",
  "scheduled",
  "processing",
  "paid",
  "failed",
  "cancelled",
  "held",
  "not_configured",
]);

export const webhookEventStatusEnum = pgEnum("payment_webhook_event_status", [
  "received",
  "processing",
  "processed",
  "ignored",
  "failed",
]);

/* ─── Billing tables ─── */

export const billingPlans = pgTable(
  "billing_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    billingInterval: billingIntervalEnum("billing_interval").notNull().default("monthly"),
    priceCents: bigint("price_cents", { mode: "number" }).notNull().default(0),
    currency: text("currency").notNull().default("BRL"),
    active: boolean("active").notNull().default(true),
    public: boolean("public").notNull().default(false),
    version: integer("version").notNull().default(1),
    currentVersionId: uuid("current_version_id"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("billing_plans_key_unique").on(table.key),
    index("billing_plans_active_idx").on(table.active),
  ],
);

export const billingPlanVersions = pgTable(
  "billing_plan_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => billingPlans.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    billingInterval: billingIntervalEnum("billing_interval").notNull(),
    priceCents: bigint("price_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("BRL"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    effectiveTo: timestamp("effective_to", { withTimezone: true, mode: "date" }),
    snapshotJson: jsonb("snapshot_json").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("billing_plan_versions_plan_version_unique").on(table.planId, table.version),
    index("billing_plan_versions_plan_idx").on(table.planId),
  ],
);

export const billingPlanFeatures = pgTable(
  "billing_plan_features",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => billingPlans.id, { onDelete: "cascade" }),
    planVersionId: uuid("plan_version_id").references(() => billingPlanVersions.id, {
      onDelete: "cascade",
    }),
    featureKey: text("feature_key").notNull(),
    limitType: entitlementLimitTypeEnum("limit_type").notNull().default("boolean"),
    limitValue: bigint("limit_value", { mode: "number" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("billing_plan_features_plan_feature_unique").on(table.planId, table.featureKey),
    index("billing_plan_features_plan_idx").on(table.planId),
    index("billing_plan_features_key_idx").on(table.featureKey),
  ],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => billingPlans.id, { onDelete: "restrict" }),
    planVersionId: uuid("plan_version_id")
      .notNull()
      .references(() => billingPlanVersions.id, { onDelete: "restrict" }),
    status: subscriptionStatusEnum("status").notNull().default("incomplete"),
    billingCycleAnchor: timestamp("billing_cycle_anchor", { withTimezone: true, mode: "date" }),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true, mode: "date" }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, mode: "date" }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "date" }),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true, mode: "date" }),
    providerKey: text("provider_key").notNull().default("not_configured"),
    externalSubscriptionId: text("external_subscription_id"),
    ...timestamps,
  },
  (table) => [
    index("subscriptions_org_idx").on(table.organizationId),
    index("subscriptions_user_idx").on(table.userId),
    index("subscriptions_status_idx").on(table.status),
    index("subscriptions_plan_idx").on(table.planId),
    uniqueIndex("subscriptions_external_unique").on(
      table.providerKey,
      table.externalSubscriptionId,
    ),
  ],
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => crmClients.id, { onDelete: "set null" }),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    invoiceNumber: text("invoice_number").notNull(),
    currency: text("currency").notNull().default("BRL"),
    subtotalCents: bigint("subtotal_cents", { mode: "number" }).notNull().default(0),
    discountCents: bigint("discount_cents", { mode: "number" }).notNull().default(0),
    taxCents: bigint("tax_cents", { mode: "number" }).notNull().default(0),
    estimatedTaxCents: bigint("estimated_tax_cents", { mode: "number" }),
    taxSource: text("tax_source"),
    totalCents: bigint("total_cents", { mode: "number" }).notNull().default(0),
    amountPaidCents: bigint("amount_paid_cents", { mode: "number" }).notNull().default(0),
    amountDueCents: bigint("amount_due_cents", { mode: "number" }).notNull().default(0),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    issuedAt: timestamp("issued_at", { withTimezone: true, mode: "date" }),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
    externalReference: text("external_reference"),
    periodKey: text("period_key"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("invoices_number_unique").on(table.invoiceNumber),
    index("invoices_org_idx").on(table.organizationId),
    index("invoices_status_idx").on(table.status),
    index("invoices_due_idx").on(table.dueAt),
    index("invoices_subscription_idx").on(table.subscriptionId),
    uniqueIndex("invoices_subscription_period_unique").on(table.subscriptionId, table.periodKey),
  ],
);

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    type: billableItemTypeEnum("type").notNull().default("other"),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitAmountCents: bigint("unit_amount_cents", { mode: "number" }).notNull(),
    totalAmountCents: bigint("total_amount_cents", { mode: "number" }).notNull(),
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("invoice_lines_invoice_idx").on(table.invoiceId)],
);

export const billingCharges = pgTable(
  "billing_charges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("BRL"),
    status: billingChargeStatusEnum("status").notNull().default("pending"),
    description: text("description"),
    paymentIntentId: uuid("payment_intent_id"),
    attemptedAt: timestamp("attempted_at", { withTimezone: true, mode: "date" }),
    succeededAt: timestamp("succeeded_at", { withTimezone: true, mode: "date" }),
    failedAt: timestamp("failed_at", { withTimezone: true, mode: "date" }),
    failureCode: text("failure_code"),
    ...timestamps,
  },
  (table) => [
    index("billing_charges_org_idx").on(table.organizationId),
    index("billing_charges_invoice_idx").on(table.invoiceId),
    index("billing_charges_status_idx").on(table.status),
  ],
);

export const billingCredits = pgTable(
  "billing_credits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    remainingCents: bigint("remaining_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("BRL"),
    reason: text("reason").notNull(),
    source: text("source").notNull().default("manual"),
    status: billingCreditStatusEnum("status").notNull().default("available"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    appliedInvoiceId: uuid("applied_invoice_id").references(() => invoices.id, {
      onDelete: "set null",
    }),
    ledgerTransactionId: uuid("ledger_transaction_id"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("billing_credits_org_idx").on(table.organizationId),
    index("billing_credits_user_idx").on(table.userId),
    index("billing_credits_status_idx").on(table.status),
  ],
);

export const legalFeeAgreements = pgTable(
  "legal_fee_agreements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => crmClients.id, { onDelete: "set null" }),
    legalMatterId: uuid("legal_matter_id").references(() => legalMatters.id, {
      onDelete: "set null",
    }),
    contractId: uuid("contract_id").references(() => contracts.id, { onDelete: "set null" }),
    feeType: legalFeeTypeEnum("fee_type").notNull().default("fixed"),
    fixedAmountCents: bigint("fixed_amount_cents", { mode: "number" }),
    hourlyRateCents: bigint("hourly_rate_cents", { mode: "number" }),
    percentageBps: integer("percentage_bps"),
    successFeeBps: integer("success_fee_bps"),
    currency: text("currency").notNull().default("BRL"),
    installmentConfig: jsonb("installment_config").$type<Record<string, unknown>>(),
    status: legalFeeAgreementStatusEnum("status").notNull().default("draft"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("legal_fee_agreements_org_idx").on(table.organizationId),
    index("legal_fee_agreements_client_idx").on(table.clientId),
    index("legal_fee_agreements_matter_idx").on(table.legalMatterId),
    index("legal_fee_agreements_status_idx").on(table.status),
  ],
);

export const legalFeeAccruals = pgTable(
  "legal_fee_accruals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agreementId: uuid("agreement_id")
      .notNull()
      .references(() => legalFeeAgreements.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("BRL"),
    description: text("description"),
    status: legalFeeAccrualStatusEnum("status").notNull().default("accrued"),
    accruedAt: timestamp("accrued_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    ledgerTransactionId: uuid("ledger_transaction_id"),
    ...timestamps,
  },
  (table) => [
    index("legal_fee_accruals_agreement_idx").on(table.agreementId),
    index("legal_fee_accruals_org_idx").on(table.organizationId),
    index("legal_fee_accruals_status_idx").on(table.status),
  ],
);

export const platformFeeRules = pgTable(
  "platform_fee_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    feeBase: platformFeeBaseEnum("fee_base").notNull(),
    percentageBps: integer("percentage_bps"),
    fixedAmountCents: bigint("fixed_amount_cents", { mode: "number" }),
    currency: text("currency").notNull().default("BRL"),
    version: integer("version").notNull().default(1),
    active: boolean("active").notNull().default(true),
    effectiveFrom: timestamp("effective_from", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    effectiveTo: timestamp("effective_to", { withTimezone: true, mode: "date" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("platform_fee_rules_key_version_unique").on(table.key, table.version),
    index("platform_fee_rules_base_idx").on(table.feeBase),
    index("platform_fee_rules_active_idx").on(table.active),
  ],
);

export const costRecords = pgTable(
  "cost_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    category: costCategoryEnum("category").notNull().default("other"),
    description: text("description").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("BRL"),
    incurredAt: timestamp("incurred_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    legalMatterId: uuid("legal_matter_id").references(() => legalMatters.id, {
      onDelete: "set null",
    }),
    serviceReferenceType: text("service_reference_type"),
    serviceReferenceId: uuid("service_reference_id"),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    source: text("source").notNull().default("manual"),
    ledgerTransactionId: uuid("ledger_transaction_id"),
    /** FK SQL → cost_centers (control.ts); sem references Drizzle para evitar ciclo. */
    costCenterId: uuid("cost_center_id"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("cost_records_org_idx").on(table.organizationId),
    index("cost_records_category_idx").on(table.category),
    index("cost_records_incurred_idx").on(table.incurredAt),
    index("cost_records_cost_center_idx").on(table.costCenterId),
  ],
);

/* ─── Ledger tables ─── */

export const ledgerAccounts = pgTable(
  "ledger_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    type: ledgerAccountTypeEnum("type").notNull(),
    currency: text("currency").notNull().default("BRL"),
    parentAccountId: uuid("parent_account_id"),
    active: boolean("active").notNull().default(true),
    systemAccount: boolean("system_account").notNull().default(false),
    systemKey: text("system_key"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("ledger_accounts_org_code_unique").on(table.organizationId, table.code),
    uniqueIndex("ledger_accounts_org_system_key_unique").on(table.organizationId, table.systemKey),
    index("ledger_accounts_org_idx").on(table.organizationId),
    index("ledger_accounts_type_idx").on(table.type),
  ],
);

export const ledgerTransactions = pgTable(
  "ledger_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    transactionType: ledgerTransactionTypeEnum("transaction_type").notNull(),
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    currency: text("currency").notNull().default("BRL"),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    status: ledgerTransactionStatusEnum("status").notNull().default("draft"),
    idempotencyKey: text("idempotency_key").notNull(),
    description: text("description"),
    reversalOfTransactionId: uuid("reversal_of_transaction_id"),
    reason: text("reason"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    postedAt: timestamp("posted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    uniqueIndex("ledger_transactions_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    index("ledger_transactions_org_idx").on(table.organizationId),
    index("ledger_transactions_status_idx").on(table.status),
    index("ledger_transactions_ref_idx").on(table.referenceType, table.referenceId),
    index("ledger_transactions_occurred_idx").on(table.occurredAt),
  ],
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => ledgerTransactions.id, { onDelete: "restrict" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => ledgerAccounts.id, { onDelete: "restrict" }),
    direction: ledgerEntryDirectionEnum("direction").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("BRL"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("ledger_entries_transaction_idx").on(table.transactionId),
    index("ledger_entries_account_idx").on(table.accountId),
  ],
);

export const financialReconciliations = pgTable(
  "financial_reconciliations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    providerKey: text("provider_key").notNull().default("not_configured"),
    externalReference: text("external_reference"),
    ledgerTransactionId: uuid("ledger_transaction_id").references(() => ledgerTransactions.id, {
      onDelete: "set null",
    }),
    amountCents: bigint("amount_cents", { mode: "number" }),
    currency: text("currency").notNull().default("BRL"),
    status: reconciliationStatusEnum("status").notNull().default("not_configured"),
    notes: text("notes"),
    matchedAt: timestamp("matched_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("financial_reconciliations_org_idx").on(table.organizationId),
    index("financial_reconciliations_status_idx").on(table.status),
  ],
);

/* ─── Payment tables ─── */

export const paymentIntents = pgTable(
  "payment_intents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    payerType: text("payer_type").notNull(),
    payerId: uuid("payer_id").notNull(),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    referenceType: text("reference_type").notNull(),
    referenceId: uuid("reference_id").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("BRL"),
    paymentMethod: paymentMethodEnum("payment_method").notNull().default("other"),
    status: paymentIntentStatusEnum("status").notNull().default("created"),
    providerKey: text("provider_key").notNull().default("not_configured"),
    externalIntentId: text("external_intent_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("payment_intents_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    index("payment_intents_org_idx").on(table.organizationId),
    index("payment_intents_status_idx").on(table.status),
    index("payment_intents_invoice_idx").on(table.invoiceId),
    index("payment_intents_ref_idx").on(table.referenceType, table.referenceId),
    uniqueIndex("payment_intents_external_unique").on(table.providerKey, table.externalIntentId),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentIntentId: uuid("payment_intent_id")
      .notNull()
      .references(() => paymentIntents.id, { onDelete: "restrict" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("BRL"),
    status: platformPaymentStatusEnum("status").notNull().default("pending"),
    providerKey: text("provider_key").notNull().default("not_configured"),
    externalPaymentId: text("external_payment_id"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true, mode: "date" }),
    failedAt: timestamp("failed_at", { withTimezone: true, mode: "date" }),
    failureCode: text("failure_code"),
    evidenceDocumentId: uuid("evidence_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    recordedByMembershipId: uuid("recorded_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ledgerTransactionId: uuid("ledger_transaction_id"),
    isManual: boolean("is_manual").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("payments_intent_idx").on(table.paymentIntentId),
    index("payments_org_idx").on(table.organizationId),
    index("payments_status_idx").on(table.status),
    uniqueIndex("payments_external_unique").on(table.providerKey, table.externalPaymentId),
    uniqueIndex("payments_ledger_tx_unique").on(table.ledgerTransactionId),
  ],
);

export const paymentWebhookEvents = pgTable(
  "payment_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerKey: text("provider_key").notNull(),
    externalEventId: text("external_event_id").notNull(),
    eventType: text("event_type").notNull(),
    payloadHash: text("payload_hash").notNull(),
    signatureValid: boolean("signature_valid"),
    receivedAt: timestamp("received_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" }),
    status: webhookEventStatusEnum("status").notNull().default("received"),
    errorCode: text("error_code"),
    paymentIntentId: uuid("payment_intent_id").references(() => paymentIntents.id, {
      onDelete: "set null",
    }),
    rawPayloadRef: text("raw_payload_ref"),
  },
  (table) => [
    uniqueIndex("payment_webhook_events_provider_event_unique").on(
      table.providerKey,
      table.externalEventId,
    ),
    index("payment_webhook_events_status_idx").on(table.status),
    index("payment_webhook_events_received_idx").on(table.receivedAt),
  ],
);

export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "restrict" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("BRL"),
    /** full | partial | credit — text to avoid enum migration churn; validated in Zod. */
    refundType: text("refund_type").notNull().default("partial"),
    reasonCode: text("reason_code"),
    status: refundStatusEnum("status").notNull().default("requested"),
    providerKey: text("provider_key").notNull().default("not_configured"),
    externalRefundId: text("external_refund_id"),
    reason: text("reason"),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    requestedAt: timestamp("requested_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true, mode: "date" }),
    failedAt: timestamp("failed_at", { withTimezone: true, mode: "date" }),
    creditId: uuid("credit_id").references(() => billingCredits.id, { onDelete: "set null" }),
    ledgerTransactionId: uuid("ledger_transaction_id"),
    idempotencyKey: text("idempotency_key"),
    ...timestamps,
  },
  (table) => [
    index("refunds_payment_idx").on(table.paymentId),
    index("refunds_status_idx").on(table.status),
    uniqueIndex("refunds_external_unique").on(table.providerKey, table.externalRefundId),
    uniqueIndex("refunds_ledger_tx_unique").on(table.ledgerTransactionId),
    uniqueIndex("refunds_idempotency_unique").on(table.organizationId, table.idempotencyKey),
  ],
);

export const paymentDisputes = pgTable(
  "payment_disputes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "restrict" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    disputeType: paymentDisputeTypeEnum("dispute_type").notNull().default("chargeback"),
    status: paymentDisputeStatusEnum("status").notNull().default("not_configured"),
    providerKey: text("provider_key").notNull().default("not_configured"),
    externalDisputeId: text("external_dispute_id"),
    amountCents: bigint("amount_cents", { mode: "number" }),
    currency: text("currency").notNull().default("BRL"),
    reason: text("reason"),
    openedAt: timestamp("opened_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("payment_disputes_payment_idx").on(table.paymentId),
    index("payment_disputes_status_idx").on(table.status),
  ],
);

export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    beneficiaryType: text("beneficiary_type").notNull(),
    beneficiaryId: uuid("beneficiary_id").notNull(),
    allocationType: text("allocation_type").notNull().default("other"),
    grossAmountCents: bigint("gross_amount_cents", { mode: "number" }),
    /** @deprecated use grossAmountCents — kept for compat during 21.3 evolution */
    grossCents: bigint("gross_cents", { mode: "number" }).notNull(),
    feeAmountCents: bigint("fee_amount_cents", { mode: "number" }),
    feeCents: bigint("fee_cents", { mode: "number" }).notNull().default(0),
    retentionAmountCents: bigint("retention_amount_cents", { mode: "number" }).notNull().default(0),
    netAmountCents: bigint("net_amount_cents", { mode: "number" }),
    netCents: bigint("net_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("BRL"),
    status: paymentAllocationStatusEnum("status").notNull().default("pending"),
    ruleVersionId: uuid("rule_version_id"),
    ruleSnapshotJson: jsonb("rule_snapshot_json").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("payment_allocations_payment_idx").on(table.paymentId),
    index("payment_allocations_org_idx").on(table.organizationId),
    index("payment_allocations_beneficiary_idx").on(table.beneficiaryType, table.beneficiaryId),
    index("payment_allocations_status_idx").on(table.status),
  ],
);

export const payouts = pgTable(
  "payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    beneficiaryType: text("beneficiary_type").notNull(),
    beneficiaryId: uuid("beneficiary_id").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("BRL"),
    status: payoutStatusEnum("status").notNull().default("not_configured"),
    providerKey: text("provider_key").notNull().default("not_configured"),
    externalPayoutId: text("external_payout_id"),
    allocationId: uuid("allocation_id").references(() => paymentAllocations.id, {
      onDelete: "set null",
    }),
    payableId: uuid("payable_id"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "date" }),
    initiatedAt: timestamp("initiated_at", { withTimezone: true, mode: "date" }),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
    failedAt: timestamp("failed_at", { withTimezone: true, mode: "date" }),
    failureCode: text("failure_code"),
    holdReason: text("hold_reason"),
    idempotencyKey: text("idempotency_key"),
    ledgerTransactionId: uuid("ledger_transaction_id"),
    ...timestamps,
  },
  (table) => [
    index("payouts_org_idx").on(table.organizationId),
    index("payouts_status_idx").on(table.status),
    index("payouts_beneficiary_idx").on(table.beneficiaryType, table.beneficiaryId),
    uniqueIndex("payouts_idempotency_unique").on(table.organizationId, table.idempotencyKey),
    uniqueIndex("payouts_external_unique").on(table.providerKey, table.externalPayoutId),
  ],
);

/* ─── Relations ─── */

export const billingPlansRelations = relations(billingPlans, ({ many }) => ({
  versions: many(billingPlanVersions),
  features: many(billingPlanFeatures),
  subscriptions: many(subscriptions),
}));

export const billingPlanVersionsRelations = relations(billingPlanVersions, ({ one }) => ({
  plan: one(billingPlans, {
    fields: [billingPlanVersions.planId],
    references: [billingPlans.id],
  }),
}));

export const billingPlanFeaturesRelations = relations(billingPlanFeatures, ({ one }) => ({
  plan: one(billingPlans, {
    fields: [billingPlanFeatures.planId],
    references: [billingPlans.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  plan: one(billingPlans, {
    fields: [subscriptions.planId],
    references: [billingPlans.id],
  }),
  planVersion: one(billingPlanVersions, {
    fields: [subscriptions.planVersionId],
    references: [billingPlanVersions.id],
  }),
  organization: one(organizations, {
    fields: [subscriptions.organizationId],
    references: [organizations.id],
  }),
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [invoices.organizationId],
    references: [organizations.id],
  }),
  subscription: one(subscriptions, {
    fields: [invoices.subscriptionId],
    references: [subscriptions.id],
  }),
  lines: many(invoiceLines),
  charges: many(billingCharges),
  paymentIntents: many(paymentIntents),
}));

export const invoiceLinesRelations = relations(invoiceLines, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceLines.invoiceId],
    references: [invoices.id],
  }),
}));

export const billingChargesRelations = relations(billingCharges, ({ one }) => ({
  invoice: one(invoices, {
    fields: [billingCharges.invoiceId],
    references: [invoices.id],
  }),
}));

export const billingCreditsRelations = relations(billingCredits, ({ one }) => ({
  organization: one(organizations, {
    fields: [billingCredits.organizationId],
    references: [organizations.id],
  }),
}));

export const legalFeeAgreementsRelations = relations(legalFeeAgreements, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [legalFeeAgreements.organizationId],
    references: [organizations.id],
  }),
  client: one(crmClients, {
    fields: [legalFeeAgreements.clientId],
    references: [crmClients.id],
  }),
  accruals: many(legalFeeAccruals),
}));

export const legalFeeAccrualsRelations = relations(legalFeeAccruals, ({ one }) => ({
  agreement: one(legalFeeAgreements, {
    fields: [legalFeeAccruals.agreementId],
    references: [legalFeeAgreements.id],
  }),
}));

export const costRecordsRelations = relations(costRecords, ({ one }) => ({
  organization: one(organizations, {
    fields: [costRecords.organizationId],
    references: [organizations.id],
  }),
}));

export const ledgerAccountsRelations = relations(ledgerAccounts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [ledgerAccounts.organizationId],
    references: [organizations.id],
  }),
  entries: many(ledgerEntries),
}));

export const ledgerTransactionsRelations = relations(ledgerTransactions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [ledgerTransactions.organizationId],
    references: [organizations.id],
  }),
  entries: many(ledgerEntries),
}));

export const ledgerEntriesRelations = relations(ledgerEntries, ({ one }) => ({
  transaction: one(ledgerTransactions, {
    fields: [ledgerEntries.transactionId],
    references: [ledgerTransactions.id],
  }),
  account: one(ledgerAccounts, {
    fields: [ledgerEntries.accountId],
    references: [ledgerAccounts.id],
  }),
}));

export const paymentIntentsRelations = relations(paymentIntents, ({ one, many }) => ({
  invoice: one(invoices, {
    fields: [paymentIntents.invoiceId],
    references: [invoices.id],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  intent: one(paymentIntents, {
    fields: [payments.paymentIntentId],
    references: [paymentIntents.id],
  }),
  refunds: many(refunds),
  allocations: many(paymentAllocations),
  disputes: many(paymentDisputes),
}));

export const refundsRelations = relations(refunds, ({ one }) => ({
  payment: one(payments, {
    fields: [refunds.paymentId],
    references: [payments.id],
  }),
}));

export const paymentAllocationsRelations = relations(paymentAllocations, ({ one, many }) => ({
  payment: one(payments, {
    fields: [paymentAllocations.paymentId],
    references: [payments.id],
  }),
  payouts: many(payouts),
}));

export const payoutsRelations = relations(payouts, ({ one }) => ({
  allocation: one(paymentAllocations, {
    fields: [payouts.allocationId],
    references: [paymentAllocations.id],
  }),
}));

export const paymentDisputesRelations = relations(paymentDisputes, ({ one }) => ({
  payment: one(payments, {
    fields: [paymentDisputes.paymentId],
    references: [payments.id],
  }),
}));

export const paymentWebhookEventsRelations = relations(paymentWebhookEvents, ({ one }) => ({
  paymentIntent: one(paymentIntents, {
    fields: [paymentWebhookEvents.paymentIntentId],
    references: [paymentIntents.id],
  }),
}));

export const financialReconciliationsRelations = relations(financialReconciliations, ({ one }) => ({
  organization: one(organizations, {
    fields: [financialReconciliations.organizationId],
    references: [organizations.id],
  }),
  transaction: one(ledgerTransactions, {
    fields: [financialReconciliations.ledgerTransactionId],
    references: [ledgerTransactions.id],
  }),
}));

export const platformFeeRulesRelations = relations(platformFeeRules, () => ({}));
