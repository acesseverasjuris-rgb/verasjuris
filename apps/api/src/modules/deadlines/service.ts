import { recordAudit } from "@verasjuris/audit";
import {
  assertDeadlineMutable,
  assertDeadlineTransition,
  policyDeadline,
  type DeadlineStatus,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  deadlineAlertDispatches,
  deadlineAlertRules,
  deadlineEscalationRules,
  deadlineHistoryEvents,
  deadlines,
  notifications,
  organizationMembers,
  type AppDatabase,
} from "@verasjuris/database";
import {
  calculateDeadlineDueAt,
  type HolidayCalendarProvider,
  type NotificationProvider,
} from "@verasjuris/notifications";
import { AppError } from "@verasjuris/types";
import { and, asc, count, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import type { RequestMeta } from "../auth/service.js";

type DbTx = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

export type DeadlineModuleDeps = {
  notifications: NotificationProvider;
  holidays: HolidayCalendarProvider;
};

function membershipOf(account: SessionAccount, organizationId: string) {
  return account.memberships.find((item) => item.organizationId === organizationId) ?? null;
}

function accessOf(account: SessionAccount, organizationId: string) {
  const membership = membershipOf(account, organizationId);
  return membership
    ? {
        status: membership.membershipStatus,
        organizationStatus: membership.organizationStatus,
        permissions: membership.permissions,
        roles: membership.roles,
      }
    : null;
}

function requireDeadlinePermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyDeadline>[1],
) {
  const decision = policyDeadline(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function serializeDeadline(
  row: typeof deadlines.$inferSelect,
  extras?: { calculationNotes?: string },
) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    title: row.title,
    description: row.description,
    baseDate: row.baseDate.toISOString(),
    baseDateLabel: row.baseDateLabel,
    ruleType: row.ruleType,
    ruleDescription: row.ruleDescription,
    ruleDays: row.ruleDays,
    calculatedAt: row.calculatedAt?.toISOString() ?? null,
    calculatedDueAt: row.calculatedDueAt?.toISOString() ?? null,
    confirmedDueAt: row.confirmedDueAt?.toISOString() ?? null,
    status: row.status,
    timezone: row.timezone,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    legalMatterId: row.legalMatterId,
    judicialProcessId: row.judicialProcessId,
    administrativeProcessId: row.administrativeProcessId,
    responsibleMembershipId: row.responsibleMembershipId,
    confirmedByMembershipId: row.confirmedByMembershipId,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    createdByMembershipId: row.createdByMembershipId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    holidayCalendar: "NOT_CONFIGURED" as const,
    microcopy:
      row.status === "confirmed"
        ? "Prazo confirmado por conferência humana."
        : "Prazo sugerido — confirme a regra e o termo inicial antes de tratar como definitivo.",
    calculationNotes: extras?.calculationNotes,
  };
}

