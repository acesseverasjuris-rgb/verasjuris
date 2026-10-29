import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure } from "./ai";
import { aiErrorMessage, formatDateTime, hasPermission, isApiFailure } from "./ai";
import { formatMoneyCents } from "./auctions";
import { getActiveMembership, getActiveOrgId } from "./crm";

export {
  getActiveMembership,
  getActiveOrgId,
  isApiFailure,
  aiErrorMessage,
  formatDateTime,
  formatMoneyCents,
};

export type BillingPlan = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  billingInterval: string;
  priceCents: number;
  currency: string;
  active: boolean;
  public: boolean;
  version: number;
  currentVersionId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BillingSubscription = {
  id: string;
  organizationId: string;
  planId: string;
  planVersionId?: string | null;
  status: string;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BillingInvoice = {
  id: string;
  organizationId: string;
  userId?: string | null;
  clientId?: string | null;
  subscriptionId?: string | null;
  invoiceNumber?: string | null;
  currency: string;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  amountDueCents: number;
  status: string;
  issuedAt?: string | null;
  dueAt?: string | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BillingCredit = {
  id: string;
  organizationId: string;
  userId?: string | null;
  amountCents: number;
  remainingCents: number;
  currency: string;
  status: string;
  reason?: string | null;
  expiresAt?: string | null;
  createdAt: string;
};

export type LegalFeeAgreement = {
  id: string;
  organizationId: string;
  legalMatterId?: string | null;
  clientId?: string | null;
  feeType: string;
  status: string;
  fixedAmountCents?: number | null;
  hourlyRateCents?: number | null;
  currency: string;
  notes?: string | null;
  createdAt: string | Date;
};

export type CostRecord = {
  id: string;
  organizationId: string;
  category: string;
  amountCents: number;
  currency: string;
  description?: string | null;
  incurredAt?: string | Date | null;
  createdAt: string | Date;
};

export type PlatformFeeRule = {
  id: string;
  key: string;
  name: string;
  feeBase: string;
  percentageBps?: number | null;
  fixedAmountCents?: number | null;
  active: boolean;
};

export type LedgerAccount = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  type: string;
  currency: string;
  parentAccountId?: string | null;
  active: boolean;
  systemAccount?: boolean;
};

export type LedgerEntry = {
  id: string;
  accountId: string;
  direction: "debit" | "credit" | string;
  amountCents: number;
  currency: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

export type LedgerTransaction = {
  id: string;
  organizationId: string;
  transactionType: string;
  referenceType?: string | null;
  referenceId?: string | null;
  currency: string;
  occurredAt: string;
  status: string;
  idempotencyKey: string;
  description?: string | null;
  reason?: string | null;
  reversalOfTransactionId?: string | null;
  createdByMembershipId?: string | null;
  createdAt: string;
  postedAt?: string | null;
  entries: LedgerEntry[];
};

export type PaymentIntent = {
  id: string;
  organizationId?: string | null;
  payerType: string;
  payerId: string;
  invoiceId?: string | null;
  referenceType: string;
  referenceId: string;
  amountCents: number;
  currency: string;
  paymentMethod: string;
  status: string;
  providerKey?: string | null;
  externalIntentId?: string | null;
  idempotencyKey: string;
  expiresAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type PlatformPayment = {
  id: string;
  organizationId?: string | null;
  paymentIntentId?: string | null;
  amountCents: number;
  currency: string;
  status: string;
  paymentMethod?: string | null;
  isManual?: boolean;
  confirmedAt?: string | null;
  createdAt: string;
};

export type ProviderHealth = {
  status: string;
  detail?: string;
  checkedAt?: string;
};

export type FinanceDashboard = {
  invoices: {
    open: { status: string; count: number; totalDueCents: number; totalPaidCents: number };
    past_due: { status: string; count: number; totalDueCents: number; totalPaidCents: number };
    paid: { status: string; count: number; totalDueCents: number; totalPaidCents: number };
    all: Array<{ status: string; count: number; totalDueCents: number; totalPaidCents: number }>;
  };
  accountsReceivable: {
    currency: string;
    openInvoiceCount: number;
    openCents: number;
    pastDueCents: number;
    partiallyPaidCents: number;
    items: Array<{
      invoiceId: string;
      invoiceNumber?: string | null;
      status: string;
      currency: string;
      totalCents: number;
      amountPaidCents: number;
      amountDueCents: number;
      dueAt?: string | null;
    }>;
  };
  costs: { totalCents: number };
  credits: { availableCents: number };
  ledger: { cashClearingBalanceCents: number; currency: string };
  providerStatus: ProviderHealth;
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  open: "Em aberto",
  partially_paid: "Parcialmente paga",
  paid: "Paga",
  past_due: "Vencida",
  void: "Anulada",
  uncollectible: "Incobrável",
  refunded: "Reembolsada",
};

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  incomplete: "Incompleta",
  trialing: "Em trial",
  active: "Ativa",
  past_due: "Em atraso",
  suspended: "Suspensa",
  cancelled: "Cancelada",
  expired: "Expirada",
  not_configured: "Não configurada",
};

export const PAYMENT_INTENT_STATUS_LABELS: Record<string, string> = {
  created: "Criada",
  requires_action: "Ação necessária",
  processing: "Processando",
  authorized: "Autorizada",
  confirmed: "Confirmada",
  failed: "Falhou",
  cancelled: "Cancelada",
  expired: "Expirada",
  not_configured: "Provedor não configurado",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  authorized: "Autorizado",
  confirmed: "Confirmado",
  failed: "Falhou",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  partially_refunded: "Parcialmente reembolsado",
  chargeback: "Chargeback",
  disputed: "Em disputa",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  boleto: "Boleto",
  bank_transfer: "Transferência",
  wallet: "Carteira",
  manual: "Manual",
  other: "Outro",
};

export const LEDGER_TX_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  posted: "Postado",
  reversed: "Estornado",
};

export const LEDGER_TX_TYPE_LABELS: Record<string, string> = {
  payment_received: "Pagamento recebido",
  payment_failed: "Pagamento falhou",
  refund: "Reembolso",
  invoice_recognition: "Reconhecimento de fatura",
  credit_applied: "Crédito aplicado",
  fee_accrual: "Accrual de honorário",
  platform_fee: "Taxa da plataforma",
  payout: "Repasse",
  chargeback: "Chargeback",
  manual_journal: "Lançamento manual",
  reversal: "Estorno",
  cost: "Custo",
  other: "Outro",
};

export const BILLING_INTERVAL_LABELS: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  yearly: "Anual",
  one_time: "Avulso",
  custom: "Personalizado",
};

