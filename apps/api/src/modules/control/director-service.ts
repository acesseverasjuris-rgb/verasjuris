import { recordAudit } from "@verasjuris/audit";
import { policyInternalControl, type SessionAccount } from "@verasjuris/auth";
import {
  controlApprovalDecisions,
  controlApprovalRequests,
  controlEmployees,
  controlGoals,
  controlKpiSnapshots,
  controlKpis,
  complianceIncidents,
  complianceRisks,
  controlVendors,
  isUniqueViolation,
  productBugs,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import { authorizeControl, mapApprovalPolicy, requireDate } from "./internal-org.js";

function serializeGoal(row: typeof controlGoals.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    title: row.title,
    description: row.description,
    ownerMembershipId: row.ownerMembershipId,
    area: row.area,
    periodStart: iso(row.periodStart),
    periodEnd: iso(row.periodEnd),
    targetType: row.targetType,
    targetValue: row.targetValue,
    currentValueSource: row.currentValueSource,
    status: row.status,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializeKpi(row: typeof controlKpis.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    key: row.key,
    name: row.name,
    description: row.description,
    unit: row.unit,
    direction: row.direction,
    sourceType: row.sourceType,
    sourceConfig: row.sourceConfig,
    targetValue: row.targetValue,
    warningThreshold: row.warningThreshold,
    criticalThreshold: row.criticalThreshold,
    active: row.active,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializeApproval(row: typeof controlApprovalRequests.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    type: row.type,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    requestedByMembershipId: row.requestedByMembershipId,
    approverPolicy: row.approverPolicy === "threshold_based" ? "threshold" : row.approverPolicy,
    status: row.status,
    requestedAt: iso(row.requestedAt),
    decidedAt: iso(row.decidedAt),
    metadata: row.metadata,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function requireGoal(db: AppDatabase, organizationId: string, goalId: string) {
  const [row] = await db
    .select()
    .from(controlGoals)
    .where(and(eq(controlGoals.id, goalId), eq(controlGoals.organizationId, organizationId)))
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos esta meta no seu acesso.");
  return row;
}

async function requireKpi(db: AppDatabase, organizationId: string, kpiId: string) {
  const [row] = await db
    .select()
    .from(controlKpis)
    .where(and(eq(controlKpis.id, kpiId), eq(controlKpis.organizationId, organizationId)))
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este KPI no seu acesso.");
  return row;
}

async function requireApproval(db: AppDatabase, organizationId: string, requestId: string) {
  const [row] = await db
    .select()
    .from(controlApprovalRequests)
    .where(
      and(
        eq(controlApprovalRequests.id, requestId),
        eq(controlApprovalRequests.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos esta aprovação no seu acesso.");
  return row;
}

/** Resolve KPI value from internal counts — never invents; only known query keys. */
async function computeInternalKpiValue(
  db: AppDatabase,
  organizationId: string,
  sourceConfig: Record<string, unknown> | null,
): Promise<{ value: string; source: string }> {
  const queryKey =
    typeof sourceConfig?.queryKey === "string" ? sourceConfig.queryKey : "employee_count";
  if (queryKey === "employee_count") {
    const [row] = await db
      .select({ value: count() })
      .from(controlEmployees)
      .where(
        and(
          eq(controlEmployees.organizationId, organizationId),
          eq(controlEmployees.status, "active"),
        ),
      );
    return { value: String(row?.value ?? 0), source: "internal_query:employee_count" };
  }
  if (queryKey === "open_incidents") {
    const [row] = await db
      .select({ value: count() })
      .from(complianceIncidents)
      .where(
        and(
          eq(complianceIncidents.organizationId, organizationId),
          sql`${complianceIncidents.status} <> 'closed'`,
        ),
      );
    return { value: String(row?.value ?? 0), source: "internal_query:open_incidents" };
  }
  if (queryKey === "active_vendors") {
    const [row] = await db
      .select({ value: count() })
      .from(controlVendors)
      .where(
        and(eq(controlVendors.organizationId, organizationId), eq(controlVendors.status, "active")),
      );
    return { value: String(row?.value ?? 0), source: "internal_query:active_vendors" };
  }
  if (queryKey === "open_bugs") {
    const [row] = await db
      .select({ value: count() })
      .from(productBugs)
      .where(
        and(
          eq(productBugs.organizationId, organizationId),
          sql`${productBugs.status} not in ('closed', 'wont_fix', 'verified')`,
        ),
      );
    return { value: String(row?.value ?? 0), source: "internal_query:open_bugs" };
  }
  if (queryKey === "open_risks") {
    const [row] = await db
      .select({ value: count() })
      .from(complianceRisks)
      .where(
        and(
          eq(complianceRisks.organizationId, organizationId),
          sql`${complianceRisks.status} in ('open', 'monitoring')`,
        ),
      );
    return { value: String(row?.value ?? 0), source: "internal_query:open_risks" };
  }
  throw new AppError(
    "VALIDATION_ERROR",
    "Consulta interna de KPI não suportada. Configure um queryKey conhecido.",
  );
}

export async function listControlGoals(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number; status?: string; area?: string },
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyInternalControl(a, "control.read"),
  );
  const filters = [eq(controlGoals.organizationId, organizationId)];
  if (query.status) {
    filters.push(eq(controlGoals.status, query.status as typeof controlGoals.$inferSelect.status));
  }
  if (query.area) filters.push(eq(controlGoals.area, query.area));
  const rows = await db
    .select()
    .from(controlGoals)
    .where(and(...filters))
    .orderBy(desc(controlGoals.updatedAt))
    .limit(query.limit)
    .offset(query.offset);
  return { goals: rows.map(serializeGoal) };
}

export async function createControlGoal(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    title: string;
    description?: string;
    ownerMembershipId?: string;
    area?: string;
    periodStart: string;
    periodEnd: string;
    targetType: string;
    targetValue?: string;
    currentValueSource?: string;
    status?: typeof controlGoals.$inferSelect.status;
  },
  meta: RequestMeta,
) {
  const actor = await authorizeControl(db, account, organizationId, (a) =>
    policyInternalControl(a, "control.director.manage"),
  );
  const targetType = (
    ["absolute", "percentage", "currency", "count", "custom"].includes(input.targetType)
      ? input.targetType
      : "custom"
  ) as typeof controlGoals.$inferSelect.targetType;
  const [row] = await db
    .insert(controlGoals)
    .values({
      organizationId,
      title: input.title,
      description: input.description ?? null,
      ownerMembershipId: input.ownerMembershipId ?? null,
      area: input.area ?? null,
      periodStart: requireDate(input.periodStart),
      periodEnd: requireDate(input.periodEnd),
      targetType,
      targetValue: input.targetValue ?? null,
      currentValueSource: input.currentValueSource ?? null,
      status: input.status ?? "draft",
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a meta.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "control.goal_created",
    resourceType: "control_goal",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: serializeGoal(row),
  });
  return { goal: serializeGoal(row), actorMembershipId: actor.membershipId };
}

export async function updateControlGoal(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  goalId: string,
  input: Partial<{
    title: string;
    description: string;
    ownerMembershipId: string;
    area: string;
    periodStart: string;
    periodEnd: string;
    targetType: string;
    targetValue: string;
    currentValueSource: string;
    status: typeof controlGoals.$inferSelect.status;
  }>,
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyInternalControl(a, "control.director.manage"),
  );
  const existing = await requireGoal(db, organizationId, goalId);
  const patch: Partial<typeof controlGoals.$inferInsert> = { updatedAt: new Date() };
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.ownerMembershipId !== undefined) patch.ownerMembershipId = input.ownerMembershipId;
  if (input.area !== undefined) patch.area = input.area;
  if (input.periodStart !== undefined) patch.periodStart = requireDate(input.periodStart);
  if (input.periodEnd !== undefined) patch.periodEnd = requireDate(input.periodEnd);
  if (input.targetType !== undefined) {
    patch.targetType = (
      ["absolute", "percentage", "currency", "count", "custom"].includes(input.targetType)
        ? input.targetType
        : existing.targetType
    ) as typeof controlGoals.$inferSelect.targetType;
  }
  if (input.targetValue !== undefined) patch.targetValue = input.targetValue;
  if (input.currentValueSource !== undefined) patch.currentValueSource = input.currentValueSource;
  if (input.status !== undefined) patch.status = input.status;
  const [row] = await db
    .update(controlGoals)
    .set(patch)
    .where(eq(controlGoals.id, goalId))
    .returning();
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos esta meta no seu acesso.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "control.goal_updated",
    resourceType: "control_goal",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    before: serializeGoal(existing),
    after: serializeGoal(row),
  });
  return { goal: serializeGoal(row) };
}

