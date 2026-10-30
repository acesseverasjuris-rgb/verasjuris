import { recordAudit } from "@verasjuris/audit";
import { policyEmployee, type SessionAccount } from "@verasjuris/auth";
import {
  calendarEvents,
  controlDepartments,
  controlEmployees,
  controlPositions,
  employeeLeaveRequests,
  employeeOnboardingItems,
  employeeOnboardingPlans,
  employeePerformanceReviews,
  isUniqueViolation,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, desc, eq } from "drizzle-orm";
import { iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import { authorizeControl, parseDate, requireDate, slugify } from "./internal-org.js";

function serializeDepartment(row: typeof controlDepartments.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    code: row.slug,
    slug: row.slug,
    description: row.description,
    active: row.active,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializePosition(row: typeof controlPositions.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    departmentId: row.departmentId,
    title: row.title,
    level: row.level,
    description: row.description,
    responsibilities: row.responsibilities,
    active: row.active,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializeEmployee(row: typeof controlEmployees.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    employeeCode: row.employeeCode,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    status: row.status,
    hiredAt: iso(row.hiredAt),
    terminatedAt: iso(row.terminatedAt),
    managerEmployeeId: row.managerEmployeeId,
    departmentId: row.departmentId,
    positionId: row.positionId,
    employmentType: row.employmentType,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializeLeave(row: typeof employeeLeaveRequests.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    employeeId: row.employeeId,
    type: row.leaveType,
    status: row.status,
    startAt: iso(row.startAt),
    endAt: iso(row.endAt),
    reason: row.reason,
    approvedByMembershipId: row.approvedByMembershipId,
    decidedAt: iso(row.decidedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function requireDepartment(db: AppDatabase, organizationId: string, id: string) {
  const [row] = await db
    .select()
    .from(controlDepartments)
    .where(
      and(eq(controlDepartments.id, id), eq(controlDepartments.organizationId, organizationId)),
    )
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este departamento no seu acesso.");
  return row;
}

async function requirePosition(db: AppDatabase, organizationId: string, id: string) {
  const [row] = await db
    .select()
    .from(controlPositions)
    .where(and(eq(controlPositions.id, id), eq(controlPositions.organizationId, organizationId)))
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este cargo no seu acesso.");
  return row;
}

async function requireEmployee(db: AppDatabase, organizationId: string, id: string) {
  const [row] = await db
    .select()
    .from(controlEmployees)
    .where(and(eq(controlEmployees.id, id), eq(controlEmployees.organizationId, organizationId)))
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este colaborador no seu acesso.");
  return row;
}

export async function createControlDepartment(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: { name: string; code?: string; description?: string; active?: boolean },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyEmployee(a, "control.hr.manage"),
  );
  const slug = slugify(input.code ?? input.name);
  try {
    const [row] = await db
      .insert(controlDepartments)
      .values({
        organizationId,
        name: input.name,
        slug,
        description: input.description ?? null,
        active: input.active ?? true,
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o departamento.");
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "control.department_created",
      resourceType: "control_department",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: serializeDepartment(row),
    });
    return { department: serializeDepartment(row) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Já existe um departamento com este código/slug.");
    }
    throw error;
  }
}

export async function listControlDepartments(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  await authorizeControl(db, account, organizationId, (a) => policyEmployee(a, "control.hr.read"));
  const rows = await db
    .select()
    .from(controlDepartments)
    .where(eq(controlDepartments.organizationId, organizationId))
    .orderBy(controlDepartments.name);
  return { departments: rows.map(serializeDepartment) };
}

export async function createControlPosition(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    departmentId: string;
    title: string;
    level?: string;
    description?: string;
    responsibilities?: string;
    active?: boolean;
  },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyEmployee(a, "control.hr.manage"),
  );
  await requireDepartment(db, organizationId, input.departmentId);
  const [row] = await db
    .insert(controlPositions)
    .values({
      organizationId,
      departmentId: input.departmentId,
      title: input.title,
      level: input.level ?? null,
      description: input.description ?? null,
      responsibilities: input.responsibilities ?? null,
      active: input.active ?? true,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o cargo.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "control.position_created",
    resourceType: "control_position",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: serializePosition(row),
  });
  return { position: serializePosition(row) };
}

export async function listControlPositions(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  departmentId?: string,
) {
  await authorizeControl(db, account, organizationId, (a) => policyEmployee(a, "control.hr.read"));
  const filters = [eq(controlPositions.organizationId, organizationId)];
  if (departmentId) filters.push(eq(controlPositions.departmentId, departmentId));
  const rows = await db
    .select()
    .from(controlPositions)
    .where(and(...filters))
    .orderBy(controlPositions.title);
  return { positions: rows.map(serializePosition) };
}

export async function createControlEmployee(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    userId?: string;
    employeeCode: string;
    fullName: string;
    email: string;
    phone?: string;
    status?: typeof controlEmployees.$inferSelect.status;
    hiredAt: string;
    terminatedAt?: string;
    managerEmployeeId?: string;
    departmentId: string;
    positionId: string;
    employmentType: typeof controlEmployees.$inferSelect.employmentType;
  },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyEmployee(a, "control.hr.manage"),
  );
  await requireDepartment(db, organizationId, input.departmentId);
  await requirePosition(db, organizationId, input.positionId);
  if (input.managerEmployeeId) {
    await requireEmployee(db, organizationId, input.managerEmployeeId);
  }
  try {
    const [row] = await db
      .insert(controlEmployees)
      .values({
        organizationId,
        userId: input.userId ?? null,
        employeeCode: input.employeeCode,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone ?? null,
        status: input.status ?? "preboarding",
        hiredAt: requireDate(input.hiredAt),
        terminatedAt: parseDate(input.terminatedAt ?? null),
        managerEmployeeId: input.managerEmployeeId ?? null,
        departmentId: input.departmentId,
        positionId: input.positionId,
        employmentType: input.employmentType,
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o colaborador.");
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "control.employee_created",
      resourceType: "control_employee",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: serializeEmployee(row),
    });
    return { employee: serializeEmployee(row) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Já existe um colaborador com este código.");
    }
    throw error;
  }
}

export async function listControlEmployees(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    limit: number;
    offset: number;
    status?: string;
    departmentId?: string;
    positionId?: string;
  },
) {
  await authorizeControl(db, account, organizationId, (a) => policyEmployee(a, "control.hr.read"));
  const filters = [eq(controlEmployees.organizationId, organizationId)];
  if (query.status) {
    filters.push(
      eq(controlEmployees.status, query.status as typeof controlEmployees.$inferSelect.status),
    );
  }
  if (query.departmentId) filters.push(eq(controlEmployees.departmentId, query.departmentId));
  if (query.positionId) filters.push(eq(controlEmployees.positionId, query.positionId));
  const rows = await db
    .select()
    .from(controlEmployees)
    .where(and(...filters))
    .orderBy(controlEmployees.fullName)
    .limit(query.limit)
    .offset(query.offset);
  return { employees: rows.map(serializeEmployee) };
}