export const CREDIT_STATUS_LABELS: Record<string, string> = {
  available: "Disponível",
  applied: "Aplicado",
  expired: "Expirado",
  void: "Anulado",
};

export const LEGAL_FEE_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativo",
  completed: "Concluído",
  cancelled: "Cancelado",
  suspended: "Suspenso",
};

export const COST_CATEGORY_LABELS: Record<string, string> = {
  infrastructure: "Infraestrutura",
  ai: "IA",
  provider: "Provedor",
  registry: "Cartório",
  court: "Tribunal",
  travel: "Deslocamento",
  marketing: "Marketing",
  personnel: "Pessoal",
  refund: "Reembolso",
  processing_fee: "Taxa de processamento",
  other: "Outro",
};

export type FinanceAction =
  | "read"
  | "plan.manage"
  | "subscription.manage"
  | "invoice.create"
  | "invoice.update"
  | "credit.manage"
  | "fee.manage"
  | "cost.manage"
  | "ledger.read"
  | "ledger.post"
  | "ledger.reverse"
  | "ledger.export"
  | "payment.read"
  | "payment.record_manual"
  | "refund"
  | "refund.read"
  | "refund.request"
  | "refund.approve"
  | "reconcile"
  | "split.read"
  | "split.manage"
  | "payout.read"
  | "payout.schedule"
  | "payout.hold"
  | "payout.release"
  | "dispute.read"
  | "dispute.manage"
  | "dispute.resolve"
  | "reconciliation.read"
  | "reconciliation.manage"
  | "treasury.read"
  | "accounts_payable.manage"
  | "accounts_receivable.manage"
  | "forecast.manage";

export type MonetizationAction =
  | "read"
  | "plan.manage"
  | "product.manage"
  | "pricing.manage"
  | "api.manage"
  | "license.manage"
  | "white_label.manage";

const PERM: Record<FinanceAction, string> = {
  read: "finance.read",
  "plan.manage": "finance.plan.manage",
  "subscription.manage": "finance.subscription.manage",
  "invoice.create": "finance.invoice.create",
  "invoice.update": "finance.invoice.update",
  "credit.manage": "finance.credit.manage",
  "fee.manage": "finance.fee.manage",
  "cost.manage": "finance.cost.manage",
  "ledger.read": "finance.ledger.read",
  "ledger.post": "finance.ledger.post",
  "ledger.reverse": "finance.ledger.reverse",
  "ledger.export": "finance.ledger.export",
  "payment.read": "finance.payment.read",
  "payment.record_manual": "finance.payment.record_manual",
  refund: "finance.refund",
  "refund.read": "finance.refund.read",
  "refund.request": "finance.refund.request",
  "refund.approve": "finance.refund.approve",
  reconcile: "finance.reconcile",
  "split.read": "finance.split.read",
  "split.manage": "finance.split.manage",
  "payout.read": "finance.payout.read",
  "payout.schedule": "finance.payout.schedule",
  "payout.hold": "finance.payout.hold",
  "payout.release": "finance.payout.release",
  "dispute.read": "finance.dispute.read",
  "dispute.manage": "finance.dispute.manage",
  "dispute.resolve": "finance.dispute.resolve",
  "reconciliation.read": "finance.reconciliation.read",
  "reconciliation.manage": "finance.reconciliation.manage",
  "treasury.read": "finance.treasury.read",
  "accounts_payable.manage": "finance.accounts_payable.manage",
  "accounts_receivable.manage": "finance.accounts_receivable.manage",
  "forecast.manage": "finance.forecast.manage",
};

