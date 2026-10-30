import { recordAudit } from "@verasjuris/audit";
import {
  policyComplianceIncident,
  policyComplianceRisk,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  complianceAuditFindings,
  complianceAudits,
  complianceControls,
  complianceIncidents,
  complianceObligations,
  complianceRisks,
  deadlines,
  isUniqueViolation,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, desc, eq } from "drizzle-orm";
import { iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import {
  authorizeControl,
  computeRiskScore,
  mapIncidentSeverity,
  parseDate,
  requireDate,
} from "./internal-org.js";

function serializeRisk(row: typeof complianceRisks.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    category: row.category,
    title: row.title,
    description: row.description,
    ownerMembershipId: row.ownerMembershipId,
    likelihood: row.likelihood,
    impact: row.impact,
    inherentRisk: row.inherentRisk,
    residualRisk: row.residualRisk,
    status: row.status,
    reviewAt: iso(row.reviewAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export async function createComplianceRisk(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    category: typeof complianceRisks.$inferSelect.category;
    title: string;
    description?: string;
    ownerMembershipId?: string;
    likelihood: number;
    impact: number;
    status?: string;
    reviewAt?: string;
  },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyComplianceRisk(a, "control.compliance.manage"),
  );
  const score = computeRiskScore(input.likelihood, input.impact);
  const status = (
    ["open", "monitoring", "mitigated", "accepted", "closed"].includes(input.status ?? "")
      ? input.status
      : "open"
  ) as typeof complianceRisks.$inferSelect.status;
  const [row] = await db
    .insert(complianceRisks)
    .values({
      organizationId,
      category: input.category,
      title: input.title,
      description: input.description ?? null,
      ownerMembershipId: input.ownerMembershipId ?? null,
      likelihood: input.likelihood,
      impact: input.impact,
      inherentRisk: score,
      residualRisk: score,
      status,
      reviewAt: parseDate(input.reviewAt ?? null),
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o risco.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "control.risk_created",
    resourceType: "compliance_risk",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: serializeRisk(row),
  });
  return { risk: serializeRisk(row) };
}

export async function listComplianceRisks(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number; category?: string; status?: string },
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyComplianceRisk(a, "control.compliance.read"),
  );
  const filters = [eq(complianceRisks.organizationId, organizationId)];
  if (query.category) {
    filters.push(
      eq(complianceRisks.category, query.category as typeof complianceRisks.$inferSelect.category),
    );
  }
  if (query.status) {
    filters.push(
      eq(complianceRisks.status, query.status as typeof complianceRisks.$inferSelect.status),
    );
  }
  const rows = await db
    .select()
    .from(complianceRisks)
    .where(and(...filters))
    .orderBy(desc(complianceRisks.createdAt))
    .limit(query.limit)
    .offset(query.offset);
  return { risks: rows.map(serializeRisk) };
}

export async function createComplianceControl(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    riskId?: string;
    code: string;
    title: string;
    description?: string;
    controlType: typeof complianceControls.$inferSelect.controlType;
    ownerMembershipId?: string;
    frequency?: string;
    status?: string;
    nextTestAt?: string;
  },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyComplianceRisk(a, "control.compliance.manage"),
  );
  const frequency = (
    ["continuous", "daily", "weekly", "monthly", "quarterly", "yearly", "ad_hoc"].includes(
      input.frequency ?? "",
    )
      ? input.frequency
      : "ad_hoc"
  ) as typeof complianceControls.$inferSelect.frequency;
  const status = (
    ["draft", "active", "inactive", "retired"].includes(input.status ?? "") ? input.status : "draft"
  ) as typeof complianceControls.$inferSelect.status;
  try {
    const [row] = await db
      .insert(complianceControls)
      .values({
        organizationId,
        riskId: input.riskId ?? null,
        code: input.code,
        title: input.title,
        description: input.description ?? null,
        controlType: input.controlType,
        ownerMembershipId: input.ownerMembershipId ?? null,
        frequency,
        status,
        nextTestAt: parseDate(input.nextTestAt ?? null),
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o controle.");
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "control.control_created",
      resourceType: "compliance_control",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
    return {
      control: {
        id: row.id,
        code: row.code,
        title: row.title,
        controlType: row.controlType,
        status: row.status,
        frequency: row.frequency,
        riskId: row.riskId,
        createdAt: iso(row.createdAt),
      },
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Já existe um controle com este código.");
    }
    throw error;
  }
}

export async function createComplianceIncident(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    type: typeof complianceIncidents.$inferSelect.type;
    severity: string;
    title: string;
    description?: string;
    detectedAt: string;
    ownerMembershipId?: string;
    status?: typeof complianceIncidents.$inferSelect.status;
  },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyComplianceIncident(a, "control.compliance.manage"),
  );
  const [row] = await db
    .insert(complianceIncidents)
    .values({
      organizationId,
      type: input.type,
      severity: mapIncidentSeverity(input.severity),
      title: input.title,
      description: input.description ?? null,
      detectedAt: requireDate(input.detectedAt),
      ownerMembershipId: input.ownerMembershipId ?? null,
      status: input.status ?? "open",
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível abrir o incidente.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "control.incident_opened",
    resourceType: "compliance_incident",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return {
    incident: {
      id: row.id,
      type: row.type,
      severity: row.severity,
      title: row.title,
      status: row.status,
      detectedAt: iso(row.detectedAt),
      createdAt: iso(row.createdAt),
    },
  };
}

export async function createComplianceAudit(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    type: typeof complianceAudits.$inferSelect.type;
    title: string;
    description?: string;
    ownerMembershipId?: string;
    plannedAt?: string;
    startedAt?: string;
  },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyComplianceRisk(a, "control.compliance.audit"),
  );
  const [row] = await db
    .insert(complianceAudits)
    .values({
      organizationId,
      type: input.type,
      title: input.title,
      ownerMembershipId: input.ownerMembershipId ?? null,
      plannedAt: parseDate(input.plannedAt ?? null),
      startedAt: parseDate(input.startedAt ?? null),
      status: "planned",
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a auditoria.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "control.audit_created",
    resourceType: "compliance_audit",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    metadata: input.description ? { description: input.description } : undefined,
  });
  return {
    audit: {
      id: row.id,
      type: row.type,
      title: row.title,
      status: row.status,
      plannedAt: iso(row.plannedAt),
      createdAt: iso(row.createdAt),
    },
  };
}