export async function listControlKpis(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number; active?: boolean; sourceType?: string },
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyInternalControl(a, "control.read"),
  );
  const filters = [eq(controlKpis.organizationId, organizationId)];
  if (query.active !== undefined) filters.push(eq(controlKpis.active, query.active));
  if (query.sourceType) {
    filters.push(
      eq(controlKpis.sourceType, query.sourceType as typeof controlKpis.$inferSelect.sourceType),
    );
  }
  const rows = await db
    .select()
    .from(controlKpis)
    .where(and(...filters))
    .orderBy(controlKpis.name)
    .limit(query.limit)
    .offset(query.offset);
  return { kpis: rows.map(serializeKpi) };
}

export async function createControlKpi(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    key: string;
    name: string;
    description?: string;
    unit?: string;
    direction: typeof controlKpis.$inferSelect.direction;
    sourceType: typeof controlKpis.$inferSelect.sourceType;
    sourceConfig?: Record<string, unknown>;
    targetValue?: string;
    warningThreshold?: string;
    criticalThreshold?: string;
    active?: boolean;
  },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyInternalControl(a, "control.director.manage"),
  );
  try {
    const [row] = await db
      .insert(controlKpis)
      .values({
        organizationId,
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        unit: input.unit ?? null,
        direction: input.direction,
        sourceType: input.sourceType,
        sourceConfig: input.sourceConfig ?? null,
        targetValue: input.targetValue ?? null,
        warningThreshold: input.warningThreshold ?? null,
        criticalThreshold: input.criticalThreshold ?? null,
        active: input.active ?? true,
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o KPI.");
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "control.kpi_created",
      resourceType: "control_kpi",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: serializeKpi(row),
    });
    return { kpi: serializeKpi(row) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Já existe um KPI com esta chave nesta organização.");
    }
    throw error;
  }
}