const MONETIZATION_PERM: Record<MonetizationAction, string> = {
  read: "monetization.read",
  "plan.manage": "monetization.plan.manage",
  "product.manage": "monetization.product.manage",
  "pricing.manage": "monetization.pricing.manage",
  "api.manage": "monetization.api.manage",
  "license.manage": "monetization.license.manage",
  "white_label.manage": "monetization.white_label.manage",
};

export function hasFinancePermission(permissions: string[], action: FinanceAction): boolean {
  return hasPermission(permissions, PERM[action]);
}

export function hasMonetizationPermission(
  permissions: string[],
  action: MonetizationAction,
): boolean {
  return hasPermission(permissions, MONETIZATION_PERM[action]);
}

export function canAccessFinanceNav(permissions: string[]): boolean {
  return (
    hasFinancePermission(permissions, "read") ||
    hasFinancePermission(permissions, "payment.read") ||
    hasFinancePermission(permissions, "ledger.read") ||
    hasFinancePermission(permissions, "split.read") ||
    hasFinancePermission(permissions, "payout.read") ||
    hasFinancePermission(permissions, "dispute.read") ||
    hasFinancePermission(permissions, "reconciliation.read") ||
    hasFinancePermission(permissions, "treasury.read") ||
    hasFinancePermission(permissions, "refund.read")
  );
}

export function canAccessMonetizationNav(permissions: string[]): boolean {
  return hasMonetizationPermission(permissions, "read");
}

async function request<T>(path: string, init?: RequestInit): Promise<T | AiApiFailure> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        [CSRF_HEADER]: "1",
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    return {
      error: {
        code: "NETWORK_ERROR",
        message: "Não foi possível falar com o serviço VerasJuris. Nenhuma alteração foi feita.",
      },
    };
  }
  const body = (await response.json().catch(() => ({}))) as T & AiApiFailure;
  if (!response.ok) {
    return {
      httpStatus: response.status,
      error: {
        code: body.error?.code ?? (response.status === 404 ? "NOT_FOUND" : "INTERNAL_ERROR"),
        message: body.error?.message ?? "Falha na requisição.",
        details: body.error?.details,
      },
    };
  }
  return body;
}

function orgPath(orgId: string, suffix: string): string {
  return `/api/v1/organizations/${orgId}${suffix}`;
}

function qs(query: Record<string, string | number | boolean | undefined | null>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function financeErrorMessage(failure: AiApiFailure): string {
  return aiErrorMessage(failure, "Falha no financeiro.");
}

export function isProviderUnavailable(status: string | null | undefined | ProviderHealth): boolean {
  if (!status) return false;
  if (typeof status === "string") return status === "not_configured" || status === "NOT_CONFIGURED";
  return status.status === "not_configured" || status.status === "NOT_CONFIGURED";
}

/* ─── Billing ─── */

export async function fetchBillingDashboard(orgId: string) {
  return request<FinanceDashboard>(orgPath(orgId, "/billing/dashboard"));
}

export async function fetchBillingPlans(orgId: string) {
  return request<{ items: BillingPlan[] }>(orgPath(orgId, "/billing/plans"));
}

export async function fetchBillingSubscriptions(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: BillingSubscription[] }>(
    orgPath(orgId, `/billing/subscriptions${qs(query)}`),
  );
}

export async function fetchBillingInvoices(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: BillingInvoice[]; total?: number }>(
    orgPath(orgId, `/billing/invoices${qs(query)}`),
  );
}

export async function fetchBillingCredits(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: BillingCredit[]; total?: number }>(
    orgPath(orgId, `/billing/credits${qs(query)}`),
  );
}

export async function fetchHonorarios(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: LegalFeeAgreement[]; total?: number }>(
    orgPath(orgId, `/billing/honorarios${qs(query)}`),
  );
}

export async function fetchCosts(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: CostRecord[]; total?: number }>(
    orgPath(orgId, `/billing/costs${qs(query)}`),
  );
}

export async function fetchPlatformFeeRules(orgId: string) {
  return request<{ items: PlatformFeeRule[] }>(orgPath(orgId, "/billing/platform-fee-rules"));
}