async function requireDeadline(db: AppDatabase | DbTx, organizationId: string, deadlineId: string) {
  const row = await db.query.deadlines.findFirst({
    where: and(eq(deadlines.id, deadlineId), eq(deadlines.organizationId, organizationId)),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este prazo no seu acesso.");
  return row;
}

async function appendHistory(
  tx: DbTx,
  input: {
    organizationId: string;
    deadlineId: string;
    eventType: string;
    title: string;
    summary?: string;
    previousValue?: string;
    newValue?: string;
    reason?: string;
    actorMembershipId?: string | null;
  },
) {
  await tx.insert(deadlineHistoryEvents).values({
    organizationId: input.organizationId,
    deadlineId: input.deadlineId,
    eventType: input.eventType,
    title: input.title,
    summary: input.summary ?? null,
    previousValue: input.previousValue ?? null,
    newValue: input.newValue ?? null,
    reason: input.reason ?? null,
    actorMembershipId: input.actorMembershipId ?? null,
  });
}

async function persistInAppNotification(
  tx: DbTx,
  deps: DeadlineModuleDeps,
  message: {
    organizationId: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    resourceType?: string;
    resourceId?: string;
  },
) {
  const result = await deps.notifications.send({ ...message, channel: "in_app" });
  if (result.status === "not_configured") {
    return { status: "not_configured" as const, notificationId: null };
  }
  const [row] = await tx
    .insert(notifications)
    .values({
      organizationId: message.organizationId,
      userId: message.userId,
      type: message.type,
      title: message.title,
      message: message.message,
      resourceType: message.resourceType ?? null,
      resourceId: message.resourceId ?? null,
    })
    .returning();
  return { status: "queued" as const, notificationId: row?.id ?? null };
}

export async function listDeadlines(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    q?: string;
    status?: DeadlineStatus;
    sourceType?: typeof deadlines.$inferSelect.sourceType;
    responsibleMembershipId?: string;
    legalMatterId?: string;
    judicialProcessId?: string;
    administrativeProcessId?: string;
    from?: string;
    to?: string;
    limit: number;
    offset: number;
  },
) {
  requireDeadlinePermission(account, organizationId, "deadline.read");
  const conditions = [eq(deadlines.organizationId, organizationId)];
  if (query.status) conditions.push(eq(deadlines.status, query.status));
  if (query.sourceType) conditions.push(eq(deadlines.sourceType, query.sourceType));
  if (query.responsibleMembershipId) {
    conditions.push(eq(deadlines.responsibleMembershipId, query.responsibleMembershipId));
  }
  if (query.legalMatterId) conditions.push(eq(deadlines.legalMatterId, query.legalMatterId));
  if (query.judicialProcessId) {
    conditions.push(eq(deadlines.judicialProcessId, query.judicialProcessId));
  }
  if (query.administrativeProcessId) {
    conditions.push(eq(deadlines.administrativeProcessId, query.administrativeProcessId));
  }
  if (query.from) {
    conditions.push(
      or(
        gte(deadlines.confirmedDueAt, new Date(query.from)),
        gte(deadlines.calculatedDueAt, new Date(query.from)),
      )!,
    );
  }
  if (query.to) {
    conditions.push(
      or(
        lte(deadlines.confirmedDueAt, new Date(query.to)),
        lte(deadlines.calculatedDueAt, new Date(query.to)),
      )!,
    );
  }
  if (query.q) {
    conditions.push(
      or(ilike(deadlines.title, `%${query.q}%`), ilike(deadlines.description, `%${query.q}%`))!,
    );
  }
  const where = and(...conditions);
  const [rows, totalRow] = await Promise.all([
    db.query.deadlines.findMany({
      where,
      orderBy: [desc(deadlines.updatedAt)],
      limit: query.limit,
      offset: query.offset,
    }),
    db.select({ value: count() }).from(deadlines).where(where),
  ]);
  return {
    deadlines: rows.map((r) => serializeDeadline(r)),
    total: totalRow[0]?.value ?? 0,
    holidayCalendar: "NOT_CONFIGURED" as const,
  };
}

export async function getDeadline(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  deadlineId: string,
) {
  requireDeadlinePermission(account, organizationId, "deadline.read");
  const row = await requireDeadline(db, organizationId, deadlineId);
  const history = await db.query.deadlineHistoryEvents.findMany({
    where: and(
      eq(deadlineHistoryEvents.deadlineId, deadlineId),
      eq(deadlineHistoryEvents.organizationId, organizationId),
    ),
    orderBy: [desc(deadlineHistoryEvents.eventAt)],
    limit: 100,
  });
  return {
    deadline: serializeDeadline(row),
    history: history.map((h) => ({
      id: h.id,
      eventType: h.eventType,
      title: h.title,
      summary: h.summary,
      previousValue: h.previousValue,
      newValue: h.newValue,
      reason: h.reason,
      eventAt: h.eventAt.toISOString(),
    })),
  };
}

export async function createDeadline(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    title: string;
    description?: string;
    baseDate: string;
    baseDateLabel?: string;
    ruleType?: typeof deadlines.$inferInsert.ruleType;
    ruleDescription?: string;
    ruleDays?: number;
    manualDueAt?: string;
    timezone?: string;
    sourceType?: typeof deadlines.$inferInsert.sourceType;
    sourceId?: string;
    legalMatterId?: string;
    judicialProcessId?: string;
    administrativeProcessId?: string;
    responsibleMembershipId?: string;
    status?: "draft" | "suggested" | "pending_confirmation";
    calculate?: boolean;
  },
  deps: DeadlineModuleDeps,
  meta: RequestMeta,
) {
  const actor = requireDeadlinePermission(account, organizationId, "deadline.create");
  const timezone = input.timezone ?? "America/Sao_Paulo";
  const ruleType = input.ruleType ?? "manual_date";
  let calculatedDueAt: Date | null = null;
  let status: DeadlineStatus = input.status ?? "draft";
  let calculationNotes: string | undefined;

  if (input.calculate !== false && (ruleType !== "manual_date" || input.manualDueAt)) {
    requireDeadlinePermission(account, organizationId, "deadline.calculate");
    const calc = await calculateDeadlineDueAt(
      {
        baseDate: new Date(input.baseDate),
        ruleType,
        ruleDays: input.ruleDays,
        timezone,
        manualDueAt: input.manualDueAt ? new Date(input.manualDueAt) : null,
      },
      deps.holidays,
    );
    calculatedDueAt = calc.calculatedDueAt;
    status = calc.status === "pending_confirmation" ? "pending_confirmation" : "suggested";
    calculationNotes = calc.notes;
    if (deps.holidays.status === "NOT_CONFIGURED" && ruleType === "business_days") {
      calculationNotes = `${calc.notes} [holidayCalendar=NOT_CONFIGURED]`;
    }
  }

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(deadlines)
      .values({
        organizationId,
        title: input.title,
        description: input.description ?? null,
        baseDate: new Date(input.baseDate),
        baseDateLabel: input.baseDateLabel ?? null,
        ruleType,
        ruleDescription: input.ruleDescription ?? null,
        ruleDays: input.ruleDays ?? null,
        calculatedAt: calculatedDueAt ? new Date() : null,
        calculatedDueAt,
        status,
        timezone,
        sourceType: input.sourceType ?? "manual",
        sourceId: input.sourceId ?? null,
        legalMatterId: input.legalMatterId ?? null,
        judicialProcessId: input.judicialProcessId ?? null,
        administrativeProcessId: input.administrativeProcessId ?? null,
        responsibleMembershipId: input.responsibleMembershipId ?? null,
        createdByMembershipId: actor.membershipId,
      })
      .returning();
    if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o prazo.");

    await appendHistory(tx, {
      organizationId,
      deadlineId: created.id,
      eventType: "deadline.created",
      title: `Prazo criado: ${created.title}`,
      actorMembershipId: actor.membershipId,
      summary: calculationNotes,
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "deadline.created",
      resourceType: "deadline",
      resourceId: created.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { status: created.status, title: created.title },
    });
    return serializeDeadline(created, { calculationNotes });
  });
}

