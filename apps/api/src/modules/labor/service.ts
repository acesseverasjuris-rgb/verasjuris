import type {
  ESocialProvider,
  FGTSProvider,
  LaborCourtProvider,
  TimeTrackingImportProvider,
} from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import {
  policyEmploymentContract,
  policyLaborCalculation,
  policyLaborCase,
  policyLaborClaims,
  policyLaborFgts,
  policyLaborLiquidation,
  policyLaborRemuneration,
  policyLaborTermination,
  policyWorkSchedule,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  FGTS_ESTIMATE_LABEL,
  LaborCalculationEngine,
  type CalculationEnvelope,
  type FeriasInput,
  type FgtsInput,
  type JornadaInput,
  type LiquidacaoInput,
  type RemuneracaoInput,
  type TerminationInput,
} from "@verasjuris/calculations";
import {
  crmClients,
  documentLinks,
  documents,
  employmentContractHistory,
  employmentContracts,
  employmentTerminations,
  fgtsRecords,
  judicialHearings,
  judicialProcesses,
  laborCalculations,
  laborCases,
  laborClaimItems,
  laborLiquidations,
  laborRemunerationItems,
  laborRuleSets,
  legalMatters,
  organizationMembers,
  vacationPeriods,
  workSchedules,
  workTimeRecords,
  type AppDatabase,
} from "@verasjuris/database";
import type { HolidayCalendarProvider, NotificationProvider } from "@verasjuris/notifications";
import { AppError } from "@verasjuris/types";
import { and, asc, count, desc, eq, ilike } from "drizzle-orm";
import { authorize, escapeLike, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import { createDeadline } from "../deadlines/service.js";
import { assertCanReadDocument, requireDocumentInOrg } from "../documents/service.js";
import { createTask } from "../tasks/service.js";

const LINK_TARGET_LABOR_CASE = "labor_case";
const laborEngine = new LaborCalculationEngine();

export const LABOR_DOCUMENT_LINK_TYPES = [
  "evidence",
  "contract",
  "payslip",
  "time_record",
  "trct",
  "fgts",
  "medical",
  "other",
] as const;

export type LaborModuleDeps = {
  eSocialProvider: ESocialProvider;
  fgtsProvider: FGTSProvider;
  laborCourtProvider: LaborCourtProvider;
  timeTrackingImportProvider: TimeTrackingImportProvider;
  notifications?: NotificationProvider;
  holidays?: HolidayCalendarProvider;
};

function parseDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}

function requireCase(db: AppDatabase, organizationId: string, laborCaseId: string) {
  return db.query.laborCases.findFirst({
    where: and(eq(laborCases.id, laborCaseId), eq(laborCases.organizationId, organizationId)),
  });
}

async function requireLaborCaseOr404(db: AppDatabase, organizationId: string, laborCaseId: string) {
  const row = await requireCase(db, organizationId, laborCaseId);
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este caso trabalhista.");
  return row;
}

async function assertClientInOrg(db: AppDatabase, organizationId: string, clientId: string) {
  const client = await db.query.crmClients.findFirst({
    where: and(eq(crmClients.id, clientId), eq(crmClients.organizationId, organizationId)),
    columns: { id: true },
  });
  if (!client) throw new AppError("NOT_FOUND", "Não encontramos este cliente.");
}

async function assertMatterInOrg(db: AppDatabase, organizationId: string, legalMatterId: string) {
  const matter = await db.query.legalMatters.findFirst({
    where: and(eq(legalMatters.id, legalMatterId), eq(legalMatters.organizationId, organizationId)),
    columns: { id: true },
  });
  if (!matter) throw new AppError("NOT_FOUND", "Não encontramos este caso jurídico.");
}

async function assertJudicialInOrg(
  db: AppDatabase,
  organizationId: string,
  judicialProcessId: string | null | undefined,
) {
  if (!judicialProcessId) return;
  const process = await db.query.judicialProcesses.findFirst({
    where: and(
      eq(judicialProcesses.id, judicialProcessId),
      eq(judicialProcesses.organizationId, organizationId),
    ),
    columns: { id: true },
  });
  if (!process) throw new AppError("NOT_FOUND", "Não encontramos este processo judicial.");
}

async function assertMembershipInOrg(
  db: AppDatabase,
  organizationId: string,
  membershipId: string | null | undefined,
) {
  if (!membershipId) return;
  const member = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.id, membershipId),
      eq(organizationMembers.organizationId, organizationId),
    ),
    columns: { id: true },
  });
  if (!member) throw new AppError("NOT_FOUND", "Não encontramos este participante.");
}