export async function createEmployeeOnboardingPlan(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    employeeId: string;
    items?: Array<{ title: string; itemType?: string; description?: string }>;
  },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyEmployee(a, "control.hr.manage"),
  );
  await requireEmployee(db, organizationId, input.employeeId);
  return db.transaction(async (tx) => {
    const [plan] = await tx
      .insert(employeeOnboardingPlans)
      .values({
        organizationId,
        employeeId: input.employeeId,
        status: "active",
        startedAt: new Date(),
      })
      .returning();
    if (!plan) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o plano.");
    const itemsInput = input.items?.length
      ? input.items
      : [
          { title: "Documentos pessoais", itemType: "documents" },
          { title: "Acessos de sistemas", itemType: "access" },
          { title: "Treinamento LGPD", itemType: "lgpd" },
        ];
    const items = [];
    for (const [index, item] of itemsInput.entries()) {
      const itemType = (
        [
          "documents",
          "access",
          "training",
          "equipment",
          "policies",
          "meetings",
          "security",
          "lgpd",
          "other",
        ].includes(item.itemType ?? "")
          ? item.itemType
          : "other"
      ) as typeof employeeOnboardingItems.$inferSelect.itemType;
      const [created] = await tx
        .insert(employeeOnboardingItems)
        .values({
          planId: plan.id,
          itemType,
          title: item.title,
          description: item.description ?? null,
          sortOrder: index,
          status: "pending",
        })
        .returning();
      if (created) items.push(created);
    }
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "control.onboarding_started",
      resourceType: "employee_onboarding_plan",
      resourceId: plan.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
    return {
      plan: {
        id: plan.id,
        organizationId: plan.organizationId,
        employeeId: plan.employeeId,
        status: plan.status,
        startedAt: iso(plan.startedAt),
        completedAt: iso(plan.completedAt),
        createdAt: iso(plan.createdAt),
      },
      items: items.map((i) => ({
        id: i.id,
        planId: i.planId,
        itemType: i.itemType,
        title: i.title,
        status: i.status,
        sortOrder: i.sortOrder,
      })),
    };
  });
}

