import { z } from "zod";

const uuid = z.string().uuid("O identificador não é válido.");
const optionalUuid = uuid.optional();
const datetime = z.string().datetime({ offset: true });
const optionalDatetime = datetime.optional();
const money = z
  .number()
  .int("Informe um valor inteiro em centavos.")
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);
const positiveMoney = money.refine((v) => v > 0, "Informe um valor positivo em centavos.");
const currency = z.string().trim().length(3).default("BRL");
const bps = z.number().int("Informe basis points como inteiro.").min(0).max(10_000);

/* ─── Enums (Prompt 21.3–21.5) ─── */

export const SPLIT_BENEFICIARY_TYPES = [
  "platform",
  "professional",
  "partner",
  "organization",
  "instructor",
  "correspondent",
  "service_provider",
  "other",
] as const;

export const SPLIT_ALLOCATION_TYPES = [
  "platform_fee",
  "professional_fee",
  "partner_share",
  "service_fee",
  "technology_fee",
  "commission",
  "withholding",
  "tax_estimate",
  "other",
] as const;

export const SPLIT_CALCULATION_TYPES = [
  "percentage",
  "fixed",
  "percentage_plus_fixed",
  "remainder",
  "custom_rule",
] as const;

export const SPLIT_RULE_STATUSES = ["draft", "active", "archived"] as const;

export const FINANCIAL_RETENTION_TYPES = [
  "tax_withholding",
  "platform_reserve",
  "chargeback_reserve",
  "compliance_hold",
  "dispute_hold",
  "other",
] as const;

export const FINANCIAL_RETENTION_SOURCES = ["manual", "estimated", "provider_confirmed"] as const;

export const FINANCIAL_RETENTION_STATUSES = [
  "pending",
  "applied",
  "released",
  "cancelled",
] as const;

export const PAYABLE_STATUSES = [
  "pending",
  "held",
  "available",
  "scheduled",
  "paid",
  "cancelled",
  "reversed",
] as const;

export const PAYOUT_FREQUENCIES = ["daily", "weekly", "biweekly", "monthly", "manual"] as const;

export const FINANCIAL_DISPUTE_TYPES = [
  "service",
  "payment",
  "chargeback",
  "fraud",
  "refund",
  "delivery",
  "other",
] as const;

export const FINANCIAL_DISPUTE_STATUSES = [
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
] as const;

export const EXTERNAL_FINANCIAL_SOURCES = [
  "payment_provider",
  "ledger",
  "bank",
  "manual_import",
  "erp",
] as const;

export const EXTERNAL_IMPORT_SOURCES = ["api", "webhook", "csv", "ofx", "cnab", "manual"] as const;

export const EXTERNAL_TX_DIRECTIONS = ["inflow", "outflow"] as const;

export const RECONCILIATION_RUN_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export const RECONCILIATION_ITEM_STATUSES = [
  "matched",
  "partial",
  "missing_left",
  "missing_right",
  "amount_mismatch",
  "date_mismatch",
  "duplicate",
  "review_required",
  "resolved",
] as const;

export const FINANCIAL_DISCREPANCY_TYPES = [
  "missing_payment",
  "missing_ledger_entry",
  "missing_bank_entry",
  "amount_mismatch",
  "duplicate",
  "unexpected_fee",
  "unexpected_refund",
  "payout_mismatch",
  "other",
] as const;

export const FINANCIAL_DISCREPANCY_SEVERITIES = ["low", "medium", "high", "critical"] as const;

export const FINANCIAL_DISCREPANCY_STATUSES = [
  "open",
  "investigating",
  "resolved",
  "dismissed",
] as const;

export const RECEIVABLE_STATUSES = [
  "open",
  "partial",
  "paid",
  "overdue",
  "disputed",
  "written_off",
  "cancelled",
] as const;

export const ACCOUNTS_PAYABLE_STATUSES = [
  "draft",
  "approved",
  "scheduled",
  "paid",
  "overdue",
  "cancelled",
  "disputed",
] as const;

export const DELINQUENCY_STAGES = [
  "reminder",
  "notice",
  "negotiation",
  "collection",
  "legal",
  "written_off",
] as const;