function serializeLaborCase(row: typeof laborCases.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    clientId: row.clientId,
    legalMatterId: row.legalMatterId,
    judicialProcessId: row.judicialProcessId,
    responsibleMembershipId: row.responsibleMembershipId,
    clientRole: row.clientRole,
    status: row.status,
    notes: row.notes,
    createdByMembershipId: row.createdByMembershipId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeContract(row: typeof employmentContracts.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    laborCaseId: row.laborCaseId,
    employeeClientId: row.employeeClientId,
    employerName: row.employerName,
    employerDocument: row.employerDocument,
    admissionDate: row.admissionDate.toISOString(),
    terminationDate: iso(row.terminationDate),
    contractType: row.contractType,
    jobTitle: row.jobTitle,
    workplace: row.workplace,
    salaryCents: row.salaryCents,
    remunerationStructure: row.remunerationStructure,
    weeklyHours: row.weeklyHours,
    status: row.status,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeHistory(row: typeof employmentContractHistory.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    contractId: row.contractId,
    kind: row.kind,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: iso(row.effectiveTo),
    previousValue: row.previousValue,
    newValue: row.newValue,
    notes: row.notes,
    source: row.source,
    actorMembershipId: row.actorMembershipId,
    documentId: row.documentId,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeSchedule(row: typeof workSchedules.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    laborCaseId: row.laborCaseId,
    contractId: row.contractId,
    name: row.name,
    weeklyHours: row.weeklyHours,
    schedulePattern: row.schedulePattern,
    includesNightShift: row.includesNightShift,
    includesOvertimeBank: row.includesOvertimeBank,
    effectiveFrom: iso(row.effectiveFrom),
    effectiveTo: iso(row.effectiveTo),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeTimeRecord(row: typeof workTimeRecords.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    laborCaseId: row.laborCaseId,
    contractId: row.contractId,
    scheduleId: row.scheduleId,
    workDate: row.workDate.toISOString(),
    clockInAt: iso(row.clockInAt),
    clockOutAt: iso(row.clockOutAt),
    breakMinutes: row.breakMinutes,
    overtimeMinutes: row.overtimeMinutes,
    nightMinutes: row.nightMinutes,
    notes: row.notes,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeRemuneration(row: typeof laborRemunerationItems.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    laborCaseId: row.laborCaseId,
    contractId: row.contractId,
    itemType: row.itemType,
    description: row.description,
    competence: row.competence,
    amountCents: row.amountCents,
    isCredit: row.isCredit,
    source: row.source,
    documentId: row.documentId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeVacation(row: typeof vacationPeriods.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    laborCaseId: row.laborCaseId,
    contractId: row.contractId,
    accrualStart: row.accrualStart.toISOString(),
    accrualEnd: row.accrualEnd.toISOString(),
    concessionStart: iso(row.concessionStart),
    concessionEnd: iso(row.concessionEnd),
    enjoyedDays: row.enjoyedDays,
    soldDays: row.soldDays,
    paymentDate: iso(row.paymentDate),
    amountCents: row.amountCents,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeFgts(row: typeof fgtsRecords.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    laborCaseId: row.laborCaseId,
    contractId: row.contractId,
    competence: row.competence,
    baseAmountCents: row.baseAmountCents,
    dueAmountCents: row.dueAmountCents,
    paidAmountCents: row.paidAmountCents,
    paymentDate: iso(row.paymentDate),
    source: row.source,
    reviewStatus: row.reviewStatus,
    notes: row.notes,
    /** Estimativa / informado — nunca saldo oficial sem FGTSProvider. */
    estimateLabel: FGTS_ESTIMATE_LABEL,
    isOfficialBalance: false,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeTermination(row: typeof employmentTerminations.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    laborCaseId: row.laborCaseId,
    contractId: row.contractId,
    terminationType: row.terminationType,
    noticeType: row.noticeType,
    noticeStart: iso(row.noticeStart),
    noticeEnd: iso(row.noticeEnd),
    terminationDate: row.terminationDate.toISOString(),
    reason: row.reason,
    lastSalaryCents: row.lastSalaryCents,
    status: row.status,
    source: row.source,
    documentId: row.documentId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeClaim(row: typeof laborClaimItems.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    laborCaseId: row.laborCaseId,
    claimType: row.claimType,
    title: row.title,
    description: row.description,
    amountCents: row.amountCents,
    periodStart: iso(row.periodStart),
    periodEnd: iso(row.periodEnd),
    status: row.status,
    facts: row.facts,
    evidenceNotes: row.evidenceNotes,
    calculationId: row.calculationId,
    documentId: row.documentId,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeCalculation(row: typeof laborCalculations.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    laborCaseId: row.laborCaseId,
    calculationType: row.calculationType,
    referenceDate: row.referenceDate.toISOString(),
    ruleSetId: row.ruleSetId,
    ruleSetVersion: row.ruleSetVersion,
    inputSnapshot: row.inputSnapshot,
    resultSnapshot: row.resultSnapshot,
    status: row.status,
    createdByMembershipId: row.createdByMembershipId,
    reviewedByMembershipId: row.reviewedByMembershipId,
    reviewedAt: iso(row.reviewedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeLiquidation(row: typeof laborLiquidations.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    laborCaseId: row.laborCaseId,
    calculationId: row.calculationId,
    referenceDate: row.referenceDate.toISOString(),
    ruleSetVersion: row.ruleSetVersion,
    itemsSnapshot: row.itemsSnapshot,
    periodsSnapshot: row.periodsSnapshot,
    correctionIndex: row.correctionIndex,
    interestRule: row.interestRule,
    contributionsCents: row.contributionsCents,
    deductionsCents: row.deductionsCents,
    totalPrincipalCents: row.totalPrincipalCents,
    totalCorrectionCents: row.totalCorrectionCents,
    totalInterestCents: row.totalInterestCents,
    totalCents: row.totalCents,
    status: row.status,
    notes: row.notes,
    createdByMembershipId: row.createdByMembershipId,
    reviewedByMembershipId: row.reviewedByMembershipId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeRuleSet(row: typeof laborRuleSets.$inferSelect) {
  return {
    id: row.id,
    key: row.key,
    version: row.version,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: iso(row.effectiveTo),
    source: row.source,
    sourceUrl: row.sourceUrl,
    status: row.status,
    metadata: row.metadata,
    locked: row.locked,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function assertCalculationMutable(status: string) {
  if (status === "approved") {
    throw new AppError(
      "CONFLICT",
      "Cálculo aprovado é imutável. Crie uma nova versão para alterar inputs ou resultados.",
    );
  }
}

function runEngine(
  calculationType: string,
  inputSnapshot: Record<string, unknown>,
  ruleSetVersion: string,
) {
  const withVersion = { ...inputSnapshot, ruleSetVersion };
  switch (calculationType) {
    case "jornada":
      return laborEngine.jornada(withVersion as JornadaInput);
    case "remuneracao":
      return laborEngine.remuneracao(withVersion as RemuneracaoInput);
    case "ferias":
      return laborEngine.ferias(withVersion as FeriasInput);
    case "fgts":
      return laborEngine.fgts(withVersion as FgtsInput);
    case "rescisao":
      return laborEngine.rescisao(withVersion as TerminationInput);
    case "liquidacao":
      return laborEngine.liquidacao(withVersion as LiquidacaoInput);
    default:
      throw new AppError("VALIDATION_ERROR", "Tipo de cálculo trabalhista não suportado.", [
        {
          path: "calculationType",
          message: "Use jornada, remuneracao, ferias, fgts, rescisao ou liquidacao.",
        },
      ]);
  }
}

/* ─── Cases ─── */

export async function listLaborCases(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    q?: string | undefined;
    clientId?: string | undefined;
    clientRole?: string | undefined;
    status?: string | undefined;
    judicialProcessId?: string | undefined;
    responsibleMembershipId?: string | undefined;
    limit: number;
    offset: number;
  },
) {
  authorize(account, organizationId, (access) => policyLaborCase(access, "labor.read"));
  const filters = [eq(laborCases.organizationId, organizationId)];
  if (query.clientId) filters.push(eq(laborCases.clientId, query.clientId));
  if (query.clientRole) {
    filters.push(
      eq(laborCases.clientRole, query.clientRole as typeof laborCases.$inferSelect.clientRole),
    );
  }
  if (query.status) {
    filters.push(eq(laborCases.status, query.status as typeof laborCases.$inferSelect.status));
  }
  if (query.judicialProcessId)
    filters.push(eq(laborCases.judicialProcessId, query.judicialProcessId));
  if (query.responsibleMembershipId) {
    filters.push(eq(laborCases.responsibleMembershipId, query.responsibleMembershipId));
  }
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    filters.push(ilike(laborCases.notes, pattern));
  }
  const where = and(...filters);
  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(laborCases)
      .where(where)
      .orderBy(desc(laborCases.updatedAt))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ value: count() }).from(laborCases).where(where),
  ]);
  return {
    items: rows.map(serializeLaborCase),
    laborCases: rows.map(serializeLaborCase),
    total: totalRow[0]?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function createLaborCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    clientId: string;
    legalMatterId: string;
    judicialProcessId?: string;
    responsibleMembershipId?: string;
    clientRole?: "employee" | "employer" | "other";
    status?: "draft" | "active" | "suspended" | "closed" | "archived";
    notes?: string;
  },
  meta: RequestMeta,
) {
  const actor = authorize(account, organizationId, (access) =>
    policyLaborCase(access, "labor.create"),
  );
  await assertClientInOrg(db, organizationId, input.clientId);
  await assertMatterInOrg(db, organizationId, input.legalMatterId);
  await assertJudicialInOrg(db, organizationId, input.judicialProcessId);
  await assertMembershipInOrg(db, organizationId, input.responsibleMembershipId);

  const [row] = await db
    .insert(laborCases)
    .values({
      organizationId,
      clientId: input.clientId,
      legalMatterId: input.legalMatterId,
      judicialProcessId: input.judicialProcessId ?? null,
      responsibleMembershipId: input.responsibleMembershipId ?? null,
      clientRole: input.clientRole ?? "employee",
      status: input.status ?? "draft",
      notes: input.notes ?? null,
      createdByMembershipId: actor.membershipId,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o caso trabalhista.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "labor.case_created",
    resourceType: "labor_case",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { clientRole: row.clientRole, status: row.status, legalMatterId: row.legalMatterId },
  });
  return { laborCase: serializeLaborCase(row) };
}

export async function getLaborCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  laborCaseId: string,
) {
  authorize(account, organizationId, (access) => policyLaborCase(access, "labor.read"));
  const row = await requireLaborCaseOr404(db, organizationId, laborCaseId);
  return { laborCase: serializeLaborCase(row) };
}

export async function updateLaborCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  laborCaseId: string,
  input: {
    judicialProcessId?: string | null;
    responsibleMembershipId?: string | null;
    clientRole?: "employee" | "employer" | "other";
    status?: "draft" | "active" | "suspended" | "closed" | "archived";
    notes?: string;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyLaborCase(access, "labor.update"));
  const existing = await requireLaborCaseOr404(db, organizationId, laborCaseId);
  if (input.judicialProcessId !== undefined) {
    await assertJudicialInOrg(db, organizationId, input.judicialProcessId);
  }
  if (input.responsibleMembershipId !== undefined) {
    await assertMembershipInOrg(db, organizationId, input.responsibleMembershipId);
  }
  const [row] = await db
    .update(laborCases)
    .set({
      ...(input.judicialProcessId !== undefined
        ? { judicialProcessId: input.judicialProcessId }
        : {}),
      ...(input.responsibleMembershipId !== undefined
        ? { responsibleMembershipId: input.responsibleMembershipId }
        : {}),
      ...(input.clientRole !== undefined ? { clientRole: input.clientRole } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(laborCases.id, existing.id), eq(laborCases.organizationId, organizationId)))
    .returning();
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este caso trabalhista.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "labor.case_updated",
    resourceType: "labor_case",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { status: row.status, clientRole: row.clientRole },
  });
  return { laborCase: serializeLaborCase(row) };
}

/* ─── Contracts ─── */

export async function listEmploymentContracts(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { laborCaseId?: string | undefined; limit: number; offset: number },
) {
  authorize(account, organizationId, (access) => policyEmploymentContract(access, "labor.read"));
  const filters = [eq(employmentContracts.organizationId, organizationId)];
  if (query.laborCaseId) filters.push(eq(employmentContracts.laborCaseId, query.laborCaseId));
  const where = and(...filters);
  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(employmentContracts)
      .where(where)
      .orderBy(desc(employmentContracts.updatedAt))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ value: count() }).from(employmentContracts).where(where),
  ]);
  return {
    items: rows.map(serializeContract),
    contracts: rows.map(serializeContract),
    total: totalRow[0]?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function createEmploymentContract(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    laborCaseId: string;
    employeeClientId?: string;
    employerName: string;
    employerDocument?: string;
    admissionDate: string;
    terminationDate?: string | null;
    contractType?: string;
    jobTitle?: string;
    workplace?: string;
    salaryCents?: number;
    remunerationStructure?: Record<string, unknown>;
    weeklyHours?: number;
    status?: typeof employmentContracts.$inferSelect.status;
    source?: typeof employmentContracts.$inferSelect.source;
  },
  meta: RequestMeta,
) {
  const actor = authorize(account, organizationId, (access) =>
    policyEmploymentContract(access, "labor.manage_contract"),
  );
  await requireLaborCaseOr404(db, organizationId, input.laborCaseId);
  if (input.employeeClientId) await assertClientInOrg(db, organizationId, input.employeeClientId);

  const [row] = await db
    .insert(employmentContracts)
    .values({
      organizationId,
      laborCaseId: input.laborCaseId,
      employeeClientId: input.employeeClientId ?? null,
      employerName: input.employerName,
      employerDocument: input.employerDocument ?? null,
      admissionDate: new Date(input.admissionDate),
      terminationDate: parseDate(input.terminationDate) ?? null,
      contractType: input.contractType ?? null,
      jobTitle: input.jobTitle ?? null,
      workplace: input.workplace ?? null,
      salaryCents: input.salaryCents ?? 0,
      remunerationStructure: input.remunerationStructure ?? null,
      weeklyHours: input.weeklyHours ?? null,
      status: input.status ?? "draft",
      source: input.source ?? "manual",
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o contrato.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "labor.contract_created",
    resourceType: "employment_contract",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: {
      salaryCents: row.salaryCents,
      status: row.status,
      actorMembershipId: actor.membershipId,
    },
  });
  return { contract: serializeContract(row) };
}

export async function updateEmploymentContract(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
  input: {
    employeeClientId?: string | null;
    employerName?: string;
    employerDocument?: string | null;
    admissionDate?: string;
    terminationDate?: string | null;
    contractType?: string | null;
    jobTitle?: string | null;
    workplace?: string | null;
    salaryCents?: number;
    remunerationStructure?: Record<string, unknown> | null;
    weeklyHours?: number | null;
    status?: typeof employmentContracts.$inferSelect.status;
    source?: typeof employmentContracts.$inferSelect.source;
  },
  meta: RequestMeta,
) {
  const actor = authorize(account, organizationId, (access) =>
    policyEmploymentContract(access, "labor.manage_contract"),
  );
  const existing = await db.query.employmentContracts.findFirst({
    where: and(
      eq(employmentContracts.id, contractId),
      eq(employmentContracts.organizationId, organizationId),
    ),
  });
  if (!existing) throw new AppError("NOT_FOUND", "Não encontramos este contrato.");

  if (input.employeeClientId) {
    await assertClientInOrg(db, organizationId, input.employeeClientId);
  }

  const historyEntries: Array<{
    kind: typeof employmentContractHistory.$inferSelect.kind;
    previousValue: Record<string, unknown>;
    newValue: Record<string, unknown>;
  }> = [];
  const now = new Date();

  if (input.jobTitle !== undefined && input.jobTitle !== existing.jobTitle) {
    historyEntries.push({
      kind: "job_title",
      previousValue: { jobTitle: existing.jobTitle },
      newValue: { jobTitle: input.jobTitle },
    });
  }
  if (input.salaryCents !== undefined && input.salaryCents !== existing.salaryCents) {
    historyEntries.push({
      kind: "salary",
      previousValue: { salaryCents: existing.salaryCents },
      newValue: { salaryCents: input.salaryCents },
    });
  }
  if (input.workplace !== undefined && input.workplace !== existing.workplace) {
    historyEntries.push({
      kind: "workplace",
      previousValue: { workplace: existing.workplace },
      newValue: { workplace: input.workplace },
    });
  }
  if (input.weeklyHours !== undefined && input.weeklyHours !== existing.weeklyHours) {
    historyEntries.push({
      kind: "schedule",
      previousValue: { weeklyHours: existing.weeklyHours },
      newValue: { weeklyHours: input.weeklyHours },
    });
  }

  const [row] = await db
    .update(employmentContracts)
    .set({
      ...(input.employeeClientId !== undefined ? { employeeClientId: input.employeeClientId } : {}),
      ...(input.employerName !== undefined ? { employerName: input.employerName } : {}),
      ...(input.employerDocument !== undefined ? { employerDocument: input.employerDocument } : {}),
      ...(input.admissionDate !== undefined
        ? { admissionDate: new Date(input.admissionDate) }
        : {}),
      ...(input.terminationDate !== undefined
        ? { terminationDate: parseDate(input.terminationDate) ?? null }
        : {}),
      ...(input.contractType !== undefined ? { contractType: input.contractType } : {}),
      ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
      ...(input.workplace !== undefined ? { workplace: input.workplace } : {}),
      ...(input.salaryCents !== undefined ? { salaryCents: input.salaryCents } : {}),
      ...(input.remunerationStructure !== undefined
        ? { remunerationStructure: input.remunerationStructure }
        : {}),
      ...(input.weeklyHours !== undefined ? { weeklyHours: input.weeklyHours } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.source !== undefined ? { source: input.source } : {}),
      updatedAt: now,
    })
    .where(
      and(
        eq(employmentContracts.id, contractId),
        eq(employmentContracts.organizationId, organizationId),
      ),
    )
    .returning();
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este contrato.");

  for (const entry of historyEntries) {
    await db.insert(employmentContractHistory).values({
      organizationId,
      contractId: row.id,
      kind: entry.kind,
      effectiveFrom: now,
      previousValue: entry.previousValue,
      newValue: entry.newValue,
      source: "manual",
      actorMembershipId: actor.membershipId,
    });
  }

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "labor.contract_changed",
    resourceType: "employment_contract",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: {
      salaryCents: row.salaryCents,
      jobTitle: row.jobTitle,
      historyKinds: historyEntries.map((e) => e.kind),
    },
  });
  return { contract: serializeContract(row), historyCreated: historyEntries.length };
}

export async function listContractHistory(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
) {
  authorize(account, organizationId, (access) => policyEmploymentContract(access, "labor.read"));
  const contract = await db.query.employmentContracts.findFirst({
    where: and(
      eq(employmentContracts.id, contractId),
      eq(employmentContracts.organizationId, organizationId),
    ),
    columns: { id: true },
  });
  if (!contract) throw new AppError("NOT_FOUND", "Não encontramos este contrato.");
  const rows = await db
    .select()
    .from(employmentContractHistory)
    .where(
      and(
        eq(employmentContractHistory.contractId, contractId),
        eq(employmentContractHistory.organizationId, organizationId),
      ),
    )
    .orderBy(desc(employmentContractHistory.effectiveFrom));
  return { items: rows.map(serializeHistory), history: rows.map(serializeHistory) };
}

export async function addContractHistory(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    contractId: string;
    kind?: typeof employmentContractHistory.$inferSelect.kind;
    effectiveFrom: string;
    effectiveTo?: string | null;
    previousValue?: Record<string, unknown>;
    newValue?: Record<string, unknown>;
    notes?: string;
    source?: typeof employmentContractHistory.$inferSelect.source;
    documentId?: string;
  },
  meta: RequestMeta,
) {
  const actor = authorize(account, organizationId, (access) =>
    policyEmploymentContract(access, "labor.manage_contract"),
  );
  const contract = await db.query.employmentContracts.findFirst({
    where: and(
      eq(employmentContracts.id, input.contractId),
      eq(employmentContracts.organizationId, organizationId),
    ),
  });
  if (!contract) throw new AppError("NOT_FOUND", "Não encontramos este contrato.");
  if (input.documentId) {
    await requireDocumentInOrg(db, organizationId, input.documentId);
  }
  const [row] = await db
    .insert(employmentContractHistory)
    .values({
      organizationId,
      contractId: input.contractId,
      kind: input.kind ?? "other",
      effectiveFrom: new Date(input.effectiveFrom),
      effectiveTo: parseDate(input.effectiveTo) ?? null,
      previousValue: input.previousValue ?? null,
      newValue: input.newValue ?? null,
      notes: input.notes ?? null,
      source: input.source ?? "manual",
      actorMembershipId: actor.membershipId,
      documentId: input.documentId ?? null,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o histórico.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "labor.contract_changed",
    resourceType: "employment_contract_history",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { kind: row.kind, contractId: row.contractId },
  });
  return { history: serializeHistory(row) };
}

