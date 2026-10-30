import type { AnalyticsWarehouseProvider, BIProvider } from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import { policyAnalytics, type SessionAccount } from "@verasjuris/auth";
import {
  administrativeProcesses,
  analyticsMetricSnapshots,
  billingPlanVersions,
  costRecords,
  deadlines,
  invoices,
  judicialProcesses,
  legalMatters,
  subscriptions,
  tasks,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, count, eq, gte, lte, sql } from "drizzle-orm";
import { authorize } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import {
  computeArrV1,
  computeCacV1,
  computeLogoChurnV1,
  computeLtvV1,
  computeMrrV1,
  computeRevenueChurnV1,
  type MetricComputeResult,
} from "./formulas.js";
import {
  defaultMetricRegistry,
  type MetricDefinition,
  type MetricRegistry,
} from "./metric-registry.js";

export type AnalyticsModuleDeps = {
  biProvider?: BIProvider;
  warehouseProvider?: AnalyticsWarehouseProvider;
  registry?: MetricRegistry;
};

function dimensionsKey(dimensions: Record<string, unknown> | undefined): string {
  if (!dimensions || Object.keys(dimensions).length === 0) return "";
  return JSON.stringify(
    Object.keys(dimensions)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = dimensions[key];
        return acc;
      }, {}),
  );
}

export class AnalyticsService {
  constructor(
    private readonly db: AppDatabase,
    private readonly registry: MetricRegistry = defaultMetricRegistry,
  ) {}

