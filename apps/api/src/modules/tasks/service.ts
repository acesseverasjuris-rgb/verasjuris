import { recordAudit } from "@verasjuris/audit";
import {
  assertTaskTransition,
  policySla,
  policyTask,
  slaStatusForTaskStatus,
  type SessionAccount,
  type TaskStatus,
} from "@verasjuris/auth";
import {
  organizationMembers,
  slaPolicies,
  taskChecklistItems,
  taskComments,
  taskDependencies,
  taskHistoryEvents,
  tasks,
  taskSlaInstances,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, asc, count, desc, eq, ilike, isNull, or } from "drizzle-orm";
import type { RequestMeta } from "../auth/service.js";

type DbTx = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

/** Comentários: texto puro — remove HTML/scripts. */
export function sanitizePlainText(input: string): string {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

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

function requireTaskPermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyTask>[1],
) {
  const decision = policyTask(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function requireSlaPermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policySla>[1],
) {
  const decision = policySla(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function serializeTask(row: typeof tasks.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    legalMatterId: row.legalMatterId,
    judicialProcessId: row.judicialProcessId,
    administrativeProcessId: row.administrativeProcessId,
    parentTaskId: row.parentTaskId,
    responsibleMembershipId: row.responsibleMembershipId,
    createdByMembershipId: row.createdByMembershipId,
    startAt: row.startAt?.toISOString() ?? null,
    dueAt: row.dueAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    slaPolicyId: row.slaPolicyId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function requireTask(db: AppDatabase | DbTx, organizationId: string, taskId: string) {
  const row = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, taskId), eq(tasks.organizationId, organizationId)),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos esta tarefa no seu acesso.");
  return row;
}

async function appendHistory(
  tx: DbTx,
  input: {
    organizationId: string;
    taskId: string;
    eventType: string;
    title: string;
    summary?: string;
    actorMembershipId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await tx.insert(taskHistoryEvents).values({
    organizationId: input.organizationId,
    taskId: input.taskId,
    eventType: input.eventType,
    title: input.title,
    summary: input.summary ?? null,
    actorMembershipId: input.actorMembershipId ?? null,
    metadata: input.metadata ?? null,
  });
}

async function syncSlaForStatus(
  tx: DbTx,
  organizationId: string,
  taskId: string,
  status: TaskStatus,
  slaPolicyId: string | null,
) {
  const existing = await tx.query.taskSlaInstances.findFirst({
    where: eq(taskSlaInstances.taskId, taskId),
  });
  if (!existing && !slaPolicyId) return;
  if (!existing && slaPolicyId) {
    const policy = await tx.query.slaPolicies.findFirst({
      where: and(eq(slaPolicies.id, slaPolicyId), eq(slaPolicies.organizationId, organizationId)),
    });
    if (!policy) return;
    const now = new Date();
    const targetAt = new Date(now.getTime() + policy.targetMinutes * 60_000);
    const warningAt = policy.warningMinutes
      ? new Date(now.getTime() + policy.warningMinutes * 60_000)
      : null;
    await tx.insert(taskSlaInstances).values({
      organizationId,
      taskId,
      slaPolicyId: policy.id,
      targetAt,
      warningAt,
      startedAt: now,
      status: status === "waiting" || status === "blocked" ? "paused" : "running",
      pausedAt: status === "waiting" || status === "blocked" ? now : null,
    });
    return;
  }
  if (!existing) return;
  const next = slaStatusForTaskStatus(status, existing.status);
  if (!next || next === existing.status) return;
  await tx
    .update(taskSlaInstances)
    .set({
      status: next,
      pausedAt: next === "paused" ? new Date() : null,
      completedAt: next === "completed" ? new Date() : existing.completedAt,
      updatedAt: new Date(),
    })
    .where(eq(taskSlaInstances.id, existing.id));
}

/** Detecta ciclo se adicionar edge taskId → dependsOnTaskId. */
export async function wouldCreateDependencyCycle(
  db: AppDatabase | DbTx,
  organizationId: string,
  taskId: string,
  dependsOnTaskId: string,
): Promise<boolean> {
  if (taskId === dependsOnTaskId) return true;
  const edges = await db.query.taskDependencies.findMany({
    where: eq(taskDependencies.organizationId, organizationId),
    columns: { taskId: true, dependsOnTaskId: true },
  });
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.taskId) ?? [];
    list.push(e.dependsOnTaskId);
    adj.set(e.taskId, list);
  }
  const fromList = adj.get(taskId) ?? [];
  fromList.push(dependsOnTaskId);
  adj.set(taskId, fromList);

  const visiting = new Set<string>();
  const visited = new Set<string>();
  function dfs(node: string): boolean {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const next of adj.get(node) ?? []) {
      if (dfs(next)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  }
  return dfs(taskId);
}

export async function listTasks(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    q?: string;
    status?: TaskStatus;
    priority?: typeof tasks.$inferSelect.priority;
    responsibleMembershipId?: string;
    legalMatterId?: string;
    judicialProcessId?: string;
    administrativeProcessId?: string;
    limit: number;
    offset: number;
  },
) {
  requireTaskPermission(account, organizationId, "task.read");
  const conditions = [eq(tasks.organizationId, organizationId)];
  if (query.status) conditions.push(eq(tasks.status, query.status));
  if (query.priority) conditions.push(eq(tasks.priority, query.priority));
  if (query.responsibleMembershipId) {
    conditions.push(eq(tasks.responsibleMembershipId, query.responsibleMembershipId));
  }
  if (query.legalMatterId) conditions.push(eq(tasks.legalMatterId, query.legalMatterId));
  if (query.judicialProcessId) {
    conditions.push(eq(tasks.judicialProcessId, query.judicialProcessId));
  }
  if (query.administrativeProcessId) {
    conditions.push(eq(tasks.administrativeProcessId, query.administrativeProcessId));
  }
  if (query.q) {
    conditions.push(
      or(ilike(tasks.title, `%${query.q}%`), ilike(tasks.description, `%${query.q}%`))!,
    );
  }
  const where = and(...conditions);
  const [rows, totalRow] = await Promise.all([
    db.query.tasks.findMany({
      where,
      orderBy: [desc(tasks.updatedAt)],
      limit: query.limit,
      offset: query.offset,
    }),
    db.select({ value: count() }).from(tasks).where(where),
  ]);
  return { tasks: rows.map(serializeTask), total: totalRow[0]?.value ?? 0 };
}

export async function getTask(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  taskId: string,
) {
  requireTaskPermission(account, organizationId, "task.read");
  const task = await requireTask(db, organizationId, taskId);
  const [checklist, comments, dependencies, history, sla] = await Promise.all([
    db.query.taskChecklistItems.findMany({
      where: and(
        eq(taskChecklistItems.taskId, taskId),
        eq(taskChecklistItems.organizationId, organizationId),
      ),
      orderBy: [asc(taskChecklistItems.sortOrder)],
    }),
    db.query.taskComments.findMany({
      where: and(
        eq(taskComments.taskId, taskId),
        eq(taskComments.organizationId, organizationId),
        isNull(taskComments.deletedAt),
      ),
      orderBy: [asc(taskComments.createdAt)],
    }),
    db.query.taskDependencies.findMany({
      where: and(
        eq(taskDependencies.taskId, taskId),
        eq(taskDependencies.organizationId, organizationId),
      ),
    }),
    db.query.taskHistoryEvents.findMany({
      where: and(
        eq(taskHistoryEvents.taskId, taskId),
        eq(taskHistoryEvents.organizationId, organizationId),
      ),
      orderBy: [desc(taskHistoryEvents.eventAt)],
      limit: 100,
    }),
    db.query.taskSlaInstances.findFirst({ where: eq(taskSlaInstances.taskId, taskId) }),
  ]);
  return {
    task: serializeTask(task),
    checklist: checklist.map((item) => ({
      id: item.id,
      title: item.title,
      sortOrder: item.sortOrder,
      completed: item.completed,
      completedAt: item.completedAt?.toISOString() ?? null,
    })),
    comments: comments.map((c) => ({
      id: c.id,
      body: c.body,
      authorMembershipId: c.authorMembershipId,
      createdAt: c.createdAt.toISOString(),
    })),
    dependencies: dependencies.map((d) => ({
      id: d.id,
      dependsOnTaskId: d.dependsOnTaskId,
      dependencyType: d.dependencyType,
    })),
    history: history.map((h) => ({
      id: h.id,
      eventType: h.eventType,
      title: h.title,
      summary: h.summary,
      eventAt: h.eventAt.toISOString(),
    })),
    sla: sla
      ? {
          id: sla.id,
          status: sla.status,
          targetAt: sla.targetAt.toISOString(),
          warningAt: sla.warningAt?.toISOString() ?? null,
          startedAt: sla.startedAt.toISOString(),
          pausedAt: sla.pausedAt?.toISOString() ?? null,
          note: "SLA operacional — distinto de prazo jurídico.",
        }
      : null,
  };
}

export async function createTask(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    title: string;
    description?: string;
    status?: TaskStatus;
    priority?: typeof tasks.$inferInsert.priority;
    legalMatterId?: string;
    judicialProcessId?: string;
    administrativeProcessId?: string;
    parentTaskId?: string;
    responsibleMembershipId?: string;
    startAt?: string;
    dueAt?: string;
    slaPolicyId?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireTaskPermission(account, organizationId, "task.create");
  if (input.responsibleMembershipId) {
    requireTaskPermission(account, organizationId, "task.assign");
    const member = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.id, input.responsibleMembershipId),
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.status, "active"),
      ),
    });
    if (!member) {
      throw new AppError("NOT_FOUND", "Não encontramos este participante ativo na organização.");
    }
  }
  const status = (input.status ?? "todo") as TaskStatus;

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(tasks)
      .values({
        organizationId,
        title: input.title,
        description: input.description ?? null,
        status,
        priority: input.priority ?? "normal",
        legalMatterId: input.legalMatterId ?? null,
        judicialProcessId: input.judicialProcessId ?? null,
        administrativeProcessId: input.administrativeProcessId ?? null,
        parentTaskId: input.parentTaskId ?? null,
        responsibleMembershipId: input.responsibleMembershipId ?? null,
        createdByMembershipId: actor.membershipId,
        startAt: input.startAt ? new Date(input.startAt) : null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        slaPolicyId: input.slaPolicyId ?? null,
        completedAt: status === "done" ? new Date() : null,
      })
      .returning();
    if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a tarefa.");

    await syncSlaForStatus(tx, organizationId, created.id, status, created.slaPolicyId);
    await appendHistory(tx, {
      organizationId,
      taskId: created.id,
      eventType: "task.created",
      title: `Tarefa criada: ${created.title}`,
      actorMembershipId: actor.membershipId,
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "task.created",
      resourceType: "task",
      resourceId: created.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { title: created.title, status: created.status },
    });
    return serializeTask(created);
  });
}