/* ─── Schedules / time ─── */

export async function listWorkSchedules(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { laborCaseId?: string | undefined; limit: number; offset: number },
) {
  authorize(account, organizationId, (access) => policyWorkSchedule(access, "labor.read"));
  const filters = [eq(workSchedules.organizationId, organizationId)];
  if (query.laborCaseId) filters.push(eq(workSchedules.laborCaseId, query.laborCaseId));
  const where = and(...filters);
  const rows = await db
    .select()
    .from(workSchedules)
    .where(where)
    .orderBy(desc(workSchedules.updatedAt))
    .limit(query.limit)
    .offset(query.offset);
  return { items: rows.map(serializeSchedule), schedules: rows.map(serializeSchedule) };
}

export async function createWorkSchedule(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    laborCaseId: string;
    contractId?: string;
    name: string;
    weeklyHours?: number;
    schedulePattern?: Record<string, unknown>;
    includesNightShift?: boolean;
    includesOvertimeBank?: boolean;
    effectiveFrom?: string;
    effectiveTo?: string | null;
    notes?: string;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyWorkSchedule(access, "labor.manage_schedule"),
  );
  await requireLaborCaseOr404(db, organizationId, input.laborCaseId);
  if (input.contractId) {
    const contract = await db.query.employmentContracts.findFirst({
      where: and(
        eq(employmentContracts.id, input.contractId),
        eq(employmentContracts.organizationId, organizationId),
      ),
      columns: { id: true },
    });
    if (!contract) throw new AppError("NOT_FOUND", "Não encontramos este contrato.");
  }
  const [row] = await db
    .insert(workSchedules)
    .values({
      organizationId,
      laborCaseId: input.laborCaseId,
      contractId: input.contractId ?? null,
      name: input.name,
      weeklyHours: input.weeklyHours ?? null,
      schedulePattern: input.schedulePattern ?? null,
      includesNightShift: input.includesNightShift ?? false,
      includesOvertimeBank: input.includesOvertimeBank ?? false,
      effectiveFrom: parseDate(input.effectiveFrom) ?? null,
      effectiveTo: parseDate(input.effectiveTo) ?? null,
      notes: input.notes ?? null,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a jornada.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "labor.schedule_changed",
    resourceType: "work_schedule",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { schedule: serializeSchedule(row) };
}

export async function createWorkTimeRecord(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    laborCaseId: string;
    contractId?: string;
    scheduleId?: string;
    workDate: string;
    clockInAt?: string;
    clockOutAt?: string;
    breakMinutes?: number;
    overtimeMinutes?: number;
    nightMinutes?: number;
    notes?: string;
    source?: typeof workTimeRecords.$inferSelect.source;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyWorkSchedule(access, "labor.manage_schedule"),
  );
  await requireLaborCaseOr404(db, organizationId, input.laborCaseId);
  const [row] = await db
    .insert(workTimeRecords)
    .values({
      organizationId,
      laborCaseId: input.laborCaseId,
      contractId: input.contractId ?? null,
      scheduleId: input.scheduleId ?? null,
      workDate: new Date(input.workDate),
      clockInAt: parseDate(input.clockInAt) ?? null,
      clockOutAt: parseDate(input.clockOutAt) ?? null,
      breakMinutes: input.breakMinutes ?? null,
      overtimeMinutes: input.overtimeMinutes ?? null,
      nightMinutes: input.nightMinutes ?? null,
      notes: input.notes ?? null,
      source: input.source ?? "manual",
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o registro de ponto.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "labor.schedule_changed",
    resourceType: "work_time_record",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { timeRecord: serializeTimeRecord(row) };
}

export async function listWorkTimeRecords(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { laborCaseId?: string | undefined; limit: number; offset: number },
) {
  authorize(account, organizationId, (access) => policyWorkSchedule(access, "labor.read"));
  const filters = [eq(workTimeRecords.organizationId, organizationId)];
  if (query.laborCaseId) filters.push(eq(workTimeRecords.laborCaseId, query.laborCaseId));
  const rows = await db
    .select()
    .from(workTimeRecords)
    .where(and(...filters))
    .orderBy(desc(workTimeRecords.workDate))
    .limit(query.limit)
    .offset(query.offset);
  return { items: rows.map(serializeTimeRecord), timeRecords: rows.map(serializeTimeRecord) };
}

/* ─── Remuneration ─── */

export async function listLaborRemuneration(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { laborCaseId?: string | undefined; limit: number; offset: number },
) {
  authorize(account, organizationId, (access) => policyLaborRemuneration(access, "labor.read"));
  const filters = [eq(laborRemunerationItems.organizationId, organizationId)];
  if (query.laborCaseId) filters.push(eq(laborRemunerationItems.laborCaseId, query.laborCaseId));
  const rows = await db
    .select()
    .from(laborRemunerationItems)
    .where(and(...filters))
    .orderBy(desc(laborRemunerationItems.createdAt))
    .limit(query.limit)
    .offset(query.offset);
  return {
    items: rows.map(serializeRemuneration),
    remunerationItems: rows.map(serializeRemuneration),
  };
}

export async function createLaborRemunerationItem(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    laborCaseId: string;
    contractId?: string;
    itemType?: typeof laborRemunerationItems.$inferSelect.itemType;
    description: string;
    competence?: string;
    amountCents?: number;
    isCredit?: boolean;
    source?: typeof laborRemunerationItems.$inferSelect.source;
    documentId?: string;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyLaborRemuneration(access, "labor.manage_remuneration"),
  );
  await requireLaborCaseOr404(db, organizationId, input.laborCaseId);
  const [row] = await db
    .insert(laborRemunerationItems)
    .values({
      organizationId,
      laborCaseId: input.laborCaseId,
      contractId: input.contractId ?? null,
      itemType: input.itemType ?? "other",
      description: input.description,
      competence: input.competence ?? null,
      amountCents: input.amountCents ?? 0,
      isCredit: input.isCredit ?? true,
      source: input.source ?? "manual",
      documentId: input.documentId ?? null,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o item de remuneração.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "labor.remuneration_changed",
    resourceType: "labor_remuneration_item",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { amountCents: row.amountCents, itemType: row.itemType },
  });
  return { remunerationItem: serializeRemuneration(row) };
}

/* ─── Vacations ─── */

export async function listVacations(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { laborCaseId?: string | undefined; limit: number; offset: number },
) {
  authorize(account, organizationId, (access) => policyLaborCase(access, "labor.read"));
  const filters = [eq(vacationPeriods.organizationId, organizationId)];
  if (query.laborCaseId) filters.push(eq(vacationPeriods.laborCaseId, query.laborCaseId));
  const rows = await db
    .select()
    .from(vacationPeriods)
    .where(and(...filters))
    .orderBy(desc(vacationPeriods.accrualStart))
    .limit(query.limit)
    .offset(query.offset);
  return { items: rows.map(serializeVacation), vacations: rows.map(serializeVacation) };
}

export async function createVacationPeriod(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    laborCaseId: string;
    contractId?: string;
    accrualStart: string;
    accrualEnd: string;
    concessionStart?: string;
    concessionEnd?: string;
    enjoyedDays?: number;
    soldDays?: number;
    paymentDate?: string;
    amountCents?: number;
    status?: typeof vacationPeriods.$inferSelect.status;
    notes?: string;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyLaborCase(access, "labor.update"));
  await requireLaborCaseOr404(db, organizationId, input.laborCaseId);
  const [row] = await db
    .insert(vacationPeriods)
    .values({
      organizationId,
      laborCaseId: input.laborCaseId,
      contractId: input.contractId ?? null,
      accrualStart: new Date(input.accrualStart),
      accrualEnd: new Date(input.accrualEnd),
      concessionStart: parseDate(input.concessionStart) ?? null,
      concessionEnd: parseDate(input.concessionEnd) ?? null,
      enjoyedDays: input.enjoyedDays ?? 0,
      soldDays: input.soldDays ?? 0,
      paymentDate: parseDate(input.paymentDate) ?? null,
      amountCents: input.amountCents ?? null,
      status: input.status ?? "accruing",
      notes: input.notes ?? null,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o período de férias.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "labor.vacation_recorded",
    resourceType: "vacation_period",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { vacation: serializeVacation(row) };
}

/* ─── FGTS ─── */

export async function listFgtsRecords(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { laborCaseId?: string | undefined; limit: number; offset: number },
) {
  authorize(account, organizationId, (access) => policyLaborFgts(access, "labor.read"));
  const filters = [eq(fgtsRecords.organizationId, organizationId)];
  if (query.laborCaseId) filters.push(eq(fgtsRecords.laborCaseId, query.laborCaseId));
  const rows = await db
    .select()
    .from(fgtsRecords)
    .where(and(...filters))
    .orderBy(desc(fgtsRecords.competence))
    .limit(query.limit)
    .offset(query.offset);
  return {
    items: rows.map(serializeFgts),
    fgtsRecords: rows.map(serializeFgts),
    disclaimer: FGTS_ESTIMATE_LABEL,
  };
}

export async function createFgtsRecord(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    laborCaseId: string;
    contractId?: string;
    competence: string;
    baseAmountCents?: number;
    dueAmountCents?: number;
    paidAmountCents?: number;
    paymentDate?: string;
    source?: typeof fgtsRecords.$inferSelect.source;
    reviewStatus?: typeof fgtsRecords.$inferSelect.reviewStatus;
    notes?: string;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyLaborFgts(access, "labor.manage_fgts"));
  await requireLaborCaseOr404(db, organizationId, input.laborCaseId);
  const [row] = await db
    .insert(fgtsRecords)
    .values({
      organizationId,
      laborCaseId: input.laborCaseId,
      contractId: input.contractId ?? null,
      competence: input.competence,
      baseAmountCents: input.baseAmountCents ?? 0,
      dueAmountCents: input.dueAmountCents ?? 0,
      paidAmountCents: input.paidAmountCents ?? null,
      paymentDate: parseDate(input.paymentDate) ?? null,
      source: input.source ?? "manual",
      reviewStatus: input.reviewStatus ?? "unreviewed",
      notes: input.notes ?? null,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o registro de FGTS.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "labor.fgts_recorded",
    resourceType: "fgts_record",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: {
      competence: row.competence,
      dueAmountCents: row.dueAmountCents,
      estimateLabel: FGTS_ESTIMATE_LABEL,
    },
  });
  return {
    fgtsRecord: serializeFgts(row),
    disclaimer: FGTS_ESTIMATE_LABEL,
  };
}

/* ─── Terminations ─── */

export async function listEmploymentTerminations(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { laborCaseId?: string | undefined; limit: number; offset: number },
) {
  authorize(account, organizationId, (access) => policyLaborTermination(access, "labor.read"));
  const filters = [eq(employmentTerminations.organizationId, organizationId)];
  if (query.laborCaseId) filters.push(eq(employmentTerminations.laborCaseId, query.laborCaseId));
  const rows = await db
    .select()
    .from(employmentTerminations)
    .where(and(...filters))
    .orderBy(desc(employmentTerminations.terminationDate))
    .limit(query.limit)
    .offset(query.offset);
  return { items: rows.map(serializeTermination), terminations: rows.map(serializeTermination) };
}

export async function createEmploymentTermination(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    laborCaseId: string;
    contractId: string;
    terminationType: string;
    noticeType?: string;
    noticeStart?: string;
    noticeEnd?: string;
    terminationDate: string;
    reason?: string;
    lastSalaryCents?: number;
    status?: typeof employmentTerminations.$inferSelect.status;
    source?: typeof employmentTerminations.$inferSelect.source;
    documentId?: string;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyLaborTermination(access, "labor.manage_termination"),
  );
  await requireLaborCaseOr404(db, organizationId, input.laborCaseId);
  const contract = await db.query.employmentContracts.findFirst({
    where: and(
      eq(employmentContracts.id, input.contractId),
      eq(employmentContracts.organizationId, organizationId),
      eq(employmentContracts.laborCaseId, input.laborCaseId),
    ),
  });
  if (!contract) throw new AppError("NOT_FOUND", "Não encontramos este contrato no caso.");

  const [row] = await db
    .insert(employmentTerminations)
    .values({
      organizationId,
      laborCaseId: input.laborCaseId,
      contractId: input.contractId,
      terminationType: input.terminationType,
      noticeType: input.noticeType ?? null,
      noticeStart: parseDate(input.noticeStart) ?? null,
      noticeEnd: parseDate(input.noticeEnd) ?? null,
      terminationDate: new Date(input.terminationDate),
      reason: input.reason ?? null,
      lastSalaryCents: input.lastSalaryCents ?? null,
      status: input.status ?? "draft",
      source: input.source ?? "manual",
      documentId: input.documentId ?? null,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar a rescisão.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "labor.termination_recorded",
    resourceType: "employment_termination",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { terminationType: row.terminationType, lastSalaryCents: row.lastSalaryCents },
  });
  return { termination: serializeTermination(row) };
}