export async function refreshControlKpiSnapshot(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  kpiId: string,
  input: { period: string; value?: string },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyInternalControl(a, "control.director.manage"),
  );
  const kpi = await requireKpi(db, organizationId, kpiId);
  let value: string;
  let source: string;
  if (kpi.sourceType === "internal_query") {
    if (input.value !== undefined) {
      throw new AppError(
        "VALIDATION_ERROR",
        "KPI automático (internal_query) não aceita valor manual. O servidor calcula o snapshot.",
      );
    }
    const computed = await computeInternalKpiValue(db, organizationId, kpi.sourceConfig);
    value = computed.value;
    source = computed.source;
  } else if (kpi.sourceType === "manual") {
    if (input.value === undefined) {
      throw new AppError("VALIDATION_ERROR", "Informe o valor para KPI manual.");
    }
    value = input.value;
    source = "manual";
  } else {
    throw new AppError(
      "NOT_CONFIGURED",
      "Provedor externo de KPI não está configurado. Use sourceType manual ou internal_query.",
    );
  }
  const [snapshot] = await db
    .insert(controlKpiSnapshots)
    .values({
      kpiId: kpi.id,
      period: input.period,
      value,
      source,
      calculatedAt: new Date(),
      metadata: { formulaVersion: "kpi.snapshot.v1" },
    })
    .returning();
  if (!snapshot) throw new AppError("INTERNAL_ERROR", "Não foi possível gravar o snapshot.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "control.kpi_snapshot_refreshed",
    resourceType: "control_kpi_snapshot",
    resourceId: snapshot.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: {
      id: snapshot.id,
      kpiId: snapshot.kpiId,
      period: snapshot.period,
      value: snapshot.value,
      source: snapshot.source,
    },
  });
  return {
    snapshot: {
      id: snapshot.id,
      kpiId: snapshot.kpiId,
      period: snapshot.period,
      value: snapshot.value,
      source: snapshot.source,
      calculatedAt: iso(snapshot.calculatedAt),
    },
    kpi: serializeKpi(kpi),
  };
}

