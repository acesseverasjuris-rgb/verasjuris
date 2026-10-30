import { recordAudit } from "@verasjuris/audit";
import { policyAnalytics, type SessionAccount } from "@verasjuris/auth";
import { analyticsExportJobs, type AppDatabase } from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, desc, eq } from "drizzle-orm";
import { authorize, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import { AnalyticsService } from "./analytics-service.js";

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "metricKey,status,value,formulaVersion\n";
  const headers = Object.keys(rows[0]!);
  const escapeCsvCell = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escapeCsvCell(r[h])).join(",")),
  ].join("\n");
}

export async function createAnalyticsExport(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    format: "csv" | "xlsx";
    metricKeys: string[];
    periodStart: string;
    periodEnd: string;
    dimensions?: Record<string, unknown>;
    dashboardTab?: string;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (a) => policyAnalytics(a, "analytics.export"));

  if (input.format === "xlsx") {
    throw new AppError(
      "NOT_CONFIGURED",
      "Exportação XLSX não está disponível nesta versão. Use format=csv.",
    );
  }

  const [job] = await db
    .insert(analyticsExportJobs)
    .values({
      organizationId,
      status: "running",
      format: "csv",
      requestedByUserId: account.user.id,
      metadata: {
        metricKeys: input.metricKeys,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        dimensions: input.dimensions ?? {},
        dashboardTab: input.dashboardTab ?? null,
      },
    })
    .returning();
  if (!job) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a exportação.");

  const analytics = new AnalyticsService(db);
  const periodStart = new Date(input.periodStart);
  const periodEnd = new Date(input.periodEnd);
  const rows: Array<Record<string, unknown>> = [];
  for (const key of input.metricKeys) {
    const result = await analytics.computeMetric(organizationId, key, periodStart, periodEnd);
    rows.push({
      metricKey: key,
      status: result.status,
      value: result.status === "ok" ? result.value : "",
      formulaVersion: result.formulaVersion,
      reason: result.status === "INSUFFICIENT_DATA" ? result.reason : "",
    });
  }
  const csv = toCsv(rows);

  const [completed] = await db
    .update(analyticsExportJobs)
    .set({
      status: "completed",
      completedAt: new Date(),
      metadata: {
        ...(job.metadata as Record<string, unknown>),
        rowCount: rows.length,
        csv,
      },
    })
    .where(eq(analyticsExportJobs.id, job.id))
    .returning();

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "analytics.export_created",
    resourceType: "analytics_export_job",
    resourceId: job.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    metadata: { format: "csv", metricKeys: input.metricKeys },
  });

  return {
    export: {
      id: completed?.id ?? job.id,
      status: completed?.status ?? "completed",
      format: "csv" as const,
      createdAt: iso(job.createdAt),
      completedAt: iso(completed?.completedAt ?? new Date()),
      csv,
      rowCount: rows.length,
    },
  };
}

export async function listAnalyticsExports(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number; status?: string },
) {
  authorize(account, organizationId, (a) => policyAnalytics(a, "analytics.export"));
  const filters = [eq(analyticsExportJobs.organizationId, organizationId)];
  if (query.status) {
    filters.push(
      eq(
        analyticsExportJobs.status,
        query.status as typeof analyticsExportJobs.$inferSelect.status,
      ),
    );
  }
  const rows = await db
    .select()
    .from(analyticsExportJobs)
    .where(and(...filters))
    .orderBy(desc(analyticsExportJobs.createdAt))
    .limit(query.limit)
    .offset(query.offset);
  return {
    exports: rows.map((r) => ({
      id: r.id,
      status: r.status,
      format: r.format,
      createdAt: iso(r.createdAt),
      completedAt: iso(r.completedAt),
      errorCode: r.errorCode,
    })),
  };
}

export async function getAnalyticsExport(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  exportId: string,
) {
  authorize(account, organizationId, (a) => policyAnalytics(a, "analytics.export"));
  const [row] = await db
    .select()
    .from(analyticsExportJobs)
    .where(
      and(
        eq(analyticsExportJobs.id, exportId),
        eq(analyticsExportJobs.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos esta exportação no seu acesso.");
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    export: {
      id: row.id,
      status: row.status,
      format: row.format,
      createdAt: iso(row.createdAt),
      completedAt: iso(row.completedAt),
      csv: typeof metadata.csv === "string" ? metadata.csv : null,
      rowCount: typeof metadata.rowCount === "number" ? metadata.rowCount : null,
    },
  };
}