/* ─── Claims ─── */

export async function listLaborClaims(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { laborCaseId?: string | undefined; limit: number; offset: number },
) {
  authorize(account, organizationId, (access) => policyLaborClaims(access, "labor.read"));
  const filters = [eq(laborClaimItems.organizationId, organizationId)];
  if (query.laborCaseId) filters.push(eq(laborClaimItems.laborCaseId, query.laborCaseId));
  const rows = await db
    .select()
    .from(laborClaimItems)
    .where(and(...filters))
    .orderBy(desc(laborClaimItems.createdAt))
    .limit(query.limit)
    .offset(query.offset);
  return { items: rows.map(serializeClaim), claims: rows.map(serializeClaim) };
}

export async function createLaborClaimItem(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    laborCaseId: string;
    claimType: string;
    title: string;
    description?: string;
    amountCents?: number;
    periodStart?: string;
    periodEnd?: string;
    status?: typeof laborClaimItems.$inferSelect.status;
    facts?: string;
    evidenceNotes?: string;
    calculationId?: string;
    documentId?: string;
    metadata?: Record<string, unknown>;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyLaborClaims(access, "labor.manage_claims"));
  await requireLaborCaseOr404(db, organizationId, input.laborCaseId);
  const [row] = await db
    .insert(laborClaimItems)
    .values({
      organizationId,
      laborCaseId: input.laborCaseId,
      claimType: input.claimType,
      title: input.title,
      description: input.description ?? null,
      amountCents: input.amountCents ?? null,
      periodStart: parseDate(input.periodStart) ?? null,
      periodEnd: parseDate(input.periodEnd) ?? null,
      status: input.status ?? "draft",
      facts: input.facts ?? null,
      evidenceNotes: input.evidenceNotes ?? null,
      calculationId: input.calculationId ?? null,
      documentId: input.documentId ?? null,
      metadata: input.metadata ?? null,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o pedido.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "labor.claim_created",
    resourceType: "labor_claim_item",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { claimType: row.claimType, amountCents: row.amountCents },
  });
  return { claim: serializeClaim(row) };
}