  async computeMetric(
    organizationId: string,
    metricKey: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<MetricComputeResult & { metricKey: string }> {
    const def = this.registry.get(metricKey);
    if (!def) {
      throw new AppError("NOT_FOUND", "Não encontramos esta métrica no catálogo.");
    }

    let result: MetricComputeResult;
    switch (metricKey) {
      case "mrr":
        result = await this.computeMrr(organizationId);
        break;
      case "arr": {
        const mrr = await this.computeMrr(organizationId);
        result =
          mrr.status === "ok"
            ? computeArrV1(mrr.value)
            : {
                status: "INSUFFICIENT_DATA",
                formulaVersion: "arr.v1",
                reason: "MRR indisponível.",
              };
        break;
      }
      case "revenue":
        result = await this.computeRevenue(organizationId, periodStart, periodEnd);
        break;
      case "logo_churn":
        result = await this.computeLogoChurn(organizationId, periodStart, periodEnd);
        break;
      case "revenue_churn":
        result = computeRevenueChurnV1({ mrrStartCents: 0, mrrLostCents: 0 });
        break;
      case "cac":
        result = computeCacV1({ acquisitionCostCents: null, newCustomers: null });
        break;
      case "ltv":
        result = computeLtvV1({ avgMonthlyRevenueCents: null, avgLifetimeMonths: null });
        break;
      case "costs":
        result = await this.computeCosts(organizationId, periodStart, periodEnd);
        break;
      case "finance": {
        const rev = await this.computeRevenue(organizationId, periodStart, periodEnd);
        const costs = await this.computeCosts(organizationId, periodStart, periodEnd);
        if (rev.status !== "ok" || costs.status !== "ok") {
          result = {
            status: "INSUFFICIENT_DATA",
            formulaVersion: "finance_net.v1",
            reason: "Receita ou custos indisponíveis.",
          };
        } else {
          result = {
            status: "ok",
            value: rev.value - costs.value,
            formulaVersion: "finance_net.v1",
          };
        }
        break;
      }
      case "legal":
        result = await this.countLegalMatters(organizationId);
        break;
      case "processes":
        result = await this.countProcesses(organizationId);
        break;
      case "deadlines":
        result = await this.countDeadlines(organizationId, periodStart, periodEnd);
        break;
      case "productivity":
        result = await this.countCompletedTasks(organizationId, periodStart, periodEnd);
        break;
      case "conversions":
      case "ai":
      case "marketplace":
        result = {
          status: "INSUFFICIENT_DATA",
          formulaVersion: def.formulaVersion,
          reason: "Fonte de domínio ainda sem volume suficiente neste ambiente.",
        };
        break;
      default:
        result = {
          status: "INSUFFICIENT_DATA",
          formulaVersion: def.formulaVersion,
          reason: "Fórmula não implementada.",
        };
    }

    return { metricKey, ...result };
  }

  async persistSnapshot(
    organizationId: string,
    metricKey: string,
    periodStart: Date,
    periodEnd: Date,
    result: MetricComputeResult,
    dimensions: Record<string, unknown> = {},
  ) {
    if (result.status !== "ok") return null;
    const key = dimensionsKey(dimensions);
    try {
      const [row] = await this.db
        .insert(analyticsMetricSnapshots)
        .values({
          metricKey,
          organizationId,
          periodStart,
          periodEnd,
          dimensions,
          dimensionsKey: key,
          value: String(result.value),
          formulaVersion: result.formulaVersion,
          calculatedAt: new Date(),
          metadata: result.metadata ?? null,
        })
        .returning();
      return row ?? null;
    } catch {
      // Unique snapshot race — still return computed value without failing the query.
      return null;
    }
  }

  private async computeMrr(organizationId: string): Promise<MetricComputeResult> {
    const rows = await this.db
      .select({
        status: subscriptions.status,
        priceCents: billingPlanVersions.priceCents,
        billingInterval: billingPlanVersions.billingInterval,
      })
      .from(subscriptions)
      .innerJoin(billingPlanVersions, eq(subscriptions.planVersionId, billingPlanVersions.id))
      .where(eq(subscriptions.organizationId, organizationId));
    return computeMrrV1(rows);
  }

  private async computeRevenue(
    organizationId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<MetricComputeResult> {
    const [row] = await this.db
      .select({
        total: sql<string>`coalesce(sum(${invoices.amountPaidCents}), 0)`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.organizationId, organizationId),
          eq(invoices.status, "paid"),
          gte(invoices.paidAt, periodStart),
          lte(invoices.paidAt, periodEnd),
        ),
      );
    return {
      status: "ok",
      value: Number(row?.total ?? 0),
      formulaVersion: "revenue.v1",
    };
  }

  private async computeCosts(
    organizationId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<MetricComputeResult> {
    const [row] = await this.db
      .select({
        total: sql<string>`coalesce(sum(${costRecords.amountCents}), 0)`,
      })
      .from(costRecords)
      .where(
        and(
          eq(costRecords.organizationId, organizationId),
          gte(costRecords.incurredAt, periodStart),
          lte(costRecords.incurredAt, periodEnd),
        ),
      );
    return {
      status: "ok",
      value: Number(row?.total ?? 0),
      formulaVersion: "costs.v1",
    };
  }

  private async computeLogoChurn(
    organizationId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<MetricComputeResult> {
    const [startActive] = await this.db
      .select({ value: count() })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.organizationId, organizationId),
          sql`${subscriptions.createdAt} < ${periodStart}`,
          sql`(${subscriptions.cancelledAt} is null or ${subscriptions.cancelledAt} >= ${periodStart})`,
        ),
      );
    const [cancelled] = await this.db
      .select({ value: count() })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.organizationId, organizationId),
          gte(subscriptions.cancelledAt, periodStart),
          lte(subscriptions.cancelledAt, periodEnd),
        ),
      );
    return computeLogoChurnV1({
      customersStart: startActive?.value ?? 0,
      customersCancelled: cancelled?.value ?? 0,
    });
  }

  private async countLegalMatters(organizationId: string): Promise<MetricComputeResult> {
    const [row] = await this.db
      .select({ value: count() })
      .from(legalMatters)
      .where(
        and(
          eq(legalMatters.organizationId, organizationId),
          sql`${legalMatters.status} in ('open', 'active')`,
        ),
      );
    return { status: "ok", value: row?.value ?? 0, formulaVersion: "legal.v1" };
  }

  private async countProcesses(organizationId: string): Promise<MetricComputeResult> {
    const [j] = await this.db
      .select({ value: count() })
      .from(judicialProcesses)
      .where(eq(judicialProcesses.organizationId, organizationId));
    const [a] = await this.db
      .select({ value: count() })
      .from(administrativeProcesses)
      .where(eq(administrativeProcesses.organizationId, organizationId));
    return {
      status: "ok",
      value: (j?.value ?? 0) + (a?.value ?? 0),
      formulaVersion: "processes.v1",
    };
  }

  private async countDeadlines(
    organizationId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<MetricComputeResult> {
    const [row] = await this.db
      .select({ value: count() })
      .from(deadlines)
      .where(
        and(
          eq(deadlines.organizationId, organizationId),
          eq(deadlines.status, "confirmed"),
          gte(deadlines.confirmedDueAt, periodStart),
          lte(deadlines.confirmedDueAt, periodEnd),
        ),
      );
    return { status: "ok", value: row?.value ?? 0, formulaVersion: "deadlines.v1" };
  }

  private async countCompletedTasks(
    organizationId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<MetricComputeResult> {
    const [row] = await this.db
      .select({ value: count() })
      .from(tasks)
      .where(
        and(
          eq(tasks.organizationId, organizationId),
          eq(tasks.status, "done"),
          gte(tasks.completedAt, periodStart),
          lte(tasks.completedAt, periodEnd),
        ),
      );
    return { status: "ok", value: row?.value ?? 0, formulaVersion: "productivity.v1" };
  }
}

export class AnalyticsQueryService {
  constructor(
    private readonly db: AppDatabase,
    private readonly analytics: AnalyticsService,
    private readonly deps: AnalyticsModuleDeps = {},
  ) {}

  listMetrics(filter?: { domain?: string; q?: string; limit?: number; offset?: number }) {
    const registry = this.deps.registry ?? defaultMetricRegistry;
    const all = registry.list(filter);
    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? 20;
    return {
      metrics: all.slice(offset, offset + limit),
      total: all.length,
    };
  }

  async query(
    organizationId: string,
    input: {
      metricKeys?: string[];
      metricKey?: string;
      periodStart: string;
      periodEnd: string;
      dimensions?: Record<string, unknown>;
      formulaVersion?: string;
    },
  ) {
    const keys =
      input.metricKeys ??
      (input.metricKey ? [input.metricKey] : ["mrr", "arr", "revenue", "costs"]);
    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);
    const results = [];
    for (const key of keys) {
      const computed = await this.analytics.computeMetric(
        organizationId,
        key,
        periodStart,
        periodEnd,
      );
      if (
        input.formulaVersion &&
        computed.status === "ok" &&
        computed.formulaVersion !== input.formulaVersion
      ) {
        results.push({
          metricKey: key,
          status: "INSUFFICIENT_DATA" as const,
          formulaVersion: input.formulaVersion,
          reason: `Versão solicitada ${input.formulaVersion} difere de ${computed.formulaVersion}.`,
        });
        continue;
      }
      if (computed.status === "ok") {
        await this.analytics.persistSnapshot(
          organizationId,
          key,
          periodStart,
          periodEnd,
          computed,
          input.dimensions,
        );
      }
      results.push(computed);
    }
    return { results, periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString() };
  }

  async dashboard(
    organizationId: string,
    input: { tab: string; periodStart: string; periodEnd: string },
  ) {
    const tabMetrics: Record<string, string[]> = {
      executive: ["revenue", "mrr", "arr", "legal", "processes"],
      revenue: ["revenue", "mrr", "arr", "logo_churn", "revenue_churn"],
      customers: ["logo_churn", "cac", "ltv", "conversions"],
      legal: ["legal", "processes", "deadlines"],
      operations: ["productivity", "deadlines"],
      marketplace: ["marketplace"],
      ai: ["ai"],
      finance: ["finance", "costs", "revenue"],
      product: ["productivity"],
      hr: ["productivity"],
      compliance: ["legal"],
    };
    const keys = tabMetrics[input.tab] ?? tabMetrics.executive;
    return this.query(organizationId, {
      metricKeys: keys,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    });
  }

  async providerHealth() {
    const bi =
      this.deps.biProvider != null
        ? await this.deps.biProvider.healthCheck()
        : { status: "not_configured" as const, checkedAt: new Date().toISOString() };
    const warehouse =
      this.deps.warehouseProvider != null
        ? await this.deps.warehouseProvider.healthCheck()
        : { status: "not_configured" as const, checkedAt: new Date().toISOString() };
    return { bi, warehouse };
  }
}

