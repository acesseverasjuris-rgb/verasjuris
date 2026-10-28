import type {
  FederalTaxProvider,
  MunicipalTaxProvider,
  StateTaxProvider,
  TaxDebtProvider,
  TaxFilingProvider,
} from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import {
  policyTaxAssessment,
  policyTaxCalculation,
  policyTaxCase,
  policyTaxCompensation,
  policyTaxCredit,
  policyTaxEnforcement,
  policyTaxObligation,
  policyTaxRefund,
  policyTaxThesis,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  TaxCalculationEngine,
  type CalculationEnvelope,
  type PenaltyInterestInput,
  type TaxCompensationInput,
  type TaxComparativeInput,
  type TaxCreditInput,
  type TaxDebitInput,
  type TaxInstallmentInput,
  type TaxRefundInput,
  type TaxUpdateInput,
} from "@verasjuris/calculations";
import {
  administrativeProcesses,
  auditEvents,
  crmClients,
  isUniqueViolation,
  judicialProcesses,
  legalMatters,
  taxAdministrativeCases,
  taxAssessments,
  taxCalculations,
  taxCaseThesisLinks,
  taxCases,
  taxCompensations,
  taxCredits,
  taxDebtCertificates,
  taxEnforcementCases,
  taxGuarantees,
  taxLegalTheses,
  taxObligations,
  taxRefundRequests,
  taxRuleSets,
  taxTypes,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { authorize, escapeLike, iso } from "../ai/shared.js";
import { sanitizeAiText } from "../ai/sanitize.js";
import type { RequestMeta } from "../auth/service.js";

const taxEngine = new TaxCalculationEngine();

const SYSTEM_TAX_TYPE_SEEDS = [
  {
    code: "IRPF",
    name: "[SEED] IRPF — placeholder",
    jurisdiction: "federal" as const,
    taxNature: "tax" as const,
    source: "system_seed" as const,
  },
  {
    code: "ICMS",
    name: "[SEED] ICMS — placeholder",
    jurisdiction: "state" as const,
    taxNature: "tax" as const,
    source: "system_seed" as const,
  },
  {
    code: "ISS",
    name: "[SEED] ISS — placeholder",
    jurisdiction: "municipal" as const,
    taxNature: "tax" as const,
    source: "system_seed" as const,
  },
];

export type TaxModuleDeps = {
  federalTaxProvider: FederalTaxProvider;
  stateTaxProvider: StateTaxProvider;
  municipalTaxProvider: MunicipalTaxProvider;
  taxDebtProvider: TaxDebtProvider;
  taxFilingProvider: TaxFilingProvider;
};

function notesOrNull(value?: string): string | null {
  if (value === undefined) return null;
  return sanitizeAiText(value);
}

function parseOptionalDate(value?: string | null): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}

function deriveObligationStatus(
  row: typeof taxObligations.$inferSelect,
): typeof taxObligations.$inferSelect.status {
  if (row.status !== "open" && row.status !== "pending") return row.status;
  if (!row.dueDate) return row.status;
  if (row.dueDate.getTime() < Date.now()) return "overdue";
  return row.status;
}

function runTaxEngine(
  calculationType: string,
  ruleSetVersion: string,
  inputSnapshot: Record<string, unknown>,
): CalculationEnvelope<unknown> {
  const withVersion = { ...inputSnapshot, ruleSetVersion };
  switch (calculationType) {
    case "debit":
      return taxEngine.debit(withVersion as TaxDebitInput);
    case "credit":
      return taxEngine.credit(withVersion as TaxCreditInput);
    case "refund":
    case "undue_repetition":
      return taxEngine.refund(withVersion as TaxRefundInput);
    case "compensation":
      return taxEngine.compensation(withVersion as TaxCompensationInput);
    case "update":
      return taxEngine.update(withVersion as TaxUpdateInput);
    case "penalty":
    case "interest":
      return taxEngine.penaltyInterest(withVersion as PenaltyInterestInput);
    case "installment":
      return taxEngine.installment(withVersion as TaxInstallmentInput);
    case "comparative_scenario":
      return taxEngine.comparative(withVersion as TaxComparativeInput);
    default:
      throw new AppError("VALIDATION_ERROR", "Tipo de cálculo tributário não suportado.", [
        {
          path: "calculationType",
          message:
            "Use debit, credit, refund, compensation, update, penalty, interest, installment, undue_repetition ou comparative_scenario.",
        },
      ]);
  }
}

