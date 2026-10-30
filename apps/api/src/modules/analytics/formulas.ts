/**
 * Versioned metric formulas. Never invent numbers — return INSUFFICIENT_DATA when inputs missing.
 */

export type MetricComputeOk = {
  status: "ok";
  value: number;
  formulaVersion: string;
  metadata?: Record<string, unknown>;
};

export type MetricComputeInsufficient = {
  status: "INSUFFICIENT_DATA";
  formulaVersion: string;
  reason: string;
};

export type MetricComputeResult = MetricComputeOk | MetricComputeInsufficient;

/** Normalize plan price to monthly cents. Excludes one_time. */
export function normalizeToMonthlyCents(
  priceCents: number,
  billingInterval: string,
): number | null {
  if (billingInterval === "one_time") return null;
  if (billingInterval === "monthly") return priceCents;
  if (billingInterval === "yearly" || billingInterval === "annual") {
    return Math.floor(priceCents / 12);
  }
  if (billingInterval === "quarterly") return Math.floor(priceCents / 3);
  if (billingInterval === "weekly") return priceCents * 4;
  return priceCents;
}

/** mrr.v1 — sum of monthly-normalized recurring subscription prices. */
export function computeMrrV1(
  subscriptions: ReadonlyArray<{ priceCents: number; billingInterval: string; status: string }>,
): MetricComputeResult {
  const active = subscriptions.filter((s) => s.status === "active" || s.status === "trialing");
  let total = 0;
  let counted = 0;
  for (const sub of active) {
    const monthly = normalizeToMonthlyCents(sub.priceCents, sub.billingInterval);
    if (monthly === null) continue;
    total += monthly;
    counted += 1;
  }
  return {
    status: "ok",
    value: total,
    formulaVersion: "mrr.v1",
    metadata: { subscriptionCount: counted },
  };
}

/** arr.v1 — MRR * 12 run-rate. */
export function computeArrV1(mrrCents: number): MetricComputeResult {
  return {
    status: "ok",
    value: mrrCents * 12,
    formulaVersion: "arr.v1",
    metadata: { mrrCents, runRate: true },
  };
}

/** logo_churn.v1 */
export function computeLogoChurnV1(input: {
  customersStart: number;
  customersCancelled: number;
}): MetricComputeResult {
  if (input.customersStart <= 0) {
    return {
      status: "INSUFFICIENT_DATA",
      formulaVersion: "logo_churn.v1",
      reason: "Sem base de clientes no início do período.",
    };
  }
  return {
    status: "ok",
    value: input.customersCancelled / input.customersStart,
    formulaVersion: "logo_churn.v1",
    metadata: input,
  };
}

/** revenue_churn.v1 */
export function computeRevenueChurnV1(input: {
  mrrStartCents: number;
  mrrLostCents: number;
}): MetricComputeResult {
  if (input.mrrStartCents <= 0) {
    return {
      status: "INSUFFICIENT_DATA",
      formulaVersion: "revenue_churn.v1",
      reason: "Sem MRR no início do período.",
    };
  }
  return {
    status: "ok",
    value: input.mrrLostCents / input.mrrStartCents,
    formulaVersion: "revenue_churn.v1",
    metadata: input,
  };
}

/** cac.v1 — never invent acquisition cost. */
export function computeCacV1(input: {
  acquisitionCostCents: number | null;
  newCustomers: number | null;
}): MetricComputeResult {
  if (
    input.acquisitionCostCents === null ||
    input.newCustomers === null ||
    input.newCustomers <= 0 ||
    input.acquisitionCostCents < 0
  ) {
    return {
      status: "INSUFFICIENT_DATA",
      formulaVersion: "cac.v1",
      reason: "Custo de aquisição ou novos clientes insuficientes.",
    };
  }
  return {
    status: "ok",
    value: Math.floor(input.acquisitionCostCents / input.newCustomers),
    formulaVersion: "cac.v1",
    metadata: input,
  };
}

/** ltv.v1 — never invent customer lifetime. */
export function computeLtvV1(input: {
  avgMonthlyRevenueCents: number | null;
  avgLifetimeMonths: number | null;
}): MetricComputeResult {
  if (
    input.avgMonthlyRevenueCents === null ||
    input.avgLifetimeMonths === null ||
    input.avgMonthlyRevenueCents <= 0 ||
    input.avgLifetimeMonths <= 0
  ) {
    return {
      status: "INSUFFICIENT_DATA",
      formulaVersion: "ltv.v1",
      reason: "Dados de receita média ou lifetime insuficientes.",
    };
  }
  return {
    status: "ok",
    value: Math.floor(input.avgMonthlyRevenueCents * input.avgLifetimeMonths),
    formulaVersion: "ltv.v1",
    metadata: input,
  };
}