/* ─── Ledger ─── */

export async function fetchLedgerAccounts(
  orgId: string,
  query: Record<string, string | number | boolean | undefined> = {},
) {
  return request<{ items: LedgerAccount[]; total?: number }>(
    orgPath(orgId, `/finance/ledger/accounts${qs(query)}`),
  );
}

export async function fetchLedgerTransactions(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: LedgerTransaction[]; total?: number }>(
    orgPath(orgId, `/finance/ledger/transactions${qs(query)}`),
  );
}

export type LedgerBalanceRow = {
  accountId: string;
  code?: string;
  name?: string;
  systemKey?: string | null;
  balanceCents: number;
  currency: string;
};

export async function fetchLedgerBalances(
  orgId: string,
  query: Record<string, string | undefined> = {},
) {
  return request<{
    balances?: LedgerBalanceRow[];
    accounts?: LedgerBalanceRow[];
    currency?: string;
    asOf?: string | null;
  }>(orgPath(orgId, `/finance/ledger/balances${qs(query)}`));
}

/* ─── Payments ─── */

export async function fetchPaymentProviderStatus(orgId?: string) {
  const path = orgId
    ? orgPath(orgId, "/payments/provider-status")
    : "/api/v1/payments/provider-status";
  return request<{ provider: ProviderHealth }>(path);
}

export async function fetchPaymentIntents(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: PaymentIntent[]; total?: number }>(
    orgPath(orgId, `/payments/intents${qs(query)}`),
  );
}

export async function fetchPaymentIntent(intentId: string, orgId?: string) {
  const path = orgId
    ? orgPath(orgId, `/payments/intents/${intentId}`)
    : `/api/v1/payments/intents/${intentId}`;
  return request<{ paymentIntent: PaymentIntent }>(path);
}

export async function fetchPayments(
  orgId: string,
  query: Record<string, string | number | boolean | undefined> = {},
) {
  return request<{ items: PlatformPayment[]; total?: number }>(
    orgPath(orgId, `/payments${qs(query)}`),
  );
}

export async function fetchPayment(paymentId: string, orgId?: string) {
  const path = orgId ? orgPath(orgId, `/payments/${paymentId}`) : `/api/v1/payments/${paymentId}`;
  return request<{ payment: PlatformPayment }>(path);
}