async function requireTaxCase(db: AppDatabase, organizationId: string, taxCaseId: string) {
  const row = await db.query.taxCases.findFirst({
    where: and(eq(taxCases.id, taxCaseId), eq(taxCases.organizationId, organizationId)),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este caso tributário no seu acesso.");
  return row;
}

async function requireClientInOrg(db: AppDatabase, organizationId: string, clientId: string) {
  const client = await db.query.crmClients.findFirst({
    where: and(eq(crmClients.id, clientId), eq(crmClients.organizationId, organizationId)),
  });
  if (!client) throw new AppError("NOT_FOUND", "Não encontramos este cliente no seu acesso.");
  return client;
}

async function requireMatterInOrg(db: AppDatabase, organizationId: string, matterId: string) {
  const matter = await db.query.legalMatters.findFirst({
    where: and(eq(legalMatters.id, matterId), eq(legalMatters.organizationId, organizationId)),
  });
  if (!matter) throw new AppError("NOT_FOUND", "Não encontramos este caso no seu acesso.");
  return matter;
}

async function requireTaxType(db: AppDatabase, taxTypeId: string) {
  const row = await db.query.taxTypes.findFirst({ where: eq(taxTypes.id, taxTypeId) });
  if (!row || !row.active) {
    throw new AppError("NOT_FOUND", "Não encontramos este tipo tributário.");
  }
  return row;
}

async function requireAdminProcessInOrg(
  db: AppDatabase,
  organizationId: string,
  administrativeProcessId: string | null | undefined,
) {
  if (!administrativeProcessId) return;
  const row = await db.query.administrativeProcesses.findFirst({
    where: and(
      eq(administrativeProcesses.id, administrativeProcessId),
      eq(administrativeProcesses.organizationId, organizationId),
    ),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este processo administrativo.");
}

async function requireJudicialInOrg(
  db: AppDatabase,
  organizationId: string,
  judicialProcessId: string,
) {
  const row = await db.query.judicialProcesses.findFirst({
    where: and(
      eq(judicialProcesses.id, judicialProcessId),
      eq(judicialProcesses.organizationId, organizationId),
    ),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este processo judicial.");
}

async function requireCreditInCase(
  db: AppDatabase,
  organizationId: string,
  taxCaseId: string,
  taxCreditId: string,
) {
  const row = await db.query.taxCredits.findFirst({
    where: and(
      eq(taxCredits.id, taxCreditId),
      eq(taxCredits.organizationId, organizationId),
      eq(taxCredits.taxCaseId, taxCaseId),
    ),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este crédito no caso tributário.");
  return row;
}

async function requireCalculation(db: AppDatabase, organizationId: string, calculationId: string) {
  const row = await db.query.taxCalculations.findFirst({
    where: and(
      eq(taxCalculations.id, calculationId),
      eq(taxCalculations.organizationId, organizationId),
    ),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este cálculo no seu acesso.");
  return row;
}

function serializeTaxCase(row: typeof taxCases.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    clientId: row.clientId,
    legalMatterId: row.legalMatterId,
    responsibleMembershipId: row.responsibleMembershipId,
    taxpayerType: row.taxpayerType,
    jurisdictionScope: row.jurisdictionScope,
    status: row.status,
    notes: row.notes,
    createdByMembershipId: row.createdByMembershipId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeObligation(row: typeof taxObligations.$inferSelect) {
  const status = deriveObligationStatus(row);
  return {
    id: row.id,
    organizationId: row.organizationId,
    taxCaseId: row.taxCaseId,
    taxTypeId: row.taxTypeId,
    obligationType: row.obligationType,
    competence: row.competence,
    dueDate: iso(row.dueDate),
    amountCents: row.amountCents,
    status,
    source: row.source,
    evidenceDocumentId: row.evidenceDocumentId,
    deadlineId: row.deadlineId,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeCredit(row: typeof taxCredits.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    taxCaseId: row.taxCaseId,
    taxTypeId: row.taxTypeId,
    origin: row.origin,
    competenceStart: row.competenceStart,
    competenceEnd: row.competenceEnd,
    principalCents: row.principalCents,
    correctionCents: row.correctionCents,
    interestCents: row.interestCents,
    penaltyCents: row.penaltyCents,
    totalCents: row.totalCents,
    status: row.status,
    source: row.source,
    calculationId: row.calculationId,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeRefund(row: typeof taxRefundRequests.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    taxCaseId: row.taxCaseId,
    taxCreditId: row.taxCreditId,
    administrativeProcessId: row.administrativeProcessId,
    requestDate: row.requestDate.toISOString(),
    protocolNumber: row.protocolNumber,
    amountRequestedCents: row.amountRequestedCents,
    amountGrantedCents: row.amountGrantedCents,
    status: row.status,
    source: row.source,
    decisionDocumentId: row.decisionDocumentId,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeCompensation(row: typeof taxCompensations.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    taxCaseId: row.taxCaseId,
    sourceCreditId: row.sourceCreditId,
    destinationTaxTypeId: row.destinationTaxTypeId,
    destinationCompetence: row.destinationCompetence,
    requestedAmountCents: row.requestedAmountCents,
    acceptedAmountCents: row.acceptedAmountCents,
    status: row.status,
    protocol: row.protocol,
    source: row.source,
    administrativeProcessId: row.administrativeProcessId,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeAssessment(row: typeof taxAssessments.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    taxCaseId: row.taxCaseId,
    authority: row.authority,
    assessmentNumber: row.assessmentNumber,
    assessmentDate: row.assessmentDate.toISOString(),
    taxTypeId: row.taxTypeId,
    principalCents: row.principalCents,
    penaltyCents: row.penaltyCents,
    interestCents: row.interestCents,
    totalCents: row.totalCents,
    legalBasisText: row.legalBasisText,
    status: row.status,
    administrativeProcessId: row.administrativeProcessId,
    documentId: row.documentId,
    source: row.source,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeCalculation(row: typeof taxCalculations.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    taxCaseId: row.taxCaseId,
    calculationType: row.calculationType,
    taxTypeId: row.taxTypeId,
    ruleSetId: row.ruleSetId,
    ruleSetVersion: row.ruleSetVersion,
    referenceDate: row.referenceDate.toISOString(),
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

/* ─── Cases ─── */

export async function createTaxCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    clientId: string;
    legalMatterId: string;
    responsibleMembershipId?: string;
    taxpayerType?: typeof taxCases.$inferSelect.taxpayerType;
    jurisdictionScope?: typeof taxCases.$inferSelect.jurisdictionScope;
    status?: typeof taxCases.$inferSelect.status;
    notes?: string;
  },
  meta: RequestMeta,
) {
  const actor = authorize(account, organizationId, (access) => policyTaxCase(access, "tax.create"));
  await requireClientInOrg(db, organizationId, input.clientId);
  const matter = await requireMatterInOrg(db, organizationId, input.legalMatterId);
  if (matter.clientId !== input.clientId) {
    throw new AppError("VALIDATION_ERROR", "O cliente informado não corresponde ao caso jurídico.");
  }

  const [created] = await db
    .insert(taxCases)
    .values({
      organizationId,
      clientId: input.clientId,
      legalMatterId: input.legalMatterId,
      responsibleMembershipId: input.responsibleMembershipId ?? null,
      taxpayerType: input.taxpayerType ?? "company",
      jurisdictionScope: input.jurisdictionScope ?? "federal",
      status: input.status ?? "draft",
      notes: notesOrNull(input.notes),
      createdByMembershipId: actor.membershipId,
    })
    .returning();
  if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o caso tributário.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "tax.case_created",
    resourceType: "tax_case",
    resourceId: created.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: {
      taxCaseId: created.id,
      clientId: created.clientId,
      legalMatterId: created.legalMatterId,
    },
  });

  return { case: serializeTaxCase(created) };
}

export async function listTaxCases(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    q?: string;
    clientId?: string;
    status?: typeof taxCases.$inferSelect.status;
    jurisdictionScope?: typeof taxCases.$inferSelect.jurisdictionScope;
    responsibleMembershipId?: string;
    limit: number;
    offset: number;
  },
) {
  authorize(account, organizationId, (access) => policyTaxCase(access, "tax.read"));
  const conditions: SQL[] = [eq(taxCases.organizationId, organizationId)];
  if (query.clientId) conditions.push(eq(taxCases.clientId, query.clientId));
  if (query.status) conditions.push(eq(taxCases.status, query.status));
  if (query.jurisdictionScope) {
    conditions.push(eq(taxCases.jurisdictionScope, query.jurisdictionScope));
  }
  if (query.responsibleMembershipId) {
    conditions.push(eq(taxCases.responsibleMembershipId, query.responsibleMembershipId));
  }
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    conditions.push(ilike(taxCases.notes, pattern));
  }
  const where = and(...conditions);
  const [rows, totalRow] = await Promise.all([
    db.query.taxCases.findMany({
      where,
      orderBy: [desc(taxCases.updatedAt)],
      limit: query.limit,
      offset: query.offset,
    }),
    db.select({ value: count() }).from(taxCases).where(where),
  ]);
  return {
    items: rows.map(serializeTaxCase),
    pagination: { total: totalRow[0]?.value ?? 0, limit: query.limit, offset: query.offset },
  };
}

export async function getTaxCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  taxCaseId: string,
) {
  authorize(account, organizationId, (access) => policyTaxCase(access, "tax.read"));
  const row = await requireTaxCase(db, organizationId, taxCaseId);
  return { case: serializeTaxCase(row) };
}

export async function updateTaxCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  taxCaseId: string,
  input: {
    responsibleMembershipId?: string | null;
    taxpayerType?: typeof taxCases.$inferSelect.taxpayerType;
    jurisdictionScope?: typeof taxCases.$inferSelect.jurisdictionScope;
    status?: typeof taxCases.$inferSelect.status;
    notes?: string;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyTaxCase(access, "tax.update"));
  await requireTaxCase(db, organizationId, taxCaseId);

  const [updated] = await db
    .update(taxCases)
    .set({
      ...(input.responsibleMembershipId !== undefined
        ? { responsibleMembershipId: input.responsibleMembershipId }
        : {}),
      ...(input.taxpayerType !== undefined ? { taxpayerType: input.taxpayerType } : {}),
      ...(input.jurisdictionScope !== undefined
        ? { jurisdictionScope: input.jurisdictionScope }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.notes !== undefined ? { notes: notesOrNull(input.notes) } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(taxCases.id, taxCaseId), eq(taxCases.organizationId, organizationId)))
    .returning();
  if (!updated) throw new AppError("NOT_FOUND", "Não encontramos este caso tributário.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "tax.case_updated",
    resourceType: "tax_case",
    resourceId: taxCaseId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { taxCaseId, status: updated.status },
  });

  return { case: serializeTaxCase(updated) };
}

export async function getTaxCaseTimeline(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  taxCaseId: string,
) {
  authorize(account, organizationId, (access) => policyTaxCase(access, "tax.read"));
  await requireTaxCase(db, organizationId, taxCaseId);

  const rows = await db
    .select()
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.organizationId, organizationId),
        sql`${auditEvents.action} like 'tax.%'`,
        or(
          eq(auditEvents.resourceId, taxCaseId),
          sql`${auditEvents.after}->>'taxCaseId' = ${taxCaseId}`,
        ),
      ),
    )
    .orderBy(desc(auditEvents.occurredAt))
    .limit(100);

  return {
    items: rows.map((event) => ({
      id: event.id,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      occurredAt: event.occurredAt.toISOString(),
      after: event.after,
    })),
  };
}

/* ─── Tax types ─── */

async function ensureSystemTaxTypeSeeds(db: AppDatabase) {
  const existing = await db.select({ value: count() }).from(taxTypes);
  if ((existing[0]?.value ?? 0) > 0) return;
  await db.insert(taxTypes).values(SYSTEM_TAX_TYPE_SEEDS).onConflictDoNothing();
}

export async function listTaxTypes(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    q?: string;
    jurisdiction?: typeof taxTypes.$inferSelect.jurisdiction;
    active?: boolean;
    limit: number;
    offset: number;
  },
) {
  authorize(account, organizationId, (access) => policyTaxCase(access, "tax.read"));
  await ensureSystemTaxTypeSeeds(db);

  const conditions: SQL[] = [];
  if (query.jurisdiction) conditions.push(eq(taxTypes.jurisdiction, query.jurisdiction));
  if (query.active !== undefined) conditions.push(eq(taxTypes.active, query.active));
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    conditions.push(or(ilike(taxTypes.code, pattern), ilike(taxTypes.name, pattern))!);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalRow] = await Promise.all([
    db.query.taxTypes.findMany({
      where,
      orderBy: [asc(taxTypes.code)],
      limit: query.limit,
      offset: query.offset,
    }),
    db.select({ value: count() }).from(taxTypes).where(where),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      jurisdiction: row.jurisdiction,
      taxNature: row.taxNature,
      active: row.active,
      source: row.source,
      metadata: row.metadata,
      official: false as const,
      note: "Catálogo configurável — não é catálogo oficial completo.",
    })),
    pagination: { total: totalRow[0]?.value ?? 0, limit: query.limit, offset: query.offset },
  };
}

export async function createTaxType(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    code: string;
    name: string;
    jurisdiction?: typeof taxTypes.$inferSelect.jurisdiction;
    taxNature?: typeof taxTypes.$inferSelect.taxNature;
    active?: boolean;
    source?: typeof taxTypes.$inferSelect.source;
    metadata?: Record<string, unknown>;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyTaxCase(access, "tax.create"));
  try {
    const [row] = await db
      .insert(taxTypes)
      .values({
        code: input.code,
        name: input.name,
        jurisdiction: input.jurisdiction ?? "federal",
        taxNature: input.taxNature ?? "tax",
        active: input.active ?? true,
        source: input.source ?? "organization",
        metadata: input.metadata ?? null,
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o tipo tributário.");

    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "tax.type_created",
      resourceType: "tax_type",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { code: row.code, source: row.source },
    });

    return { taxType: row };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Já existe um tipo tributário com este código.");
    }
    throw error;
  }
}

/* ─── Rule sets ─── */

export async function listTaxRuleSets(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  authorize(account, organizationId, (access) => policyTaxCase(access, "tax.read"));
  const rows = await db.query.taxRuleSets.findMany({
    orderBy: [desc(taxRuleSets.effectiveFrom)],
  });
  return {
    items: rows.map((r) => ({
      id: r.id,
      key: r.key,
      version: r.version,
      effectiveFrom: r.effectiveFrom.toISOString(),
      effectiveTo: iso(r.effectiveTo),
      source: r.source,
      sourceUrl: r.sourceUrl,
      status: r.status,
      locked: r.locked,
      metadata: r.metadata,
    })),
  };
}

export async function createTaxRuleSet(
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
    status?: string;
    locked?: boolean;
    metadata?: Record<string, unknown>;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyTaxCalculation(access, "tax.calculate"));
  try {
    const [row] = await db
      .insert(taxRuleSets)
      .values({
        key: input.key,
        version: input.version,
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: parseOptionalDate(input.effectiveTo) ?? null,
        source: input.source ?? "system",
        sourceUrl: input.sourceUrl ?? null,
        status: input.status ?? "active",
        locked: input.locked ?? false,
        metadata: input.metadata ?? null,
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o rule set.");

    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "tax.rule_set_created",
      resourceType: "tax_rule_set",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { key: row.key, version: row.version },
    });

    return { ruleSet: row };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Já existe rule set com esta chave e versão.");
    }
    throw error;
  }
}