export async function calculateDeadline(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  deadlineId: string,
  input: {
    baseDate?: string;
    ruleType?: typeof deadlines.$inferInsert.ruleType;
    ruleDays?: number;
    manualDueAt?: string;
    timezone?: string;
  },
  deps: DeadlineModuleDeps,
  meta: RequestMeta,
) {
  const actor = requireDeadlinePermission(account, organizationId, "deadline.calculate");
  const existing = await requireDeadline(db, organizationId, deadlineId);
  if (existing.status === "confirmed" || existing.status === "completed") {
    throw new AppError(
      "CONFLICT",
      "Prazo confirmado não pode ser recalculado sem alteração com histórico.",
    );
  }

  const ruleType = input.ruleType ?? existing.ruleType;
  const calc = await calculateDeadlineDueAt(
    {
      baseDate: input.baseDate ? new Date(input.baseDate) : existing.baseDate,
      ruleType,
      ruleDays: input.ruleDays ?? existing.ruleDays,
      timezone: input.timezone ?? existing.timezone,
      manualDueAt: input.manualDueAt ? new Date(input.manualDueAt) : existing.calculatedDueAt,
    },
    deps.holidays,
  );

  const nextStatus: DeadlineStatus =
    calc.status === "pending_confirmation" ? "pending_confirmation" : "suggested";
  assertDeadlineTransition(existing.status as DeadlineStatus, nextStatus);

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(deadlines)
      .set({
        baseDate: input.baseDate ? new Date(input.baseDate) : existing.baseDate,
        ruleType,
        ruleDays: input.ruleDays === undefined ? existing.ruleDays : input.ruleDays,
        timezone: input.timezone ?? existing.timezone,
        calculatedAt: new Date(),
        calculatedDueAt: calc.calculatedDueAt,
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(deadlines.id, deadlineId))
      .returning();
    if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível calcular o prazo.");
    await appendHistory(tx, {
      organizationId,
      deadlineId,
      eventType: "deadline.calculated",
      title: "Prazo recalculado (sugerido)",
      summary: calc.notes,
      actorMembershipId: actor.membershipId,
      newValue: calc.calculatedDueAt?.toISOString(),
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "deadline.calculated",
      resourceType: "deadline",
      resourceId: deadlineId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { status: updated.status, holidayCalendar: deps.holidays.status },
    });
    return serializeDeadline(updated, { calculationNotes: calc.notes });
  });
}