export const DELINQUENCY_STATUSES = [
  "open",
  "in_progress",
  "resolved",
  "written_off",
  "cancelled",
] as const;

export const FORECAST_SCENARIOS = ["pessimistic", "base", "favorable", "custom"] as const;

export const PLAN_TIERS = [
  "individual",
  "professional",
  "office",
  "business",
  "enterprise",
  "white_label",
] as const;

export const PLAN_TARGETS = [
  "user",
  "professional",
  "organization",
  "enterprise",
  "partner",
] as const;

export const USAGE_AGGREGATION_TYPES = ["sum", "max", "count", "last", "unique_count"] as const;

export const USAGE_RESET_PERIODS = [
  "none",
  "daily",
  "monthly",
  "yearly",
  "billing_period",
] as const;

export const AI_CREDIT_TX_TYPES = [
  "grant",
  "purchase",
  "consumption",
  "refund",
  "expiration",
  "adjustment",
] as const;

export const MONETIZATION_PRODUCT_TYPES = [
  "subscription",
  "one_time_service",
  "ai_credit_pack",
  "api_package",
  "license",
  "white_label_setup",
  "technology_fee",
  "other",
] as const;

export const API_CLIENT_STATUSES = ["active", "suspended", "revoked"] as const;

export const SOFTWARE_LICENSE_TYPES = [
  "subscription",
  "term",
  "perpetual",
  "enterprise",
  "white_label",
  "custom",
] as const;

export const SOFTWARE_LICENSE_STATUSES = [
  "draft",
  "active",
  "expired",
  "suspended",
  "cancelled",
] as const;

export const WHITE_LABEL_STATUSES = [
  "draft",
  "pending_domain",
  "active",
  "suspended",
  "disabled",
] as const;

/* ─── Split rules / retentions / payables / schedules ─── */

const splitRuleFieldsSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9_]+$/, "Informe uma chave em snake_case."),
  productType: z.string().trim().min(2).max(80),
  serviceType: z.string().trim().max(80).optional(),
  beneficiaryType: z.enum(SPLIT_BENEFICIARY_TYPES),
  calculationType: z.enum(SPLIT_CALCULATION_TYPES).default("percentage"),
  percentageBps: bps.nullable().optional(),
  fixedAmountCents: money.nullable().optional(),
  priority: z.number().int().min(0).max(10_000).default(100),
  validFrom: optionalDatetime,
  validTo: optionalDatetime,
  status: z.enum(SPLIT_RULE_STATUSES).default("active"),
  snapshotJson: z.record(z.string(), z.unknown()).optional(),
});

export const createSplitRuleSchema = splitRuleFieldsSchema.superRefine((value, ctx) => {
  if (
    (value.calculationType === "percentage" || value.calculationType === "percentage_plus_fixed") &&
    (value.percentageBps === undefined || value.percentageBps === null)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Informe percentageBps para cálculo percentual.",
      path: ["percentageBps"],
    });
  }
  if (
    (value.calculationType === "fixed" || value.calculationType === "percentage_plus_fixed") &&
    (value.fixedAmountCents === undefined || value.fixedAmountCents === null)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Informe fixedAmountCents para cálculo fixo.",
      path: ["fixedAmountCents"],
    });
  }
});