/* ─── Obligations ─── */

export async function createTaxObligation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    taxCaseId: string;
    taxTypeId: string;
    obligationType?: typeof taxObligations.$inferSelect.obligationType;
    competence?: string;
    dueDate?: string;
    amountCents?: number;
    status?: typeof taxObligations.$inferSelect.status;
    source?: string;
    evidenceDocumentId?: string;
    deadlineId?: string;
    notes?: string;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyTaxObligation(access, "tax.manage_obligations"),
  );
  await requireTaxCase(db, organizationId, input.taxCaseId);
  await requireTaxType(db, input.taxTypeId);

  const [row] = await db
    .insert(taxObligations)
    .values({
      organizationId,
      taxCaseId: input.taxCaseId,
      taxTypeId: input.taxTypeId,
      obligationType: input.obligationType ?? "principal",
      competence: input.competence ?? null,
      dueDate: parseOptionalDate(input.dueDate) ?? null,
      amountCents: input.amountCents ?? null,
      status: input.status ?? "draft",
      source: input.source ?? "manual",
      evidenceDocumentId: input.evidenceDocumentId ?? null,
      deadlineId: input.deadlineId ?? null,
      notes: notesOrNull(input.notes),
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a obrigação.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "tax.obligation_created",
    resourceType: "tax_obligation",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { taxCaseId: input.taxCaseId, status: row.status, amountCents: row.amountCents },
  });

  return { obligation: serializeObligation(row) };
}