export async function addComplianceFinding(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  auditId: string,
  input: {
    severity: typeof complianceAuditFindings.$inferSelect.severity;
    description: string;
    ownerMembershipId?: string;
    remediationDueAt?: string;
  },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyComplianceRisk(a, "control.compliance.audit"),
  );
  const [audit] = await db
    .select()
    .from(complianceAudits)
    .where(
      and(eq(complianceAudits.id, auditId), eq(complianceAudits.organizationId, organizationId)),
    )
    .limit(1);
  if (!audit) throw new AppError("NOT_FOUND", "Não encontramos esta auditoria no seu acesso.");
  const [row] = await db
    .insert(complianceAuditFindings)
    .values({
      auditId: audit.id,
      severity: input.severity,
      description: input.description,
      ownerMembershipId: input.ownerMembershipId ?? null,
      remediationDueAt: parseDate(input.remediationDueAt ?? null),
      status: "open",
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o achado.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "control.finding_created",
    resourceType: "compliance_audit_finding",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return {
    finding: {
      id: row.id,
      auditId: row.auditId,
      severity: row.severity,
      description: row.description,
      status: row.status,
      remediationDueAt: iso(row.remediationDueAt),
    },
  };
}

export async function createComplianceObligation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    title: string;
    source?: string;
    authority?: string;
    frequency?: string;
    dueAt?: string;
    ownerMembershipId?: string;
    evidenceDocumentId?: string;
    status?: string;
  },
  meta: RequestMeta,
) {
  const actor = await authorizeControl(db, account, organizationId, (a) =>
    policyComplianceRisk(a, "control.compliance.manage"),
  );
  const status = (
    ["open", "in_progress", "completed", "overdue", "waived"].includes(input.status ?? "")
      ? input.status
      : "open"
  ) as typeof complianceObligations.$inferSelect.status;
  return db.transaction(async (tx) => {
    const dueAt = parseDate(input.dueAt ?? null);
    const [row] = await tx
      .insert(complianceObligations)
      .values({
        organizationId,
        title: input.title,
        source: input.source ?? null,
        authority: input.authority ?? null,
        frequency: input.frequency ?? null,
        dueAt,
        ownerMembershipId: input.ownerMembershipId ?? null,
        evidenceDocumentId: input.evidenceDocumentId ?? null,
        status,
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a obrigação.");

    let deadlineId: string | null = null;
    if (dueAt) {
      const [deadline] = await tx
        .insert(deadlines)
        .values({
          organizationId,
          title: `Obrigação: ${input.title}`,
          description: input.source ?? null,
          baseDate: dueAt,
          ruleType: "manual_date",
          calculatedDueAt: dueAt,
          confirmedDueAt: dueAt,
          status: "confirmed",
          sourceType: "manual",
          sourceId: row.id,
          responsibleMembershipId: input.ownerMembershipId ?? actor.membershipId,
          createdByMembershipId: actor.membershipId,
        })
        .returning();
      deadlineId = deadline?.id ?? null;
    }

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "control.obligation_created",
      resourceType: "compliance_obligation",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { deadlineId },
    });

    return {
      obligation: {
        id: row.id,
        title: row.title,
        source: row.source,
        authority: row.authority,
        frequency: row.frequency,
        dueAt: iso(row.dueAt),
        status: row.status,
        createdAt: iso(row.createdAt),
      },
      deadlineId,
    };
  });
}

export async function listComplianceIncidents(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyComplianceIncident(a, "control.compliance.read"),
  );
  const rows = await db
    .select()
    .from(complianceIncidents)
    .where(eq(complianceIncidents.organizationId, organizationId))
    .orderBy(desc(complianceIncidents.detectedAt))
    .limit(100);
  return {
    incidents: rows.map((r) => ({
      id: r.id,
      type: r.type,
      severity: r.severity,
      title: r.title,
      status: r.status,
      detectedAt: iso(r.detectedAt),
    })),
  };
}

export async function complianceObligationReminderJob(db: AppDatabase, organizationId: string) {
  const rows = await db
    .select()
    .from(complianceObligations)
    .where(
      and(
        eq(complianceObligations.organizationId, organizationId),
        eq(complianceObligations.status, "open"),
      ),
    );
  return { open: rows.length };
}