export async function confirmDeadline(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  deadlineId: string,
  input: { confirmedDueAt?: string; notes?: string },
  deps: DeadlineModuleDeps,
  meta: RequestMeta,
) {
  const actor = requireDeadlinePermission(account, organizationId, "deadline.confirm");
  const existing = await requireDeadline(db, organizationId, deadlineId);
  assertDeadlineTransition(existing.status as DeadlineStatus, "confirmed");
  const confirmedDueAt = input.confirmedDueAt
    ? new Date(input.confirmedDueAt)
    : existing.calculatedDueAt;
  if (!confirmedDueAt) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Informe a data confirmada ou calcule o prazo sugerido antes de confirmar.",
    );
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(deadlines)
      .set({
        confirmedDueAt,
        status: "confirmed",
        confirmedByMembershipId: actor.membershipId,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(deadlines.id, deadlineId))
      .returning();
    if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível confirmar o prazo.");
    await appendHistory(tx, {
      organizationId,
      deadlineId,
      eventType: "deadline.confirmed",
      title: "Prazo confirmado",
      summary: input.notes,
      previousValue: existing.calculatedDueAt?.toISOString(),
      newValue: confirmedDueAt.toISOString(),
      actorMembershipId: actor.membershipId,
    });

    if (existing.responsibleMembershipId) {
      const member = await tx.query.organizationMembers.findFirst({
        where: eq(organizationMembers.id, existing.responsibleMembershipId),
      });
      if (member) {
        await persistInAppNotification(tx, deps, {
          organizationId,
          userId: member.userId,
          type: "deadline.confirmed",
          title: `Prazo confirmado: ${updated.title}`,
          message: `Vencimento confirmado em ${confirmedDueAt.toISOString()}.`,
          resourceType: "deadline",
          resourceId: deadlineId,
        });
      }
    }

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "deadline.confirmed",
      resourceType: "deadline",
      resourceId: deadlineId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { confirmedDueAt: confirmedDueAt.toISOString() },
    });
    return serializeDeadline(updated);
  });
}

export async function changeDeadlineWithHistory(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  deadlineId: string,
  input: { confirmedDueAt: string; reason: string },
  meta: RequestMeta,
) {
  const actor = requireDeadlinePermission(account, organizationId, "deadline.update");
  const existing = await requireDeadline(db, organizationId, deadlineId);
  assertDeadlineMutable(existing.status as DeadlineStatus, "change_date");
  const next = new Date(input.confirmedDueAt);

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(deadlines)
      .set({
        confirmedDueAt: next,
        updatedAt: new Date(),
      })
      .where(eq(deadlines.id, deadlineId))
      .returning();
    if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível alterar o prazo.");
    await appendHistory(tx, {
      organizationId,
      deadlineId,
      eventType: "deadline.changed",
      title: "Data confirmada alterada",
      reason: input.reason,
      previousValue: existing.confirmedDueAt?.toISOString(),
      newValue: next.toISOString(),
      actorMembershipId: actor.membershipId,
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "deadline.changed",
      resourceType: "deadline",
      resourceId: deadlineId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { confirmedDueAt: next.toISOString(), reason: input.reason },
    });
    return serializeDeadline(updated);
  });
}