export async function listTaxObligations(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    taxCaseId?: string;
    status?: typeof taxObligations.$inferSelect.status;
    taxTypeId?: string;
    limit: number;
    offset: number;
  },
) {
  authorize(account, organizationId, (access) => policyTaxObligation(access, "tax.read"));
  const conditions: SQL[] = [eq(taxObligations.organizationId, organizationId)];
  if (query.taxCaseId) {
    await requireTaxCase(db, organizationId, query.taxCaseId);
    conditions.push(eq(taxObligations.taxCaseId, query.taxCaseId));
  }
  if (query.status) conditions.push(eq(taxObligations.status, query.status));
  if (query.taxTypeId) conditions.push(eq(taxObligations.taxTypeId, query.taxTypeId));

  const where = and(...conditions);
  const rows = await db.query.taxObligations.findMany({
    where,
    orderBy: [desc(taxObligations.updatedAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return { items: rows.map(serializeObligation) };
}

/* ─── Credits ─── */

export async function createTaxCredit(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    taxCaseId: string;
    taxTypeId: string;
    origin?: typeof taxCredits.$inferSelect.origin;
    competenceStart?: string;
    competenceEnd?: string;
    principalCents?: number;
    correctionCents?: number;
    interestCents?: number;
    penaltyCents?: number;
    totalCents?: number;
    status?: typeof taxCredits.$inferSelect.status;
    source?: string;
    calculationId?: string;
    notes?: string;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyTaxCredit(access, "tax.manage_credits"));
  await requireTaxCase(db, organizationId, input.taxCaseId);
  await requireTaxType(db, input.taxTypeId);

  const [row] = await db
    .insert(taxCredits)
    .values({
      organizationId,
      taxCaseId: input.taxCaseId,
      taxTypeId: input.taxTypeId,
      origin: input.origin ?? "other",
      competenceStart: input.competenceStart ?? null,
      competenceEnd: input.competenceEnd ?? null,
      principalCents: input.principalCents ?? 0,
      correctionCents: input.correctionCents ?? 0,
      interestCents: input.interestCents ?? 0,
      penaltyCents: input.penaltyCents ?? 0,
      totalCents: input.totalCents ?? 0,
      status: input.status ?? "draft",
      source: input.source ?? "manual",
      calculationId: input.calculationId ?? null,
      notes: notesOrNull(input.notes),
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o crédito.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "tax.credit_created",
    resourceType: "tax_credit",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { taxCaseId: input.taxCaseId, totalCents: row.totalCents },
  });

  return { credit: serializeCredit(row) };
}

export async function listTaxCredits(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    taxCaseId?: string;
    status?: typeof taxCredits.$inferSelect.status;
    limit: number;
    offset: number;
  },
) {
  authorize(account, organizationId, (access) => policyTaxCredit(access, "tax.read"));
  const conditions: SQL[] = [eq(taxCredits.organizationId, organizationId)];
  if (query.taxCaseId) {
    await requireTaxCase(db, organizationId, query.taxCaseId);
    conditions.push(eq(taxCredits.taxCaseId, query.taxCaseId));
  }
  if (query.status) conditions.push(eq(taxCredits.status, query.status));

  const rows = await db.query.taxCredits.findMany({
    where: and(...conditions),
    orderBy: [desc(taxCredits.updatedAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return { items: rows.map(serializeCredit) };
}

/* ─── Refunds ─── */

export async function createTaxRefund(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    taxCaseId: string;
    taxCreditId: string;
    administrativeProcessId?: string;
    requestDate: string;
    protocolNumber?: string;
    amountRequestedCents: number;
    amountGrantedCents?: number;
    status?: typeof taxRefundRequests.$inferSelect.status;
    source?: string;
    decisionDocumentId?: string;
    notes?: string;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyTaxRefund(access, "tax.manage_refunds"));
  await requireTaxCase(db, organizationId, input.taxCaseId);
  await requireCreditInCase(db, organizationId, input.taxCaseId, input.taxCreditId);
  await requireAdminProcessInOrg(db, organizationId, input.administrativeProcessId);

  const [row] = await db
    .insert(taxRefundRequests)
    .values({
      organizationId,
      taxCaseId: input.taxCaseId,
      taxCreditId: input.taxCreditId,
      administrativeProcessId: input.administrativeProcessId ?? null,
      requestDate: new Date(input.requestDate),
      protocolNumber: input.protocolNumber?.trim() || null,
      amountRequestedCents: input.amountRequestedCents,
      amountGrantedCents: input.amountGrantedCents ?? null,
      status: input.status ?? "draft",
      source: input.source ?? "manual",
      decisionDocumentId: input.decisionDocumentId ?? null,
      notes: notesOrNull(input.notes),
    })
    .returning();
  if (!row)
    throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o pedido de restituição.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "tax.refund_requested",
    resourceType: "tax_refund_request",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: {
      taxCaseId: input.taxCaseId,
      amountRequestedCents: row.amountRequestedCents,
      protocolNumber: row.protocolNumber,
    },
  });

  return { refund: serializeRefund(row) };
}

export async function listTaxRefunds(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    taxCaseId?: string;
    status?: typeof taxRefundRequests.$inferSelect.status;
    limit: number;
    offset: number;
  },
) {
  authorize(account, organizationId, (access) => policyTaxRefund(access, "tax.read"));
  const conditions: SQL[] = [eq(taxRefundRequests.organizationId, organizationId)];
  if (query.taxCaseId) {
    await requireTaxCase(db, organizationId, query.taxCaseId);
    conditions.push(eq(taxRefundRequests.taxCaseId, query.taxCaseId));
  }
  if (query.status) conditions.push(eq(taxRefundRequests.status, query.status));

  const rows = await db.query.taxRefundRequests.findMany({
    where: and(...conditions),
    orderBy: [desc(taxRefundRequests.updatedAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return { items: rows.map(serializeRefund) };
}

/* ─── Compensations ─── */

export async function createTaxCompensation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    taxCaseId: string;
    sourceCreditId: string;
    destinationTaxTypeId: string;
    destinationCompetence?: string;
    requestedAmountCents: number;
    acceptedAmountCents?: number;
    status?: typeof taxCompensations.$inferSelect.status;
    protocol?: string;
    source?: string;
    administrativeProcessId?: string;
    notes?: string;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyTaxCompensation(access, "tax.manage_compensations"),
  );
  await requireTaxCase(db, organizationId, input.taxCaseId);
  await requireCreditInCase(db, organizationId, input.taxCaseId, input.sourceCreditId);
  await requireTaxType(db, input.destinationTaxTypeId);
  await requireAdminProcessInOrg(db, organizationId, input.administrativeProcessId);

  const [row] = await db
    .insert(taxCompensations)
    .values({
      organizationId,
      taxCaseId: input.taxCaseId,
      sourceCreditId: input.sourceCreditId,
      destinationTaxTypeId: input.destinationTaxTypeId,
      destinationCompetence: input.destinationCompetence ?? null,
      requestedAmountCents: input.requestedAmountCents,
      acceptedAmountCents: input.acceptedAmountCents ?? null,
      status: input.status ?? "draft",
      protocol: input.protocol?.trim() || null,
      source: input.source ?? "manual",
      administrativeProcessId: input.administrativeProcessId ?? null,
      notes: notesOrNull(input.notes),
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar a compensação.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "tax.compensation_created",
    resourceType: "tax_compensation",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { taxCaseId: input.taxCaseId, requestedAmountCents: row.requestedAmountCents },
  });

  return { compensation: serializeCompensation(row) };
}

export async function listTaxCompensations(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    taxCaseId?: string;
    status?: typeof taxCompensations.$inferSelect.status;
    limit: number;
    offset: number;
  },
) {
  authorize(account, organizationId, (access) => policyTaxCompensation(access, "tax.read"));
  const conditions: SQL[] = [eq(taxCompensations.organizationId, organizationId)];
  if (query.taxCaseId) {
    await requireTaxCase(db, organizationId, query.taxCaseId);
    conditions.push(eq(taxCompensations.taxCaseId, query.taxCaseId));
  }
  if (query.status) conditions.push(eq(taxCompensations.status, query.status));

  const rows = await db.query.taxCompensations.findMany({
    where: and(...conditions),
    orderBy: [desc(taxCompensations.updatedAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return { items: rows.map(serializeCompensation) };
}

/* ─── Assessments ─── */

export async function createTaxAssessment(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    taxCaseId: string;
    authority: string;
    assessmentNumber: string;
    assessmentDate: string;
    taxTypeId: string;
    principalCents?: number;
    penaltyCents?: number;
    interestCents?: number;
    totalCents?: number;
    legalBasisText?: string;
    status?: typeof taxAssessments.$inferSelect.status;
    administrativeProcessId?: string;
    documentId?: string;
    source?: string;
    notes?: string;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyTaxAssessment(access, "tax.manage_assessments"),
  );
  await requireTaxCase(db, organizationId, input.taxCaseId);
  await requireTaxType(db, input.taxTypeId);
  await requireAdminProcessInOrg(db, organizationId, input.administrativeProcessId);

  try {
    const [row] = await db
      .insert(taxAssessments)
      .values({
        organizationId,
        taxCaseId: input.taxCaseId,
        authority: sanitizeAiText(input.authority),
        assessmentNumber: sanitizeAiText(input.assessmentNumber),
        assessmentDate: new Date(input.assessmentDate),
        taxTypeId: input.taxTypeId,
        principalCents: input.principalCents ?? 0,
        penaltyCents: input.penaltyCents ?? 0,
        interestCents: input.interestCents ?? 0,
        totalCents: input.totalCents ?? 0,
        legalBasisText: input.legalBasisText ? notesOrNull(input.legalBasisText) : null,
        status: input.status ?? "draft",
        administrativeProcessId: input.administrativeProcessId ?? null,
        documentId: input.documentId ?? null,
        source: input.source ?? "manual",
        notes: notesOrNull(input.notes),
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o lançamento.");

    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "tax.assessment_recorded",
      resourceType: "tax_assessment",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        taxCaseId: input.taxCaseId,
        assessmentNumber: row.assessmentNumber,
        totalCents: row.totalCents,
      },
    });

    return { assessment: serializeAssessment(row) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Já existe lançamento com este número nesta organização.");
    }
    throw error;
  }
}

export async function listTaxAssessments(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    taxCaseId?: string;
    status?: typeof taxAssessments.$inferSelect.status;
    limit: number;
    offset: number;
  },
) {
  authorize(account, organizationId, (access) => policyTaxAssessment(access, "tax.read"));
  const conditions: SQL[] = [eq(taxAssessments.organizationId, organizationId)];
  if (query.taxCaseId) {
    await requireTaxCase(db, organizationId, query.taxCaseId);
    conditions.push(eq(taxAssessments.taxCaseId, query.taxCaseId));
  }
  if (query.status) conditions.push(eq(taxAssessments.status, query.status));

  const rows = await db.query.taxAssessments.findMany({
    where: and(...conditions),
    orderBy: [desc(taxAssessments.updatedAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return { items: rows.map(serializeAssessment) };
}

export async function updateTaxAssessment(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  assessmentId: string,
  input: {
    status?: typeof taxAssessments.$inferSelect.status;
    notes?: string;
    legalBasisText?: string;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyTaxAssessment(access, "tax.manage_assessments"),
  );
  const existing = await db.query.taxAssessments.findFirst({
    where: and(
      eq(taxAssessments.id, assessmentId),
      eq(taxAssessments.organizationId, organizationId),
    ),
  });
  if (!existing) throw new AppError("NOT_FOUND", "Não encontramos este lançamento.");

  const [updated] = await db
    .update(taxAssessments)
    .set({
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.notes !== undefined ? { notes: notesOrNull(input.notes) } : {}),
      ...(input.legalBasisText !== undefined
        ? { legalBasisText: notesOrNull(input.legalBasisText) }
        : {}),
      updatedAt: new Date(),
    })
    .where(
      and(eq(taxAssessments.id, assessmentId), eq(taxAssessments.organizationId, organizationId)),
    )
    .returning();
  if (!updated) throw new AppError("NOT_FOUND", "Não encontramos este lançamento.");

  if (input.status === "challenged" && existing.status !== "challenged") {
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "tax.assessment_challenged",
      resourceType: "tax_assessment",
      resourceId: assessmentId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { taxCaseId: existing.taxCaseId, status: updated.status },
    });
  }

  return { assessment: serializeAssessment(updated) };
}

/* ─── Administrative links ─── */

export async function createTaxAdministrativeCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    taxCaseId: string;
    administrativeProcessId: string;
    taxAssessmentId?: string;
    phase?: typeof taxAdministrativeCases.$inferSelect.phase;
    notes?: string;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyTaxAssessment(access, "tax.manage_assessments"),
  );
  await requireTaxCase(db, organizationId, input.taxCaseId);
  await requireAdminProcessInOrg(db, organizationId, input.administrativeProcessId);
  if (input.taxAssessmentId) {
    const assessment = await db.query.taxAssessments.findFirst({
      where: and(
        eq(taxAssessments.id, input.taxAssessmentId),
        eq(taxAssessments.organizationId, organizationId),
        eq(taxAssessments.taxCaseId, input.taxCaseId),
      ),
    });
    if (!assessment) throw new AppError("NOT_FOUND", "Não encontramos o lançamento vinculado.");
  }

  try {
    const [row] = await db
      .insert(taxAdministrativeCases)
      .values({
        organizationId,
        taxCaseId: input.taxCaseId,
        administrativeProcessId: input.administrativeProcessId,
        taxAssessmentId: input.taxAssessmentId ?? null,
        phase: input.phase ?? "impugnacao",
        notes: notesOrNull(input.notes),
      })
      .returning();
    if (!row)
      throw new AppError("INTERNAL_ERROR", "Não foi possível vincular o processo administrativo.");

    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "tax.administrative_case_linked",
      resourceType: "tax_administrative_case",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        taxCaseId: input.taxCaseId,
        administrativeProcessId: input.administrativeProcessId,
      },
    });

    return { administrativeCase: row };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Este processo administrativo já está vinculado.");
    }
    throw error;
  }
}

