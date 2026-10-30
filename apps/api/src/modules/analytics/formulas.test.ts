import { describe, expect, it } from "vitest";
import {
  computeArrV1,
  computeCacV1,
  computeLogoChurnV1,
  computeLtvV1,
  computeMrrV1,
  computeRevenueChurnV1,
  normalizeToMonthlyCents,
} from "./formulas.js";

describe("analytics formulas", () => {
  it("normalizes intervals and excludes one_time", () => {
    expect(normalizeToMonthlyCents(1200, "monthly")).toBe(1200);
    expect(normalizeToMonthlyCents(12000, "yearly")).toBe(1000);
    expect(normalizeToMonthlyCents(3000, "quarterly")).toBe(1000);
    expect(normalizeToMonthlyCents(500, "one_time")).toBeNull();
  });

  it("computes mrr.v1 from active recurring only", () => {
    const result = computeMrrV1([
      { priceCents: 10000, billingInterval: "monthly", status: "active" },
      { priceCents: 120000, billingInterval: "yearly", status: "active" },
      { priceCents: 999, billingInterval: "one_time", status: "active" },
      { priceCents: 5000, billingInterval: "monthly", status: "cancelled" },
    ]);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.value).toBe(10000 + 10000);
      expect(result.formulaVersion).toBe("mrr.v1");
    }
  });

  it("computes arr.v1 as MRR*12", () => {
    const result = computeArrV1(15000);
    expect(result).toMatchObject({ status: "ok", value: 180000, formulaVersion: "arr.v1" });
  });

  it("returns INSUFFICIENT_DATA for churn/cac/ltv without base", () => {
    expect(computeLogoChurnV1({ customersStart: 0, customersCancelled: 1 }).status).toBe(
      "INSUFFICIENT_DATA",
    );
    expect(computeRevenueChurnV1({ mrrStartCents: 0, mrrLostCents: 100 }).status).toBe(
      "INSUFFICIENT_DATA",
    );
    expect(computeCacV1({ acquisitionCostCents: null, newCustomers: 3 }).status).toBe(
      "INSUFFICIENT_DATA",
    );
    expect(computeLtvV1({ avgMonthlyRevenueCents: null, avgLifetimeMonths: 12 }).status).toBe(
      "INSUFFICIENT_DATA",
    );
  });
});