export async function updateTask(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  taskId: string,
  input: {
    title?: string;
    description?: string | null;
    status?: TaskStatus;
    priority?: typeof tasks.$inferInsert.priority;
    legalMatterId?: string | null;
    judicialProcessId?: string | null;
    administrativeProcessId?: string | null;
    parentTaskId?: string | null;
    responsibleMembershipId?: string | null;
    startAt?: string | null;
    dueAt?: string | null;
    slaPolicyId?: string | null;
  },
  meta: RequestMeta,
) {
  const actor = requireTaskPermission(account, organizationId, "task.update");
  const existing = await requireTask(db, organizationId, taskId);
  if (input.responsibleMembershipId !== undefined) {
    requireTaskPermission(account, organizationId, "task.assign");
  }
  if (input.status === "done") {
    requireTaskPermission(account, organizationId, "task.complete");
  }
  if (input.status === "archived") {
    requireTaskPermission(account, organizationId, "task.archive");
  }
  if (input.status) {
    assertTaskTransition(existing.status as TaskStatus, input.status);
  }

  return db.transaction(async (tx) => {
    const nextStatus = (input.status ?? existing.status) as TaskStatus;
    const [updated] = await tx
      .update(tasks)
      .set({
        title: input.title ?? existing.title,
        description: input.description === undefined ? existing.description : input.description,
        status: nextStatus,
        priority: input.priority ?? existing.priority,
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
        parentTaskId: input.parentTaskId === undefined ? existing.parentTaskId : input.parentTaskId,
        responsibleMembershipId:
          input.responsibleMembershipId === undefined
            ? existing.responsibleMembershipId
            : input.responsibleMembershipId,
        startAt:
          input.startAt === undefined
            ? existing.startAt
            : input.startAt
              ? new Date(input.startAt)
              : null,
        dueAt:
          input.dueAt === undefined ? existing.dueAt : input.dueAt ? new Date(input.dueAt) : null,
        slaPolicyId: input.slaPolicyId === undefined ? existing.slaPolicyId : input.slaPolicyId,
        completedAt:
          nextStatus === "done" && existing.status !== "done" ? new Date() : existing.completedAt,
        cancelledAt:
          nextStatus === "cancelled" && existing.status !== "cancelled"
            ? new Date()
            : existing.cancelledAt,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId))
      .returning();
    if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível atualizar a tarefa.");

    await syncSlaForStatus(tx, organizationId, taskId, nextStatus, updated.slaPolicyId);
    if (input.status && input.status !== existing.status) {
      await appendHistory(tx, {
        organizationId,
        taskId,
        eventType: "task.status_changed",
        title: `Status: ${existing.status} → ${input.status}`,
        actorMembershipId: actor.membershipId,
        metadata: { from: existing.status, to: input.status },
      });
    }
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "task.updated",
      resourceType: "task",
      resourceId: taskId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { status: existing.status },
      after: { status: updated.status },
    });
    return serializeTask(updated);
  });
}