export const updateSplitRuleSchema = splitRuleFieldsSchema
  .partial()
  .omit({ key: true })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createFinancialRetentionSchema = z.object({
  allocationId: uuid,
  type: z.enum(FINANCIAL_RETENTION_TYPES),
  amountCents: positiveMoney,
  currency,
  source: z.enum(FINANCIAL_RETENTION_SOURCES).default("manual"),
  ruleSetId: z.string().trim().max(120).optional(),
  status: z.enum(FINANCIAL_RETENTION_STATUSES).default("pending"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateFinancialRetentionSchema = z
  .object({
    status: z.enum(FINANCIAL_RETENTION_STATUSES).optional(),
    amountCents: positiveMoney.optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createPayableSchema = z.object({
  beneficiaryType: z.string().trim().min(2).max(80),
  beneficiaryId: uuid,
  sourceAllocationId: optionalUuid,
  amountCents: positiveMoney,
  currency,
  availableAt: optionalDatetime,
  dueAt: optionalDatetime,
  status: z.enum(PAYABLE_STATUSES).default("pending"),
  holdReason: z.string().trim().max(1000).optional(),
  heldByDisputeId: optionalUuid,
});

export const updatePayableSchema = z
  .object({
    status: z.enum(PAYABLE_STATUSES).optional(),
    availableAt: optionalDatetime,
    dueAt: optionalDatetime.nullable(),
    holdReason: z.string().trim().max(1000).nullable().optional(),
    heldByDisputeId: optionalUuid.nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const holdPayableSchema = z.object({
  holdReason: z.string().trim().min(3).max(1000),
  heldByDisputeId: optionalUuid,
});

export const releasePayableSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

export const createPayoutScheduleSchema = z.object({
  beneficiaryType: z.string().trim().min(2).max(80),
  beneficiaryId: uuid,
  frequency: z.enum(PAYOUT_FREQUENCIES).default("manual"),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  minimumAmountCents: money.nullable().optional(),
  delayDays: z.number().int().min(0).max(365).default(0),
  active: z.boolean().default(true),
});

export const updatePayoutScheduleSchema = createPayoutScheduleSchema
  .partial()
  .omit({ beneficiaryType: true, beneficiaryId: true })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const allocatePaymentSchema = z.object({
  paymentId: uuid,
  productType: z.string().trim().min(2).max(80),
  serviceType: z.string().trim().max(80).optional(),
  /** When set, load that rule version; otherwise active rules for productType. */
  ruleVersion: z.number().int().min(1).optional(),
  /** Map split rule key → beneficiary UUID (required for non-platform beneficiaries). */
  beneficiaryIds: z.record(z.string(), uuid).optional(),
  retentions: z
    .array(
      z.object({
        ruleKey: z.string().trim().min(2).max(80).optional(),
        type: z.enum(FINANCIAL_RETENTION_TYPES),
        amountCents: positiveMoney,
        source: z.enum(FINANCIAL_RETENTION_SOURCES).default("manual"),
        ruleSetId: z.string().trim().max(120).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .max(50)
    .optional(),
  postLedger: z.boolean().default(false),
  availableAt: optionalDatetime,
});

export const createPayoutFromPayablesSchema = z.object({
  payableIds: z.array(uuid).min(1).max(100),
  scheduledAt: optionalDatetime,
  providerKey: z.string().trim().max(80).default("not_configured"),
  idempotencyKey: z.string().trim().min(8).max(120),
  holdReason: z.string().trim().max(1000).optional(),
});

export const processPayoutSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

export const confirmPayoutPaidSchema = z.object({
  externalPayoutId: z.string().trim().max(200).optional(),
  paidAt: optionalDatetime,
  note: z.string().trim().max(1000).optional(),
});

/* ─── Financial disputes ─── */

export const createFinancialDisputeSchema = z.object({
  paymentId: optionalUuid,
  invoiceId: optionalUuid,
  sourceType: z.string().trim().min(2).max(80),
  sourceId: optionalUuid,
  disputeType: z.enum(FINANCIAL_DISPUTE_TYPES).default("payment"),
  amountCents: positiveMoney,
  currency,
  reasonCode: z.string().trim().max(80).optional(),
  description: z.string().trim().max(4000).optional(),
  providerKey: z.string().trim().max(80).default("not_configured"),
  externalDisputeId: z.string().trim().max(200).optional(),
  holdApplied: z.boolean().default(false),
});

export const updateFinancialDisputeSchema = z
  .object({
    status: z.enum(FINANCIAL_DISPUTE_STATUSES).optional(),
    reasonCode: z.string().trim().max(80).nullable().optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    holdApplied: z.boolean().optional(),
    resolutionNote: z.string().trim().max(4000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const resolveFinancialDisputeSchema = z.object({
  status: z.enum(["won", "lost", "partially_won", "resolved", "closed"]),
  resolutionNote: z.string().trim().min(3).max(4000),
});

export const addFinancialDisputeEvidenceSchema = z.object({
  documentId: uuid,
  evidenceType: z.string().trim().min(2).max(80).default("other"),
});

/* ─── Reconciliation / treasury ─── */

export const createReconciliationRunSchema = z.object({
  sourceA: z.enum(EXTERNAL_FINANCIAL_SOURCES),
  sourceB: z.enum(EXTERNAL_FINANCIAL_SOURCES),
  periodStart: datetime,
  periodEnd: datetime,
});

export const updateReconciliationRunSchema = z
  .object({
    status: z.enum(RECONCILIATION_RUN_STATUSES).optional(),
    summary: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const resolveReconciliationItemSchema = z.object({
  status: z.enum(RECONCILIATION_ITEM_STATUSES),
  resolution: z.string().trim().min(3).max(2000),
});

export const createExternalFinancialTransactionSchema = z.object({
  sourceType: z.enum(EXTERNAL_FINANCIAL_SOURCES),
  importSource: z.enum(EXTERNAL_IMPORT_SOURCES).default("manual"),
  providerKey: z.string().trim().max(80).default("not_configured"),
  externalId: z.string().trim().min(1).max(200),
  occurredAt: datetime,
  amountCents: money,
  currency,
  direction: z.enum(EXTERNAL_TX_DIRECTIONS),
  description: z.string().trim().max(2000).optional(),
  rawReference: z.string().trim().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const createFinancialDiscrepancySchema = z.object({
  runId: optionalUuid,
  source: z.string().trim().min(2).max(80),
  type: z.enum(FINANCIAL_DISCREPANCY_TYPES),
  amountCents: money.nullable().optional(),
  currency,
  severity: z.enum(FINANCIAL_DISCREPANCY_SEVERITIES).default("medium"),
  ownerMembershipId: optionalUuid,
  description: z.string().trim().max(4000).optional(),
});

export const updateFinancialDiscrepancySchema = z
  .object({
    status: z.enum(FINANCIAL_DISCREPANCY_STATUSES).optional(),
    severity: z.enum(FINANCIAL_DISCREPANCY_SEVERITIES).optional(),
    ownerMembershipId: optionalUuid.nullable(),
    description: z.string().trim().max(4000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createReceivableSchema = z.object({
  sourceType: z.string().trim().min(2).max(80),
  sourceId: uuid,
  debtorType: z.string().trim().max(80).optional(),
  debtorId: optionalUuid,
  amountCents: positiveMoney,
  amountPaidCents: money.default(0),
  currency,
  dueAt: optionalDatetime,
  expectedAt: optionalDatetime,
  status: z.enum(RECEIVABLE_STATUSES).default("open"),
});

export const updateReceivableSchema = z
  .object({
    amountPaidCents: money.optional(),
    dueAt: optionalDatetime.nullable(),
    expectedAt: optionalDatetime.nullable(),
    status: z.enum(RECEIVABLE_STATUSES).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createAccountsPayableSchema = z.object({
  vendorName: z.string().trim().max(200).optional(),
  beneficiaryType: z.string().trim().max(80).optional(),
  beneficiaryId: optionalUuid,
  category: z.string().trim().min(2).max(80).default("other"),
  description: z.string().trim().min(2).max(2000),
  amountCents: positiveMoney,
  currency,
  dueAt: optionalDatetime,
  status: z.enum(ACCOUNTS_PAYABLE_STATUSES).default("draft"),
  documentId: optionalUuid,
  sourceType: z.string().trim().max(80).optional(),
  sourceId: optionalUuid,
});

export const updateAccountsPayableSchema = createAccountsPayableSchema
  .partial()
  .extend({
    status: z.enum(ACCOUNTS_PAYABLE_STATUSES).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const approveAccountsPayableSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

export const createDelinquencyCaseSchema = z.object({
  receivableId: uuid,
  daysOverdue: z.number().int().min(0).max(100_000).default(0),
  stage: z.enum(DELINQUENCY_STAGES).default("reminder"),
  status: z.enum(DELINQUENCY_STATUSES).default("open"),
  lastContactAt: optionalDatetime,
  nextActionAt: optionalDatetime,
  notes: z.string().trim().max(4000).optional(),
});

export const updateDelinquencyCaseSchema = createDelinquencyCaseSchema
  .partial()
  .omit({ receivableId: true })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createTreasuryForecastSchema = z.object({
  name: z.string().trim().min(2).max(160),
  scenario: z.enum(FORECAST_SCENARIOS).default("base"),
  currency,
  periodStart: datetime,
  periodEnd: datetime,
});

export const updateTreasuryForecastSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    scenario: z.enum(FORECAST_SCENARIOS).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createTreasuryForecastVersionSchema = z.object({
  openingBalanceCents: money.default(0),
  projectedInflowsCents: money.default(0),
  projectedOutflowsCents: money.default(0),
  closingBalanceCents: money.default(0),
  actualOpeningCents: money.nullable().optional(),
  actualInflowsCents: money.nullable().optional(),
  actualOutflowsCents: money.nullable().optional(),
  snapshotJson: z.record(z.string(), z.unknown()).optional(),
});

export const upsertTreasuryCashPositionSchema = z.object({
  currency,
  sourceAccountKey: z.string().trim().min(2).max(80).default("ledger_derived"),
  asOfDate: datetime,
  balanceCents: z.number().int(),
  derivedFrom: z.string().trim().min(2).max(80).default("ledger"),
});

/* ─── Monetization products / prices / usage / AI credits ─── */

export const createMonetizationProductSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9_]+$/, "Informe uma chave em snake_case."),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(4000).optional(),
  productType: z.enum(MONETIZATION_PRODUCT_TYPES),
  planTier: z.enum(PLAN_TIERS).nullable().optional(),
  planTarget: z.enum(PLAN_TARGETS).nullable().optional(),
  billingPlanId: optionalUuid,
  active: z.boolean().default(true),
  public: z.boolean().default(false),
});

export const updateMonetizationProductSchema = createMonetizationProductSchema
  .partial()
  .omit({ key: true })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createProductPriceSchema = z.object({
  productId: uuid,
  amountCents: money,
  currency,
  interval: z.string().trim().max(40).optional(),
  usageBased: z.boolean().default(false),
  validFrom: optionalDatetime,
  validTo: optionalDatetime,
  active: z.boolean().default(true),
});

export const updateProductPriceSchema = z
  .object({
    amountCents: money.optional(),
    currency: z.string().trim().length(3).optional(),
    interval: z.string().trim().max(40).nullable().optional(),
    usageBased: z.boolean().optional(),
    validFrom: optionalDatetime,
    validTo: optionalDatetime.nullable(),
    active: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createUsageMeterSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9_]+$/, "Informe uma chave em snake_case."),
  name: z.string().trim().min(2).max(160),
  unit: z.string().trim().min(1).max(40),
  aggregationType: z.enum(USAGE_AGGREGATION_TYPES).default("sum"),
  resetPeriod: z.enum(USAGE_RESET_PERIODS).default("monthly"),
  billable: z.boolean().default(true),
  active: z.boolean().default(true),
});

export const recordUsageSchema = z.object({
  meterId: uuid,
  quantity: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  occurredAt: optionalDatetime,
  sourceType: z.string().trim().min(2).max(80),
  sourceId: optionalUuid,
  userId: optionalUuid,
  idempotencyKey: z.string().trim().min(8).max(120),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const createAiCreditWalletSchema = z.object({
  organizationId: optionalUuid,
  userId: optionalUuid,
  currencyLabel: z.string().trim().min(1).max(40).default("credit"),
});

export const postAiCreditTransactionSchema = z.object({
  walletId: uuid,
  type: z.enum(AI_CREDIT_TX_TYPES),
  amountCredits: z.number().int(),
  reason: z.string().trim().max(1000).optional(),
  sourceType: z.string().trim().max(80).optional(),
  sourceId: optionalUuid,
  providerTokens: z.number().int().min(0).optional(),
  providerCostMicros: z.number().int().min(0).optional(),
  featureKey: z.string().trim().max(80).optional(),
  idempotencyKey: z.string().trim().min(8).max(120),
});

export const createTechnologyFeeRuleSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9_]+$/, "Informe uma chave em snake_case."),
  name: z.string().trim().min(2).max(160),
  appliesTo: z.string().trim().min(2).max(80),
  percentageBps: bps.nullable().optional(),
  fixedAmountCents: money.nullable().optional(),
  currency,
  active: z.boolean().default(true),
  validFrom: optionalDatetime,
  validTo: optionalDatetime,
});

export const updateTechnologyFeeRuleSchema = createTechnologyFeeRuleSchema
  .partial()
  .omit({ key: true })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

/* ─── API clients / licenses / white-label ─── */

export const createApiClientSchema = z.object({
  name: z.string().trim().min(2).max(160),
  planId: optionalUuid,
  status: z.enum(API_CLIENT_STATUSES).default("active"),
  scopeIds: z.array(uuid).max(50).optional(),
});

export const updateApiClientSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    planId: optionalUuid.nullable(),
    status: z.enum(API_CLIENT_STATUSES).optional(),
    scopeIds: z.array(uuid).max(50).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createApiCredentialSchema = z.object({
  prefix: z.string().trim().min(2).max(20).default("vj_"),
});

export const revokeApiCredentialSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
});

export const recordApiUsageSchema = z.object({
  endpointKey: z.string().trim().min(1).max(160),
  quantity: z.number().int().min(1).max(1_000_000).default(1),
  units: z.number().int().min(0).optional(),
  occurredAt: optionalDatetime,
  status: z.string().trim().max(40).default("ok"),
  idempotencyKey: z.string().trim().min(8).max(120),
});

export const createSoftwareLicenseSchema = z.object({
  product: z.string().trim().min(2).max(160),
  licenseType: z.enum(SOFTWARE_LICENSE_TYPES).default("subscription"),
  startsAt: optionalDatetime,
  endsAt: optionalDatetime,
  seats: z.number().int().min(1).max(1_000_000).nullable().optional(),
  status: z.enum(SOFTWARE_LICENSE_STATUSES).default("draft"),
  contractId: optionalUuid,
  subscriptionId: optionalUuid,
});

export const updateSoftwareLicenseSchema = createSoftwareLicenseSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const upsertWhiteLabelConfigSchema = z.object({
  enabled: z.boolean().default(false),
  brandName: z.string().trim().max(160).nullable().optional(),
  logoDocumentId: optionalUuid.nullable(),
  primaryColor: z
    .string()
    .trim()
    .max(20)
    .regex(/^#?[0-9a-fA-F]{3,8}$/, "Informe uma cor hexadecimal.")
    .nullable()
    .optional(),
  secondaryColor: z
    .string()
    .trim()
    .max(20)
    .regex(/^#?[0-9a-fA-F]{3,8}$/, "Informe uma cor hexadecimal.")
    .nullable()
    .optional(),
  customDomain: z.string().trim().max(253).nullable().optional(),
  supportBranding: z.boolean().default(true),
  status: z.enum(WHITE_LABEL_STATUSES).default("draft"),
});

/* ─── List queries ─── */

export const splitRuleListQuerySchema = z.object({
  status: z.enum(SPLIT_RULE_STATUSES).optional(),
  productType: z.string().trim().max(80).optional(),
  beneficiaryType: z.enum(SPLIT_BENEFICIARY_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const payableListQuerySchema = z.object({
  status: z.enum(PAYABLE_STATUSES).optional(),
  beneficiaryType: z.string().trim().max(80).optional(),
  beneficiaryId: optionalUuid,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const financialDisputeListQuerySchema = z.object({
  status: z.enum(FINANCIAL_DISPUTE_STATUSES).optional(),
  disputeType: z.enum(FINANCIAL_DISPUTE_TYPES).optional(),
  paymentId: optionalUuid,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const reconciliationRunListQuerySchema = z.object({
  status: z.enum(RECONCILIATION_RUN_STATUSES).optional(),
  from: optionalDatetime,
  to: optionalDatetime,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const receivableListQuerySchema = z.object({
  status: z.enum(RECEIVABLE_STATUSES).optional(),
  sourceType: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const accountsPayableListQuerySchema = z.object({
  status: z.enum(ACCOUNTS_PAYABLE_STATUSES).optional(),
  category: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const monetizationProductListQuerySchema = z.object({
  productType: z.enum(MONETIZATION_PRODUCT_TYPES).optional(),
  active: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  public: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const apiClientListQuerySchema = z.object({
  status: z.enum(API_CLIENT_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const softwareLicenseListQuerySchema = z.object({
  status: z.enum(SOFTWARE_LICENSE_STATUSES).optional(),
  licenseType: z.enum(SOFTWARE_LICENSE_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});