/* ─── Rule sets ─── */

export async function listLaborRuleSets(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  authorize(account, organizationId, (access) => policyLaborCalculation(access, "labor.read"));
  const rows = await db
    .select()
    .from(laborRuleSets)
    .orderBy(desc(laborRuleSets.effectiveFrom), desc(laborRuleSets.version));
  return { items: rows.map(serializeRuleSet), ruleSets: rows.map(serializeRuleSet) };
}

export async function createLaborRuleSet(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    key: string;
    version: string;
    effectiveFrom: string;
    effectiveTo?: string | null;
    source?: string;
    sourceUrl?: string;
    status?: typeof laborRuleSets.$inferSelect.status;
    metadata?: Record<string, unknown>;
    locked?: boolean;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyLaborCalculation(access, "labor.calculate"));
  const [row] = await db
    .insert(laborRuleSets)
    .values({
      key: input.key,
      version: input.version,
      effectiveFrom: new Date(input.effectiveFrom),
      effectiveTo: parseDate(input.effectiveTo) ?? null,
      source: input.source ?? "system_seed",
      sourceUrl: input.sourceUrl ?? null,
      status: input.status ?? "draft",
      metadata: input.metadata ?? null,
      locked: input.locked ?? false,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o rule set.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "labor.rule_set_created",
    resourceType: "labor_rule_set",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { key: row.key, version: row.version },
  });
  return { ruleSet: serializeRuleSet(row) };
}