export async function updateDeadline(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  deadlineId: string,
  input: {
    title?: string;
    description?: string | null;
    baseDate?: string;
    baseDateLabel?: string | null;
    ruleType?: typeof deadlines.$inferInsert.ruleType;
    ruleDescription?: string | null;
    ruleDays?: number | null;
    timezone?: string;
    responsibleMembershipId?: string | null;
    legalMatterId?: string | null;
    judicialProcessId?: string | null;
    administrativeProcessId?: string | null;
  },
  meta: RequestMeta,
) {
  const actor = requireDeadlinePermission(account, organizationId, "deadline.update");
  const existing = await requireDeadline(db, organizationId, deadlineId);
  assertDeadlineMutable(existing.status as DeadlineStatus, "update");
  if (input.responsibleMembershipId !== undefined) {
    requireDeadlinePermission(account, organizationId, "deadline.assign");
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(deadlines)
      .set({
        title: input.title ?? existing.title,
        description: input.description === undefined ? existing.description : input.description,
        baseDate: input.baseDate ? new Date(input.baseDate) : existing.baseDate,
        baseDateLabel:
          input.baseDateLabel === undefined ? existing.baseDateLabel : input.baseDateLabel,
        ruleType: input.ruleType ?? existing.ruleType,
        ruleDescription:
          input.ruleDescription === undefined ? existing.ruleDescription : input.ruleDescription,
        ruleDays: input.ruleDays === undefined ? existing.ruleDays : input.ruleDays,
        timezone: input.timezone ?? existing.timezone,
        responsibleMembershipId:
          input.responsibleMembershipId === undefined
            ? existing.responsibleMembershipId
            : input.responsibleMembershipId,
        legalMatterId:
          input.legalMatterId === undefined ? existing.legalMatterId : input.legalMatterId,
        judicialProcessId:
          input.judicialProcessId === undefined
            ? existing.judicialProcessId
            : input.judicialProcessId,
        administrativeProcessId:
          input.administrativeProcessId === undefined
            ? existing.administrativeProcessId
            : input.administrativeProcessId,
        updatedAt: new Date(),
      })
      .where(eq(deadlines.id, deadlineId))
      .returning();
    if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível atualizar o prazo.");
    await appendHistory(tx, {
      organizationId,
      deadlineId,
      eventType: "deadline.updated",
      title: "Prazo atualizado",
      actorMembershipId: actor.membershipId,
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "deadline.updated",
      resourceType: "deadline",
      resourceId: deadlineId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
    return serializeDeadline(updated);
  });
}

export async function completeDeadline(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  deadlineId: string,
  meta: RequestMeta,
) {
  const actor = requireDeadlinePermission(account, organizationId, "deadline.complete");
  const existing = await requireDeadline(db, organizationId, deadlineId);
  assertDeadlineTransition(existing.status as DeadlineStatus, "completed");
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(deadlines)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(deadlines.id, deadlineId))
      .returning();
    if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível concluir o prazo.");
    await appendHistory(tx, {
      organizationId,
      deadlineId,
      eventType: "deadline.completed",
      title: "Prazo concluído",
      actorMembershipId: actor.membershipId,
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "deadline.completed",
      resourceType: "deadline",
      resourceId: deadlineId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
    return serializeDeadline(updated);
  });
}

export async function cancelDeadline(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  deadlineId: string,
  meta: RequestMeta,
) {
  const actor = requireDeadlinePermission(account, organizationId, "deadline.cancel");
  const existing = await requireDeadline(db, organizationId, deadlineId);
  assertDeadlineTransition(existing.status as DeadlineStatus, "cancelled");
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(deadlines)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(deadlines.id, deadlineId))
      .returning();
    if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível cancelar o prazo.");
    await appendHistory(tx, {
      organizationId,
      deadlineId,
      eventType: "deadline.cancelled",
      title: "Prazo cancelado",
      actorMembershipId: actor.membershipId,
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "deadline.cancelled",
      resourceType: "deadline",
      resourceId: deadlineId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
    return serializeDeadline(updated);
  });
}

export async function createAlertRule(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: { name: string; offsetMinutes: number; active?: boolean },
  meta: RequestMeta,
) {
  requireDeadlinePermission(account, organizationId, "deadline.manage_alerts");
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(deadlineAlertRules)
      .values({
        organizationId,
        name: input.name,
        offsetMinutes: input.offsetMinutes,
        active: input.active ?? true,
      })
      .returning();
    if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a regra de alerta.");
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "deadline_alert_rule.created",
      resourceType: "deadline_alert_rule",
      resourceId: created.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
    return {
      id: created.id,
      name: created.name,
      offsetMinutes: created.offsetMinutes,
      active: created.active,
      channels: {
        in_app: "ready",
        email: "NOT_CONFIGURED",
        whatsapp: "NOT_CONFIGURED",
        sms: "NOT_CONFIGURED",
      },
    };
  });
}

