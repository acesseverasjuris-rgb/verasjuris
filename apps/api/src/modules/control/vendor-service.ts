import { recordAudit } from "@verasjuris/audit";
import { policyVendor, type SessionAccount } from "@verasjuris/auth";
import {
  controlVendors,
  vendorReviews,
  vendorSlaResults,
  vendorSlas,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, desc, eq } from "drizzle-orm";
import { iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import { authorizeControl, requireDate } from "./internal-org.js";

function serializeVendor(row: typeof controlVendors.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    legalName: row.legalName,
    tradeName: row.tradeName,
    taxId: row.taxId,
    category: row.category,
    status: row.status,
    riskLevel: row.riskLevel,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    onboardingStatus: row.onboardingStatus,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export async function createControlVendor(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    legalName: string;
    tradeName?: string;
    taxId?: string;
    category?: string;
    status?: typeof controlVendors.$inferSelect.status;
    riskLevel?: typeof controlVendors.$inferSelect.riskLevel;
    contactEmail?: string;
    contactPhone?: string;
    onboardingStatus?: string;
  },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyVendor(a, "control.vendor.manage"),
  );
  const onboardingStatus = (
    ["not_started", "in_progress", "completed", "blocked"].includes(input.onboardingStatus ?? "")
      ? input.onboardingStatus
      : "not_started"
  ) as typeof controlVendors.$inferSelect.onboardingStatus;
  const [row] = await db
    .insert(controlVendors)
    .values({
      organizationId,
      legalName: input.legalName,
      tradeName: input.tradeName ?? null,
      taxId: input.taxId ?? null,
      category: input.category ?? null,
      status: input.status ?? "prospect",
      riskLevel: input.riskLevel ?? "medium",
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      onboardingStatus,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o fornecedor.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "control.vendor_created",
    resourceType: "control_vendor",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: serializeVendor(row),
  });
  return { vendor: serializeVendor(row) };
}

export async function listControlVendors(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number; status?: string; category?: string },
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyVendor(a, "control.vendor.read"),
  );
  const filters = [eq(controlVendors.organizationId, organizationId)];
  if (query.status) {
    filters.push(
      eq(controlVendors.status, query.status as typeof controlVendors.$inferSelect.status),
    );
  }
  if (query.category) filters.push(eq(controlVendors.category, query.category));
  const rows = await db
    .select()
    .from(controlVendors)
    .where(and(...filters))
    .orderBy(controlVendors.legalName)
    .limit(query.limit)
    .offset(query.offset);
  return { vendors: rows.map(serializeVendor) };
}

