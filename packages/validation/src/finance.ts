import { z } from "zod";

const uuid = z.string().uuid("O identificador não é válido.");
const optionalUuid = uuid.optional();
const datetime = z.string().datetime({ offset: true });
const optionalDatetime = datetime.optional();
const cents = z
  .number()
  .int("Informe um valor inteiro em centavos.")
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);
const positiveCents = cents.refine((v) => v > 0, "Informe um valor positivo em centavos.");
const currency = z.string().trim().length(3).default("BRL");
const bps = z.number().int("Informe basis points como inteiro.").min(0).max(10_000);

export const BILLING_INTERVALS = ["monthly", "quarterly", "yearly", "one_time", "custom"] as const;

export const SUBSCRIPTION_STATUSES = [
  "incomplete",
  "trialing",
  "active",
  "past_due",
  "suspended",
  "cancelled",
  "expired",
  "not_configured",
] as const;

export const INVOICE_STATUSES = [
  "draft",
  "open",
  "partially_paid",
  "paid",
  "past_due",
  "void",
  "uncollectible",
  "refunded",
] as const;

export const BILLABLE_ITEM_TYPES = [
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
] as const;

export const BILLING_CREDIT_STATUSES = ["available", "applied", "expired", "void"] as const;

export const LEGAL_FEE_TYPES = [
  "fixed",
  "hourly",
  "percentage",
  "success",
  "mixed",
  "installment",
  "other",
] as const;

export const LEGAL_FEE_AGREEMENT_STATUSES = [
  "draft",
  "active",
  "completed",
  "cancelled",
  "suspended",
] as const;

export const LEGAL_FEE_ACCRUAL_STATUSES = ["accrued", "invoiced", "waived", "cancelled"] as const;

export const PLATFORM_FEE_BASES = [
  "marketplace",
  "online_consultation",
  "diligence",
  "extrajudicial",
  "education",
  "subscription",
  "other",
] as const;

export const COST_CATEGORIES = [
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
] as const;

export const ENTITLEMENT_LIMIT_TYPES = [
  "boolean",
  "count",
  "amount_cents",
  "unlimited",
  "storage",
  "rate",
  "credit",
  "currency",
] as const;

export const LEDGER_ACCOUNT_TYPES = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
  "clearing",
] as const;

export const LEDGER_TRANSACTION_STATUSES = ["draft", "posted", "reversed"] as const;

export const LEDGER_ENTRY_DIRECTIONS = ["debit", "credit"] as const;

export const LEDGER_TRANSACTION_TYPES = [
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
] as const;

export const RECONCILIATION_STATUSES = [
  "unmatched",
  "matched",
  "partial",
  "review_required",
  "resolved",
  "not_configured",
] as const;

export const PAYMENT_INTENT_STATUSES = [
  "created",
  "requires_action",
  "processing",
  "authorized",
  "confirmed",
  "failed",
  "cancelled",
  "expired",
  "not_configured",
] as const;

export const PLATFORM_PAYMENT_STATUSES = [
  "pending",
  "authorized",
  "confirmed",
  "failed",
  "cancelled",
  "refunded",
  "partially_refunded",
  "chargeback",
  "disputed",
] as const;

export const PAYMENT_METHODS = [
  "pix",
  "credit_card",
  "debit_card",
  "boleto",
  "bank_transfer",
  "wallet",
  "manual",
  "other",
] as const;

export const REFUND_STATUSES = [
  "requested",
  "processing",
  "confirmed",
  "failed",
  "cancelled",
  "not_configured",
] as const;

export const REFUND_TYPES = ["full", "partial", "credit"] as const;

export const PAYMENT_ALLOCATION_STATUSES = [
  "pending",
  "reserved",
  "released",
  "paid_out",
  "cancelled",
  "not_configured",
] as const;

export const PAYOUT_STATUSES = [
  "pending",
  "scheduled",
  "processing",
  "paid",
  "failed",
  "cancelled",
  "held",
  "not_configured",
] as const;

export const PAYMENT_DISPUTE_TYPES = ["chargeback", "payment_dispute", "fraud_review"] as const;

export const PAYMENT_DISPUTE_STATUSES = [
  "open",
  "under_review",
  "won",
  "lost",
  "cancelled",
  "not_configured",
] as const;

export const createBillingPlanSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9_]+$/, "Informe uma chave em snake_case."),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(4000).optional(),
  billingInterval: z.enum(BILLING_INTERVALS).default("monthly"),
  priceCents: cents.default(0),
  currency,
  active: z.boolean().default(true),
  public: z.boolean().default(false),
});