export async function createCheckout(body: Record<string, unknown>, orgId?: string) {
  const path = orgId ? orgPath(orgId, "/payments/checkout") : "/api/v1/payments/checkout";
  return request<{
    paymentIntent: PaymentIntent;
    checkout: { status: string; checkoutUrl?: string | null } | null;
    providerStatus: ProviderHealth;
    unavailable: boolean;
    message?: string | null;
    alreadyExists?: boolean;
  }>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/* ─── Prompt 21 types ─── */

export type SplitRule = {
  id: string;
  organizationId?: string | null;
  key: string;
  name?: string | null;
  productType: string;
  serviceType?: string | null;
  beneficiaryType: string;
  calculationType: string;
  percentageBps?: number | null;
  fixedAmountCents?: number | null;
  priority: number;
  status: string;
  version: number;
  validFrom?: string | null;
  validTo?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentAllocation = {
  id: string;
  organizationId: string;
  paymentId: string;
  beneficiaryType: string;
  beneficiaryId: string;
  allocationType: string;
  grossAmountCents: number;
  grossCents?: number;
  feeAmountCents: number;
  feeCents?: number;
  retentionAmountCents: number;
  netAmountCents: number;
  netCents?: number;
  currency: string;
  status: string;
  ruleVersionId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FinancePayable = {
  id: string;
  organizationId: string;
  beneficiaryType: string;
  beneficiaryId: string;
  sourceAllocationId?: string | null;
  amountCents: number;
  currency: string;
  availableAt?: string | null;
  dueAt?: string | null;
  status: string;
  holdReason?: string | null;
  heldByDisputeId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PayoutSchedule = {
  id: string;
  organizationId: string;
  beneficiaryType: string;
  beneficiaryId: string;
  frequency: string;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  minimumAmountCents?: number | null;
  delayDays?: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Payout = {
  id: string;
  organizationId: string;
  beneficiaryType: string;
  beneficiaryId: string;
  amountCents: number;
  currency: string;
  status: string;
  providerKey?: string | null;
  externalPayoutId?: string | null;
  allocationId?: string | null;
  payableId?: string | null;
  scheduledAt?: string | null;
  initiatedAt?: string | null;
  paidAt?: string | null;
  failedAt?: string | null;
  failureCode?: string | null;
  holdReason?: string | null;
  ledgerTransactionId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlatformRefund = {
  id: string;
  paymentId: string;
  organizationId?: string | null;
  invoiceId?: string | null;
  amountCents: number;
  currency: string;
  refundType: string;
  reasonCode?: string | null;
  status: string;
  providerKey?: string | null;
  reason?: string | null;
  creditId?: string | null;
  ledgerTransactionId?: string | null;
  requestedAt?: string | null;
  confirmedAt?: string | null;
  failedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FinancialDispute = {
  id: string;
  organizationId: string;
  paymentId?: string | null;
  invoiceId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  disputeType: string;
  amountCents: number;
  currency: string;
  reasonCode?: string | null;
  description?: string | null;
  status: string;
  providerKey?: string | null;
  holdApplied: boolean;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DisputeEvidence = {
  id: string;
  documentId: string;
  evidenceType?: string | null;
  submittedByUserId?: string | null;
  submittedAt: string;
};

export type DisputeHistoryEntry = {
  id: string;
  fromStatus?: string | null;
  toStatus: string;
  note?: string | null;
  actorUserId?: string | null;
  createdAt: string;
};

export type ReconciliationRun = {
  id: string;
  organizationId: string;
  sourceA: string;
  sourceB: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  startedAt?: string | null;
  completedAt?: string | null;
  summary?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type ReconciliationItem = {
  id: string;
  runId: string;
  sourceAType?: string | null;
  sourceAId?: string | null;
  sourceBType?: string | null;
  sourceBId?: string | null;
  amountDifferenceCents?: number | null;
  dateDifferenceHours?: number | null;
  status: string;
  confidence?: number | null;
  resolution?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
};

export type FinancialDiscrepancy = {
  id: string;
  organizationId: string;
  runId?: string | null;
  source?: string | null;
  type: string;
  amountCents: number;
  currency: string;
  status: string;
  severity: string;
  description?: string | null;
  openedAt: string;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExternalFinancialTx = {
  id: string;
  organizationId: string;
  sourceType: string;
  importSource?: string | null;
  providerKey?: string | null;
  externalId: string;
  occurredAt: string;
  amountCents: number;
  currency: string;
  direction: string;
  description?: string | null;
  status: string;
  importedAt: string;
};

export type CashPosition = {
  kind: "cash_position";
  isForecast: false;
  isActual: true;
  derivedFrom: string;
  notBankBalance: boolean;
  currency: string;
  asOf: string;
  balanceCents: number;
  accountId?: string | null;
  sourceAccountKey?: string;
};

export type TreasuryReceivable = {
  id: string;
  organizationId?: string;
  sourceType: string;
  sourceId: string;
  debtorType?: string | null;
  debtorId?: string | null;
  amountCents: number;
  amountPaidCents?: number;
  amountDueCents: number;
  currency: string;
  dueAt?: string | null;
  expectedAt?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type TreasuryAccountsPayable = {
  id: string;
  organizationId: string;
  vendorName?: string | null;
  beneficiaryType?: string | null;
  beneficiaryId?: string | null;
  category?: string | null;
  amountCents: number;
  currency: string;
  dueAt?: string | null;
  status: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DelinquencyCase = {
  id: string;
  organizationId: string;
  receivableId?: string | null;
  daysOverdue?: number | null;
  stage: string;
  status: string;
  notes?: string | null;
  lastContactAt?: string | null;
  nextActionAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TreasuryForecast = {
  id: string;
  organizationId: string;
  name: string;
  currency: string;
  scenario: string;
  periodStart: string;
  periodEnd: string;
  currentVersionId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MonetizationProduct = {
  id: string;
  organizationId?: string | null;
  key: string;
  name: string;
  description?: string | null;
  productType: string;
  planTier?: string | null;
  planTarget?: string | null;
  billingPlanId?: string | null;
  active: boolean;
  public: boolean;
  prices?: MonetizationPrice[];
  features?: unknown;
  featureSource?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type MonetizationPrice = {
  id: string;
  productId: string;
  amountCents: number;
  currency: string;
  interval?: string | null;
  usageBased?: boolean;
  active: boolean;
  version?: number;
};

export type MonetizationDashboard = {
  mrrCents: number;
  arrRunRateCents: number;
  arrKind: string;
  activeSubscriptions: number;
  churn: {
    logo: { rateBps?: number; cancelledCount?: number; baseCount?: number; status?: string };
    revenue: { status: string };
  };
  aiCredits: {
    balanceCredits: number;
    salesCredits: number;
    usageCredits: number;
    note: string;
  };
  apiUsageTotal: number;
  formulas: { mrr: string; arr: string };
};

export type AiCreditWallet = {
  id: string;
  organizationId: string;
  userId?: string | null;
  balanceCredits: number;
  currencyLabel?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiClient = {
  id: string;
  organizationId: string;
  name: string;
  status: string;
  planId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SoftwareLicense = {
  id: string;
  organizationId: string;
  product: string;
  licenseType: string;
  startsAt: string;
  endsAt?: string | null;
  seats?: number | null;
  status: string;
  contractId?: string | null;
  subscriptionId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WhiteLabelConfig = {
  id: string;
  organizationId: string;
  enabled: boolean;
  brandName?: string | null;
  logoDocumentId?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  customDomain?: string | null;
  customDomainVerified?: boolean | null;
  supportBranding?: boolean | null;
  status: string;
  brandingOnly?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TechnologyFeeRule = {
  id: string;
  key?: string;
  name?: string;
  active?: boolean;
  percentageBps?: number | null;
  fixedAmountCents?: number | null;
};

export const PAYOUT_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  scheduled: "Agendado",
  processing: "Processando",
  paid: "Pago",
  failed: "Falhou",
  cancelled: "Cancelado",
  held: "Retido",
  not_configured: "Provedor não configurado",
};

export const PAYABLE_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  held: "Retido",
  available: "Disponível",
  scheduled: "Agendado",
  paid: "Pago",
  cancelled: "Cancelado",
  reversed: "Estornado",
};

export const ALLOCATION_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  reserved: "Reservado",
  released: "Liberado",
  paid_out: "Repassado",
  cancelled: "Cancelado",
  not_configured: "Não configurado",
};

export const REFUND_STATUS_LABELS: Record<string, string> = {
  requested: "Solicitado",
  processing: "Processando",
  confirmed: "Confirmado",
  failed: "Falhou",
  cancelled: "Cancelado",
  not_configured: "Provedor não configurado",
};

export const REFUND_TYPE_LABELS: Record<string, string> = {
  full: "Integral (caixa)",
  partial: "Parcial (caixa)",
  credit: "Crédito comercial (≠ caixa)",
};

export const DISPUTE_STATUS_LABELS: Record<string, string> = {
  open: "Aberta",
  under_review: "Em análise",
  waiting_customer: "Aguardando cliente",
  waiting_provider: "Aguardando provedor",
  evidence_required: "Evidência necessária",
  submitted: "Submetida",
  won: "Ganha",
  lost: "Perdida",
  partially_won: "Parcialmente ganha",
  resolved: "Resolvida",
  closed: "Fechada",
  not_configured: "Provedor não configurado",
};

export const DISPUTE_TYPE_LABELS: Record<string, string> = {
  service: "Serviço",
  payment: "Pagamento",
  chargeback: "Chargeback",
  fraud: "Fraude",
  refund: "Reembolso",
  delivery: "Entrega",
  other: "Outro",
};

export const BENEFICIARY_TYPE_LABELS: Record<string, string> = {
  platform: "Plataforma",
  professional: "Profissional",
  partner: "Parceiro",
  organization: "Organização",
  instructor: "Instrutor",
  correspondent: "Correspondente",
  service_provider: "Prestador",
  other: "Outro",
};

export const ALLOCATION_TYPE_LABELS: Record<string, string> = {
  platform_fee: "Taxa da plataforma",
  professional_fee: "Honorário profissional",
  partner_share: "Cota do parceiro",
  service_fee: "Taxa de serviço",
  technology_fee: "Taxa de tecnologia",
  commission: "Comissão",
  withholding: "Retenção",
  tax_estimate: "Estimativa tributária",
  other: "Outro",
};

export const RECONCILIATION_RUN_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  running: "Em execução",
  completed: "Concluída",
  failed: "Falhou",
  cancelled: "Cancelada",
};

export const RECONCILIATION_ITEM_STATUS_LABELS: Record<string, string> = {
  matched: "Conciliado",
  partial: "Parcial",
  missing_left: "Ausente (fonte A)",
  missing_right: "Ausente (fonte B)",
  amount_mismatch: "Valor divergente",
  date_mismatch: "Data divergente",
  duplicate: "Duplicado",
  review_required: "Revisão necessária",
  resolved: "Resolvido",
};

export const DISCREPANCY_STATUS_LABELS: Record<string, string> = {
  open: "Aberta",
  investigating: "Em investigação",
  resolved: "Resolvida",
  dismissed: "Dispensada",
};

export const DISCREPANCY_SEVERITY_LABELS: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

export const EXTERNAL_SOURCE_LABELS: Record<string, string> = {
  payment_provider: "Gateway",
  ledger: "Ledger",
  bank: "Banco",
  manual_import: "Importação manual",
  erp: "ERP",
};

export const RECEIVABLE_STATUS_LABELS: Record<string, string> = {
  open: "Em aberto",
  partial: "Parcial",
  paid: "Pago",
  overdue: "Vencido",
  disputed: "Em disputa",
  written_off: "Baixado",
  cancelled: "Cancelado",
};

export const AP_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  approved: "Aprovado",
  scheduled: "Agendado",
  paid: "Pago",
  overdue: "Vencido",
  cancelled: "Cancelado",
  disputed: "Em disputa",
};

export const DELINQUENCY_STAGE_LABELS: Record<string, string> = {
  reminder: "Lembrete",
  notice: "Notificação",
  negotiation: "Negociação",
  collection: "Cobrança",
  legal: "Jurídico",
  written_off: "Baixado",
};

export const DELINQUENCY_STATUS_LABELS: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em andamento",
  resolved: "Resolvido",
  written_off: "Baixado",
  cancelled: "Cancelado",
};

export const FORECAST_SCENARIO_LABELS: Record<string, string> = {
  pessimistic: "Pessimista",
  base: "Base",
  favorable: "Favorável",
  custom: "Personalizado",
};

export const PAYOUT_FREQUENCY_LABELS: Record<string, string> = {
  daily: "Diário",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
  manual: "Manual",
};

export const PRODUCT_TYPE_LABELS: Record<string, string> = {
  subscription: "Assinatura",
  one_time_service: "Serviço avulso",
  ai_credit_pack: "Pacote de créditos de IA",
  api_package: "Pacote de API",
  license: "Licença",
  white_label_setup: "White-label",
  technology_fee: "Taxa de tecnologia",
  other: "Outro",
};

export const LICENSE_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativa",
  expired: "Expirada",
  suspended: "Suspensa",
  cancelled: "Cancelada",
};

export const WHITE_LABEL_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  pending_domain: "Domínio pendente",
  active: "Ativo",
  suspended: "Suspenso",
  disabled: "Desativado",
};

export const API_CLIENT_STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  suspended: "Suspenso",
  revoked: "Revogado",
};

/** Display payout status without implying PAID when provider is not configured. */
export function displayPayoutStatus(
  status: string,
  provider?: ProviderHealth | string | null,
): string {
  if (isProviderUnavailable(provider) && status === "paid") return "not_configured";
  return status;
}

export function splitWaterfallFromAllocations(allocations: PaymentAllocation[]): {
  brutoCents: number;
  plataformaCents: number;
  parceiroCents: number;
  retencoesCents: number;
  liquidoCents: number;
  currency: string;
} {
  const currency = allocations[0]?.currency ?? "BRL";
  let brutoCents = 0;
  let plataformaCents = 0;
  let parceiroCents = 0;
  let retencoesCents = 0;
  let liquidoCents = 0;
  for (const a of allocations) {
    const gross = a.grossAmountCents ?? a.grossCents ?? 0;
    const fee = a.feeAmountCents ?? a.feeCents ?? 0;
    const retention = a.retentionAmountCents ?? 0;
    const net = a.netAmountCents ?? a.netCents ?? 0;
    brutoCents += gross;
    retencoesCents += retention;
    liquidoCents += net;
    if (a.beneficiaryType === "platform" || a.allocationType === "platform_fee") {
      plataformaCents += net + fee;
    } else if (a.beneficiaryType === "partner" || a.allocationType === "partner_share") {
      parceiroCents += net;
    }
  }
  return { brutoCents, plataformaCents, parceiroCents, retencoesCents, liquidoCents, currency };
}

/* ─── Split / payouts / refunds / disputes ─── */

export async function fetchSplitRules(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: SplitRule[]; total?: number }>(
    orgPath(orgId, `/finance/split-rules${qs(query)}`),
  );
}

export async function fetchAllocations(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: PaymentAllocation[]; total?: number }>(
    orgPath(orgId, `/finance/allocations${qs(query)}`),
  );
}

export async function fetchFinancePayables(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: FinancePayable[]; total?: number }>(
    orgPath(orgId, `/finance/payables${qs(query)}`),
  );
}

export async function fetchPayoutSchedules(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: PayoutSchedule[]; total?: number }>(
    orgPath(orgId, `/finance/payout-schedules${qs(query)}`),
  );
}

export async function fetchPayoutProviderStatus(orgId: string) {
  return request<{ provider: ProviderHealth }>(orgPath(orgId, "/finance/payouts/provider-status"));
}

export async function fetchPayouts(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: Payout[]; total?: number }>(
    orgPath(orgId, `/finance/payouts${qs(query)}`),
  );
}

export async function fetchRefunds(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: PlatformRefund[]; total?: number }>(
    orgPath(orgId, `/finance/refunds${qs(query)}`),
  );
}

export async function fetchDisputeProviderStatus(orgId: string) {
  return request<{ provider: ProviderHealth }>(orgPath(orgId, "/finance/disputes/provider-status"));
}

export async function fetchDisputes(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: FinancialDispute[]; total?: number }>(
    orgPath(orgId, `/finance/disputes${qs(query)}`),
  );
}

export async function fetchDispute(orgId: string, disputeId: string) {
  return request<{
    dispute: FinancialDispute;
    evidence: DisputeEvidence[];
    history: DisputeHistoryEntry[];
  }>(orgPath(orgId, `/finance/disputes/${disputeId}`));
}

/* ─── Reconciliation ─── */

export async function fetchReconciliationRuns(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: ReconciliationRun[]; total?: number }>(
    orgPath(orgId, `/finance/reconciliation/runs${qs(query)}`),
  );
}

export async function fetchReconciliationRun(orgId: string, runId: string) {
  return request<{ run: ReconciliationRun; items: ReconciliationItem[] }>(
    orgPath(orgId, `/finance/reconciliation/runs/${runId}`),
  );
}

export async function fetchReconciliationItems(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: ReconciliationItem[]; total?: number }>(
    orgPath(orgId, `/finance/reconciliation/items${qs(query)}`),
  );
}

export async function fetchReconciliationImports(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: ExternalFinancialTx[]; total?: number }>(
    orgPath(orgId, `/finance/reconciliation/imports${qs(query)}`),
  );
}