export async function listControlApprovals(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number; status?: string; type?: string },
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyInternalControl(a, "control.read"),
  );
  const filters = [eq(controlApprovalRequests.organizationId, organizationId)];
  if (query.status) {
    filters.push(
      eq(
        controlApprovalRequests.status,
        query.status as typeof controlApprovalRequests.$inferSelect.status,
      ),
    );
  }
  if (query.type) filters.push(eq(controlApprovalRequests.type, query.type));
  const rows = await db
    .select()
    .from(controlApprovalRequests)
    .where(and(...filters))
    .orderBy(desc(controlApprovalRequests.requestedAt))
    .limit(query.limit)
    .offset(query.offset);
  return { approvals: rows.map(serializeApproval) };
}

export async function createControlApprovalRequest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    type: string;
    referenceType: string;
    referenceId: string;
    approverPolicy: "single" | "sequential" | "parallel" | "threshold";
    comment?: string;
  },
  meta: RequestMeta,
) {
  const actor = await authorizeControl(db, account, organizationId, (a) =>
    policyInternalControl(a, "control.approval.manage"),
  );
  const [row] = await db
    .insert(controlApprovalRequests)
    .values({
      organizationId,
      type: input.type,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      requestedByMembershipId: actor.membershipId,
      approverPolicy: mapApprovalPolicy(input.approverPolicy),
      status: "pending",
      metadata: input.comment ? { comment: input.comment } : null,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a aprovação.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "control.approval_requested",
    resourceType: "control_approval_request",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: serializeApproval(row),
  });
  return { approval: serializeApproval(row) };
}

export async function decideControlApproval(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  requestId: string,
  input: { decision: "approved" | "rejected"; comment?: string },
  meta: RequestMeta,
) {
  const actor = await authorizeControl(db, account, organizationId, (a) =>
    policyInternalControl(a, "control.approval.manage"),
  );

  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(controlApprovalRequests)
      .where(
        and(
          eq(controlApprovalRequests.id, requestId),
          eq(controlApprovalRequests.organizationId, organizationId),
        ),
      )
      .for("update")
      .limit(1);
    if (!locked) throw new AppError("NOT_FOUND", "Não encontramos esta aprovação no seu acesso.");
    if (!["pending", "partially_approved"].includes(locked.status)) {
      throw new AppError(
        "CONFLICT",
        "Esta solicitação de aprovação já foi finalizada. Nenhum dado foi alterado.",
      );
    }

    try {
      await tx.insert(controlApprovalDecisions).values({
        requestId: locked.id,
        approverMembershipId: actor.membershipId,
        decision: input.decision,
        comment: input.comment ?? null,
        decidedAt: new Date(),
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(
          "CONFLICT",
          "Você já registrou uma decisão nesta aprovação. Nenhum dado foi alterado.",
        );
      }
      throw error;
    }

    const decisions = await tx
      .select()
      .from(controlApprovalDecisions)
      .where(eq(controlApprovalDecisions.requestId, locked.id));

    let nextStatus: typeof controlApprovalRequests.$inferSelect.status = locked.status;
    if (input.decision === "rejected") {
      nextStatus = "rejected";
    } else if (locked.approverPolicy === "single") {
      nextStatus = "approved";
    } else if (locked.approverPolicy === "sequential" || locked.approverPolicy === "parallel") {
      const threshold =
        typeof locked.metadata?.requiredApprovals === "number"
          ? locked.metadata.requiredApprovals
          : 1;
      const approvedCount = decisions.filter((d) => d.decision === "approved").length;
      nextStatus = approvedCount >= threshold ? "approved" : "partially_approved";
    } else if (locked.approverPolicy === "threshold_based") {
      const threshold =
        typeof locked.metadata?.requiredApprovals === "number"
          ? locked.metadata.requiredApprovals
          : 2;
      const approvedCount = decisions.filter((d) => d.decision === "approved").length;
      nextStatus = approvedCount >= threshold ? "approved" : "partially_approved";
    }

    const [updated] = await tx
      .update(controlApprovalRequests)
      .set({
        status: nextStatus,
        decidedAt: ["approved", "rejected"].includes(nextStatus) ? new Date() : locked.decidedAt,
        updatedAt: new Date(),
      })
      .where(eq(controlApprovalRequests.id, locked.id))
      .returning();
    if (!updated) throw new AppError("INTERNAL_ERROR", "Falha ao atualizar aprovação.");

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "control.approval_decided",
      resourceType: "control_approval_request",
      resourceId: updated.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: serializeApproval(locked),
      after: serializeApproval(updated),
      metadata: { decision: input.decision },
    });

    return {
      approval: serializeApproval(updated),
      decisions: decisions.map((d) => ({
        id: d.id,
        approverMembershipId: d.approverMembershipId,
        decision: d.decision,
        comment: d.comment,
        decidedAt: iso(d.decidedAt),
      })),
    };
  });
}