export async function createEscalationRule(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    name: string;
    offsetMinutes: number;
    escalateToMembershipId?: string;
    escalateToRoleKey?: string;
    active?: boolean;
  },
  meta: RequestMeta,
) {
  requireDeadlinePermission(account, organizationId, "deadline.manage_escalation");
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(deadlineEscalationRules)
      .values({
        organizationId,
        name: input.name,
        offsetMinutes: input.offsetMinutes,
        escalateToMembershipId: input.escalateToMembershipId ?? null,
        escalateToRoleKey: input.escalateToRoleKey ?? null,
        active: input.active ?? true,
      })
      .returning();
    if (!created) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível criar a regra de escalonamento.");
    }
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "deadline_escalation_rule.created",
      resourceType: "deadline_escalation_rule",
      resourceId: created.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
    return {
      id: created.id,
      name: created.name,
      offsetMinutes: created.offsetMinutes,
      escalateToMembershipId: created.escalateToMembershipId,
      escalateToRoleKey: created.escalateToRoleKey,
      active: created.active,
      note: "Escalonamento apenas in-app nesta versão.",
    };
  });
}

/** Dispara alertas in-app para prazos confirmados próximos (chamada síncrona / sob demanda). */
export async function dispatchDeadlineAlerts(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  deadlineId: string,
  deps: DeadlineModuleDeps,
  meta: RequestMeta,
) {
  requireDeadlinePermission(account, organizationId, "deadline.manage_alerts");
  const deadline = await requireDeadline(db, organizationId, deadlineId);
  if (deadline.status !== "confirmed" || !deadline.confirmedDueAt) {
    throw new AppError("CONFLICT", "Alertas só se aplicam a prazos confirmados com data.");
  }
  if (!deadline.responsibleMembershipId) {
    return { dispatched: 0, channel: "in_app" as const };
  }
  const member = await db.query.organizationMembers.findFirst({
    where: eq(organizationMembers.id, deadline.responsibleMembershipId),
  });
  if (!member) return { dispatched: 0, channel: "in_app" as const };

  const rules = await db.query.deadlineAlertRules.findMany({
    where: and(
      eq(deadlineAlertRules.organizationId, organizationId),
      eq(deadlineAlertRules.active, true),
    ),
  });

  let dispatched = 0;
  await db.transaction(async (tx) => {
    for (const rule of rules) {
      const existing = await tx.query.deadlineAlertDispatches.findFirst({
        where: and(
          eq(deadlineAlertDispatches.deadlineId, deadlineId),
          eq(deadlineAlertDispatches.alertRuleId, rule.id),
          eq(deadlineAlertDispatches.channel, "in_app"),
        ),
      });
      if (existing) continue;
      const notify = await persistInAppNotification(tx, deps, {
        organizationId,
        userId: member.userId,
        type: "deadline.alert",
        title: `Alerta de prazo: ${deadline.title}`,
        message: `Regra “${rule.name}” (${rule.offsetMinutes} min). Canal: in-app.`,
        resourceType: "deadline",
        resourceId: deadlineId,
      });
      await tx.insert(deadlineAlertDispatches).values({
        organizationId,
        deadlineId,
        alertRuleId: rule.id,
        channel: "in_app",
        notificationId: notify.notificationId,
      });
      dispatched += 1;
    }
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "deadline.alerts_dispatched",
      resourceType: "deadline",
      resourceId: deadlineId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { dispatched, channel: "in_app" },
    });
  });
  return { dispatched, channel: "in_app" as const, email: "NOT_CONFIGURED" as const };
}