export async function createEmployeePerformanceReview(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    employeeId: string;
    periodStart: string;
    periodEnd: string;
    reviewerEmployeeId: string;
    overallScore?: number;
    reviewScaleMax: number;
    strengths?: string;
    improvements?: string;
    goals?: string;
  },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyEmployee(a, "control.hr.review"),
  );
  await requireEmployee(db, organizationId, input.employeeId);
  await requireEmployee(db, organizationId, input.reviewerEmployeeId);
  const [row] = await db
    .insert(employeePerformanceReviews)
    .values({
      organizationId,
      employeeId: input.employeeId,
      periodStart: requireDate(input.periodStart),
      periodEnd: requireDate(input.periodEnd),
      reviewerEmployeeId: input.reviewerEmployeeId,
      overallScore: input.overallScore ?? null,
      reviewScaleMax: input.reviewScaleMax,
      strengths: input.strengths ?? null,
      improvements: input.improvements ?? null,
      goals: input.goals ?? null,
      status: "draft",
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a avaliação.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "control.review_created",
    resourceType: "employee_performance_review",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return {
    review: {
      id: row.id,
      employeeId: row.employeeId,
      periodStart: iso(row.periodStart),
      periodEnd: iso(row.periodEnd),
      reviewerEmployeeId: row.reviewerEmployeeId,
      status: row.status,
      overallScore: row.overallScore,
      reviewScaleMax: row.reviewScaleMax,
      strengths: row.strengths,
      improvements: row.improvements,
      goals: row.goals,
      createdAt: iso(row.createdAt),
    },
  };
}

export async function createEmployeeLeaveRequest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    employeeId: string;
    type: typeof employeeLeaveRequests.$inferSelect.leaveType;
    startAt: string;
    endAt: string;
    reason?: string;
    status?: "draft" | "requested";
  },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyEmployee(a, "control.hr.manage"),
  );
  await requireEmployee(db, organizationId, input.employeeId);
  const startAt = requireDate(input.startAt);
  const endAt = requireDate(input.endAt);
  if (endAt < startAt) {
    throw new AppError("VALIDATION_ERROR", "A data final deve ser posterior à inicial.");
  }
  const [row] = await db
    .insert(employeeLeaveRequests)
    .values({
      organizationId,
      employeeId: input.employeeId,
      leaveType: input.type,
      startAt,
      endAt,
      reason: input.reason ?? null,
      status: input.status ?? "requested",
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a solicitação.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "control.leave_requested",
    resourceType: "employee_leave_request",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: serializeLeave(row),
  });
  return { leave: serializeLeave(row) };
}