export async function createVendorSla(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    vendorId: string;
    contractId?: string;
    metric: string;
    target: string;
    measurement?: string;
    period?: string;
    status?: string;
  },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyVendor(a, "control.vendor.manage"),
  );
  const [vendor] = await db
    .select()
    .from(controlVendors)
    .where(
      and(eq(controlVendors.id, input.vendorId), eq(controlVendors.organizationId, organizationId)),
    )
    .limit(1);
  if (!vendor) throw new AppError("NOT_FOUND", "Não encontramos este fornecedor no seu acesso.");
  const status = (
    ["active", "breached", "paused", "expired"].includes(input.status ?? "")
      ? input.status
      : "active"
  ) as typeof vendorSlas.$inferSelect.status;
  const [row] = await db
    .insert(vendorSlas)
    .values({
      organizationId,
      vendorId: vendor.id,
      contractId: input.contractId ?? null,
      metric: input.metric,
      target: input.target,
      measurement: input.measurement ?? null,
      period: input.period ?? null,
      status,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o SLA.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "control.vendor_sla_created",
    resourceType: "vendor_sla",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return {
    sla: {
      id: row.id,
      vendorId: row.vendorId,
      contractId: row.contractId,
      metric: row.metric,
      target: row.target,
      measurement: row.measurement,
      period: row.period,
      status: row.status,
      createdAt: iso(row.createdAt),
    },
  };
}

export async function recordVendorSlaResult(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  slaId: string,
  input: {
    periodStart: string;
    periodEnd: string;
    actualValue?: string;
    status: typeof vendorSlaResults.$inferSelect.status;
    notes?: string;
  },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyVendor(a, "control.vendor.manage"),
  );
  const [sla] = await db
    .select()
    .from(vendorSlas)
    .where(and(eq(vendorSlas.id, slaId), eq(vendorSlas.organizationId, organizationId)))
    .limit(1);
  if (!sla) throw new AppError("NOT_FOUND", "Não encontramos este SLA no seu acesso.");
  const [row] = await db
    .insert(vendorSlaResults)
    .values({
      slaId: sla.id,
      periodStart: requireDate(input.periodStart),
      periodEnd: requireDate(input.periodEnd),
      actualValue: input.actualValue ?? null,
      status: input.status,
      notes: input.notes ?? null,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o resultado.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "control.vendor_sla_result",
    resourceType: "vendor_sla_result",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return {
    result: {
      id: row.id,
      slaId: row.slaId,
      periodStart: iso(row.periodStart),
      periodEnd: iso(row.periodEnd),
      actualValue: row.actualValue,
      status: row.status,
      notes: row.notes,
    },
  };
}

export async function createVendorReview(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    vendorId: string;
    period: string;
    qualityScore?: number;
    deadlineScore?: number;
    costScore?: number;
    securityScore?: number;
    complianceScore?: number;
    supportScore?: number;
    notes?: string;
  },
  meta: RequestMeta,
) {
  const actor = await authorizeControl(db, account, organizationId, (a) =>
    policyVendor(a, "control.vendor.manage"),
  );
  const [vendor] = await db
    .select()
    .from(controlVendors)
    .where(
      and(eq(controlVendors.id, input.vendorId), eq(controlVendors.organizationId, organizationId)),
    )
    .limit(1);
  if (!vendor) throw new AppError("NOT_FOUND", "Não encontramos este fornecedor no seu acesso.");

  const scores = [
    input.qualityScore,
    input.deadlineScore,
    input.costScore,
    input.securityScore,
    input.complianceScore,
    input.supportScore,
  ].filter((v): v is number => typeof v === "number");
  const overallScore =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  let periodStart: Date | null = null;
  let periodEnd: Date | null = null;
  const match = /^(\d{4})-(\d{2})$/.exec(input.period);
  if (match) {
    periodStart = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
    periodEnd = new Date(Date.UTC(Number(match[1]), Number(match[2]), 0, 23, 59, 59));
  }

  const [row] = await db
    .insert(vendorReviews)
    .values({
      organizationId,
      vendorId: vendor.id,
      periodStart,
      periodEnd,
      qualityScore: input.qualityScore ?? null,
      deadlineScore: input.deadlineScore ?? null,
      costScore: input.costScore ?? null,
      securityScore: input.securityScore ?? null,
      complianceScore: input.complianceScore ?? null,
      supportScore: input.supportScore ?? null,
      overallScore,
      reviewScaleMax: 100,
      comments: input.notes ?? null,
      reviewerMembershipId: actor.membershipId,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a avaliação.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "control.vendor_reviewed",
    resourceType: "vendor_review",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return {
    review: {
      id: row.id,
      vendorId: row.vendorId,
      period: input.period,
      qualityScore: row.qualityScore,
      deadlineScore: row.deadlineScore,
      costScore: row.costScore,
      securityScore: row.securityScore,
      complianceScore: row.complianceScore,
      supportScore: row.supportScore,
      overallScore: row.overallScore,
      comments: row.comments,
      reviewedAt: iso(row.reviewedAt),
    },
  };
}

export async function vendorSlaCheckJob(db: AppDatabase, organizationId: string) {
  const rows = await db
    .select()
    .from(vendorSlas)
    .where(and(eq(vendorSlas.organizationId, organizationId), eq(vendorSlas.status, "active")));
  return { activeSlas: rows.length };
}

export async function listVendorSlas(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  vendorId?: string,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyVendor(a, "control.vendor.read"),
  );
  const filters = [eq(vendorSlas.organizationId, organizationId)];
  if (vendorId) filters.push(eq(vendorSlas.vendorId, vendorId));
  const rows = await db
    .select()
    .from(vendorSlas)
    .where(and(...filters))
    .orderBy(desc(vendorSlas.createdAt));
  return {
    slas: rows.map((r) => ({
      id: r.id,
      vendorId: r.vendorId,
      contractId: r.contractId,
      metric: r.metric,
      target: r.target,
      status: r.status,
      period: r.period,
    })),
  };
}