export async function listTaxAdministrativeCases(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  taxCaseId: string,
) {
  authorize(account, organizationId, (access) => policyTaxAssessment(access, "tax.read"));
  await requireTaxCase(db, organizationId, taxCaseId);
  const rows = await db.query.taxAdministrativeCases.findMany({
    where: and(
      eq(taxAdministrativeCases.organizationId, organizationId),
      eq(taxAdministrativeCases.taxCaseId, taxCaseId),
    ),
    orderBy: [desc(taxAdministrativeCases.updatedAt)],
  });
  return { items: rows };
}

/* ─── Debt certificates ─── */

export async function createTaxDebtCertificate(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    taxCaseId: string;
    number: string;
    issuer: string;
    taxTypeId?: string;
    principalCents?: number;
    correctionCents?: number;
    interestCents?: number;
    penaltyCents?: number;
    totalCents?: number;
    registrationDate?: string;
    source?: string;
    documentId?: string;
    notes?: string;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyTaxEnforcement(access, "tax.manage_enforcement"),
  );
  await requireTaxCase(db, organizationId, input.taxCaseId);
  if (input.taxTypeId) await requireTaxType(db, input.taxTypeId);

  try {
    const [row] = await db
      .insert(taxDebtCertificates)
      .values({
        organizationId,
        taxCaseId: input.taxCaseId,
        number: sanitizeAiText(input.number),
        issuer: sanitizeAiText(input.issuer),
        taxTypeId: input.taxTypeId ?? null,
        principalCents: input.principalCents ?? 0,
        correctionCents: input.correctionCents ?? 0,
        interestCents: input.interestCents ?? 0,
        penaltyCents: input.penaltyCents ?? 0,
        totalCents: input.totalCents ?? 0,
        registrationDate: parseOptionalDate(input.registrationDate) ?? null,
        source: input.source ?? "manual",
        documentId: input.documentId ?? null,
        notes: notesOrNull(input.notes),
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar a CDA.");

    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "tax.debt_certificate_created",
      resourceType: "tax_debt_certificate",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { taxCaseId: input.taxCaseId, number: row.number, totalCents: row.totalCents },
    });

    return { debtCertificate: row };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Já existe CDA com este número nesta organização.");
    }
    throw error;
  }
}

