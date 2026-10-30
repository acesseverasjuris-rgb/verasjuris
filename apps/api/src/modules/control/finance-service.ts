import { recordAudit } from "@verasjuris/audit";
import { policyBudget, policyExpenseReport, type SessionAccount } from "@verasjuris/auth";
import {
  costCenters,
  costRecords,
  expenseReportItems,
  expenseReports,
  internalBudgetLines,
  internalBudgets,
  isUniqueViolation,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, desc, eq, sql } from "drizzle-orm";
import { iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import { authorizeControl, requireDate } from "./internal-org.js";
import { requireEmployeeInOrg } from "./hr-lookups.js";

function serializeCostCenter(row: typeof costCenters.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    code: row.code,
    name: row.name,
    departmentId: row.departmentId,
    managerMembershipId: row.managerMembershipId,
    active: row.active,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializeBudget(row: typeof internalBudgets.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    fiscalYear: row.fiscalYear,
    version: row.version,
    status: row.status,
    approvedByMembershipId: row.approvedByMembershipId,
    approvedAt: iso(row.approvedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializeExpense(row: typeof expenseReports.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    employeeId: row.employeeId,
    costCenterId: row.costCenterId,
    period: row.period,
    totalCents: row.totalCents,
    currency: row.currency,
    status: row.status,
    submittedAt: iso(row.submittedAt),
    approvedAt: iso(row.approvedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function requireCostCenter(db: AppDatabase, organizationId: string, id: string) {
  const [row] = await db
    .select()
    .from(costCenters)
    .where(and(eq(costCenters.id, id), eq(costCenters.organizationId, organizationId)))
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este centro de custo no seu acesso.");
  return row;
}

async function requireBudget(db: AppDatabase, organizationId: string, id: string) {
  const [row] = await db
    .select()
    .from(internalBudgets)
    .where(and(eq(internalBudgets.id, id), eq(internalBudgets.organizationId, organizationId)))
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este orçamento no seu acesso.");
  return row;
}

export async function createCostCenter(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    code: string;
    name: string;
    departmentId?: string;
    managerMembershipId?: string;
    active?: boolean;
  },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyBudget(a, "control.finance.manage"),
  );
  try {
    const [row] = await db
      .insert(costCenters)
      .values({
        organizationId,
        code: input.code,
        name: input.name,
        departmentId: input.departmentId ?? null,
        managerMembershipId: input.managerMembershipId ?? null,
        active: input.active ?? true,
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o centro de custo.");
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "control.cost_center_created",
      resourceType: "cost_center",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: serializeCostCenter(row),
    });
    return { costCenter: serializeCostCenter(row) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Já existe um centro de custo com este código.");
    }
    throw error;
  }
}

export async function listCostCenters(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyBudget(a, "control.finance.read"),
  );
  const rows = await db
    .select()
    .from(costCenters)
    .where(eq(costCenters.organizationId, organizationId))
    .orderBy(costCenters.code);
  return { costCenters: rows.map(serializeCostCenter) };
}

export async function createInternalBudget(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    fiscalYear: number;
    version: number;
    status?: typeof internalBudgets.$inferSelect.status;
  },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyBudget(a, "control.finance.manage"),
  );
  try {
    const [row] = await db
      .insert(internalBudgets)
      .values({
        organizationId,
        fiscalYear: input.fiscalYear,
        version: input.version,
        status: input.status ?? "draft",
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o orçamento.");
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "control.budget_created",
      resourceType: "internal_budget",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: serializeBudget(row),
    });
    return { budget: serializeBudget(row) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Já existe este orçamento (ano/versão).");
    }
    throw error;
  }
}

export async function listInternalBudgets(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number; fiscalYear?: number; status?: string },
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyBudget(a, "control.finance.read"),
  );
  const filters = [eq(internalBudgets.organizationId, organizationId)];
  if (query.fiscalYear) filters.push(eq(internalBudgets.fiscalYear, query.fiscalYear));
  if (query.status) {
    filters.push(
      eq(internalBudgets.status, query.status as typeof internalBudgets.$inferSelect.status),
    );
  }
  const rows = await db
    .select()
    .from(internalBudgets)
    .where(and(...filters))
    .orderBy(desc(internalBudgets.fiscalYear))
    .limit(query.limit)
    .offset(query.offset);
  return { budgets: rows.map(serializeBudget) };
}

