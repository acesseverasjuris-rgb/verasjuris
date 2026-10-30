import { z } from "zod";

const uuid = z.string().uuid("O identificador não é válido.");
const optionalUuid = uuid.optional();
const datetime = z.string().datetime({ offset: true });
const optionalDatetime = datetime.optional();

export const ANALYTICS_EXPORT_FORMATS = ["csv", "xlsx"] as const;

export const ANALYTICS_EXPORT_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export const ANALYTICS_DASHBOARD_TABS = [
  "executive",
  "revenue",
  "customers",
  "legal",
  "operations",
  "marketplace",
  "ai",
  "finance",
  "product",
  "hr",
  "compliance",
] as const;

export const ANALYTICS_METRIC_DOMAINS = [
  "revenue",
  "subscription",
  "conversion",
  "legal",
  "deadline",
  "productivity",
  "ai",
  "cost",
  "marketplace",
  "finance",
  "hr",
  "compliance",
  "product",
  "other",
] as const;

const listPagination = {
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  q: z.string().trim().max(120).optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
};

export const analyticsMetricKeySchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/, "Informe uma chave de métrica válida.");

export const analyticsQuerySchema = z.object({
  metricKeys: z.array(analyticsMetricKeySchema).min(1).max(50).optional(),
  metricKey: analyticsMetricKeySchema.optional(),
  periodStart: datetime,
  periodEnd: datetime,
  dimensions: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  organizationId: optionalUuid,
  formulaVersion: z.string().trim().max(40).optional(),
});

export const analyticsDashboardQuerySchema = z.object({
  tab: z.enum(ANALYTICS_DASHBOARD_TABS).default("executive"),
  periodStart: datetime,
  periodEnd: datetime,
  organizationId: optionalUuid,
  product: z.string().trim().max(80).optional(),
  area: z.string().trim().max(80).optional(),
  region: z.string().trim().max(80).optional(),
  plan: z.string().trim().max(80).optional(),
  department: z.string().trim().max(80).optional(),
});

export const analyticsMetricListQuerySchema = z.object({
  ...listPagination,
  domain: z.enum(ANALYTICS_METRIC_DOMAINS).optional(),
  sort: z.enum(["key", "name", "domain", "createdAt"]).default("key"),
});

export const analyticsSnapshotListQuerySchema = z.object({
  ...listPagination,
  metricKey: analyticsMetricKeySchema.optional(),
  periodStart: optionalDatetime,
  periodEnd: optionalDatetime,
  organizationId: optionalUuid,
  sort: z.enum(["calculatedAt", "periodStart", "metricKey"]).default("calculatedAt"),
});

export const createAnalyticsExportSchema = z.object({
  format: z.enum(ANALYTICS_EXPORT_FORMATS).default("csv"),
  metricKeys: z.array(analyticsMetricKeySchema).min(1).max(50),
  periodStart: datetime,
  periodEnd: datetime,
  dimensions: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  dashboardTab: z.enum(ANALYTICS_DASHBOARD_TABS).optional(),
});

export const analyticsExportListQuerySchema = z.object({
  ...listPagination,
  status: z.enum(ANALYTICS_EXPORT_STATUSES).optional(),
  format: z.enum(ANALYTICS_EXPORT_FORMATS).optional(),
  sort: z.enum(["createdAt", "completedAt"]).default("createdAt"),
});