export async function listTaxDebtCertificates(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  taxCaseId: string,
) {
  authorize(account, organizationId, (access) => policyTaxEnforcement(access, "tax.read"));
  await requireTaxCase(db, organizationId, taxCaseId);
  const rows = await db.query.taxDebtCertificates.findMany({
    where: and(
      eq(taxDebtCertificates.organizationId, organizationId),
      eq(taxDebtCertificates.taxCaseId, taxCaseId),
    ),
    orderBy: [desc(taxDebtCertificates.updatedAt)],
  });
  return { items: rows };
}

/* ─── Enforcement ─── */

export async function createTaxEnforcement(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    taxCaseId: string;
    judicialProcessId: string;
    debtCertificateId?: string;
    cdaNumber?: string;
    cdaAmountCents?: number;
    filingDate?: string;
    status?: typeof taxEnforcementCases.$inferSelect.status;
    notes?: string;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyTaxEnforcement(access, "tax.manage_enforcement"),
  );
  await requireTaxCase(db, organizationId, input.taxCaseId);
  await requireJudicialInOrg(db, organizationId, input.judicialProcessId);
  if (input.debtCertificateId) {
    const cda = await db.query.taxDebtCertificates.findFirst({
      where: and(
        eq(taxDebtCertificates.id, input.debtCertificateId),
        eq(taxDebtCertificates.organizationId, organizationId),
        eq(taxDebtCertificates.taxCaseId, input.taxCaseId),
      ),
    });
    if (!cda) throw new AppError("NOT_FOUND", "Não encontramos a CDA informada.");
  }

  try {
    const [row] = await db
      .insert(taxEnforcementCases)
      .values({
        organizationId,
        taxCaseId: input.taxCaseId,
        judicialProcessId: input.judicialProcessId,
        debtCertificateId: input.debtCertificateId ?? null,
        cdaNumber: input.cdaNumber?.trim() || null,
        cdaAmountCents: input.cdaAmountCents ?? null,
        filingDate: parseOptionalDate(input.filingDate) ?? null,
        status: input.status ?? "draft",
        notes: notesOrNull(input.notes),
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível vincular a execução fiscal.");

    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "tax.enforcement_linked",
      resourceType: "tax_enforcement_case",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        taxCaseId: input.taxCaseId,
        judicialProcessId: input.judicialProcessId,
      },
    });

    return { enforcement: row };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Este processo judicial já está vinculado a execução fiscal.");
    }
    throw error;
  }
}

export async function listTaxEnforcements(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  taxCaseId: string,
) {
  authorize(account, organizationId, (access) => policyTaxEnforcement(access, "tax.read"));
  await requireTaxCase(db, organizationId, taxCaseId);
  const rows = await db.query.taxEnforcementCases.findMany({
    where: and(
      eq(taxEnforcementCases.organizationId, organizationId),
      eq(taxEnforcementCases.taxCaseId, taxCaseId),
    ),
    orderBy: [desc(taxEnforcementCases.updatedAt)],
  });
  return { items: rows };
}

/* ─── Guarantees ─── */