export async function listAnalyticsMetrics(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number; domain?: string; q?: string },
  deps: AnalyticsModuleDeps = {},
) {
  authorize(account, organizationId, (a) => policyAnalytics(a, "analytics.read"));
  const service = new AnalyticsQueryService(db, new AnalyticsService(db), deps);
  return service.listMetrics(query);
}

export async function queryAnalytics(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    metricKeys?: string[];
    metricKey?: string;
    periodStart: string;
    periodEnd: string;
    dimensions?: Record<string, unknown>;
    formulaVersion?: string;
  },
  deps: AnalyticsModuleDeps = {},
  meta?: RequestMeta,
) {
  authorize(account, organizationId, (a) => policyAnalytics(a, "analytics.read"));
  const service = new AnalyticsQueryService(db, new AnalyticsService(db), deps);
  const result = await service.query(organizationId, input);
  if (meta) {
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "analytics.metric_queried",
      resourceType: "analytics_query",
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { metricKeys: input.metricKeys ?? input.metricKey },
    });
  }
  return result;
}

export async function getAnalyticsDashboard(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: { tab: string; periodStart: string; periodEnd: string },
  deps: AnalyticsModuleDeps = {},
) {
  authorize(account, organizationId, (a) => policyAnalytics(a, "analytics.read"));
  const service = new AnalyticsQueryService(db, new AnalyticsService(db), deps);
  const [dashboard, health] = await Promise.all([
    service.dashboard(organizationId, input),
    service.providerHealth(),
  ]);
  return { ...dashboard, providers: health, tab: input.tab };
}

export type { MetricDefinition };