export async function fetchDiscrepancies(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: FinancialDiscrepancy[]; total?: number }>(
    orgPath(orgId, `/finance/reconciliation/discrepancies${qs(query)}`),
  );
}

/* ─── Treasury ─── */

export async function fetchCashPosition(
  orgId: string,
  query: Record<string, string | undefined> = {},
) {
  return request<CashPosition>(orgPath(orgId, `/finance/treasury/cash${qs(query)}`));
}

export async function fetchTreasuryReceivables(
  orgId: string,
  query: Record<string, string | number | boolean | undefined> = {},
) {
  return request<{ items: TreasuryReceivable[]; total?: number }>(
    orgPath(orgId, `/finance/treasury/receivables${qs(query)}`),
  );
}

export async function fetchTreasuryPayables(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: TreasuryAccountsPayable[]; total?: number }>(
    orgPath(orgId, `/finance/treasury/payables${qs(query)}`),
  );
}

export async function fetchDelinquency(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: DelinquencyCase[]; total?: number }>(
    orgPath(orgId, `/finance/treasury/delinquency${qs(query)}`),
  );
}

export async function fetchTreasuryForecasts(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: TreasuryForecast[]; total?: number }>(
    orgPath(orgId, `/finance/treasury/forecast${qs(query)}`),
  );
}