export async function createTaxGuarantee(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    taxCaseId: string;
    enforcementCaseId?: string;
    guaranteeType?: typeof taxGuarantees.$inferSelect.guaranteeType;
    amountCents?: number;
    status?: typeof taxGuarantees.$inferSelect.status;
    description?: string;
    documentId?: string;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyTaxEnforcement(access, "tax.manage_enforcement"),
  );
  await requireTaxCase(db, organizationId, input.taxCaseId);
  if (input.enforcementCaseId) {
    const enforcement = await db.query.taxEnforcementCases.findFirst({
      where: and(
        eq(taxEnforcementCases.id, input.enforcementCaseId),
        eq(taxEnforcementCases.organizationId, organizationId),
        eq(taxEnforcementCases.taxCaseId, input.taxCaseId),
      ),
    });
    if (!enforcement)
      throw new AppError("NOT_FOUND", "Não encontramos a execução fiscal informada.");
  }

  const [row] = await db
    .insert(taxGuarantees)
    .values({
      organizationId,
      taxCaseId: input.taxCaseId,
      enforcementCaseId: input.enforcementCaseId ?? null,
      guaranteeType: input.guaranteeType ?? "other",
      amountCents: input.amountCents ?? 0,
      status: input.status ?? "draft",
      description: input.description ? notesOrNull(input.description) : null,
      documentId: input.documentId ?? null,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar a garantia.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "tax.guarantee_created",
    resourceType: "tax_guarantee",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { taxCaseId: input.taxCaseId, amountCents: row.amountCents },
  });

  return { guarantee: row };
}

export async function listTaxGuarantees(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  taxCaseId: string,
) {
  authorize(account, organizationId, (access) => policyTaxEnforcement(access, "tax.read"));
  await requireTaxCase(db, organizationId, taxCaseId);
  const rows = await db.query.taxGuarantees.findMany({
    where: and(
      eq(taxGuarantees.organizationId, organizationId),
      eq(taxGuarantees.taxCaseId, taxCaseId),
    ),
    orderBy: [desc(taxGuarantees.updatedAt)],
  });
  return { items: rows };
}

/* ─── Theses ─── */

export async function createTaxLegalThesis(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    title: string;
    summary?: string;
    taxTypeId?: string;
    legalBasis?: string;
    status?: typeof taxLegalTheses.$inferSelect.status;
    riskLevel?: typeof taxLegalTheses.$inferSelect.riskLevel;
    sourceResearchId?: string;
  },
  meta: RequestMeta,
) {
  const actor = authorize(account, organizationId, (access) =>
    policyTaxThesis(access, "tax.manage_theses"),
  );
  if (input.taxTypeId) await requireTaxType(db, input.taxTypeId);

  const [row] = await db
    .insert(taxLegalTheses)
    .values({
      organizationId,
      title: sanitizeAiText(input.title),
      summary: input.summary ? notesOrNull(input.summary) : null,
      taxTypeId: input.taxTypeId ?? null,
      legalBasis: input.legalBasis ? notesOrNull(input.legalBasis) : null,
      status: input.status ?? "draft",
      riskLevel: input.riskLevel ?? "unknown",
      sourceResearchId: input.sourceResearchId ?? null,
      createdByMembershipId: actor.membershipId,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a tese.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "tax.thesis_created",
    resourceType: "tax_legal_thesis",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { title: row.title, organizationId },
  });

  return { thesis: row };
}

export async function listTaxTheses(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    q?: string;
    status?: typeof taxLegalTheses.$inferSelect.status;
    riskLevel?: typeof taxLegalTheses.$inferSelect.riskLevel;
    taxTypeId?: string;
    limit: number;
    offset: number;
  },
) {
  authorize(account, organizationId, (access) => policyTaxThesis(access, "tax.read"));
  const conditions: SQL[] = [
    or(
      eq(taxLegalTheses.organizationId, organizationId),
      sql`${taxLegalTheses.organizationId} is null`,
    )!,
  ];
  if (query.status) conditions.push(eq(taxLegalTheses.status, query.status));
  if (query.riskLevel) conditions.push(eq(taxLegalTheses.riskLevel, query.riskLevel));
  if (query.taxTypeId) conditions.push(eq(taxLegalTheses.taxTypeId, query.taxTypeId));
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    conditions.push(ilike(taxLegalTheses.title, pattern));
  }

  const where = and(...conditions);
  const rows = await db.query.taxLegalTheses.findMany({
    where,
    orderBy: [desc(taxLegalTheses.updatedAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return { items: rows };
}

export async function createTaxCaseThesisLink(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    taxCaseId: string;
    thesisId: string;
    applicabilityStatus?: typeof taxCaseThesisLinks.$inferSelect.applicabilityStatus;
    assumptions?: Record<string, unknown>;
    missingData?: string[];
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyTaxThesis(access, "tax.manage_theses"));
  await requireTaxCase(db, organizationId, input.taxCaseId);
  const thesis = await db.query.taxLegalTheses.findFirst({
    where: eq(taxLegalTheses.id, input.thesisId),
  });
  if (!thesis) throw new AppError("NOT_FOUND", "Não encontramos esta tese.");
  if (thesis.organizationId && thesis.organizationId !== organizationId) {
    throw new AppError("NOT_FOUND", "Não encontramos esta tese no seu acesso.");
  }

  try {
    const [row] = await db
      .insert(taxCaseThesisLinks)
      .values({
        organizationId,
        taxCaseId: input.taxCaseId,
        thesisId: input.thesisId,
        applicabilityStatus: input.applicabilityStatus ?? "suggested",
        assumptions: input.assumptions ?? null,
        missingData: input.missingData ?? null,
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível vincular a tese.");

    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "tax.thesis_linked",
      resourceType: "tax_case_thesis_link",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { taxCaseId: input.taxCaseId, thesisId: input.thesisId },
    });

    return { link: row };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Esta tese já está vinculada ao caso.");
    }
    throw error;
  }
}

export async function listTaxCaseThesisLinks(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  taxCaseId: string,
) {
  authorize(account, organizationId, (access) => policyTaxThesis(access, "tax.read"));
  await requireTaxCase(db, organizationId, taxCaseId);
  const rows = await db.query.taxCaseThesisLinks.findMany({
    where: and(
      eq(taxCaseThesisLinks.organizationId, organizationId),
      eq(taxCaseThesisLinks.taxCaseId, taxCaseId),
    ),
    orderBy: [desc(taxCaseThesisLinks.updatedAt)],
  });
  return { items: rows };
}

/* ─── Calculations ─── */

export async function createTaxCalculation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    taxCaseId: string;
    calculationType: typeof taxCalculations.$inferSelect.calculationType;
    taxTypeId?: string;
    ruleSetId?: string;
    ruleSetVersion: string;
    referenceDate: string;
    inputSnapshot?: Record<string, unknown>;
    status?: typeof taxCalculations.$inferSelect.status;
  },
  meta: RequestMeta,
) {
  const actor = authorize(account, organizationId, (access) =>
    policyTaxCalculation(access, "tax.calculate"),
  );
  await requireTaxCase(db, organizationId, input.taxCaseId);
  if (input.taxTypeId) await requireTaxType(db, input.taxTypeId);
  if (input.ruleSetId) {
    const rs = await db.query.taxRuleSets.findFirst({
      where: eq(taxRuleSets.id, input.ruleSetId),
    });
    if (!rs) throw new AppError("NOT_FOUND", "Rule set não encontrado.");
  }

  const [created] = await db
    .insert(taxCalculations)
    .values({
      organizationId,
      taxCaseId: input.taxCaseId,
      calculationType: input.calculationType,
      taxTypeId: input.taxTypeId ?? null,
      ruleSetId: input.ruleSetId ?? null,
      ruleSetVersion: input.ruleSetVersion,
      referenceDate: new Date(input.referenceDate),
      inputSnapshot: input.inputSnapshot ?? {},
      status: input.status ?? "draft",
      createdByMembershipId: actor.membershipId,
    })
    .returning();
  if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o cálculo.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "tax.calculation_created",
    resourceType: "tax_calculation",
    resourceId: created.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: {
      taxCaseId: input.taxCaseId,
      calculationType: created.calculationType,
      ruleSetVersion: created.ruleSetVersion,
    },
  });

  return { calculation: serializeCalculation(created) };
}