export async function createInternalBudgetLine(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    budgetId: string;
    costCenterId: string;
    category: string;
    period: string;
    plannedAmountCents: number;
    notes?: string;
  },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyBudget(a, "control.finance.manage"),
  );
  await requireBudget(db, organizationId, input.budgetId);
  await requireCostCenter(db, organizationId, input.costCenterId);
  const [row] = await db
    .insert(internalBudgetLines)
    .values({
      budgetId: input.budgetId,
      costCenterId: input.costCenterId,
      category: input.category,
      period: input.period,
      plannedAmountCents: input.plannedAmountCents,
      notes: input.notes ?? null,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a linha.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "control.budget_line_created",
    resourceType: "internal_budget_line",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return {
    line: {
      id: row.id,
      budgetId: row.budgetId,
      costCenterId: row.costCenterId,
      category: row.category,
      period: row.period,
      plannedAmountCents: row.plannedAmountCents,
      notes: row.notes,
    },
  };
}

export async function approveInternalBudget(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  budgetId: string,
  meta: RequestMeta,
) {
  const actor = await authorizeControl(db, account, organizationId, (a) =>
    policyBudget(a, "control.finance.approve"),
  );
  const existing = await requireBudget(db, organizationId, budgetId);
  if (!["draft", "under_review", "revised"].includes(existing.status)) {
    throw new AppError("CONFLICT", "Este orçamento não pode ser aprovado no status atual.");
  }
  const [row] = await db
    .update(internalBudgets)
    .set({
      status: "approved",
      approvedByMembershipId: actor.membershipId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(internalBudgets.id, budgetId))
    .returning();
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este orçamento no seu acesso.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "control.budget_approved",
    resourceType: "internal_budget",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    before: serializeBudget(existing),
    after: serializeBudget(row),
  });
  return { budget: serializeBudget(row) };
}

export async function createExpenseReport(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: { employeeId: string; costCenterId: string; period: string; notes?: string },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyExpenseReport(a, "control.finance.manage"),
  );
  await requireEmployeeInOrg(db, organizationId, input.employeeId);
  await requireCostCenter(db, organizationId, input.costCenterId);
  const [row] = await db
    .insert(expenseReports)
    .values({
      organizationId,
      employeeId: input.employeeId,
      costCenterId: input.costCenterId,
      period: input.period,
      totalCents: 0,
      status: "draft",
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a prestação.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "control.expense_created",
    resourceType: "expense_report",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: serializeExpense(row),
    metadata: input.notes ? { notes: input.notes } : undefined,
  });
  return { expenseReport: serializeExpense(row) };
}

export async function addExpenseReportItem(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    expenseReportId: string;
    category: string;
    description: string;
    amountCents: number;
    incurredAt: string;
    documentId?: string;
  },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyExpenseReport(a, "control.finance.manage"),
  );
  const [report] = await db
    .select()
    .from(expenseReports)
    .where(
      and(
        eq(expenseReports.id, input.expenseReportId),
        eq(expenseReports.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!report) throw new AppError("NOT_FOUND", "Não encontramos esta prestação no seu acesso.");
  if (report.status !== "draft") {
    throw new AppError("CONFLICT", "Só é possível adicionar itens em prestações em rascunho.");
  }
  return db.transaction(async (tx) => {
    const [item] = await tx
      .insert(expenseReportItems)
      .values({
        expenseReportId: report.id,
        category: input.category,
        description: input.description,
        amountCents: input.amountCents,
        incurredAt: requireDate(input.incurredAt),
        documentId: input.documentId ?? null,
        status: "pending",
      })
      .returning();
    if (!item) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o item.");
    const [updated] = await tx
      .update(expenseReports)
      .set({
        totalCents: report.totalCents + input.amountCents,
        updatedAt: new Date(),
      })
      .where(eq(expenseReports.id, report.id))
      .returning();
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "control.expense_item_added",
      resourceType: "expense_report_item",
      resourceId: item.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
    return {
      item: {
        id: item.id,
        expenseReportId: item.expenseReportId,
        category: item.category,
        description: item.description,
        amountCents: item.amountCents,
        incurredAt: iso(item.incurredAt),
        documentId: item.documentId,
        status: item.status,
      },
      expenseReport: updated ? serializeExpense(updated) : serializeExpense(report),
    };
  });
}

export async function submitExpenseReport(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  expenseReportId: string,
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyExpenseReport(a, "control.finance.manage"),
  );
  const [report] = await db
    .select()
    .from(expenseReports)
    .where(
      and(
        eq(expenseReports.id, expenseReportId),
        eq(expenseReports.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!report) throw new AppError("NOT_FOUND", "Não encontramos esta prestação no seu acesso.");
  if (report.status !== "draft") {
    throw new AppError("CONFLICT", "Esta prestação já foi submetida.");
  }
  const [row] = await db
    .update(expenseReports)
    .set({ status: "submitted", submittedAt: new Date(), updatedAt: new Date() })
    .where(eq(expenseReports.id, expenseReportId))
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Falha ao submeter prestação.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "control.expense_submitted",
    resourceType: "expense_report",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: serializeExpense(row),
  });
  return { expenseReport: serializeExpense(row) };
}