/* ─── Calculations ─── */

export async function listLaborCalculations(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { laborCaseId?: string | undefined; limit: number; offset: number },
) {
  authorize(account, organizationId, (access) => policyLaborCalculation(access, "labor.read"));
  const filters = [eq(laborCalculations.organizationId, organizationId)];
  if (query.laborCaseId) filters.push(eq(laborCalculations.laborCaseId, query.laborCaseId));
  const rows = await db
    .select()
    .from(laborCalculations)
    .where(and(...filters))
    .orderBy(desc(laborCalculations.createdAt))
    .limit(query.limit)
    .offset(query.offset);
  return { items: rows.map(serializeCalculation), calculations: rows.map(serializeCalculation) };
}

export async function createLaborCalculation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    laborCaseId: string;
    calculationType: string;
    referenceDate: string;
    ruleSetId?: string;
    ruleSetVersion: string;
    inputSnapshot?: Record<string, unknown>;
    resultSnapshot?: Record<string, unknown>;
    status?: typeof laborCalculations.$inferSelect.status;
  },
  meta: RequestMeta,
) {
  const actor = authorize(account, organizationId, (access) =>
    policyLaborCalculation(access, "labor.calculate"),
  );
  await requireLaborCaseOr404(db, organizationId, input.laborCaseId);
  if (input.ruleSetId) {
    const ruleSet = await db.query.laborRuleSets.findFirst({
      where: eq(laborRuleSets.id, input.ruleSetId),
      columns: { id: true, locked: true },
    });
    if (!ruleSet) throw new AppError("NOT_FOUND", "Não encontramos este rule set.");
  }
  const [row] = await db
    .insert(laborCalculations)
    .values({
      organizationId,
      laborCaseId: input.laborCaseId,
      calculationType: input.calculationType,
      referenceDate: new Date(input.referenceDate),
      ruleSetId: input.ruleSetId ?? null,
      ruleSetVersion: input.ruleSetVersion,
      inputSnapshot: input.inputSnapshot ?? {},
      resultSnapshot: input.resultSnapshot ?? null,
      status: input.status ?? "draft",
      createdByMembershipId: actor.membershipId,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o cálculo.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "labor.calculation_created",
    resourceType: "labor_calculation",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { calculationType: row.calculationType, ruleSetVersion: row.ruleSetVersion },
  });
  return { calculation: serializeCalculation(row) };
}

export async function getLaborCalculation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  calculationId: string,
) {
  authorize(account, organizationId, (access) => policyLaborCalculation(access, "labor.read"));
  const row = await db.query.laborCalculations.findFirst({
    where: and(
      eq(laborCalculations.id, calculationId),
      eq(laborCalculations.organizationId, organizationId),
    ),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este cálculo.");
  return { calculation: serializeCalculation(row) };
}

export async function runLaborCalculation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  calculationId: string,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyLaborCalculation(access, "labor.calculate"));
  const existing = await db.query.laborCalculations.findFirst({
    where: and(
      eq(laborCalculations.id, calculationId),
      eq(laborCalculations.organizationId, organizationId),
    ),
  });
  if (!existing) throw new AppError("NOT_FOUND", "Não encontramos este cálculo.");
  assertCalculationMutable(existing.status);

  let envelope: CalculationEnvelope<unknown>;
  try {
    envelope = runEngine(
      existing.calculationType,
      existing.inputSnapshot ?? {},
      existing.ruleSetVersion,
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "VALIDATION_ERROR",
      error instanceof Error ? error.message : "Entrada de cálculo inválida.",
    );
  }

  const resultSnapshot = {
    ...envelope,
    reviewHint: "review_required" as const,
  };

  const [row] = await db
    .update(laborCalculations)
    .set({
      resultSnapshot,
      status: "review_required",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(laborCalculations.id, calculationId),
        eq(laborCalculations.organizationId, organizationId),
      ),
    )
    .returning();
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este cálculo.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "labor.calculation_run",
    resourceType: "labor_calculation",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { status: row.status, calculationType: row.calculationType },
  });
  return { calculation: serializeCalculation(row), envelope: resultSnapshot };
}

export async function reviewLaborCalculation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  calculationId: string,
  input: { status: "reviewed" | "approved"; notes?: string },
  meta: RequestMeta,
) {
  const actor = authorize(account, organizationId, (access) =>
    policyLaborCalculation(access, "labor.review_calculation"),
  );
  const existing = await db.query.laborCalculations.findFirst({
    where: and(
      eq(laborCalculations.id, calculationId),
      eq(laborCalculations.organizationId, organizationId),
    ),
  });
  if (!existing) throw new AppError("NOT_FOUND", "Não encontramos este cálculo.");
  assertCalculationMutable(existing.status);
  if (existing.status === "draft") {
    throw new AppError("CONFLICT", "Execute o cálculo antes da revisão.");
  }

  const [row] = await db
    .update(laborCalculations)
    .set({
      status: input.status,
      reviewedByMembershipId: actor.membershipId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
      ...(input.notes
        ? {
            resultSnapshot: {
              ...(existing.resultSnapshot ?? {}),
              reviewNotes: input.notes,
            },
          }
        : {}),
    })
    .where(
      and(
        eq(laborCalculations.id, calculationId),
        eq(laborCalculations.organizationId, organizationId),
      ),
    )
    .returning();
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este cálculo.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "labor.calculation_reviewed",
    resourceType: "labor_calculation",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { status: row.status },
  });
  return { calculation: serializeCalculation(row) };
}

/* ─── Liquidations ─── */

export async function listLaborLiquidations(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { laborCaseId?: string | undefined; limit: number; offset: number },
) {
  authorize(account, organizationId, (access) => policyLaborLiquidation(access, "labor.read"));
  const filters = [eq(laborLiquidations.organizationId, organizationId)];
  if (query.laborCaseId) filters.push(eq(laborLiquidations.laborCaseId, query.laborCaseId));
  const rows = await db
    .select()
    .from(laborLiquidations)
    .where(and(...filters))
    .orderBy(desc(laborLiquidations.createdAt))
    .limit(query.limit)
    .offset(query.offset);
  return { items: rows.map(serializeLiquidation), liquidations: rows.map(serializeLiquidation) };
}