export const updateBillingPlanSchema = createBillingPlanSchema
  .partial()
  .omit({ key: true })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createBillingPlanFeatureSchema = z.object({
  featureKey: z.string().trim().min(2).max(80),
  limitType: z.enum(ENTITLEMENT_LIMIT_TYPES).default("boolean"),
  limitValue: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  planVersionId: optionalUuid,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const createSubscriptionSchema = z.object({
  organizationId: optionalUuid,
  userId: optionalUuid,
  planId: uuid,
  planVersionId: uuid,
  status: z.enum(["incomplete", "trialing", "active"]).default("incomplete"),
  billingCycleAnchor: optionalDatetime,
  currentPeriodStart: optionalDatetime,
  currentPeriodEnd: optionalDatetime,
  trialEndsAt: optionalDatetime,
  providerKey: z.string().trim().max(80).default("not_configured"),
  externalSubscriptionId: z.string().trim().max(200).optional(),
});

export const updateSubscriptionSchema = z
  .object({
    status: z.enum(SUBSCRIPTION_STATUSES).optional(),
    cancelAtPeriodEnd: z.boolean().optional(),
    cancelledAt: optionalDatetime.nullable(),
    currentPeriodStart: optionalDatetime,
    currentPeriodEnd: optionalDatetime,
    trialEndsAt: optionalDatetime.nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

const invoiceLineSchema = z.object({
  type: z.enum(BILLABLE_ITEM_TYPES).default("other"),
  description: z.string().trim().min(1).max(500),
  quantity: z.number().int().min(1).max(1_000_000).default(1),
  unitAmountCents: cents,
  totalAmountCents: cents,
  referenceType: z.string().trim().max(80).optional(),
  referenceId: optionalUuid,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const createInvoiceSchema = z.object({
  organizationId: optionalUuid,
  userId: optionalUuid,
  clientId: optionalUuid,
  subscriptionId: optionalUuid,
  invoiceNumber: z.string().trim().min(1).max(80).optional(),
  currency,
  subtotalCents: cents.default(0),
  discountCents: cents.default(0),
  taxCents: cents.default(0),
  estimatedTaxCents: cents.nullable().optional(),
  taxSource: z.string().trim().max(80).optional(),
  totalCents: cents.default(0),
  amountDueCents: cents.default(0),
  status: z.enum(["draft", "open"]).default("draft"),
  issuedAt: optionalDatetime,
  dueAt: optionalDatetime,
  externalReference: z.string().trim().max(200).optional(),
  periodKey: z.string().trim().max(40).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  lines: z.array(invoiceLineSchema).max(200).optional(),
});

export const updateInvoiceSchema = z
  .object({
    status: z.enum(INVOICE_STATUSES).optional(),
    discountCents: cents.optional(),
    taxCents: cents.optional(),
    estimatedTaxCents: cents.nullable().optional(),
    taxSource: z.string().trim().max(80).nullable().optional(),
    totalCents: cents.optional(),
    amountPaidCents: cents.optional(),
    amountDueCents: cents.optional(),
    issuedAt: optionalDatetime.nullable(),
    dueAt: optionalDatetime.nullable(),
    paidAt: optionalDatetime.nullable(),
    externalReference: z.string().trim().max(200).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const addInvoiceLineSchema = invoiceLineSchema;

export const createBillingCreditSchema = z.object({
  organizationId: optionalUuid,
  userId: optionalUuid,
  amountCents: positiveCents,
  currency,
  reason: z.string().trim().min(3).max(500),
  source: z.string().trim().max(80).default("manual"),
  expiresAt: optionalDatetime,
});

export const updateBillingCreditSchema = z
  .object({
    status: z.enum(BILLING_CREDIT_STATUSES).optional(),
    remainingCents: cents.optional(),
    appliedInvoiceId: optionalUuid,
    expiresAt: optionalDatetime.nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createLegalFeeAgreementSchema = z.object({
  clientId: optionalUuid,
  legalMatterId: optionalUuid,
  contractId: optionalUuid,
  feeType: z.enum(LEGAL_FEE_TYPES).default("fixed"),
  fixedAmountCents: cents.nullable().optional(),
  hourlyRateCents: cents.nullable().optional(),
  percentageBps: bps.nullable().optional(),
  successFeeBps: bps.nullable().optional(),
  currency,
  installmentConfig: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["draft", "active"]).default("draft"),
  notes: z.string().trim().max(4000).optional(),
});

export const updateLegalFeeAgreementSchema = createLegalFeeAgreementSchema
  .partial()
  .extend({
    status: z.enum(LEGAL_FEE_AGREEMENT_STATUSES).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createLegalFeeAccrualSchema = z.object({
  agreementId: uuid,
  amountCents: positiveCents,
  currency,
  description: z.string().trim().max(1000).optional(),
  status: z.enum(LEGAL_FEE_ACCRUAL_STATUSES).default("accrued"),
  accruedAt: optionalDatetime,
  invoiceId: optionalUuid,
});

export const createPlatformFeeRuleSchema = z.object({
  key: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(160),
  feeBase: z.enum(PLATFORM_FEE_BASES),
  percentageBps: bps.nullable().optional(),
  fixedAmountCents: cents.nullable().optional(),
  currency,
  active: z.boolean().default(true),
  effectiveFrom: optionalDatetime,
  effectiveTo: optionalDatetime,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updatePlatformFeeRuleSchema = createPlatformFeeRuleSchema
  .partial()
  .omit({ key: true })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createCostRecordSchema = z.object({
  category: z.enum(COST_CATEGORIES).default("other"),
  description: z.string().trim().min(2).max(1000),
  amountCents: positiveCents,
  currency,
  incurredAt: optionalDatetime,
  legalMatterId: optionalUuid,
  serviceReferenceType: z.string().trim().max(80).optional(),
  serviceReferenceId: optionalUuid,
  documentId: optionalUuid,
  source: z.string().trim().max(80).default("manual"),
});

export const updateCostRecordSchema = createCostRecordSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createLedgerAccountSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(2).max(160),
  type: z.enum(LEDGER_ACCOUNT_TYPES),
  currency,
  parentAccountId: optionalUuid,
  active: z.boolean().default(true),
  systemAccount: z.boolean().default(false),
  systemKey: z.string().trim().max(80).optional(),
});

export const updateLedgerAccountSchema = createLedgerAccountSchema
  .partial()
  .omit({ code: true })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

const ledgerEntryInputSchema = z.object({
  accountId: uuid,
  direction: z.enum(LEDGER_ENTRY_DIRECTIONS),
  amountCents: positiveCents,
  currency: z.string().trim().length(3).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const createLedgerTransactionSchema = z
  .object({
    transactionType: z.enum(LEDGER_TRANSACTION_TYPES),
    referenceType: z.string().trim().max(80).optional(),
    referenceId: optionalUuid,
    currency,
    occurredAt: optionalDatetime,
    idempotencyKey: z.string().trim().min(8).max(120),
    description: z.string().trim().max(1000).optional(),
    reason: z.string().trim().max(1000).optional(),
    entries: z.array(ledgerEntryInputSchema).min(2).max(100),
  })
  .superRefine((value, ctx) => {
    let debit = 0;
    let credit = 0;
    for (const entry of value.entries) {
      if (entry.direction === "debit") debit += entry.amountCents;
      else credit += entry.amountCents;
    }
    if (debit !== credit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Lançamentos devem equilibrar débitos e créditos (centavos).",
        path: ["entries"],
      });
    }
  });

export const postLedgerTransactionSchema = z.object({});

export const reverseLedgerTransactionSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
  idempotencyKey: z.string().trim().min(8).max(120),
});

export const createPaymentIntentSchema = z.object({
  payerType: z.string().trim().min(2).max(40),
  payerId: uuid,
  invoiceId: optionalUuid,
  referenceType: z.string().trim().min(2).max(80),
  referenceId: uuid,
  amountCents: positiveCents,
  currency,
  paymentMethod: z.enum(PAYMENT_METHODS).default("other"),
  providerKey: z.string().trim().max(80).default("not_configured"),
  idempotencyKey: z.string().trim().min(8).max(120),
  expiresAt: optionalDatetime,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updatePaymentIntentSchema = z
  .object({
    status: z.enum(PAYMENT_INTENT_STATUSES).optional(),
    externalIntentId: z.string().trim().max(200).optional(),
    expiresAt: optionalDatetime.nullable(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const recordManualPaymentSchema = z.object({
  paymentIntentId: uuid,
  amountCents: positiveCents,
  currency,
  evidenceDocumentId: uuid,
  externalPaymentId: z.string().trim().max(200).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const createRefundSchema = z
  .object({
    paymentId: uuid,
    refundType: z.enum(REFUND_TYPES).default("partial"),
    amountCents: positiveCents.optional(),
    currency,
    reason: z.string().trim().min(3).max(1000).optional(),
    reasonCode: z.string().trim().max(80).optional(),
    invoiceId: optionalUuid,
    providerKey: z.string().trim().max(80).default("not_configured"),
    idempotencyKey: z.string().trim().min(8).max(120).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.refundType === "partial" &&
      (value.amountCents === undefined || value.amountCents <= 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe amountCents positivo para reembolso parcial.",
        path: ["amountCents"],
      });
    }
    if (
      value.refundType === "credit" &&
      (value.amountCents === undefined || value.amountCents <= 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe amountCents positivo para reembolso em crédito.",
        path: ["amountCents"],
      });
    }
  });

export const updateRefundSchema = z
  .object({
    status: z.enum(REFUND_STATUSES).optional(),
    externalRefundId: z.string().trim().max(200).optional(),
    confirmedAt: optionalDatetime,
    reason: z.string().trim().min(3).max(1000).optional(),
    reasonCode: z.string().trim().max(80).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const approveRefundSchema = z.object({
  note: z.string().trim().max(1000).optional(),
  externalRefundId: z.string().trim().max(200).optional(),
});

export const cancelRefundSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
});

export const createPaymentAllocationSchema = z.object({
  paymentId: uuid,
  beneficiaryType: z.string().trim().min(2).max(80),
  beneficiaryId: uuid,
  allocationType: z.string().trim().min(2).max(80).default("other"),
  grossAmountCents: cents.optional(),
  grossCents: cents,
  feeAmountCents: cents.optional(),
  feeCents: cents.default(0),
  retentionAmountCents: cents.default(0),
  netAmountCents: cents.optional(),
  netCents: cents,
  currency,
  status: z.enum(PAYMENT_ALLOCATION_STATUSES).default("pending"),
  ruleVersionId: optionalUuid,
  ruleSnapshotJson: z.record(z.string(), z.unknown()).optional(),
});

export const updatePaymentAllocationSchema = z
  .object({
    status: z.enum(PAYMENT_ALLOCATION_STATUSES).optional(),
    feeCents: cents.optional(),
    feeAmountCents: cents.optional(),
    retentionAmountCents: cents.optional(),
    netCents: cents.optional(),
    netAmountCents: cents.optional(),
    ruleSnapshotJson: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createPayoutSchema = z.object({
  beneficiaryType: z.string().trim().min(2).max(80),
  beneficiaryId: uuid,
  amountCents: positiveCents,
  currency,
  allocationId: optionalUuid,
  payableId: optionalUuid,
  scheduledAt: optionalDatetime,
  providerKey: z.string().trim().max(80).default("not_configured"),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
  holdReason: z.string().trim().max(1000).optional(),
});

export const updatePayoutSchema = z
  .object({
    status: z.enum(PAYOUT_STATUSES).optional(),
    scheduledAt: optionalDatetime.nullable(),
    holdReason: z.string().trim().max(1000).nullable().optional(),
    externalPayoutId: z.string().trim().max(200).optional(),
    failureCode: z.string().trim().max(80).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const holdPayoutSchema = z.object({
  holdReason: z.string().trim().min(3).max(1000),
});

export const releasePayoutSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

export const createPaymentDisputeSchema = z.object({
  paymentId: uuid,
  disputeType: z.enum(PAYMENT_DISPUTE_TYPES).default("chargeback"),
  amountCents: cents.nullable().optional(),
  currency,
  reason: z.string().trim().max(2000).optional(),
  providerKey: z.string().trim().max(80).default("not_configured"),
  externalDisputeId: z.string().trim().max(200).optional(),
});

export const updatePaymentDisputeSchema = z
  .object({
    status: z.enum(PAYMENT_DISPUTE_STATUSES).optional(),
    reason: z.string().trim().max(2000).nullable().optional(),
    resolvedAt: optionalDatetime.nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const refundListQuerySchema = z.object({
  status: z.enum(REFUND_STATUSES).optional(),
  refundType: z.enum(REFUND_TYPES).optional(),
  paymentId: optionalUuid,
  organizationId: optionalUuid,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const payoutListQuerySchema = z.object({
  status: z.enum(PAYOUT_STATUSES).optional(),
  beneficiaryType: z.string().trim().max(80).optional(),
  beneficiaryId: optionalUuid,
  organizationId: optionalUuid,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const paymentAllocationListQuerySchema = z.object({
  status: z.enum(PAYMENT_ALLOCATION_STATUSES).optional(),
  paymentId: optionalUuid,
  beneficiaryType: z.string().trim().max(80).optional(),
  beneficiaryId: optionalUuid,
  organizationId: optionalUuid,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createReconciliationSchema = z.object({
  providerKey: z.string().trim().max(80).default("not_configured"),
  externalReference: z.string().trim().max(200).optional(),
  ledgerTransactionId: optionalUuid,
  amountCents: cents.nullable().optional(),
  currency,
  status: z.enum(RECONCILIATION_STATUSES).default("unmatched"),
  notes: z.string().trim().max(2000).optional(),
});

export const updateReconciliationSchema = z
  .object({
    status: z.enum(RECONCILIATION_STATUSES).optional(),
    ledgerTransactionId: optionalUuid,
    notes: z.string().trim().max(2000).nullable().optional(),
    matchedAt: optionalDatetime.nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const invoiceListQuerySchema = z.object({
  status: z.enum(INVOICE_STATUSES).optional(),
  organizationId: optionalUuid,
  clientId: optionalUuid,
  subscriptionId: optionalUuid,
  from: optionalDatetime,
  to: optionalDatetime,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const subscriptionListQuerySchema = z.object({
  status: z.enum(SUBSCRIPTION_STATUSES).optional(),
  planId: optionalUuid,
  organizationId: optionalUuid,
  userId: optionalUuid,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const paymentListQuerySchema = z.object({
  status: z.enum(PLATFORM_PAYMENT_STATUSES).optional(),
  paymentIntentId: optionalUuid,
  organizationId: optionalUuid,
  isManual: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const paymentIntentListQuerySchema = z.object({
  status: z.enum(PAYMENT_INTENT_STATUSES).optional(),
  invoiceId: optionalUuid,
  organizationId: optionalUuid,
  referenceType: z.string().trim().max(80).optional(),
  referenceId: optionalUuid,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const ledgerTransactionListQuerySchema = z.object({
  status: z.enum(LEDGER_TRANSACTION_STATUSES).optional(),
  transactionType: z.enum(LEDGER_TRANSACTION_TYPES).optional(),
  organizationId: optionalUuid,
  referenceType: z.string().trim().max(80).optional(),
  referenceId: optionalUuid,
  from: optionalDatetime,
  to: optionalDatetime,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const costRecordListQuerySchema = z.object({
  category: z.enum(COST_CATEGORIES).optional(),
  organizationId: optionalUuid,
  legalMatterId: optionalUuid,
  from: optionalDatetime,
  to: optionalDatetime,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const ledgerExportQuerySchema = z.object({
  organizationId: optionalUuid,
  accountId: optionalUuid,
  from: datetime,
  to: datetime,
  format: z.enum(["json", "csv"]).default("json"),
});

export const createBillingPlanVersionSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(4000).optional(),
  billingInterval: z.enum(BILLING_INTERVALS).optional(),
  priceCents: cents.optional(),
  currency: z.string().trim().length(3).optional(),
  effectiveFrom: optionalDatetime,
  effectiveTo: optionalDatetime,
  snapshotJson: z.record(z.string(), z.unknown()).optional(),
});

export const createCheckoutSchema = z.object({
  organizationId: optionalUuid,
  payerType: z.string().trim().min(2).max(40),
  payerId: uuid,
  invoiceId: optionalUuid,
  referenceType: z.string().trim().min(2).max(80),
  referenceId: uuid,
  amountCents: positiveCents,
  currency,
  paymentMethod: z.enum(PAYMENT_METHODS).default("other"),
  description: z.string().trim().max(500).optional(),
  successUrl: z.string().url().max(2000),
  cancelUrl: z.string().url().max(2000),
  idempotencyKey: z.string().trim().min(8).max(120),
  expiresAt: optionalDatetime,
  createInvoiceIfMissing: z.boolean().default(false),
  invoiceLines: z.array(invoiceLineSchema).max(50).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const ledgerBalanceQuerySchema = z.object({
  accountId: optionalUuid,
  currency: z.string().trim().length(3).optional(),
  asOf: optionalDatetime,
});

export const ledgerAccountListQuerySchema = z.object({
  type: z.enum(LEDGER_ACCOUNT_TYPES).optional(),
  active: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  systemAccount: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const creditListQuerySchema = z.object({
  status: z.enum(BILLING_CREDIT_STATUSES).optional(),
  userId: optionalUuid,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const legalFeeAgreementListQuerySchema = z.object({
  status: z.enum(LEGAL_FEE_AGREEMENT_STATUSES).optional(),
  clientId: optionalUuid,
  legalMatterId: optionalUuid,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const reconciliationListQuerySchema = z.object({
  status: z.enum(RECONCILIATION_STATUSES).optional(),
  providerKey: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const cancelSubscriptionSchema = z.object({
  atPeriodEnd: z.boolean().default(true),
  cancelledAt: optionalDatetime,
});