export async function addChecklistItem(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  taskId: string,
  input: { title: string; sortOrder?: number },
  meta: RequestMeta,
) {
  const actor = requireTaskPermission(account, organizationId, "task.manage_checklist");
  await requireTask(db, organizationId, taskId);
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(taskChecklistItems)
      .values({
        organizationId,
        taskId,
        title: input.title,
        sortOrder: input.sortOrder ?? 0,
      })
      .returning();
    if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o item.");
    await appendHistory(tx, {
      organizationId,
      taskId,
      eventType: "task.checklist_added",
      title: `Checklist: ${created.title}`,
      actorMembershipId: actor.membershipId,
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "task.checklist_added",
      resourceType: "task_checklist_item",
      resourceId: created.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
    return {
      id: created.id,
      title: created.title,
      sortOrder: created.sortOrder,
      completed: created.completed,
    };
  });
}

export async function updateChecklistItem(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  taskId: string,
  itemId: string,
  input: { title?: string; completed?: boolean; sortOrder?: number },
  meta: RequestMeta,
) {
  const actor = requireTaskPermission(account, organizationId, "task.manage_checklist");
  await requireTask(db, organizationId, taskId);
  const existing = await db.query.taskChecklistItems.findFirst({
    where: and(
      eq(taskChecklistItems.id, itemId),
      eq(taskChecklistItems.taskId, taskId),
      eq(taskChecklistItems.organizationId, organizationId),
    ),
  });
  if (!existing) throw new AppError("NOT_FOUND", "Não encontramos este item no seu acesso.");

  return db.transaction(async (tx) => {
    const completed = input.completed ?? existing.completed;
    const [updated] = await tx
      .update(taskChecklistItems)
      .set({
        title: input.title ?? existing.title,
        sortOrder: input.sortOrder ?? existing.sortOrder,
        completed,
        completedAt: completed && !existing.completed ? new Date() : existing.completedAt,
        completedByMembershipId: completed ? actor.membershipId : existing.completedByMembershipId,
        updatedAt: new Date(),
      })
      .where(eq(taskChecklistItems.id, itemId))
      .returning();
    if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível atualizar o item.");
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "task.checklist_updated",
      resourceType: "task_checklist_item",
      resourceId: itemId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
    return {
      id: updated.id,
      title: updated.title,
      sortOrder: updated.sortOrder,
      completed: updated.completed,
      completedAt: updated.completedAt?.toISOString() ?? null,
    };
  });
}