export async function createLaborLiquidation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    laborCaseId: string;
    calculationId?: string;
    referenceDate: string;
    ruleSetVersion?: string;
    itemsSnapshot?: unknown[];
    periodsSnapshot?: unknown[];
    correctionIndex?: string;
    interestRule?: string;
    contributionsCents?: number;
    deductionsCents?: number;
    totalPrincipalCents?: number;
    totalCorrectionCents?: number;
    totalInterestCents?: number;
    totalCents?: number;
    status?: typeof laborLiquidations.$inferSelect.status;
    notes?: string;
  },
  meta: RequestMeta,
) {
  const actor = authorize(account, organizationId, (access) =>
    policyLaborLiquidation(access, "labor.liquidate"),
  );
  await requireLaborCaseOr404(db, organizationId, input.laborCaseId);

  let totals = {
    contributionsCents: input.contributionsCents ?? 0,
    deductionsCents: input.deductionsCents ?? 0,
    totalPrincipalCents: input.totalPrincipalCents ?? 0,
    totalCorrectionCents: input.totalCorrectionCents ?? 0,
    totalInterestCents: input.totalInterestCents ?? 0,
    totalCents: input.totalCents ?? 0,
    itemsSnapshot: input.itemsSnapshot ?? null,
    ruleSetVersion: input.ruleSetVersion ?? null,
  };

  if (input.calculationId) {
    const calc = await db.query.laborCalculations.findFirst({
      where: and(
        eq(laborCalculations.id, input.calculationId),
        eq(laborCalculations.organizationId, organizationId),
      ),
    });
    if (!calc) throw new AppError("NOT_FOUND", "Não encontramos este cálculo.");
    if (calc.calculationType === "liquidacao" && calc.resultSnapshot) {
      const snapshot = calc.resultSnapshot as {
        result?: {
          totalPrincipalCents?: number;
          totalCorrectionCents?: number;
          totalInterestCents?: number;
          totalDiscountsCents?: number;
          totalCents?: number;
        };
        ruleSetVersion?: string;
      };
      const result = snapshot.result;
      if (result) {
        totals = {
          contributionsCents: totals.contributionsCents,
          deductionsCents: result.totalDiscountsCents ?? totals.deductionsCents,
          totalPrincipalCents: result.totalPrincipalCents ?? totals.totalPrincipalCents,
          totalCorrectionCents: result.totalCorrectionCents ?? totals.totalCorrectionCents,
          totalInterestCents: result.totalInterestCents ?? totals.totalInterestCents,
          totalCents: result.totalCents ?? totals.totalCents,
          itemsSnapshot: totals.itemsSnapshot ?? [calc.resultSnapshot],
          ruleSetVersion: snapshot.ruleSetVersion ?? calc.ruleSetVersion,
        };
      }
    }
  }

  const [row] = await db
    .insert(laborLiquidations)
    .values({
      organizationId,
      laborCaseId: input.laborCaseId,
      calculationId: input.calculationId ?? null,
      referenceDate: new Date(input.referenceDate),
      ruleSetVersion: totals.ruleSetVersion,
      itemsSnapshot: totals.itemsSnapshot,
      periodsSnapshot: input.periodsSnapshot ?? null,
      correctionIndex: input.correctionIndex ?? null,
      interestRule: input.interestRule ?? null,
      contributionsCents: totals.contributionsCents,
      deductionsCents: totals.deductionsCents,
      totalPrincipalCents: totals.totalPrincipalCents,
      totalCorrectionCents: totals.totalCorrectionCents,
      totalInterestCents: totals.totalInterestCents,
      totalCents: totals.totalCents,
      status: input.status ?? "draft",
      notes: input.notes ?? null,
      createdByMembershipId: actor.membershipId,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a liquidação.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "labor.liquidation_created",
    resourceType: "labor_liquidation",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { totalCents: row.totalCents, status: row.status },
  });
  return { liquidation: serializeLiquidation(row) };
}

/* ─── Timeline / documents / suggestions ─── */

export async function getLaborCaseTimeline(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  laborCaseId: string,
) {
  authorize(account, organizationId, (access) => policyLaborCase(access, "labor.read"));
  const laborCase = await requireLaborCaseOr404(db, organizationId, laborCaseId);

  const [
    contracts,
    history,
    schedules,
    vacations,
    terminations,
    claims,
    calculations,
    liquidations,
    fgts,
  ] = await Promise.all([
    db
      .select()
      .from(employmentContracts)
      .where(
        and(
          eq(employmentContracts.laborCaseId, laborCaseId),
          eq(employmentContracts.organizationId, organizationId),
        ),
      ),
    db
      .select()
      .from(employmentContractHistory)
      .where(eq(employmentContractHistory.organizationId, organizationId)),
    db
      .select()
      .from(workSchedules)
      .where(
        and(
          eq(workSchedules.laborCaseId, laborCaseId),
          eq(workSchedules.organizationId, organizationId),
        ),
      ),
    db
      .select()
      .from(vacationPeriods)
      .where(
        and(
          eq(vacationPeriods.laborCaseId, laborCaseId),
          eq(vacationPeriods.organizationId, organizationId),
        ),
      ),
    db
      .select()
      .from(employmentTerminations)
      .where(
        and(
          eq(employmentTerminations.laborCaseId, laborCaseId),
          eq(employmentTerminations.organizationId, organizationId),
        ),
      ),
    db
      .select()
      .from(laborClaimItems)
      .where(
        and(
          eq(laborClaimItems.laborCaseId, laborCaseId),
          eq(laborClaimItems.organizationId, organizationId),
        ),
      ),
    db
      .select()
      .from(laborCalculations)
      .where(
        and(
          eq(laborCalculations.laborCaseId, laborCaseId),
          eq(laborCalculations.organizationId, organizationId),
        ),
      ),
    db
      .select()
      .from(laborLiquidations)
      .where(
        and(
          eq(laborLiquidations.laborCaseId, laborCaseId),
          eq(laborLiquidations.organizationId, organizationId),
        ),
      ),
    db
      .select()
      .from(fgtsRecords)
      .where(
        and(
          eq(fgtsRecords.laborCaseId, laborCaseId),
          eq(fgtsRecords.organizationId, organizationId),
        ),
      ),
  ]);

  const contractIds = new Set(contracts.map((c) => c.id));
  const caseHistory = history.filter((h) => contractIds.has(h.contractId));

  type TimelineEvent = {
    at: string;
    kind: string;
    title: string;
    resourceId: string;
  };
  const events: TimelineEvent[] = [];

  events.push({
    at: laborCase.createdAt.toISOString(),
    kind: "case_created",
    title: "Caso trabalhista criado",
    resourceId: laborCase.id,
  });
  for (const c of contracts) {
    events.push({
      at: c.admissionDate.toISOString(),
      kind: "contract_admission",
      title: `Contratação — ${c.employerName}`,
      resourceId: c.id,
    });
  }
  for (const h of caseHistory) {
    events.push({
      at: h.effectiveFrom.toISOString(),
      kind: "contract_change",
      title: `Alteração contratual (${h.kind})`,
      resourceId: h.id,
    });
  }
  for (const s of schedules) {
    events.push({
      at: (s.effectiveFrom ?? s.createdAt).toISOString(),
      kind: "schedule",
      title: `Jornada — ${s.name}`,
      resourceId: s.id,
    });
  }
  for (const v of vacations) {
    events.push({
      at: v.accrualStart.toISOString(),
      kind: "vacation",
      title: "Período aquisitivo de férias",
      resourceId: v.id,
    });
  }
  for (const f of fgts) {
    events.push({
      at: f.createdAt.toISOString(),
      kind: "fgts",
      title: `FGTS informado ${f.competence}`,
      resourceId: f.id,
    });
  }
  for (const t of terminations) {
    events.push({
      at: t.terminationDate.toISOString(),
      kind: "termination",
      title: `Rescisão — ${t.terminationType}`,
      resourceId: t.id,
    });
  }
  for (const c of claims) {
    events.push({
      at: c.createdAt.toISOString(),
      kind: "claim",
      title: `Pedido — ${c.title}`,
      resourceId: c.id,
    });
  }
  for (const c of calculations) {
    events.push({
      at: c.createdAt.toISOString(),
      kind: "calculation",
      title: `Cálculo — ${c.calculationType}`,
      resourceId: c.id,
    });
  }
  for (const l of liquidations) {
    events.push({
      at: l.createdAt.toISOString(),
      kind: "liquidation",
      title: "Liquidação",
      resourceId: l.id,
    });
  }

  if (laborCase.judicialProcessId) {
    const hearings = await db
      .select()
      .from(judicialHearings)
      .where(eq(judicialHearings.judicialProcessId, laborCase.judicialProcessId))
      .orderBy(asc(judicialHearings.scheduledAt));
    for (const hearing of hearings) {
      events.push({
        at: hearing.scheduledAt.toISOString(),
        kind: "hearing",
        title: `Audiência — ${hearing.type}`,
        resourceId: hearing.id,
      });
    }
  }

  events.sort((a, b) => a.at.localeCompare(b.at));
  return { laborCaseId, events };
}