export async function fetchTreasuryForecast(orgId: string, forecastId: string) {
  return request<{
    forecast: TreasuryForecast;
    projected: {
      openingBalanceCents: number;
      inflowsCents: number;
      outflowsCents: number;
      closingBalanceCents: number;
    } | null;
    actual: {
      openingBalanceCents?: number | null;
      inflowsCents?: number | null;
      outflowsCents?: number | null;
      closingBalanceCents?: number | null;
    } | null;
    isForecast: boolean;
    isActual: boolean;
  }>(orgPath(orgId, `/finance/treasury/forecast/${forecastId}`));
}

/* ─── Monetization ─── */

export async function fetchPublicPlans(query: Record<string, string | number | undefined> = {}) {
  return request<{
    items: MonetizationProduct[];
    total?: number;
  }>(`/api/v1/planos${qs(query)}`);
}

export async function fetchMonetizationDashboard(orgId: string) {
  return request<MonetizationDashboard>(orgPath(orgId, "/monetization/dashboard"));
}

export async function fetchMonetizationProducts(
  orgId: string,
  query: Record<string, string | number | boolean | undefined> = {},
) {
  return request<{ items: MonetizationProduct[]; total?: number }>(
    orgPath(orgId, `/monetization/products${qs(query)}`),
  );
}

export async function fetchMonetizationPlans(orgId: string) {
  return request<{ items: MonetizationProduct[]; total?: number }>(
    orgPath(orgId, "/monetization/plans"),
  );
}

export async function fetchAiCreditsWallet(orgId: string) {
  return request<{ wallet: AiCreditWallet } | AiCreditWallet>(
    orgPath(orgId, "/monetization/ai-credits"),
  );
}

export async function fetchTechnologyFeeRules(orgId: string) {
  return request<{ items: TechnologyFeeRule[] } | TechnologyFeeRule[]>(
    orgPath(orgId, "/monetization/technology-fees"),
  );
}

export async function fetchApiClients(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: ApiClient[]; total?: number }>(
    orgPath(orgId, `/monetization/api-clients${qs(query)}`),
  );
}

export async function fetchSoftwareLicenses(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: SoftwareLicense[]; total?: number }>(
    orgPath(orgId, `/monetization/licenses${qs(query)}`),
  );
}

export async function fetchWhiteLabel(orgId: string) {
  return request<{ config: WhiteLabelConfig | null } | WhiteLabelConfig | null>(
    orgPath(orgId, "/monetization/white-label"),
  );
}