export async function escalateDeadline(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  deadlineId: string,
  deps: DeadlineModuleDeps,
  meta: RequestMeta,
) {
  requireDeadlinePermission(account, organizationId, "deadline.manage_escalation");
  const deadline = await requireDeadline(db, organizationId, deadlineId);
  const rules = await db.query.deadlineEscalationRules.findMany({
    where: and(
      eq(deadlineEscalationRules.organizationId, organizationId),
      eq(deadlineEscalationRules.active, true),
    ),
    orderBy: [asc(deadlineEscalationRules.offsetMinutes)],
    limit: 1,
  });
  const rule = rules[0];
  if (!rule?.escalateToMembershipId) {
    return { escalated: false, reason: "Nenhuma regra de escalonamento configurada." };
  }
  const member = await db.query.organizationMembers.findFirst({
    where: eq(organizationMembers.id, rule.escalateToMembershipId),
  });
  if (!member) return { escalated: false, reason: "Destinatário de escalonamento não encontrado." };

  await db.transaction(async (tx) => {
    await persistInAppNotification(tx, deps, {
      organizationId,
      userId: member.userId,
      type: "deadline.escalation",
      title: `Escalonamento: ${deadline.title}`,
      message: `Prazo escalonado via regra “${rule.name}” (in-app).`,
      resourceType: "deadline",
      resourceId: deadlineId,
    });
    await appendHistory(tx, {
      organizationId,
      deadlineId,
      eventType: "deadline.escalated",
      title: `Escalonado: ${rule.name}`,
      actorMembershipId: membershipOf(account, organizationId)?.membershipId,
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "deadline.escalated",
      resourceType: "deadline",
      resourceId: deadlineId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
  });
  return { escalated: true, channel: "in_app" as const };
}

/** Hook: cria/atualiza prazo central a partir de prazo administrativo. */
export async function syncCentralFromAdministrative(
  tx: DbTx,
  input: {
    organizationId: string;
    administrativeProcessId: string;
    administrativeDeadlineId: string;
    title: string;
    dueAt: Date;
    timezone: string;
    status: string;
    legalMatterId?: string | null;
    actorMembershipId?: string | null;
    existingCentralId?: string | null;
  },
): Promise<string> {
  const mappedStatus: DeadlineStatus =
    input.status === "confirmed"
      ? "confirmed"
      : input.status === "completed"
        ? "completed"
        : input.status === "cancelled"
          ? "cancelled"
          : input.status === "pending_confirmation"
            ? "pending_confirmation"
            : "suggested";

  if (input.existingCentralId) {
    await tx
      .update(deadlines)
      .set({
        title: input.title,
        confirmedDueAt: mappedStatus === "confirmed" ? input.dueAt : null,
        calculatedDueAt: input.dueAt,
        status: mappedStatus,
        timezone: input.timezone,
        updatedAt: new Date(),
      })
      .where(eq(deadlines.id, input.existingCentralId));
    return input.existingCentralId;
  }

  const [created] = await tx
    .insert(deadlines)
    .values({
      organizationId: input.organizationId,
      title: input.title,
      baseDate: input.dueAt,
      ruleType: "manual_date",
      calculatedDueAt: input.dueAt,
      calculatedAt: new Date(),
      confirmedDueAt: mappedStatus === "confirmed" ? input.dueAt : null,
      confirmedAt: mappedStatus === "confirmed" ? new Date() : null,
      status: mappedStatus,
      timezone: input.timezone,
      sourceType: "administrative_deadline",
      sourceId: input.administrativeDeadlineId,
      administrativeProcessId: input.administrativeProcessId,
      legalMatterId: input.legalMatterId ?? null,
      createdByMembershipId: input.actorMembershipId ?? null,
    })
    .returning();
  if (!created) throw new AppError("INTERNAL_ERROR", "Falha ao espelhar prazo central.");
  return created.id;
}

export async function countDeadlinesOverview(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  requireDeadlinePermission(account, organizationId, "deadline.read");
  const rows = await db
    .select({ status: deadlines.status, value: count() })
    .from(deadlines)
    .where(eq(deadlines.organizationId, organizationId))
    .groupBy(deadlines.status);
  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    byStatus[row.status] = row.value;
    total += row.value;
  }
  return {
    total,
    byStatus,
    suggested: byStatus.suggested ?? 0,
    pendingConfirmation: byStatus.pending_confirmation ?? 0,
    confirmed: byStatus.confirmed ?? 0,
    holidayCalendar: "NOT_CONFIGURED" as const,
  };
}