export async function decideEmployeeLeave(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  leaveId: string,
  input: { status: "approved" | "rejected"; comment?: string },
  meta: RequestMeta,
) {
  const actor = await authorizeControl(db, account, organizationId, (a) =>
    policyEmployee(a, "control.hr.leave.approve"),
  );
  return db.transaction(async (tx) => {
    const [leave] = await tx
      .select()
      .from(employeeLeaveRequests)
      .where(
        and(
          eq(employeeLeaveRequests.id, leaveId),
          eq(employeeLeaveRequests.organizationId, organizationId),
        ),
      )
      .for("update")
      .limit(1);
    if (!leave) throw new AppError("NOT_FOUND", "Não encontramos esta solicitação no seu acesso.");
    if (!["draft", "requested"].includes(leave.status)) {
      throw new AppError("CONFLICT", "Esta solicitação já foi decidida.");
    }
    const [updated] = await tx
      .update(employeeLeaveRequests)
      .set({
        status: input.status,
        approvedByMembershipId: actor.membershipId,
        decidedAt: new Date(),
        updatedAt: new Date(),
        reason: input.comment
          ? `${leave.reason ?? ""}\n[decisão] ${input.comment}`.trim()
          : leave.reason,
      })
      .where(eq(employeeLeaveRequests.id, leave.id))
      .returning();
    if (!updated) throw new AppError("INTERNAL_ERROR", "Falha ao decidir afastamento.");

    let calendarEventId: string | null = null;
    if (input.status === "approved") {
      const employee = await requireEmployee(
        tx as unknown as AppDatabase,
        organizationId,
        leave.employeeId,
      );
      const [event] = await tx
        .insert(calendarEvents)
        .values({
          organizationId,
          title: `Afastamento: ${employee.fullName}`,
          description: `Licença/férias (${leave.leaveType}) aprovada.`,
          eventType: "other",
          startsAt: leave.startAt,
          endsAt: leave.endAt,
          allDay: true,
          status: "scheduled",
          createdByMembershipId: actor.membershipId,
          metadata: {
            source: "control_leave",
            leaveRequestId: leave.id,
            employeeId: leave.employeeId,
          },
        })
        .returning();
      calendarEventId = event?.id ?? null;
      if (employee.status === "active") {
        await tx
          .update(controlEmployees)
          .set({ status: "on_leave", updatedAt: new Date() })
          .where(eq(controlEmployees.id, employee.id));
      }
    }

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "control.leave_approved",
      resourceType: "employee_leave_request",
      resourceId: updated.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: serializeLeave(leave),
      after: serializeLeave(updated),
      metadata: { calendarEventId, decision: input.status },
    });

    return { leave: serializeLeave(updated), calendarEventId };
  });
}

export async function listEmployeeLeaves(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  employeeId?: string,
) {
  await authorizeControl(db, account, organizationId, (a) => policyEmployee(a, "control.hr.read"));
  const filters = [eq(employeeLeaveRequests.organizationId, organizationId)];
  if (employeeId) filters.push(eq(employeeLeaveRequests.employeeId, employeeId));
  const rows = await db
    .select()
    .from(employeeLeaveRequests)
    .where(and(...filters))
    .orderBy(desc(employeeLeaveRequests.createdAt));
  return { leaves: rows.map(serializeLeave) };
}

export async function leaveReminderJob(db: AppDatabase, organizationId: string) {
  const rows = await db
    .select()
    .from(employeeLeaveRequests)
    .where(
      and(
        eq(employeeLeaveRequests.organizationId, organizationId),
        eq(employeeLeaveRequests.status, "requested"),
      ),
    );
  return { pending: rows.length };
}

export async function employeeReviewReminderJob(db: AppDatabase, organizationId: string) {
  const rows = await db
    .select()
    .from(employeePerformanceReviews)
    .where(
      and(
        eq(employeePerformanceReviews.organizationId, organizationId),
        eq(employeePerformanceReviews.status, "in_progress"),
      ),
    );
  return { pending: rows.length };
}