export async function linkLaborCaseDocument(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  laborCaseId: string,
  input: { documentId: string; linkType: string },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyLaborCase(access, "labor.update"));
  await requireLaborCaseOr404(db, organizationId, laborCaseId);
  if (!(LABOR_DOCUMENT_LINK_TYPES as readonly string[]).includes(input.linkType)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Tipo de vínculo documental inválido para o caso trabalhista.",
    );
  }
  const doc = await requireDocumentInOrg(db, organizationId, input.documentId);
  await assertCanReadDocument(db, account, organizationId, doc);

  const existing = await db.query.documentLinks.findFirst({
    where: and(
      eq(documentLinks.organizationId, organizationId),
      eq(documentLinks.documentId, doc.id),
      eq(documentLinks.targetType, LINK_TARGET_LABOR_CASE),
      eq(documentLinks.targetId, laborCaseId),
      eq(documentLinks.linkType, input.linkType),
    ),
  });
  if (existing) {
    return {
      link: {
        id: existing.id,
        documentId: existing.documentId,
        linkType: existing.linkType,
        targetType: existing.targetType,
        targetId: existing.targetId,
      },
      replayed: true,
    };
  }

  const [link] = await db
    .insert(documentLinks)
    .values({
      organizationId,
      documentId: doc.id,
      targetType: LINK_TARGET_LABOR_CASE,
      targetId: laborCaseId,
      linkType: input.linkType,
    })
    .returning();
  if (!link) throw new AppError("INTERNAL_ERROR", "Não foi possível vincular o documento.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "labor.document_linked",
    resourceType: "document_link",
    resourceId: link.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return {
    link: {
      id: link.id,
      documentId: link.documentId,
      linkType: link.linkType,
      targetType: link.targetType,
      targetId: link.targetId,
    },
    replayed: false,
  };
}

export async function listLaborCaseDocuments(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  laborCaseId: string,
) {
  authorize(account, organizationId, (access) => policyLaborCase(access, "labor.read"));
  await requireLaborCaseOr404(db, organizationId, laborCaseId);
  const rows = await db
    .select({ link: documentLinks, doc: documents })
    .from(documentLinks)
    .innerJoin(documents, eq(documents.id, documentLinks.documentId))
    .where(
      and(
        eq(documentLinks.organizationId, organizationId),
        eq(documentLinks.targetType, LINK_TARGET_LABOR_CASE),
        eq(documentLinks.targetId, laborCaseId),
      ),
    )
    .orderBy(desc(documentLinks.createdAt));
  return {
    items: rows.map(({ link, doc }) => ({
      id: link.id,
      linkType: link.linkType,
      documentId: doc.id,
      title: doc.title,
      createdAt: link.createdAt.toISOString(),
    })),
  };
}

const SUGGESTED_LABOR_TASKS = [
  { key: "collect_ctps", title: "Coletar CTPS / documentos de vínculo" },
  { key: "collect_payslips", title: "Coletar holerites" },
  { key: "review_time_records", title: "Revisar registros de jornada" },
  { key: "prepare_claims", title: "Preparar pedidos / verbas" },
  { key: "review_calculation", title: "Revisar cálculo trabalhista" },
] as const;

export async function suggestLaborTasks(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  laborCaseId: string,
  input: { keys?: string[] },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyLaborCase(access, "labor.update"));
  const laborCase = await requireLaborCaseOr404(db, organizationId, laborCaseId);
  const selected = SUGGESTED_LABOR_TASKS.filter(
    (task) => !input.keys || input.keys.includes(task.key),
  );
  const created = [];
  for (const task of selected) {
    const result = await createTask(
      db,
      account,
      organizationId,
      {
        title: `${task.title} (trabalhista)`,
        description: `Sugestão para o caso trabalhista ${laborCaseId}. Confirme antes de executar.`,
        status: "todo",
        priority: "normal",
        legalMatterId: laborCase.legalMatterId,
        judicialProcessId: laborCase.judicialProcessId ?? undefined,
      },
      meta,
    );
    created.push(result);
  }
  return {
    tasks: created,
    note: "Sugestões criadas sob demanda humana — sem automação de workflow.",
  };
}

export async function suggestLaborDeadlines(
  deps: LaborModuleDeps & { db: AppDatabase },
  account: SessionAccount,
  organizationId: string,
  laborCaseId: string,
  input: { baseDate: string; titles?: string[] },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyLaborCase(access, "labor.update"));
  const laborCase = await requireLaborCaseOr404(deps.db, organizationId, laborCaseId);
  if (!deps.notifications || !deps.holidays) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Dependências de prazo (notifications/holidays) não disponíveis.",
    );
  }
  const titles = input.titles?.length
    ? input.titles
    : ["Prazo para defesa", "Audiência", "Liquidação", "Recurso"];
  const created = [];
  for (const title of titles) {
    const result = await createDeadline(
      deps.db,
      account,
      organizationId,
      {
        title: `${title} (trabalhista)`,
        baseDate: input.baseDate,
        baseDateLabel: "Data sugerida — confirmar humanamente",
        ruleType: "manual_date",
        manualDueAt: input.baseDate,
        sourceType: "manual",
        sourceId: laborCaseId,
        legalMatterId: laborCase.legalMatterId,
        judicialProcessId: laborCase.judicialProcessId ?? undefined,
        status: "suggested",
        calculate: false,
      },
      { notifications: deps.notifications, holidays: deps.holidays },
      meta,
    );
    created.push(result);
  }
  return {
    deadlines: created,
    note: "Prazos SUGGESTED até confirmação humana.",
  };
}

/* ─── Providers ─── */

export async function getLaborProvidersStatus(
  account: SessionAccount,
  organizationId: string,
  deps: LaborModuleDeps,
) {
  authorize(account, organizationId, (access) => policyLaborCase(access, "labor.read"));
  const [eSocial, fgts, laborCourt, timeTracking] = await Promise.all([
    deps.eSocialProvider.healthCheck(),
    deps.fgtsProvider.healthCheck(),
    deps.laborCourtProvider.healthCheck(),
    deps.timeTrackingImportProvider.healthCheck(),
  ]);
  return {
    eSocial: {
      provider: deps.eSocialProvider.id,
      status: eSocial.status,
      health: eSocial,
    },
    fgts: {
      provider: deps.fgtsProvider.id,
      status: fgts.status,
      health: fgts,
      officialBalanceAvailable: false,
      disclaimer: FGTS_ESTIMATE_LABEL,
    },
    laborCourt: {
      provider: deps.laborCourtProvider.id,
      status: laborCourt.status,
      health: laborCourt,
    },
    timeTrackingImport: {
      provider: deps.timeTrackingImportProvider.id,
      status: timeTracking.status,
      health: timeTracking,
      manualEntryAvailable: true,
    },
    manualEntryAvailable: true,
  };
}