export async function listTaxCalculations(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    taxCaseId?: string;
    calculationType?: typeof taxCalculations.$inferSelect.calculationType;
    status?: typeof taxCalculations.$inferSelect.status;
    limit: number;
    offset: number;
  },
) {
  authorize(account, organizationId, (access) => policyTaxCalculation(access, "tax.read"));
  const conditions: SQL[] = [eq(taxCalculations.organizationId, organizationId)];
  if (query.taxCaseId) {
    await requireTaxCase(db, organizationId, query.taxCaseId);
    conditions.push(eq(taxCalculations.taxCaseId, query.taxCaseId));
  }
  if (query.calculationType)
    conditions.push(eq(taxCalculations.calculationType, query.calculationType));
  if (query.status) conditions.push(eq(taxCalculations.status, query.status));

  const rows = await db.query.taxCalculations.findMany({
    where: and(...conditions),
    orderBy: [desc(taxCalculations.updatedAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return { items: rows.map(serializeCalculation) };
}

export async function runTaxCalculation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  calculationId: string,
  input: { inputSnapshot?: Record<string, unknown> },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyTaxCalculation(access, "tax.calculate"));
  const existing = await requireCalculation(db, organizationId, calculationId);
  if (existing.status === "approved") {
    throw new AppError("CONFLICT", "Cálculo aprovado é imutável.");
  }
  if (existing.status === "superseded") {
    throw new AppError("CONFLICT", "Cálculo substituído não pode ser executado.");
  }

  const inputSnapshot = {
    ...(existing.inputSnapshot ?? {}),
    ...(input.inputSnapshot ?? {}),
  };

  let envelope: CalculationEnvelope<unknown>;
  try {
    envelope = runTaxEngine(existing.calculationType, existing.ruleSetVersion, inputSnapshot);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "VALIDATION_ERROR",
      error instanceof Error ? error.message : "Falha ao executar o cálculo.",
    );
  }

  const resultSnapshot = {
    result: envelope.result,
    memory: envelope.memory,
    warnings: envelope.warnings,
    missingData: envelope.missingData,
    ruleSetVersion: envelope.ruleSetVersion,
    engineStatus: envelope.status,
    reviewHint: envelope.reviewHint,
  };

  const nextStatus =
    envelope.reviewHint === "review_required" ||
    envelope.warnings.length > 0 ||
    envelope.missingData.length > 0
      ? "review_required"
      : "calculated";

  if (existing.ruleSetId) {
    await db
      .update(taxRuleSets)
      .set({ locked: true, updatedAt: new Date() })
      .where(eq(taxRuleSets.id, existing.ruleSetId));
  }

  const [updated] = await db
    .update(taxCalculations)
    .set({
      inputSnapshot,
      resultSnapshot,
      status: nextStatus,
      updatedAt: new Date(),
    })
    .where(eq(taxCalculations.id, calculationId))
    .returning();
  if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível persistir o cálculo.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "tax.calculation_run",
    resourceType: "tax_calculation",
    resourceId: calculationId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: {
      taxCaseId: existing.taxCaseId,
      status: nextStatus,
      memorySteps: envelope.memory.length,
    },
  });

  return { calculation: serializeCalculation(updated) };
}

export async function reviewTaxCalculation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  calculationId: string,
  input: { status: "reviewed" | "approved"; notes?: string },
  meta: RequestMeta,
) {
  const actor = authorize(account, organizationId, (access) =>
    policyTaxCalculation(access, "tax.review_calculation"),
  );
  const existing = await requireCalculation(db, organizationId, calculationId);
  if (existing.status === "approved") {
    throw new AppError("CONFLICT", "Cálculo já aprovado e imutável.");
  }
  if (existing.status === "draft" || existing.status === "superseded") {
    throw new AppError("VALIDATION_ERROR", "Execute o cálculo antes da revisão.");
  }

  const [updated] = await db
    .update(taxCalculations)
    .set({
      status: input.status,
      reviewedByMembershipId: actor.membershipId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
      ...(input.notes
        ? {
            resultSnapshot: {
              ...(existing.resultSnapshot ?? {}),
              reviewNotes: notesOrNull(input.notes),
            },
          }
        : {}),
    })
    .where(eq(taxCalculations.id, calculationId))
    .returning();
  if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível revisar o cálculo.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "tax.calculation_reviewed",
    resourceType: "tax_calculation",
    resourceId: calculationId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { taxCaseId: existing.taxCaseId, status: updated.status },
  });

  return { calculation: serializeCalculation(updated) };
}

/* ─── Providers ─── */

export async function getTaxProvidersStatus(
  account: SessionAccount,
  organizationId: string,
  deps: TaxModuleDeps,
) {
  authorize(account, organizationId, (access) => policyTaxCase(access, "tax.read"));
  const [federal, state, municipal, debt, filing] = await Promise.all([
    deps.federalTaxProvider.healthCheck(),
    deps.stateTaxProvider.healthCheck(),
    deps.municipalTaxProvider.healthCheck(),
    deps.taxDebtProvider.healthCheck(),
    deps.taxFilingProvider.healthCheck(),
  ]);
  return {
    federal: { provider: deps.federalTaxProvider.id, ...federal },
    state: { provider: deps.stateTaxProvider.id, ...state },
    municipal: { provider: deps.municipalTaxProvider.id, ...municipal },
    taxDebt: { provider: deps.taxDebtProvider.id, ...debt },
    taxFiling: { provider: deps.taxFilingProvider.id, ...filing },
    manualEntryAvailable: true,
  };
}