export async function getDirectorDashboard(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyInternalControl(a, "control.read"),
  );

  const [goalsActive] = await db
    .select({ value: count() })
    .from(controlGoals)
    .where(
      and(
        eq(controlGoals.organizationId, organizationId),
        sql`${controlGoals.status} in ('active', 'at_risk')`,
      ),
    );
  const [kpisActive] = await db
    .select({ value: count() })
    .from(controlKpis)
    .where(and(eq(controlKpis.organizationId, organizationId), eq(controlKpis.active, true)));
  const [approvalsPending] = await db
    .select({ value: count() })
    .from(controlApprovalRequests)
    .where(
      and(
        eq(controlApprovalRequests.organizationId, organizationId),
        sql`${controlApprovalRequests.status} in ('pending', 'partially_approved')`,
      ),
    );
  const [employeesActive] = await db
    .select({ value: count() })
    .from(controlEmployees)
    .where(
      and(
        eq(controlEmployees.organizationId, organizationId),
        eq(controlEmployees.status, "active"),
      ),
    );
  const [incidentsOpen] = await db
    .select({ value: count() })
    .from(complianceIncidents)
    .where(
      and(
        eq(complianceIncidents.organizationId, organizationId),
        sql`${complianceIncidents.status} <> 'closed'`,
      ),
    );
  const [vendorsActive] = await db
    .select({ value: count() })
    .from(controlVendors)
    .where(
      and(eq(controlVendors.organizationId, organizationId), eq(controlVendors.status, "active")),
    );
  const [bugsOpen] = await db
    .select({ value: count() })
    .from(productBugs)
    .where(
      and(
        eq(productBugs.organizationId, organizationId),
        sql`${productBugs.status} not in ('closed', 'wont_fix')`,
      ),
    );

  return {
    dashboard: {
      goalsActive: goalsActive?.value ?? 0,
      kpisActive: kpisActive?.value ?? 0,
      approvalsPending: approvalsPending?.value ?? 0,
      employeesActive: employeesActive?.value ?? 0,
      incidentsOpen: incidentsOpen?.value ?? 0,
      vendorsActive: vendorsActive?.value ?? 0,
      bugsOpen: bugsOpen?.value ?? 0,
      generatedAt: new Date().toISOString(),
    },
  };
}

export async function refreshGoalProgressJob(db: AppDatabase, organizationId: string) {
  const goals = await db
    .select()
    .from(controlGoals)
    .where(
      and(
        eq(controlGoals.organizationId, organizationId),
        sql`${controlGoals.status} in ('active', 'at_risk')`,
      ),
    );
  return { refreshed: goals.length };
}

export async function refreshKpiJob(db: AppDatabase, organizationId: string, kpiId?: string) {
  const filters = [
    eq(controlKpis.organizationId, organizationId),
    eq(controlKpis.sourceType, "internal_query"),
    eq(controlKpis.active, true),
  ];
  if (kpiId) filters.push(eq(controlKpis.id, kpiId));
  const kpis = await db
    .select()
    .from(controlKpis)
    .where(and(...filters));
  const period = new Date().toISOString().slice(0, 7);
  let refreshed = 0;
  for (const kpi of kpis) {
    const computed = await computeInternalKpiValue(db, organizationId, kpi.sourceConfig);
    await db.insert(controlKpiSnapshots).values({
      kpiId: kpi.id,
      period,
      value: computed.value,
      source: computed.source,
      calculatedAt: new Date(),
      metadata: { formulaVersion: "kpi.snapshot.v1", job: true },
    });
    refreshed += 1;
  }
  return { refreshed };
}