export async function listExpenseReports(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number; status?: string; employeeId?: string },
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyExpenseReport(a, "control.finance.read"),
  );
  const filters = [eq(expenseReports.organizationId, organizationId)];
  if (query.status) {
    filters.push(
      eq(expenseReports.status, query.status as typeof expenseReports.$inferSelect.status),
    );
  }
  if (query.employeeId) filters.push(eq(expenseReports.employeeId, query.employeeId));
  const rows = await db
    .select()
    .from(expenseReports)
    .where(and(...filters))
    .orderBy(desc(expenseReports.createdAt))
    .limit(query.limit)
    .offset(query.offset);
  return { expenseReports: rows.map(serializeExpense) };
}

/** Planned vs actual from budget lines + costRecords; forecast left null when treasury unavailable. */
export class BudgetVarianceService {
  constructor(private readonly db: AppDatabase) {}

  async compute(organizationId: string, budgetId: string) {
    const budget = await requireBudget(this.db, organizationId, budgetId);
    const lines = await this.db
      .select()
      .from(internalBudgetLines)
      .where(eq(internalBudgetLines.budgetId, budgetId));
    const plannedCents = lines.reduce((acc, line) => acc + line.plannedAmountCents, 0);

    const [actualRow] = await this.db
      .select({ total: sql<string>`coalesce(sum(${costRecords.amountCents}), 0)` })
      .from(costRecords)
      .where(
        and(
          eq(costRecords.organizationId, organizationId),
          sql`extract(year from ${costRecords.incurredAt}) = ${budget.fiscalYear}`,
        ),
      );
    const actualCents = Number(actualRow?.total ?? 0);

    return {
      budgetId: budget.id,
      fiscalYear: budget.fiscalYear,
      version: budget.version,
      plannedCents,
      actualCents,
      varianceCents: plannedCents - actualCents,
      forecastCents: null as number | null,
      forecastStatus: "INSUFFICIENT_DATA" as const,
      formulaVersion: "budget_variance.v1",
      lines: lines.map((l) => ({
        id: l.id,
        category: l.category,
        period: l.period,
        costCenterId: l.costCenterId,
        plannedAmountCents: l.plannedAmountCents,
      })),
    };
  }
}

export async function getBudgetVariance(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  budgetId: string,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyBudget(a, "control.finance.read"),
  );
  const service = new BudgetVarianceService(db);
  return { variance: await service.compute(organizationId, budgetId) };
}

export async function budgetVarianceRefreshJob(db: AppDatabase, organizationId: string) {
  const budgets = await db
    .select()
    .from(internalBudgets)
    .where(
      and(
        eq(internalBudgets.organizationId, organizationId),
        eq(internalBudgets.status, "approved"),
      ),
    );
  const service = new BudgetVarianceService(db);
  const results = [];
  for (const budget of budgets) {
    results.push(await service.compute(organizationId, budget.id));
  }
  return { refreshed: results.length, results };
}