export async function addTaskComment(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  taskId: string,
  input: { body: string },
  meta: RequestMeta,
) {
  const actor = requireTaskPermission(account, organizationId, "task.comment");
  await requireTask(db, organizationId, taskId);
  const body = sanitizePlainText(input.body);
  if (!body) {
    throw new AppError("VALIDATION_ERROR", "O comentário não pode ficar vazio após a sanitização.");
  }
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(taskComments)
      .values({
        organizationId,
        taskId,
        authorMembershipId: actor.membershipId,
        body,
      })
      .returning();
    if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível salvar o comentário.");
    await appendHistory(tx, {
      organizationId,
      taskId,
      eventType: "task.commented",
      title: "Comentário adicionado",
      actorMembershipId: actor.membershipId,
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "task.commented",
      resourceType: "task_comment",
      resourceId: created.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
    return {
      id: created.id,
      body: created.body,
      authorMembershipId: created.authorMembershipId,
      createdAt: created.createdAt.toISOString(),
    };
  });
}

export async function addTaskDependency(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  taskId: string,
  input: { dependsOnTaskId: string; dependencyType?: "blocks" | "requires" },
  meta: RequestMeta,
) {
  const actor = requireTaskPermission(account, organizationId, "task.manage_dependencies");
  await requireTask(db, organizationId, taskId);
  await requireTask(db, organizationId, input.dependsOnTaskId);
  if (await wouldCreateDependencyCycle(db, organizationId, taskId, input.dependsOnTaskId)) {
    throw new AppError(
      "CONFLICT",
      "Esta dependência criaria um ciclo entre tarefas. Nenhuma alteração foi feita.",
    );
  }
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(taskDependencies)
      .values({
        organizationId,
        taskId,
        dependsOnTaskId: input.dependsOnTaskId,
        dependencyType: input.dependencyType ?? "blocks",
      })
      .returning();
    if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a dependência.");
    await appendHistory(tx, {
      organizationId,
      taskId,
      eventType: "task.dependency_added",
      title: `Dependência de ${input.dependsOnTaskId}`,
      actorMembershipId: actor.membershipId,
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "task.dependency_added",
      resourceType: "task_dependency",
      resourceId: created.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
    return {
      id: created.id,
      dependsOnTaskId: created.dependsOnTaskId,
      dependencyType: created.dependencyType,
    };
  });
}

export async function createSlaPolicy(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    name: string;
    description?: string;
    targetMinutes: number;
    warningMinutes?: number;
    active?: boolean;
  },
  meta: RequestMeta,
) {
  requireSlaPermission(account, organizationId, "sla.manage");
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(slaPolicies)
      .values({
        organizationId,
        name: input.name,
        description: input.description ?? null,
        targetMinutes: input.targetMinutes,
        warningMinutes: input.warningMinutes ?? null,
        active: input.active ?? true,
      })
      .returning();
    if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a política de SLA.");
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "sla_policy.created",
      resourceType: "sla_policy",
      resourceId: created.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
    return {
      id: created.id,
      name: created.name,
      targetMinutes: created.targetMinutes,
      warningMinutes: created.warningMinutes,
      active: created.active,
      note: "SLA operacional — não é prazo jurídico.",
    };
  });
}

export async function countTasksOverview(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  requireTaskPermission(account, organizationId, "task.read");
  const rows = await db
    .select({ status: tasks.status, value: count() })
    .from(tasks)
    .where(eq(tasks.organizationId, organizationId))
    .groupBy(tasks.status);
  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    byStatus[row.status] = row.value;
    total += row.value;
  }
  return { total, byStatus };
}
