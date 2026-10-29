import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type FinancePermission = Extract<
  PermissionKey,
  | "finance.read"
  | "finance.plan.manage"
  | "finance.subscription.manage"
  | "finance.invoice.create"
  | "finance.invoice.update"
  | "finance.credit.manage"
  | "finance.fee.manage"
  | "finance.cost.manage"
  | "finance.ledger.read"
  | "finance.ledger.post"
  | "finance.ledger.reverse"
  | "finance.ledger.export"
  | "finance.payment.read"
  | "finance.payment.record_manual"
  | "finance.refund"
  | "finance.refund.read"
  | "finance.refund.request"
  | "finance.refund.approve"
  | "finance.refund.cancel"
  | "finance.reconcile"
  | "finance.split.read"
  | "finance.split.manage"
  | "finance.payout.read"
  | "finance.payout.schedule"
  | "finance.payout.hold"
  | "finance.payout.release"
  | "finance.dispute.read"
  | "finance.dispute.manage"
  | "finance.dispute.resolve"
  | "finance.reconciliation.read"
  | "finance.reconciliation.manage"
  | "finance.treasury.read"
  | "finance.accounts_payable.manage"
  | "finance.accounts_receivable.manage"
  | "finance.forecast.manage"
>;

type MonetizationPermission = Extract<
  PermissionKey,
  | "monetization.read"
  | "monetization.plan.manage"
  | "monetization.product.manage"
  | "monetization.pricing.manage"
  | "monetization.api.manage"
  | "monetization.license.manage"
  | "monetization.white_label.manage"
>;

export function policyFinanceRead(
  membership: AccessMembership,
  required: Extract<
    FinancePermission,
    "finance.read" | "finance.payment.read" | "finance.ledger.read"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyFinanceManage(
  membership: AccessMembership,
  required: Extract<
    FinancePermission,
    | "finance.plan.manage"
    | "finance.subscription.manage"
    | "finance.credit.manage"
    | "finance.fee.manage"
    | "finance.cost.manage"
    | "finance.reconcile"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyInvoice(
  membership: AccessMembership,
  required: Extract<
    FinancePermission,
    "finance.read" | "finance.invoice.create" | "finance.invoice.update"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyPaymentIntent(
  membership: AccessMembership,
  required: Extract<
    FinancePermission,
    "finance.read" | "finance.payment.read" | "finance.payment.record_manual"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyPayment(
  membership: AccessMembership,
  required: Extract<FinancePermission, "finance.payment.read" | "finance.payment.record_manual">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyRefund(
  membership: AccessMembership,
  required: Extract<
    FinancePermission,
    | "finance.payment.read"
    | "finance.refund"
    | "finance.refund.read"
    | "finance.refund.request"
    | "finance.refund.approve"
    | "finance.refund.cancel"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyLedgerAccount(
  membership: AccessMembership,
  required: Extract<
    FinancePermission,
    "finance.ledger.read" | "finance.ledger.post" | "finance.ledger.export"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyLedgerTransaction(
  membership: AccessMembership,
  required: Extract<
    FinancePermission,
    | "finance.ledger.read"
    | "finance.ledger.post"
    | "finance.ledger.reverse"
    | "finance.ledger.export"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyPaymentAllocation(
  membership: AccessMembership,
  required: Extract<
    FinancePermission,
    "finance.split.read" | "finance.split.manage" | "finance.payout.read"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyPayable(
  membership: AccessMembership,
  required: Extract<
    FinancePermission,
    | "finance.payout.read"
    | "finance.payout.schedule"
    | "finance.payout.hold"
    | "finance.payout.release"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyPayout(
  membership: AccessMembership,
  required: Extract<
    FinancePermission,
    | "finance.payout.read"
    | "finance.payout.schedule"
    | "finance.payout.hold"
    | "finance.payout.release"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyFinancialDispute(
  membership: AccessMembership,
  required: Extract<
    FinancePermission,
    "finance.dispute.read" | "finance.dispute.manage" | "finance.dispute.resolve"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyReconciliation(
  membership: AccessMembership,
  required: Extract<
    FinancePermission,
    "finance.reconciliation.read" | "finance.reconciliation.manage" | "finance.reconcile"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyTreasury(
  membership: AccessMembership,
  required: Extract<
    FinancePermission,
    | "finance.treasury.read"
    | "finance.accounts_payable.manage"
    | "finance.accounts_receivable.manage"
    | "finance.forecast.manage"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyApiClient(
  membership: AccessMembership,
  required: Extract<MonetizationPermission, "monetization.read" | "monetization.api.manage">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyLicense(
  membership: AccessMembership,
  required: Extract<MonetizationPermission, "monetization.read" | "monetization.license.manage">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyWhiteLabel(
  membership: AccessMembership,
  required: Extract<
    MonetizationPermission,
    "monetization.read" | "monetization.white_label.manage"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyMonetization(
  membership: AccessMembership,
  required: Extract<
    MonetizationPermission,
    | "monetization.read"
    | "monetization.plan.manage"
    | "monetization.product.manage"
    | "monetization.pricing.manage"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
