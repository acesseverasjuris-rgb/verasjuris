import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure } from "./ai";
import { aiErrorMessage, formatDateTime, hasPermission, isApiFailure } from "./ai";
import { getActiveMembership, getActiveOrgId } from "./crm";

export { getActiveMembership, getActiveOrgId, isApiFailure, aiErrorMessage, formatDateTime };

export type AnalyticsAction =
  | "read"
  | "finance.read"
  | "hr.read"
  | "legal.read"
  | "export"
  | "admin";

const PERM: Record<AnalyticsAction, string> = {
  read: "analytics.read",
  "finance.read": "analytics.finance.read",
  "hr.read": "analytics.hr.read",
  "legal.read": "analytics.legal.read",
  export: "analytics.export",
  admin: "analytics.admin",
};

export function hasAnalyticsPermission(permissions: string[], action: AnalyticsAction): boolean {
  if (action !== "read" && hasPermission(permissions, PERM.admin)) return true;
  return hasPermission(permissions, PERM[action]);
}

export function canAccessAnalyticsNav(permissions: string[]): boolean {
  return hasAnalyticsPermission(permissions, "read");
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

export function analyticsErrorMessage(failure: AiApiFailure): string {
  return aiErrorMessage(failure, "Falha em Analytics.");
}

export const ANALYTICS_TAB_KEYS = [
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

export type AnalyticsTabKey = (typeof ANALYTICS_TAB_KEYS)[number];

export const ANALYTICS_TAB_LABELS: Record<AnalyticsTabKey, string> = {
  executive: "Executivo",
  revenue: "Receita",
  customers: "Clientes",
  legal: "Jurídico",
  operations: "Operação",
  marketplace: "Marketplace",
  ai: "IA",
  finance: "Financeiro",
  product: "Produto",
  hr: "RH",
  compliance: "Compliance",
};

export type AnalyticsSeriesPoint = {
  label: string;
  value: number;
  unit?: string | null;
  status?: "ok" | "insufficient_data" | "error" | string;
  note?: string | null;
};

export type AnalyticsMetricCard = {
  key: string;
  name: string;
  value: number | null;
  unit?: string | null;
  formulaVersion?: string | null;
  status?: "ok" | "insufficient_data" | "error" | string;
  note?: string | null;
};

export type AnalyticsDashboard = {
  tab: AnalyticsTabKey | string;
  periodStart: string;
  periodEnd: string;
  metrics: AnalyticsMetricCard[];
  series: Array<{
    key: string;
    name: string;
    points: AnalyticsSeriesPoint[];
  }>;
  filters?: Record<string, string | null | undefined>;
};

export type AnalyticsMetricDefinition = {
  key: string;
  name: string;
  domain: string;
  description?: string | null;
  unit?: string | null;
  formulaVersion?: string | null;
  createdAt?: string;
};

export type AnalyticsSnapshot = {
  id: string;
  metricKey: string;
  periodStart: string;
  periodEnd: string;
  value: number | null;
  status?: string | null;
  formulaVersion?: string | null;
  calculatedAt: string;
};

export type AnalyticsExportJob = {
  id: string;
  format: string;
  status: string;
  createdAt: string;
  completedAt?: string | null;
};

export type AnalyticsDashboardQuery = {
  tab?: AnalyticsTabKey | string;
  periodStart: string;
  periodEnd: string;
  organizationId?: string;
  product?: string;
  area?: string;
  region?: string;
  plan?: string;
  department?: string;
};

export async function fetchAnalyticsDashboard(orgId: string, query: AnalyticsDashboardQuery) {
  return request<AnalyticsDashboard>(orgPath(orgId, `/analytics/dashboard${qs(query)}`));
}

export async function fetchAnalyticsMetrics(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: AnalyticsMetricDefinition[]; total?: number }>(
    orgPath(orgId, `/analytics/metrics${qs(query)}`),
  );
}

export async function fetchAnalyticsSnapshots(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: AnalyticsSnapshot[]; total?: number }>(
    orgPath(orgId, `/analytics/snapshots${qs(query)}`),
  );
}

export async function createAnalyticsExport(
  orgId: string,
  body: {
    format?: string;
    metricKeys: string[];
    periodStart: string;
    periodEnd: string;
    dashboardTab?: string;
  },
) {
  return request<{ export: AnalyticsExportJob }>(orgPath(orgId, "/analytics/exports"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchAnalyticsExports(
  orgId: string,
  query: Record<string, string | number | undefined> = {},
) {
  return request<{ items: AnalyticsExportJob[]; total?: number }>(
    orgPath(orgId, `/analytics/exports${qs(query)}`),
  );
}

/** Período padrão: últimos 30 dias em ISO datetime. */
export function defaultAnalyticsPeriod(now = new Date()): {
  periodStart: string;
  periodEnd: string;
} {
  const end = new Date(now);
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 30);
  return { periodStart: start.toISOString(), periodEnd: end.toISOString() };
}
