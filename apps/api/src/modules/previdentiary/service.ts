import {
  type CNISProvider,
  NotConfiguredCNISProvider,
  NotConfiguredSocialSecurityProvider,
  type SocialSecurityProvider,
} from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import {
  policyBenefit,
  policyCNIS,
  policyPrevidentiaryCalculation,
  policyPrevidentiaryCase,
  policyPrevidentiaryMedicalExam,
  policyPrevidentiaryRequest,
  type SessionAccount,
} from "@verasjuris/auth";
import { PrevidentiaryCalculationEngine, type CalculationEnvelope } from "@verasjuris/calculations";
import {
  administrativeBodies,
  administrativeProcesses,
  benefitScenarios,
  benefitTypes,
  calendarEvents,
  cnisEntries,
  cnisImports,
  cnisWarnings,
  crmClients,
  documentLinks,
  documents,
  isUniqueViolation,
  legalMatters,
  normalizeNb,
  previdentiaryCalculations,
  previdentiaryCases,
  previdentiaryClientProfiles,
  previdentiaryMedicalExams,
  previdentiaryRequests,
  previdentiaryRuleSets,
  previdentiarySocialAssessments,
  ruralPeriods,
  socialSecurityBenefitHistory,
  socialSecurityBenefits,
  socialSecurityContributions,
  socialSecurityPeriods,
  specialPeriods,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, asc, count, desc, eq, ilike, type SQL } from "drizzle-orm";
import { authorize, escapeLike, iso } from "../ai/shared.js";
import { ensureAdministrativeReferenceCatalog } from "../administrative/catalog.js";
import type { RequestMeta } from "../auth/service.js";
import { assertCanReadDocument, requireDocumentInOrg } from "../documents/service.js";

export type PrevidentiaryDeps = {
  db: AppDatabase;
  socialSecurityProvider?: SocialSecurityProvider;
  cnisProvider?: CNISProvider;
};

const engine = new PrevidentiaryCalculationEngine();

const CALC_TYPES = [
  "carencia",
  "qualidade",
  "tempo",
  "salario_beneficio",
  "rmi",
  "atrasados",
  "scenarios",
] as const;

type CalcType = (typeof CALC_TYPES)[number];

const PREVIDENTIARY_LINK_TYPES = [
  "cnis",
  "ppp",
  "ltcat",
  "medical_report",
  "protocol_receipt",
  "decision",
  "requirement_response",
  "proof",
  "other",
] as const;

function parseOptionalDate(value?: string | null): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}

function requireCaseRead(account: SessionAccount, organizationId: string) {
  return authorize(account, organizationId, (access) =>
    policyPrevidentiaryCase(access, "previdentiary.read"),
  );
}

function requireCaseCreate(account: SessionAccount, organizationId: string) {
  return authorize(account, organizationId, (access) =>
    policyPrevidentiaryCase(access, "previdentiary.create"),
  );
}

function requireCaseUpdate(account: SessionAccount, organizationId: string) {
  return authorize(account, organizationId, (access) =>
    policyPrevidentiaryCase(access, "previdentiary.update"),
  );
}

function requireBenefitManage(account: SessionAccount, organizationId: string) {
  return authorize(account, organizationId, (access) =>
    policyBenefit(access, "previdentiary.manage_benefits"),
  );
}

function requireRequestManage(account: SessionAccount, organizationId: string) {
  return authorize(account, organizationId, (access) =>
    policyPrevidentiaryRequest(access, "previdentiary.manage_requests"),
  );
}

function requireCnisManage(account: SessionAccount, organizationId: string) {
  return authorize(account, organizationId, (access) =>
    policyCNIS(access, "previdentiary.manage_cnis"),
  );
}

function requireCalculate(account: SessionAccount, organizationId: string) {
  return authorize(account, organizationId, (access) =>
    policyPrevidentiaryCalculation(access, "previdentiary.calculate"),
  );
}

function requireCalcReview(account: SessionAccount, organizationId: string) {
  return authorize(account, organizationId, (access) =>
    policyPrevidentiaryCalculation(access, "previdentiary.review_calculation"),
  );
}

function requireExamManage(account: SessionAccount, organizationId: string) {
  return authorize(account, organizationId, (access) =>
    policyPrevidentiaryMedicalExam(access, "previdentiary.manage_medical_exam"),
  );
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

async function requireCase(db: AppDatabase, organizationId: string, caseId: string) {
  const row = await db.query.previdentiaryCases.findFirst({
    where: and(
      eq(previdentiaryCases.id, caseId),
      eq(previdentiaryCases.organizationId, organizationId),
    ),
  });
  if (!row)
    throw new AppError("NOT_FOUND", "Não encontramos este caso previdenciário no seu acesso.");
  return row;
}

async function requireBenefit(db: AppDatabase, organizationId: string, benefitId: string) {
  const row = await db.query.socialSecurityBenefits.findFirst({
    where: and(
      eq(socialSecurityBenefits.id, benefitId),
      eq(socialSecurityBenefits.organizationId, organizationId),
    ),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este benefício no seu acesso.");
  return row;
}

async function requireRequest(db: AppDatabase, organizationId: string, requestId: string) {
  const row = await db.query.previdentiaryRequests.findFirst({
    where: and(
      eq(previdentiaryRequests.id, requestId),
      eq(previdentiaryRequests.organizationId, organizationId),
    ),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este requerimento no seu acesso.");
  return row;
}

async function requireCalculation(db: AppDatabase, organizationId: string, id: string) {
  const row = await db.query.previdentiaryCalculations.findFirst({
    where: and(
      eq(previdentiaryCalculations.id, id),
      eq(previdentiaryCalculations.organizationId, organizationId),
    ),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este cálculo no seu acesso.");
  return row;
}

async function requireCnisImport(db: AppDatabase, organizationId: string, id: string) {
  const row = await db.query.cnisImports.findFirst({
    where: and(eq(cnisImports.id, id), eq(cnisImports.organizationId, organizationId)),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos esta importação CNIS no seu acesso.");
  return row;
}

async function requireBenefitType(db: AppDatabase, benefitTypeId: string) {
  const row = await db.query.benefitTypes.findFirst({ where: eq(benefitTypes.id, benefitTypeId) });
  if (!row || !row.active) {
    throw new AppError("NOT_FOUND", "Não encontramos este tipo de benefício.");
  }
  return row;
}

function serializeCase(row: typeof previdentiaryCases.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    clientId: row.clientId,
    legalMatterId: row.legalMatterId,
    responsibleMembershipId: row.responsibleMembershipId,
    regime: row.regime,
    insuredCategory: row.insuredCategory,
    currentSituation: row.currentSituation,
    notes: row.notes,
    createdByMembershipId: row.createdByMembershipId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeProfile(
  row: typeof previdentiaryClientProfiles.$inferSelect,
  options?: { maskSensitive?: boolean },
) {
  const mask = options?.maskSensitive === true;
  return {
    id: row.id,
    organizationId: row.organizationId,
    clientId: row.clientId,
    nitMasked: mask && row.nitMasked ? "***" : row.nitMasked,
    pisMasked: mask && row.pisMasked ? "***" : row.pisMasked,
    category: row.category,
    occupation: row.occupation,
    ruralWorker: row.ruralWorker,
    specialExposure: row.specialExposure,
    disability: row.disability,
    publicServiceHistory: row.publicServiceHistory,
    benefitHistoryNotes: mask ? null : row.benefitHistoryNotes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeBenefit(row: typeof socialSecurityBenefits.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    previdentiaryCaseId: row.previdentiaryCaseId,
    clientId: row.clientId,
    benefitTypeId: row.benefitTypeId,
    nb: row.nb,
    normalizedNb: row.normalizedNb,
    der: iso(row.der),
    dib: iso(row.dib),
    dcb: iso(row.dcb),
    dip: iso(row.dip),
    cessacaoAt: iso(row.cessacaoAt),
    status: row.status,
    administrativeProcessId: row.administrativeProcessId,
    judicialProcessId: row.judicialProcessId,
    source: row.source,
    sourceReference: row.sourceReference,
    createdByMembershipId: row.createdByMembershipId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    /** Nunca afirma existência oficial no INSS — cadastro interno. */
    officialInssClaim: false as const,
  };
}

function serializeRequest(row: typeof previdentiaryRequests.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    previdentiaryCaseId: row.previdentiaryCaseId,
    administrativeProcessId: row.administrativeProcessId,
    benefitTypeId: row.benefitTypeId,
    requestType: row.requestType,
    der: iso(row.der),
    protocolNumber: row.protocolNumber,
    protocolDate: iso(row.protocolDate),
    protocolSource: row.protocolSource,
    protocolVerificationStatus: row.protocolVerificationStatus,
    /** Protocolo MANUAL — nunca “Protocolado no INSS” sem integração. */
    protocolLabel:
      row.protocolNumber != null
        ? "Protocolo registrado manualmente (não confirma integração com o INSS)"
        : null,
    status: row.status,
    source: row.source,
    justificationSummary: row.justificationSummary,
    createdByMembershipId: row.createdByMembershipId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeCalculation(row: typeof previdentiaryCalculations.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    previdentiaryCaseId: row.previdentiaryCaseId,
    calculationType: row.calculationType,
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

function serializeCnisImport(row: typeof cnisImports.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    previdentiaryCaseId: row.previdentiaryCaseId,
    clientId: row.clientId,
    sourceDocumentId: row.sourceDocumentId,
    importFormat: row.importFormat,
    status: row.status,
    source: row.source,
    notes: row.notes,
    createdByMembershipId: row.createdByMembershipId,
    reviewedByMembershipId: row.reviewedByMembershipId,
    reviewedAt: iso(row.reviewedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeCnisEntry(row: typeof cnisEntries.$inferSelect) {
  return {
    id: row.id,
    importId: row.importId,
    competence: row.competence,
    relationshipType: row.relationshipType,
    employer: row.employer,
    employerDocument: row.employerDocument,
    remunerationCents: row.remunerationCents,
    contributionCents: row.contributionCents,
    indicators: row.indicators,
    source: row.source,
    reviewStatus: row.reviewStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeExam(row: typeof previdentiaryMedicalExams.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    requestId: row.requestId,
    calendarEventId: row.calendarEventId,
    examType: row.examType,
    scheduledAt: iso(row.scheduledAt),
    timezone: row.timezone,
    location: row.location,
    modality: row.modality,
    examinerInfo: row.examinerInfo,
    status: row.status,
    resultSummary: row.resultSummary,
    source: row.source,
    documentId: row.documentId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeAssessment(row: typeof previdentiarySocialAssessments.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    requestId: row.requestId,
    calendarEventId: row.calendarEventId,
    scheduledAt: iso(row.scheduledAt),
    timezone: row.timezone,
    location: row.location,
    modality: row.modality,
    status: row.status,
    resultSummary: row.resultSummary,
    source: row.source,
    documentId: row.documentId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function assertIntegerCents(value: number, path: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Valor monetário inválido em ${path}: use centavos inteiros.`,
    );
  }
}

function resolveProviders(deps: PrevidentiaryDeps) {
  return {
    socialSecurityProvider:
      deps.socialSecurityProvider ?? new NotConfiguredSocialSecurityProvider(),
    cnisProvider: deps.cnisProvider ?? new NotConfiguredCNISProvider(),
  };
}

function runEngine(
  calculationType: string,
  ruleSetVersion: string,
  inputSnapshot: Record<string, unknown>,
): CalculationEnvelope<unknown> {
  const type = calculationType as CalcType;
  if (!(CALC_TYPES as readonly string[]).includes(type)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Tipo de cálculo não suportado: ${calculationType}. Use: ${CALC_TYPES.join(", ")}.`,
    );
  }
  const base = { ...inputSnapshot, ruleSetVersion };
  switch (type) {
    case "carencia":
      return engine.carencia(base as Parameters<typeof engine.carencia>[0]);
    case "qualidade":
      return engine.qualidade(base as Parameters<typeof engine.qualidade>[0]);
    case "tempo":
      return engine.tempo(base as Parameters<typeof engine.tempo>[0]);
    case "salario_beneficio":
      return engine.salarioBeneficio(base as Parameters<typeof engine.salarioBeneficio>[0]);
    case "rmi":
      return engine.rmiCalc(base as Parameters<typeof engine.rmiCalc>[0]);
    case "atrasados":
      return engine.atrasados(base as Parameters<typeof engine.atrasados>[0]);
    case "scenarios":
      return engine.scenarios(base as Parameters<typeof engine.scenarios>[0]);
  }
}

/* ─── Cases ─── */

export async function createPrevidentiaryCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    clientId: string;
    legalMatterId: string;
    responsibleMembershipId?: string;
    regime?: "rgps" | "rpps" | "military" | "other";
    insuredCategory?: string;
    currentSituation?: string;
    notes?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireCaseCreate(account, organizationId);
  await requireClientInOrg(db, organizationId, input.clientId);
  const matter = await requireMatterInOrg(db, organizationId, input.legalMatterId);
  if (matter.clientId !== input.clientId) {
    throw new AppError("VALIDATION_ERROR", "O cliente informado não corresponde ao caso jurídico.");
  }

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(previdentiaryCases)
      .values({
        organizationId,
        clientId: input.clientId,
        legalMatterId: input.legalMatterId,
        responsibleMembershipId: input.responsibleMembershipId ?? null,
        regime: input.regime ?? "rgps",
        insuredCategory: input.insuredCategory ?? null,
        currentSituation: input.currentSituation ?? null,
        notes: input.notes ?? null,
        createdByMembershipId: actor.membershipId,
      })
      .returning();
    if (!created)
      throw new AppError("INTERNAL_ERROR", "Não foi possível criar o caso previdenciário.");

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "previdentiary.case_created",
      resourceType: "previdentiary_case",
      resourceId: created.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        clientId: created.clientId,
        legalMatterId: created.legalMatterId,
        regime: created.regime,
      },
    });

    return { case: serializeCase(created) };
  });
}

export async function listPrevidentiaryCases(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    q?: string;
    clientId?: string;
    status?: string;
    regime?: "rgps" | "rpps" | "military" | "other";
    responsibleMembershipId?: string;
    maskSensitive?: boolean;
    limit: number;
    offset: number;
  },
) {
  requireCaseRead(account, organizationId);
  const conditions: SQL[] = [eq(previdentiaryCases.organizationId, organizationId)];
  if (query.clientId) conditions.push(eq(previdentiaryCases.clientId, query.clientId));
  if (query.regime) conditions.push(eq(previdentiaryCases.regime, query.regime));
  if (query.responsibleMembershipId) {
    conditions.push(eq(previdentiaryCases.responsibleMembershipId, query.responsibleMembershipId));
  }
  if (query.status) {
    conditions.push(eq(previdentiaryCases.currentSituation, query.status));
  }
  if (query.q) {
    conditions.push(ilike(previdentiaryCases.notes, `%${escapeLike(query.q)}%`));
  }
  const where = and(...conditions);
  const [rows, totalRow] = await Promise.all([
    db.query.previdentiaryCases.findMany({
      where,
      orderBy: [desc(previdentiaryCases.updatedAt)],
      limit: query.limit,
      offset: query.offset,
    }),
    db.select({ value: count() }).from(previdentiaryCases).where(where),
  ]);
  return {
    items: rows.map(serializeCase),
    pagination: {
      total: totalRow[0]?.value ?? 0,
      limit: query.limit,
      offset: query.offset,
    },
    maskSensitive: query.maskSensitive === true,
  };
}

export async function getPrevidentiaryCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  caseId: string,
) {
  requireCaseRead(account, organizationId);
  const row = await requireCase(db, organizationId, caseId);
  const profile = await db.query.previdentiaryClientProfiles.findFirst({
    where: and(
      eq(previdentiaryClientProfiles.organizationId, organizationId),
      eq(previdentiaryClientProfiles.clientId, row.clientId),
    ),
  });
  return {
    case: serializeCase(row),
    clientProfile: profile ? serializeProfile(profile) : null,
  };
}

export async function updatePrevidentiaryCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  caseId: string,
  input: {
    responsibleMembershipId?: string;
    regime?: "rgps" | "rpps" | "military" | "other";
    insuredCategory?: string;
    currentSituation?: string;
    notes?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireCaseUpdate(account, organizationId);
  await requireCase(db, organizationId, caseId);
  const [updated] = await db
    .update(previdentiaryCases)
    .set({
      ...(input.responsibleMembershipId !== undefined
        ? { responsibleMembershipId: input.responsibleMembershipId }
        : {}),
      ...(input.regime !== undefined ? { regime: input.regime } : {}),
      ...(input.insuredCategory !== undefined ? { insuredCategory: input.insuredCategory } : {}),
      ...(input.currentSituation !== undefined ? { currentSituation: input.currentSituation } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(eq(previdentiaryCases.id, caseId), eq(previdentiaryCases.organizationId, organizationId)),
    )
    .returning();
  if (!updated)
    throw new AppError("NOT_FOUND", "Não encontramos este caso previdenciário no seu acesso.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "previdentiary.case_updated",
    resourceType: "previdentiary_case",
    resourceId: updated.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { regime: updated.regime, currentSituation: updated.currentSituation },
  });
  void actor;
  return { case: serializeCase(updated) };
}

/* ─── Client profile ─── */

export async function getClientProfile(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  clientId: string,
  options?: { maskSensitive?: boolean },
) {
  requireCaseRead(account, organizationId);
  await requireClientInOrg(db, organizationId, clientId);
  const profile = await db.query.previdentiaryClientProfiles.findFirst({
    where: and(
      eq(previdentiaryClientProfiles.organizationId, organizationId),
      eq(previdentiaryClientProfiles.clientId, clientId),
    ),
  });
  if (!profile) throw new AppError("NOT_FOUND", "Perfil previdenciário do cliente não encontrado.");
  return { profile: serializeProfile(profile, options) };
}

export async function upsertClientProfile(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    clientId: string;
    nitMasked?: string | null;
    pisMasked?: string | null;
    category?: string | null;
    occupation?: string | null;
    ruralWorker?: boolean;
    specialExposure?: boolean;
    disability?: boolean;
    publicServiceHistory?: boolean;
    benefitHistoryNotes?: string | null;
  },
  meta: RequestMeta,
) {
  const actor = requireCaseUpdate(account, organizationId);
  await requireClientInOrg(db, organizationId, input.clientId);
  const existing = await db.query.previdentiaryClientProfiles.findFirst({
    where: and(
      eq(previdentiaryClientProfiles.organizationId, organizationId),
      eq(previdentiaryClientProfiles.clientId, input.clientId),
    ),
  });
  const now = new Date();
  let row: typeof previdentiaryClientProfiles.$inferSelect;
  if (existing) {
    const [updated] = await db
      .update(previdentiaryClientProfiles)
      .set({
        nitMasked: input.nitMasked !== undefined ? input.nitMasked : existing.nitMasked,
        pisMasked: input.pisMasked !== undefined ? input.pisMasked : existing.pisMasked,
        category: input.category !== undefined ? input.category : existing.category,
        occupation: input.occupation !== undefined ? input.occupation : existing.occupation,
        ruralWorker: input.ruralWorker ?? existing.ruralWorker,
        specialExposure: input.specialExposure ?? existing.specialExposure,
        disability: input.disability ?? existing.disability,
        publicServiceHistory: input.publicServiceHistory ?? existing.publicServiceHistory,
        benefitHistoryNotes:
          input.benefitHistoryNotes !== undefined
            ? input.benefitHistoryNotes
            : existing.benefitHistoryNotes,
        updatedAt: now,
      })
      .where(eq(previdentiaryClientProfiles.id, existing.id))
      .returning();
    if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível atualizar o perfil.");
    row = updated;
  } else {
    const [created] = await db
      .insert(previdentiaryClientProfiles)
      .values({
        organizationId,
        clientId: input.clientId,
        nitMasked: input.nitMasked ?? null,
        pisMasked: input.pisMasked ?? null,
        category: input.category ?? null,
        occupation: input.occupation ?? null,
        ruralWorker: input.ruralWorker ?? false,
        specialExposure: input.specialExposure ?? false,
        disability: input.disability ?? false,
        publicServiceHistory: input.publicServiceHistory ?? false,
        benefitHistoryNotes: input.benefitHistoryNotes ?? null,
      })
      .returning();
    if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o perfil.");
    row = created;
  }
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "previdentiary.client_profile_upserted",
    resourceType: "previdentiary_client_profile",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { clientId: row.clientId },
  });
  void actor;
  return { profile: serializeProfile(row) };
}

/* ─── Benefits ─── */

export async function createBenefit(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    previdentiaryCaseId: string;
    clientId: string;
    benefitTypeId: string;
    nb?: string;
    der?: string;
    dib?: string;
    dcb?: string;
    dip?: string;
    cessacaoAt?: string;
    status?: typeof socialSecurityBenefits.$inferSelect.status;
    administrativeProcessId?: string;
    judicialProcessId?: string;
    source?: typeof socialSecurityBenefits.$inferSelect.source;
    sourceReference?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireBenefitManage(account, organizationId);
  const caseRow = await requireCase(db, organizationId, input.previdentiaryCaseId);
  if (caseRow.clientId !== input.clientId) {
    throw new AppError("VALIDATION_ERROR", "O cliente não corresponde ao caso previdenciário.");
  }
  await requireBenefitType(db, input.benefitTypeId);
  const nb = input.nb?.trim() || null;
  const normalized = nb ? normalizeNb(nb) : null;

  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(socialSecurityBenefits)
        .values({
          organizationId,
          previdentiaryCaseId: input.previdentiaryCaseId,
          clientId: input.clientId,
          benefitTypeId: input.benefitTypeId,
          nb,
          normalizedNb: normalized,
          der: parseOptionalDate(input.der) ?? null,
          dib: parseOptionalDate(input.dib) ?? null,
          dcb: parseOptionalDate(input.dcb) ?? null,
          dip: parseOptionalDate(input.dip) ?? null,
          cessacaoAt: parseOptionalDate(input.cessacaoAt) ?? null,
          status: input.status ?? "draft",
          administrativeProcessId: input.administrativeProcessId ?? null,
          judicialProcessId: input.judicialProcessId ?? null,
          source: input.source ?? "manual",
          sourceReference: input.sourceReference ?? null,
          createdByMembershipId: actor.membershipId,
        })
        .returning();
      if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o benefício.");

      await tx.insert(socialSecurityBenefitHistory).values({
        organizationId,
        benefitId: created.id,
        previousStatus: null,
        newStatus: created.status,
        event: "benefit_created",
        source: created.source,
        actorMembershipId: actor.membershipId,
        notes: "Cadastro interno — não afirma existência no INSS.",
      });

      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "previdentiary.benefit_created",
        resourceType: "social_security_benefit",
        resourceId: created.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: {
          status: created.status,
          normalizedNb: created.normalizedNb,
          der: iso(created.der),
          dib: iso(created.dib),
        },
      });

      return { benefit: serializeBenefit(created) };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Já existe um benefício com este NB nesta organização.");
    }
    throw error;
  }
}

export async function listBenefits(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    q?: string;
    clientId?: string;
    previdentiaryCaseId?: string;
    benefitTypeId?: string;
    status?: typeof socialSecurityBenefits.$inferSelect.status;
    nb?: string;
    limit: number;
    offset: number;
  },
) {
  requireCaseRead(account, organizationId);
  const conditions: SQL[] = [eq(socialSecurityBenefits.organizationId, organizationId)];
  if (query.clientId) conditions.push(eq(socialSecurityBenefits.clientId, query.clientId));
  if (query.previdentiaryCaseId) {
    conditions.push(eq(socialSecurityBenefits.previdentiaryCaseId, query.previdentiaryCaseId));
  }
  if (query.benefitTypeId) {
    conditions.push(eq(socialSecurityBenefits.benefitTypeId, query.benefitTypeId));
  }
  if (query.status) conditions.push(eq(socialSecurityBenefits.status, query.status));
  if (query.nb) conditions.push(eq(socialSecurityBenefits.normalizedNb, normalizeNb(query.nb)));
  const where = and(...conditions);
  const [rows, totalRow] = await Promise.all([
    db.query.socialSecurityBenefits.findMany({
      where,
      orderBy: [desc(socialSecurityBenefits.updatedAt)],
      limit: query.limit,
      offset: query.offset,
    }),
    db.select({ value: count() }).from(socialSecurityBenefits).where(where),
  ]);
  return {
    items: rows.map(serializeBenefit),
    pagination: { total: totalRow[0]?.value ?? 0, limit: query.limit, offset: query.offset },
  };
}

export async function getBenefit(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  benefitId: string,
) {
  requireCaseRead(account, organizationId);
  const row = await requireBenefit(db, organizationId, benefitId);
  const history = await db.query.socialSecurityBenefitHistory.findMany({
    where: and(
      eq(socialSecurityBenefitHistory.organizationId, organizationId),
      eq(socialSecurityBenefitHistory.benefitId, benefitId),
    ),
    orderBy: [asc(socialSecurityBenefitHistory.occurredAt)],
  });
  return {
    benefit: serializeBenefit(row),
    history: history.map((h) => ({
      id: h.id,
      previousStatus: h.previousStatus,
      newStatus: h.newStatus,
      event: h.event,
      occurredAt: h.occurredAt.toISOString(),
      source: h.source,
      notes: h.notes,
    })),
  };
}

export async function updateBenefit(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  benefitId: string,
  input: {
    benefitTypeId?: string;
    nb?: string;
    der?: string;
    dib?: string;
    dcb?: string;
    dip?: string;
    cessacaoAt?: string;
    status?: typeof socialSecurityBenefits.$inferSelect.status;
    administrativeProcessId?: string;
    judicialProcessId?: string;
    source?: typeof socialSecurityBenefits.$inferSelect.source;
    sourceReference?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireBenefitManage(account, organizationId);
  const existing = await requireBenefit(db, organizationId, benefitId);
  if (input.benefitTypeId) await requireBenefitType(db, input.benefitTypeId);

  const nb = input.nb !== undefined ? (input.nb.trim() ? input.nb.trim() : null) : undefined;
  const normalized = nb !== undefined ? (nb ? normalizeNb(nb) : null) : undefined;

  try {
    return await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(socialSecurityBenefits)
        .set({
          ...(input.benefitTypeId !== undefined ? { benefitTypeId: input.benefitTypeId } : {}),
          ...(nb !== undefined ? { nb, normalizedNb: normalized } : {}),
          ...(input.der !== undefined ? { der: parseOptionalDate(input.der) ?? null } : {}),
          ...(input.dib !== undefined ? { dib: parseOptionalDate(input.dib) ?? null } : {}),
          ...(input.dcb !== undefined ? { dcb: parseOptionalDate(input.dcb) ?? null } : {}),
          ...(input.dip !== undefined ? { dip: parseOptionalDate(input.dip) ?? null } : {}),
          ...(input.cessacaoAt !== undefined
            ? { cessacaoAt: parseOptionalDate(input.cessacaoAt) ?? null }
            : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.administrativeProcessId !== undefined
            ? { administrativeProcessId: input.administrativeProcessId }
            : {}),
          ...(input.judicialProcessId !== undefined
            ? { judicialProcessId: input.judicialProcessId }
            : {}),
          ...(input.source !== undefined ? { source: input.source } : {}),
          ...(input.sourceReference !== undefined
            ? { sourceReference: input.sourceReference }
            : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(socialSecurityBenefits.id, benefitId),
            eq(socialSecurityBenefits.organizationId, organizationId),
          ),
        )
        .returning();
      if (!updated)
        throw new AppError("NOT_FOUND", "Não encontramos este benefício no seu acesso.");

      if (input.status !== undefined && input.status !== existing.status) {
        await tx.insert(socialSecurityBenefitHistory).values({
          organizationId,
          benefitId,
          previousStatus: existing.status,
          newStatus: input.status,
          event: "status_changed",
          source: updated.source,
          actorMembershipId: actor.membershipId,
        });
        await recordAudit(tx, {
          actorUserId: account.user.id,
          organizationId,
          action: "previdentiary.benefit_status_changed",
          resourceType: "social_security_benefit",
          resourceId: benefitId,
          source: "api",
          requestId: meta.requestId,
          ip: meta.ip,
          before: { status: existing.status },
          after: { status: input.status, der: iso(updated.der), dib: iso(updated.dib) },
        });
      }

      return { benefit: serializeBenefit(updated) };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Já existe um benefício com este NB nesta organização.");
    }
    throw error;
  }
}

/* ─── Periods / contributions / special / rural ─── */

export async function createPeriod(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    previdentiaryCaseId: string;
    clientId: string;
    startDate: string;
    endDate?: string | null;
    category?: typeof socialSecurityPeriods.$inferSelect.category;
    employerName?: string;
    employerDocument?: string;
    source?: typeof socialSecurityPeriods.$inferSelect.source;
    sourceDocumentId?: string;
    status?: typeof socialSecurityPeriods.$inferSelect.status;
    reviewed?: boolean;
  },
  meta: RequestMeta,
) {
  const actor = requireBenefitManage(account, organizationId);
  const caseRow = await requireCase(db, organizationId, input.previdentiaryCaseId);
  if (caseRow.clientId !== input.clientId) {
    throw new AppError("VALIDATION_ERROR", "O cliente não corresponde ao caso previdenciário.");
  }
  const [created] = await db
    .insert(socialSecurityPeriods)
    .values({
      organizationId,
      previdentiaryCaseId: input.previdentiaryCaseId,
      clientId: input.clientId,
      startDate: new Date(input.startDate),
      endDate: parseOptionalDate(input.endDate) ?? null,
      category: input.category ?? "other",
      employerName: input.employerName ?? null,
      employerDocument: input.employerDocument ?? null,
      source: input.source ?? "manual",
      sourceDocumentId: input.sourceDocumentId ?? null,
      status: input.status ?? "draft",
      reviewed: input.reviewed ?? false,
    })
    .returning();
  if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o período.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "previdentiary.period_created",
    resourceType: "social_security_period",
    resourceId: created.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  void actor;
  return {
    period: {
      id: created.id,
      previdentiaryCaseId: created.previdentiaryCaseId,
      clientId: created.clientId,
      startDate: created.startDate.toISOString(),
      endDate: iso(created.endDate),
      category: created.category,
      employerName: created.employerName,
      status: created.status,
      reviewed: created.reviewed,
      source: created.source,
      createdAt: created.createdAt.toISOString(),
    },
  };
}

export async function listPeriods(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  previdentiaryCaseId: string,
) {
  requireCaseRead(account, organizationId);
  await requireCase(db, organizationId, previdentiaryCaseId);
  const rows = await db.query.socialSecurityPeriods.findMany({
    where: and(
      eq(socialSecurityPeriods.organizationId, organizationId),
      eq(socialSecurityPeriods.previdentiaryCaseId, previdentiaryCaseId),
    ),
    orderBy: [asc(socialSecurityPeriods.startDate)],
  });
  return {
    items: rows.map((r) => ({
      id: r.id,
      startDate: r.startDate.toISOString(),
      endDate: iso(r.endDate),
      category: r.category,
      employerName: r.employerName,
      status: r.status,
      reviewed: r.reviewed,
      source: r.source,
    })),
  };
}

export async function createContribution(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    previdentiaryCaseId: string;
    periodId?: string;
    competence: string;
    remunerationCents: number;
    contributionCents?: number;
    contributionType?: string;
    source?: typeof socialSecurityContributions.$inferSelect.source;
    sourceDocumentId?: string;
    validationStatus?: typeof socialSecurityContributions.$inferSelect.validationStatus;
  },
  meta: RequestMeta,
) {
  const actor = requireBenefitManage(account, organizationId);
  await requireCase(db, organizationId, input.previdentiaryCaseId);
  assertIntegerCents(input.remunerationCents, "remunerationCents");
  if (input.contributionCents !== undefined) {
    assertIntegerCents(input.contributionCents, "contributionCents");
  }
  const [created] = await db
    .insert(socialSecurityContributions)
    .values({
      organizationId,
      previdentiaryCaseId: input.previdentiaryCaseId,
      periodId: input.periodId ?? null,
      competence: input.competence,
      remunerationCents: input.remunerationCents,
      contributionCents: input.contributionCents ?? null,
      contributionType: input.contributionType ?? null,
      source: input.source ?? "manual",
      sourceDocumentId: input.sourceDocumentId ?? null,
      validationStatus: input.validationStatus ?? "unreviewed",
    })
    .returning();
  if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a contribuição.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "previdentiary.contribution_created",
    resourceType: "social_security_contribution",
    resourceId: created.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: {
      competence: created.competence,
      remunerationCents: created.remunerationCents,
    },
  });
  void actor;
  return {
    contribution: {
      id: created.id,
      previdentiaryCaseId: created.previdentiaryCaseId,
      periodId: created.periodId,
      competence: created.competence,
      remunerationCents: created.remunerationCents,
      contributionCents: created.contributionCents,
      contributionType: created.contributionType,
      validationStatus: created.validationStatus,
      source: created.source,
      createdAt: created.createdAt.toISOString(),
    },
  };
}

export async function listContributions(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  previdentiaryCaseId: string,
) {
  requireCaseRead(account, organizationId);
  await requireCase(db, organizationId, previdentiaryCaseId);
  const rows = await db.query.socialSecurityContributions.findMany({
    where: and(
      eq(socialSecurityContributions.organizationId, organizationId),
      eq(socialSecurityContributions.previdentiaryCaseId, previdentiaryCaseId),
    ),
    orderBy: [asc(socialSecurityContributions.competence)],
  });
  return {
    items: rows.map((r) => ({
      id: r.id,
      periodId: r.periodId,
      competence: r.competence,
      remunerationCents: r.remunerationCents,
      contributionCents: r.contributionCents,
      validationStatus: r.validationStatus,
      source: r.source,
    })),
  };
}

export async function createSpecialPeriod(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    previdentiaryCaseId: string;
    periodId?: string;
    startDate: string;
    endDate?: string | null;
    agent?: string;
    intensity?: string;
    concentration?: string;
    pppDocumentId?: string;
    ltcatDocumentId?: string;
    evidenceNotes?: string;
    reviewStatus?: typeof specialPeriods.$inferSelect.reviewStatus;
  },
  meta: RequestMeta,
) {
  const actor = requireBenefitManage(account, organizationId);
  await requireCase(db, organizationId, input.previdentiaryCaseId);
  const [created] = await db
    .insert(specialPeriods)
    .values({
      organizationId,
      previdentiaryCaseId: input.previdentiaryCaseId,
      periodId: input.periodId ?? null,
      startDate: new Date(input.startDate),
      endDate: parseOptionalDate(input.endDate) ?? null,
      agent: input.agent ?? null,
      intensity: input.intensity ?? null,
      concentration: input.concentration ?? null,
      pppDocumentId: input.pppDocumentId ?? null,
      ltcatDocumentId: input.ltcatDocumentId ?? null,
      evidenceNotes: input.evidenceNotes ?? null,
      reviewStatus: input.reviewStatus ?? "unreviewed",
    })
    .returning();
  if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o período especial.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "previdentiary.special_period_created",
    resourceType: "special_period",
    resourceId: created.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  void actor;
  return {
    specialPeriod: {
      id: created.id,
      previdentiaryCaseId: created.previdentiaryCaseId,
      startDate: created.startDate.toISOString(),
      endDate: iso(created.endDate),
      agent: created.agent,
      reviewStatus: created.reviewStatus,
      createdAt: created.createdAt.toISOString(),
    },
  };
}

export async function createRuralPeriod(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    previdentiaryCaseId: string;
    periodId?: string;
    startDate: string;
    endDate?: string | null;
    regime?: string;
    evidenceNotes?: string;
    reviewStatus?: typeof ruralPeriods.$inferSelect.reviewStatus;
  },
  meta: RequestMeta,
) {
  const actor = requireBenefitManage(account, organizationId);
  await requireCase(db, organizationId, input.previdentiaryCaseId);
  const [created] = await db
    .insert(ruralPeriods)
    .values({
      organizationId,
      previdentiaryCaseId: input.previdentiaryCaseId,
      periodId: input.periodId ?? null,
      startDate: new Date(input.startDate),
      endDate: parseOptionalDate(input.endDate) ?? null,
      regime: input.regime ?? null,
      evidenceNotes: input.evidenceNotes ?? null,
      reviewStatus: input.reviewStatus ?? "unreviewed",
    })
    .returning();
  if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o período rural.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "previdentiary.rural_period_created",
    resourceType: "rural_period",
    resourceId: created.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  void actor;
  return {
    ruralPeriod: {
      id: created.id,
      previdentiaryCaseId: created.previdentiaryCaseId,
      startDate: created.startDate.toISOString(),
      endDate: iso(created.endDate),
      regime: created.regime,
      reviewStatus: created.reviewStatus,
      createdAt: created.createdAt.toISOString(),
    },
  };
}

/* ─── Requests ─── */

async function resolveOrCreateAdminProcess(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  caseRow: typeof previdentiaryCases.$inferSelect,
  input: {
    administrativeProcessId?: string;
    administrativeBodyId?: string;
    adminSubject?: string;
    protocolNumber?: string;
    protocolDate?: string;
  },
  actorMembershipId: string,
): Promise<string> {
  if (input.administrativeProcessId) {
    const process = await db.query.administrativeProcesses.findFirst({
      where: and(
        eq(administrativeProcesses.id, input.administrativeProcessId),
        eq(administrativeProcesses.organizationId, organizationId),
      ),
    });
    if (!process) {
      throw new AppError(
        "NOT_FOUND",
        "Não encontramos este processo administrativo no seu acesso.",
      );
    }
    if (process.legalMatterId !== caseRow.legalMatterId) {
      throw new AppError(
        "VALIDATION_ERROR",
        "O processo administrativo deve pertencer ao mesmo caso jurídico.",
      );
    }
    return process.id;
  }

  await ensureAdministrativeReferenceCatalog(db);
  let bodyId = input.administrativeBodyId;
  if (!bodyId) {
    const inss = await db.query.administrativeBodies.findFirst({
      where: eq(administrativeBodies.code, "INSS"),
    });
    if (!inss) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Informe administrativeBodyId ou administrativeProcessId.",
      );
    }
    bodyId = inss.id;
  } else {
    const body = await db.query.administrativeBodies.findFirst({
      where: eq(administrativeBodies.id, bodyId),
    });
    if (!body) throw new AppError("NOT_FOUND", "Órgão administrativo não encontrado.");
  }

  const [created] = await db
    .insert(administrativeProcesses)
    .values({
      organizationId,
      legalMatterId: caseRow.legalMatterId,
      administrativeBodyId: bodyId,
      subject: input.adminSubject ?? "Requerimento previdenciário",
      protocolNumber: input.protocolNumber ?? null,
      protocolDate: parseOptionalDate(input.protocolDate) ?? null,
      protocolSource: input.protocolNumber ? "manual" : null,
      status: "draft",
      source: "manual",
      createdByMembershipId: actorMembershipId,
      lastActivityAt: new Date(),
    })
    .returning();
  if (!created) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível criar o processo administrativo.");
  }
  void account;
  return created.id;
}

export async function createRequest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    previdentiaryCaseId: string;
    administrativeProcessId?: string;
    administrativeBodyId?: string;
    adminSubject?: string;
    benefitTypeId?: string;
    requestType?: typeof previdentiaryRequests.$inferSelect.requestType;
    der?: string;
    protocolNumber?: string;
    protocolDate?: string;
    protocolSource?: string;
    protocolVerificationStatus?: typeof previdentiaryRequests.$inferSelect.protocolVerificationStatus;
    status?: typeof previdentiaryRequests.$inferSelect.status;
    source?: typeof previdentiaryRequests.$inferSelect.source;
    justificationSummary?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireRequestManage(account, organizationId);
  const caseRow = await requireCase(db, organizationId, input.previdentiaryCaseId);
  if (input.benefitTypeId) await requireBenefitType(db, input.benefitTypeId);

  const protocolSource = input.protocolSource ?? "manual";
  if (protocolSource !== "manual" && input.protocolNumber) {
    // Sem integração: só manual é permitido com afirmação honesta
  }

  return db.transaction(async (tx) => {
    const adminProcessId = await resolveOrCreateAdminProcess(
      tx as unknown as AppDatabase,
      account,
      organizationId,
      caseRow,
      input,
      actor.membershipId,
    );

    const [created] = await tx
      .insert(previdentiaryRequests)
      .values({
        organizationId,
        previdentiaryCaseId: input.previdentiaryCaseId,
        administrativeProcessId: adminProcessId,
        benefitTypeId: input.benefitTypeId ?? null,
        requestType: input.requestType ?? "initial_request",
        der: parseOptionalDate(input.der) ?? null,
        protocolNumber: input.protocolNumber ?? null,
        protocolDate: parseOptionalDate(input.protocolDate) ?? null,
        protocolSource,
        protocolVerificationStatus: input.protocolVerificationStatus ?? "manual",
        status: input.status ?? "draft",
        source: input.source ?? "manual",
        justificationSummary: input.justificationSummary ?? null,
        createdByMembershipId: actor.membershipId,
      })
      .returning();
    if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o requerimento.");

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "previdentiary.request_created",
      resourceType: "previdentiary_request",
      resourceId: created.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        status: created.status,
        administrativeProcessId: created.administrativeProcessId,
        protocolSource: created.protocolSource,
      },
    });

    if (created.protocolNumber) {
      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "previdentiary.protocol_recorded",
        resourceType: "previdentiary_request",
        resourceId: created.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: {
          protocolNumber: created.protocolNumber,
          protocolSource: created.protocolSource,
          protocolVerificationStatus: created.protocolVerificationStatus,
          note: "Registro manual — não confirma protocolo no INSS.",
        },
      });
    }

    return { request: serializeRequest(created) };
  });
}

export async function listRequests(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    previdentiaryCaseId?: string;
    status?: typeof previdentiaryRequests.$inferSelect.status;
    limit: number;
    offset: number;
  },
) {
  requireCaseRead(account, organizationId);
  const conditions: SQL[] = [eq(previdentiaryRequests.organizationId, organizationId)];
  if (query.previdentiaryCaseId) {
    conditions.push(eq(previdentiaryRequests.previdentiaryCaseId, query.previdentiaryCaseId));
  }
  if (query.status) conditions.push(eq(previdentiaryRequests.status, query.status));
  const where = and(...conditions);
  const [rows, totalRow] = await Promise.all([
    db.query.previdentiaryRequests.findMany({
      where,
      orderBy: [desc(previdentiaryRequests.updatedAt)],
      limit: query.limit,
      offset: query.offset,
    }),
    db.select({ value: count() }).from(previdentiaryRequests).where(where),
  ]);
  return {
    items: rows.map(serializeRequest),
    pagination: { total: totalRow[0]?.value ?? 0, limit: query.limit, offset: query.offset },
  };
}

export async function getRequest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  requestId: string,
) {
  requireCaseRead(account, organizationId);
  const row = await requireRequest(db, organizationId, requestId);
  return { request: serializeRequest(row) };
}

export async function updateRequest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  requestId: string,
  input: {
    benefitTypeId?: string;
    requestType?: typeof previdentiaryRequests.$inferSelect.requestType;
    der?: string;
    protocolNumber?: string;
    protocolDate?: string;
    protocolSource?: string;
    protocolVerificationStatus?: typeof previdentiaryRequests.$inferSelect.protocolVerificationStatus;
    status?: typeof previdentiaryRequests.$inferSelect.status;
    source?: typeof previdentiaryRequests.$inferSelect.source;
    justificationSummary?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireRequestManage(account, organizationId);
  const existing = await requireRequest(db, organizationId, requestId);

  const [updated] = await db
    .update(previdentiaryRequests)
    .set({
      ...(input.benefitTypeId !== undefined ? { benefitTypeId: input.benefitTypeId } : {}),
      ...(input.requestType !== undefined ? { requestType: input.requestType } : {}),
      ...(input.der !== undefined ? { der: parseOptionalDate(input.der) ?? null } : {}),
      ...(input.protocolNumber !== undefined ? { protocolNumber: input.protocolNumber } : {}),
      ...(input.protocolDate !== undefined
        ? { protocolDate: parseOptionalDate(input.protocolDate) ?? null }
        : {}),
      ...(input.protocolSource !== undefined ? { protocolSource: input.protocolSource } : {}),
      ...(input.protocolVerificationStatus !== undefined
        ? { protocolVerificationStatus: input.protocolVerificationStatus }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.source !== undefined ? { source: input.source } : {}),
      ...(input.justificationSummary !== undefined
        ? { justificationSummary: input.justificationSummary }
        : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(previdentiaryRequests.id, requestId),
        eq(previdentiaryRequests.organizationId, organizationId),
      ),
    )
    .returning();
  if (!updated) throw new AppError("NOT_FOUND", "Não encontramos este requerimento no seu acesso.");

  if (
    input.protocolNumber !== undefined &&
    input.protocolNumber &&
    input.protocolNumber !== existing.protocolNumber
  ) {
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "previdentiary.protocol_recorded",
      resourceType: "previdentiary_request",
      resourceId: updated.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        protocolNumber: updated.protocolNumber,
        protocolSource: updated.protocolSource,
        note: "Registro manual — não confirma protocolo no INSS.",
      },
    });
  }
  void actor;
  return { request: serializeRequest(updated) };
}

/* ─── Exams / assessments ─── */

async function maybeCreateCalendarEvent(
  db: AppDatabase,
  organizationId: string,
  actorMembershipId: string,
  input: {
    title: string;
    scheduledAt: string;
    timezone: string;
    location?: string;
    eventType: "expert_exam" | "meeting" | "other";
    legalMatterId: string;
    administrativeProcessId: string;
  },
) {
  const startsAt = new Date(input.scheduledAt);
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
  const [event] = await db
    .insert(calendarEvents)
    .values({
      organizationId,
      title: input.title,
      eventType: input.eventType,
      startsAt,
      endsAt,
      timezone: input.timezone,
      locationType: input.location ? "in_person" : "undetermined",
      locationText: input.location ?? null,
      status: "scheduled",
      legalMatterId: input.legalMatterId,
      administrativeProcessId: input.administrativeProcessId,
      createdByMembershipId: actorMembershipId,
    })
    .returning();
  return event?.id ?? null;
}

export async function createMedicalExam(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    requestId: string;
    calendarEventId?: string;
    createCalendarEvent?: boolean;
    examType: string;
    scheduledAt?: string;
    timezone?: string;
    location?: string;
    modality?: typeof previdentiaryMedicalExams.$inferSelect.modality;
    examinerInfo?: string;
    status?: typeof previdentiaryMedicalExams.$inferSelect.status;
    resultSummary?: string;
    source?: typeof previdentiaryMedicalExams.$inferSelect.source;
    documentId?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireExamManage(account, organizationId);
  const request = await requireRequest(db, organizationId, input.requestId);
  const caseRow = await requireCase(db, organizationId, request.previdentiaryCaseId);
  const timezone = input.timezone ?? "America/Sao_Paulo";

  return db.transaction(async (tx) => {
    let calendarEventId = input.calendarEventId ?? null;
    if (!calendarEventId && input.createCalendarEvent && input.scheduledAt) {
      calendarEventId = await maybeCreateCalendarEvent(
        tx as unknown as AppDatabase,
        organizationId,
        actor.membershipId,
        {
          title: `Perícia: ${input.examType}`,
          scheduledAt: input.scheduledAt,
          timezone,
          location: input.location,
          eventType: "expert_exam",
          legalMatterId: caseRow.legalMatterId,
          administrativeProcessId: request.administrativeProcessId,
        },
      );
    }

    const [created] = await tx
      .insert(previdentiaryMedicalExams)
      .values({
        organizationId,
        requestId: input.requestId,
        calendarEventId,
        examType: input.examType,
        scheduledAt: parseOptionalDate(input.scheduledAt) ?? null,
        timezone,
        location: input.location ?? null,
        modality: input.modality ?? "unknown",
        examinerInfo: input.examinerInfo ?? null,
        status: input.status ?? "scheduled",
        resultSummary: input.resultSummary ?? null,
        source: input.source ?? "manual",
        documentId: input.documentId ?? null,
      })
      .returning();
    if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a perícia.");

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "previdentiary.exam_scheduled",
      resourceType: "previdentiary_medical_exam",
      resourceId: created.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { status: created.status, examType: created.examType, calendarEventId },
    });

    return { exam: serializeExam(created) };
  });
}

export async function listMedicalExams(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  requestId: string,
) {
  requireCaseRead(account, organizationId);
  await requireRequest(db, organizationId, requestId);
  const rows = await db.query.previdentiaryMedicalExams.findMany({
    where: and(
      eq(previdentiaryMedicalExams.organizationId, organizationId),
      eq(previdentiaryMedicalExams.requestId, requestId),
    ),
    orderBy: [desc(previdentiaryMedicalExams.createdAt)],
  });
  return { items: rows.map(serializeExam) };
}

export async function createSocialAssessment(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    requestId: string;
    calendarEventId?: string;
    createCalendarEvent?: boolean;
    scheduledAt?: string;
    timezone?: string;
    location?: string;
    modality?: typeof previdentiarySocialAssessments.$inferSelect.modality;
    status?: typeof previdentiarySocialAssessments.$inferSelect.status;
    resultSummary?: string;
    source?: typeof previdentiarySocialAssessments.$inferSelect.source;
    documentId?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireExamManage(account, organizationId);
  const request = await requireRequest(db, organizationId, input.requestId);
  const caseRow = await requireCase(db, organizationId, request.previdentiaryCaseId);
  const timezone = input.timezone ?? "America/Sao_Paulo";

  return db.transaction(async (tx) => {
    let calendarEventId = input.calendarEventId ?? null;
    if (!calendarEventId && input.createCalendarEvent && input.scheduledAt) {
      calendarEventId = await maybeCreateCalendarEvent(
        tx as unknown as AppDatabase,
        organizationId,
        actor.membershipId,
        {
          title: "Avaliação social previdenciária",
          scheduledAt: input.scheduledAt,
          timezone,
          location: input.location,
          eventType: "meeting",
          legalMatterId: caseRow.legalMatterId,
          administrativeProcessId: request.administrativeProcessId,
        },
      );
    }

    const [created] = await tx
      .insert(previdentiarySocialAssessments)
      .values({
        organizationId,
        requestId: input.requestId,
        calendarEventId,
        scheduledAt: parseOptionalDate(input.scheduledAt) ?? null,
        timezone,
        location: input.location ?? null,
        modality: input.modality ?? "unknown",
        status: input.status ?? "scheduled",
        resultSummary: input.resultSummary ?? null,
        source: input.source ?? "manual",
        documentId: input.documentId ?? null,
      })
      .returning();
    if (!created)
      throw new AppError("INTERNAL_ERROR", "Não foi possível criar a avaliação social.");

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "previdentiary.exam_scheduled",
      resourceType: "previdentiary_social_assessment",
      resourceId: created.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { status: created.status, kind: "social_assessment" },
    });

    return { assessment: serializeAssessment(created) };
  });
}

/* ─── CNIS ─── */

export async function createCnisImport(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    previdentiaryCaseId: string;
    clientId: string;
    sourceDocumentId?: string;
    importFormat?: string;
    status?: typeof cnisImports.$inferSelect.status;
    source?: typeof cnisImports.$inferSelect.source;
    notes?: string;
    entries?: Array<{
      competence: string;
      relationshipType?: string;
      employer?: string;
      employerDocument?: string;
      remunerationCents?: number;
      contributionCents?: number;
      indicators?: Record<string, unknown>;
      source?: typeof cnisEntries.$inferSelect.source;
      reviewStatus?: typeof cnisEntries.$inferSelect.reviewStatus;
    }>;
  },
  meta: RequestMeta,
) {
  const actor = requireCnisManage(account, organizationId);
  const caseRow = await requireCase(db, organizationId, input.previdentiaryCaseId);
  if (caseRow.clientId !== input.clientId) {
    throw new AppError("VALIDATION_ERROR", "O cliente não corresponde ao caso previdenciário.");
  }
  if (input.importFormat === "api") {
    throw new AppError(
      "CNIS_PROVIDER_NOT_CONFIGURED",
      "Provedor CNIS externo não configurado. Use importação/cadastro manual.",
    );
  }

  for (const entry of input.entries ?? []) {
    if (entry.remunerationCents !== undefined) {
      assertIntegerCents(entry.remunerationCents, "remunerationCents");
    }
    if (entry.contributionCents !== undefined) {
      assertIntegerCents(entry.contributionCents, "contributionCents");
    }
  }

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(cnisImports)
      .values({
        organizationId,
        previdentiaryCaseId: input.previdentiaryCaseId,
        clientId: input.clientId,
        sourceDocumentId: input.sourceDocumentId ?? null,
        importFormat: input.importFormat ?? "manual",
        status: input.entries?.length ? "pending_review" : (input.status ?? "draft"),
        source: input.source ?? "manual",
        notes: input.notes ?? null,
        createdByMembershipId: actor.membershipId,
      })
      .returning();
    if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a importação CNIS.");

    const insertedEntries: Array<typeof cnisEntries.$inferSelect> = [];
    const warnings: Array<typeof cnisWarnings.$inferSelect> = [];
    const seen = new Map<string, string>();

    for (const entry of input.entries ?? []) {
      const [row] = await tx
        .insert(cnisEntries)
        .values({
          organizationId,
          importId: created.id,
          competence: entry.competence,
          relationshipType: entry.relationshipType ?? null,
          employer: entry.employer ?? null,
          employerDocument: entry.employerDocument ?? null,
          remunerationCents: entry.remunerationCents ?? null,
          contributionCents: entry.contributionCents ?? null,
          indicators: entry.indicators ?? null,
          source: entry.source ?? "import",
          reviewStatus: entry.reviewStatus ?? "unreviewed",
        })
        .returning();
      if (!row) continue;
      insertedEntries.push(row);

      const prior = seen.get(entry.competence);
      if (prior) {
        const [warning] = await tx
          .insert(cnisWarnings)
          .values({
            organizationId,
            importId: created.id,
            entryId: row.id,
            code: "DUPLICATE_COMPETENCE",
            severity: "warning",
            message: `Competência duplicada na importação: ${entry.competence}`,
            metadata: { competence: entry.competence, priorEntryId: prior },
          })
          .returning();
        if (warning) warnings.push(warning);
      } else {
        seen.set(entry.competence, row.id);
      }
    }

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "previdentiary.cnis_imported",
      resourceType: "cnis_import",
      resourceId: created.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        importFormat: created.importFormat,
        entries: insertedEntries.length,
        warnings: warnings.length,
        note: "Importação manual estruturada — não é CNIS oficial sincronizado.",
      },
    });

    return {
      import: serializeCnisImport(created),
      entries: insertedEntries.map(serializeCnisEntry),
      warnings: warnings.map((w) => ({
        id: w.id,
        code: w.code,
        severity: w.severity,
        message: w.message,
        entryId: w.entryId,
      })),
    };
  });
}

export async function listCnisImports(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    previdentiaryCaseId?: string;
    clientId?: string;
    status?: typeof cnisImports.$inferSelect.status;
    limit: number;
    offset: number;
  },
) {
  requireCaseRead(account, organizationId);
  const conditions: SQL[] = [eq(cnisImports.organizationId, organizationId)];
  if (query.previdentiaryCaseId) {
    conditions.push(eq(cnisImports.previdentiaryCaseId, query.previdentiaryCaseId));
  }
  if (query.clientId) conditions.push(eq(cnisImports.clientId, query.clientId));
  if (query.status) conditions.push(eq(cnisImports.status, query.status));
  const where = and(...conditions);
  const [rows, totalRow] = await Promise.all([
    db.query.cnisImports.findMany({
      where,
      orderBy: [desc(cnisImports.updatedAt)],
      limit: query.limit,
      offset: query.offset,
    }),
    db.select({ value: count() }).from(cnisImports).where(where),
  ]);
  return {
    items: rows.map(serializeCnisImport),
    pagination: { total: totalRow[0]?.value ?? 0, limit: query.limit, offset: query.offset },
  };
}

export async function getCnisImport(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  importId: string,
) {
  requireCaseRead(account, organizationId);
  const row = await requireCnisImport(db, organizationId, importId);
  const [entries, warnings] = await Promise.all([
    db.query.cnisEntries.findMany({
      where: and(
        eq(cnisEntries.organizationId, organizationId),
        eq(cnisEntries.importId, importId),
      ),
      orderBy: [asc(cnisEntries.competence)],
    }),
    db.query.cnisWarnings.findMany({
      where: and(
        eq(cnisWarnings.organizationId, organizationId),
        eq(cnisWarnings.importId, importId),
      ),
    }),
  ]);
  return {
    import: serializeCnisImport(row),
    entries: entries.map(serializeCnisEntry),
    warnings: warnings.map((w) => ({
      id: w.id,
      code: w.code,
      severity: w.severity,
      message: w.message,
      entryId: w.entryId,
      metadata: w.metadata,
    })),
  };
}

export async function reviewCnisEntry(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  entryId: string,
  input: { reviewStatus: typeof cnisEntries.$inferSelect.reviewStatus },
  meta: RequestMeta,
) {
  const actor = requireCnisManage(account, organizationId);
  const entry = await db.query.cnisEntries.findFirst({
    where: and(eq(cnisEntries.id, entryId), eq(cnisEntries.organizationId, organizationId)),
  });
  if (!entry) throw new AppError("NOT_FOUND", "Não encontramos esta entrada CNIS no seu acesso.");

  const [updated] = await db
    .update(cnisEntries)
    .set({ reviewStatus: input.reviewStatus, updatedAt: new Date() })
    .where(eq(cnisEntries.id, entryId))
    .returning();
  if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível revisar a entrada.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "previdentiary.cnis_entry_reviewed",
    resourceType: "cnis_entry",
    resourceId: entryId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { reviewStatus: input.reviewStatus },
  });
  void actor;
  return { entry: serializeCnisEntry(updated) };
}

/* ─── Calculations ─── */

export async function createCalculation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    previdentiaryCaseId: string;
    calculationType: string;
    ruleSetId?: string;
    ruleSetVersion: string;
    referenceDate: string;
    inputSnapshot?: Record<string, unknown>;
  },
  meta: RequestMeta,
) {
  const actor = requireCalculate(account, organizationId);
  await requireCase(db, organizationId, input.previdentiaryCaseId);
  if (input.ruleSetId) {
    const rs = await db.query.previdentiaryRuleSets.findFirst({
      where: eq(previdentiaryRuleSets.id, input.ruleSetId),
    });
    if (!rs) throw new AppError("NOT_FOUND", "Rule set não encontrado.");
  }

  const [created] = await db
    .insert(previdentiaryCalculations)
    .values({
      organizationId,
      previdentiaryCaseId: input.previdentiaryCaseId,
      calculationType: input.calculationType,
      ruleSetId: input.ruleSetId ?? null,
      ruleSetVersion: input.ruleSetVersion,
      referenceDate: new Date(input.referenceDate),
      inputSnapshot: input.inputSnapshot ?? {},
      status: "draft",
      createdByMembershipId: actor.membershipId,
    })
    .returning();
  if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o cálculo.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "previdentiary.calculation_created",
    resourceType: "previdentiary_calculation",
    resourceId: created.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: {
      calculationType: created.calculationType,
      ruleSetVersion: created.ruleSetVersion,
      status: created.status,
    },
  });

  return { calculation: serializeCalculation(created) };
}

export async function listCalculations(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    previdentiaryCaseId?: string;
    status?: typeof previdentiaryCalculations.$inferSelect.status;
    calculationType?: string;
    limit: number;
    offset: number;
  },
) {
  requireCaseRead(account, organizationId);
  const conditions: SQL[] = [eq(previdentiaryCalculations.organizationId, organizationId)];
  if (query.previdentiaryCaseId) {
    conditions.push(eq(previdentiaryCalculations.previdentiaryCaseId, query.previdentiaryCaseId));
  }
  if (query.status) conditions.push(eq(previdentiaryCalculations.status, query.status));
  if (query.calculationType) {
    conditions.push(eq(previdentiaryCalculations.calculationType, query.calculationType));
  }
  const where = and(...conditions);
  const [rows, totalRow] = await Promise.all([
    db.query.previdentiaryCalculations.findMany({
      where,
      orderBy: [desc(previdentiaryCalculations.updatedAt)],
      limit: query.limit,
      offset: query.offset,
    }),
    db.select({ value: count() }).from(previdentiaryCalculations).where(where),
  ]);
  return {
    items: rows.map(serializeCalculation),
    pagination: { total: totalRow[0]?.value ?? 0, limit: query.limit, offset: query.offset },
  };
}

export async function getCalculation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  calculationId: string,
) {
  requireCaseRead(account, organizationId);
  const row = await requireCalculation(db, organizationId, calculationId);
  return { calculation: serializeCalculation(row) };
}

export async function updateCalculation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  calculationId: string,
  input: {
    calculationType?: string;
    ruleSetId?: string | null;
    ruleSetVersion?: string;
    referenceDate?: string;
    inputSnapshot?: Record<string, unknown>;
    resultSnapshot?: Record<string, unknown> | null;
    status?: typeof previdentiaryCalculations.$inferSelect.status;
  },
  meta: RequestMeta,
) {
  const actor = requireCalculate(account, organizationId);
  const existing = await requireCalculation(db, organizationId, calculationId);

  if (existing.status === "approved") {
    throw new AppError("CONFLICT", "Cálculo aprovado é imutável. Crie uma nova versão.");
  }

  const changingInput =
    input.inputSnapshot !== undefined ||
    input.ruleSetVersion !== undefined ||
    input.calculationType !== undefined ||
    input.referenceDate !== undefined;

  if (
    changingInput &&
    (existing.status === "calculated" ||
      existing.status === "review_required" ||
      existing.status === "reviewed")
  ) {
    return db.transaction(async (tx) => {
      await tx
        .update(previdentiaryCalculations)
        .set({ status: "superseded", updatedAt: new Date() })
        .where(eq(previdentiaryCalculations.id, calculationId));

      const [created] = await tx
        .insert(previdentiaryCalculations)
        .values({
          organizationId,
          previdentiaryCaseId: existing.previdentiaryCaseId,
          calculationType: input.calculationType ?? existing.calculationType,
          ruleSetId: input.ruleSetId !== undefined ? input.ruleSetId : existing.ruleSetId,
          ruleSetVersion: input.ruleSetVersion ?? existing.ruleSetVersion,
          referenceDate: input.referenceDate
            ? new Date(input.referenceDate)
            : existing.referenceDate,
          inputSnapshot: input.inputSnapshot ?? existing.inputSnapshot,
          status: "draft",
          createdByMembershipId: actor.membershipId,
        })
        .returning();
      if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível versionar o cálculo.");

      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "previdentiary.calculation_created",
        resourceType: "previdentiary_calculation",
        resourceId: created.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: {
          supersedes: calculationId,
          calculationType: created.calculationType,
          status: "draft",
        },
      });

      return {
        calculation: serializeCalculation(created),
        supersededId: calculationId,
      };
    });
  }

  const [updated] = await db
    .update(previdentiaryCalculations)
    .set({
      ...(input.calculationType !== undefined ? { calculationType: input.calculationType } : {}),
      ...(input.ruleSetId !== undefined ? { ruleSetId: input.ruleSetId } : {}),
      ...(input.ruleSetVersion !== undefined ? { ruleSetVersion: input.ruleSetVersion } : {}),
      ...(input.referenceDate !== undefined
        ? { referenceDate: new Date(input.referenceDate) }
        : {}),
      ...(input.inputSnapshot !== undefined ? { inputSnapshot: input.inputSnapshot } : {}),
      ...(input.resultSnapshot !== undefined ? { resultSnapshot: input.resultSnapshot } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(previdentiaryCalculations.id, calculationId),
        eq(previdentiaryCalculations.organizationId, organizationId),
      ),
    )
    .returning();
  if (!updated) throw new AppError("NOT_FOUND", "Não encontramos este cálculo no seu acesso.");
  return { calculation: serializeCalculation(updated) };
}

export async function runCalculation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  calculationId: string,
  input: { inputSnapshot?: Record<string, unknown> },
  meta: RequestMeta,
) {
  const actor = requireCalculate(account, organizationId);
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
    envelope = runEngine(existing.calculationType, existing.ruleSetVersion, inputSnapshot);
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
      .update(previdentiaryRuleSets)
      .set({ locked: true, updatedAt: new Date() })
      .where(eq(previdentiaryRuleSets.id, existing.ruleSetId));
  }

  const [updated] = await db
    .update(previdentiaryCalculations)
    .set({
      inputSnapshot,
      resultSnapshot,
      status: nextStatus,
      updatedAt: new Date(),
    })
    .where(eq(previdentiaryCalculations.id, calculationId))
    .returning();
  if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível persistir o cálculo.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "previdentiary.calculation_run",
    resourceType: "previdentiary_calculation",
    resourceId: calculationId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: {
      status: nextStatus,
      memorySteps: envelope.memory.length,
      warnings: envelope.warnings.length,
    },
  });
  void actor;
  return { calculation: serializeCalculation(updated) };
}

export async function reviewCalculation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  calculationId: string,
  input: { decision: "reviewed" | "approved"; notes?: string },
  meta: RequestMeta,
) {
  const actor = requireCalcReview(account, organizationId);
  const existing = await requireCalculation(db, organizationId, calculationId);
  if (existing.status === "approved") {
    throw new AppError("CONFLICT", "Cálculo já aprovado e imutável.");
  }
  if (existing.status === "draft" || existing.status === "superseded") {
    throw new AppError("VALIDATION_ERROR", "Execute o cálculo antes da revisão.");
  }

  const [updated] = await db
    .update(previdentiaryCalculations)
    .set({
      status: input.decision === "approved" ? "approved" : "reviewed",
      reviewedByMembershipId: actor.membershipId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(previdentiaryCalculations.id, calculationId))
    .returning();
  if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível revisar o cálculo.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "previdentiary.calculation_reviewed",
    resourceType: "previdentiary_calculation",
    resourceId: calculationId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { status: updated.status, notes: input.notes ?? null },
  });

  return { calculation: serializeCalculation(updated) };
}

/* ─── Rule sets / scenarios ─── */

export async function listRuleSets(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  requireCaseRead(account, organizationId);
  const rows = await db.query.previdentiaryRuleSets.findMany({
    orderBy: [desc(previdentiaryRuleSets.effectiveFrom)],
  });
  return {
    items: rows.map((r) => ({
      id: r.id,
      key: r.key,
      version: r.version,
      effectiveFrom: r.effectiveFrom.toISOString(),
      effectiveTo: iso(r.effectiveTo),
      source: r.source,
      status: r.status,
      locked: r.locked,
      metadata: r.metadata,
    })),
  };
}

export async function createRuleSet(
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
    status?: typeof previdentiaryRuleSets.$inferSelect.status;
    metadata?: Record<string, unknown>;
  },
  meta: RequestMeta,
) {
  const actor = requireCalculate(account, organizationId);
  try {
    const [created] = await db
      .insert(previdentiaryRuleSets)
      .values({
        key: input.key,
        version: input.version,
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: parseOptionalDate(input.effectiveTo) ?? null,
        source: input.source ?? "organization",
        sourceUrl: input.sourceUrl ?? null,
        status: input.status ?? "draft",
        metadata: input.metadata ?? null,
        locked: false,
      })
      .returning();
    if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o rule set.");
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "previdentiary.rule_set_created",
      resourceType: "previdentiary_rule_set",
      resourceId: created.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { key: created.key, version: created.version },
    });
    void actor;
    return {
      ruleSet: {
        id: created.id,
        key: created.key,
        version: created.version,
        effectiveFrom: created.effectiveFrom.toISOString(),
        effectiveTo: iso(created.effectiveTo),
        source: created.source,
        status: created.status,
        locked: created.locked,
      },
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Já existe um rule set com esta chave e versão.");
    }
    throw error;
  }
}

export async function compareScenarios(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    previdentiaryCaseId: string;
    ruleSetVersion: string;
    scenarios: Array<{
      id: string;
      benefitType: string;
      der?: string;
      ruleSetVersion?: string;
      eligibilityStatus?: string;
      estimatedRmiCents: number;
      estimatedStart?: string;
      assumptions?: string[];
      missingData?: string[];
    }>;
  },
  meta: RequestMeta,
) {
  const actor = requireCalculate(account, organizationId);
  await requireCase(db, organizationId, input.previdentiaryCaseId);
  for (const s of input.scenarios) {
    assertIntegerCents(s.estimatedRmiCents, "estimatedRmiCents");
  }

  const envelope = engine.scenarios({
    ruleSetVersion: input.ruleSetVersion,
    scenarios: input.scenarios,
  });

  const persisted: Array<typeof benefitScenarios.$inferSelect> = [];
  for (const s of input.scenarios) {
    const [row] = await db
      .insert(benefitScenarios)
      .values({
        organizationId,
        previdentiaryCaseId: input.previdentiaryCaseId,
        der: s.der ? new Date(s.der) : null,
        ruleSetVersion: s.ruleSetVersion ?? input.ruleSetVersion,
        eligibilityStatus: s.eligibilityStatus ?? null,
        estimatedRmiCents: s.estimatedRmiCents,
        estimatedStart: s.estimatedStart ? new Date(s.estimatedStart) : null,
        assumptions: s.assumptions ? { assumptions: s.assumptions } : null,
        missingData: s.missingData ?? null,
        reviewStatus: "estimated",
      })
      .returning();
    if (row) persisted.push(row);
  }

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "previdentiary.scenarios_compared",
    resourceType: "previdentiary_case",
    resourceId: input.previdentiaryCaseId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: {
      highestScenarioId: envelope.result.highestScenarioId,
      count: input.scenarios.length,
    },
  });
  void actor;

  return {
    comparison: envelope,
    scenarios: persisted.map((r) => ({
      id: r.id,
      estimatedRmiCents: r.estimatedRmiCents,
      eligibilityStatus: r.eligibilityStatus,
      reviewStatus: r.reviewStatus,
    })),
  };
}

/* ─── Documents ─── */

export async function linkDocument(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    documentId: string;
    linkType: (typeof PREVIDENTIARY_LINK_TYPES)[number];
    targetType:
      | "previdentiary_case"
      | "social_security_benefit"
      | "previdentiary_request"
      | "cnis_import"
      | "previdentiary_calculation";
    targetId: string;
  },
  meta: RequestMeta,
) {
  requireCaseUpdate(account, organizationId);
  if (input.targetType === "previdentiary_case") {
    await requireCase(db, organizationId, input.targetId);
  } else if (input.targetType === "social_security_benefit") {
    await requireBenefit(db, organizationId, input.targetId);
  } else if (input.targetType === "previdentiary_request") {
    await requireRequest(db, organizationId, input.targetId);
  } else if (input.targetType === "cnis_import") {
    await requireCnisImport(db, organizationId, input.targetId);
  } else {
    await requireCalculation(db, organizationId, input.targetId);
  }

  const doc = await requireDocumentInOrg(db, organizationId, input.documentId);
  await assertCanReadDocument(db, account, organizationId, doc);

  const existing = await db.query.documentLinks.findFirst({
    where: and(
      eq(documentLinks.organizationId, organizationId),
      eq(documentLinks.documentId, doc.id),
      eq(documentLinks.targetType, input.targetType),
      eq(documentLinks.targetId, input.targetId),
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
      targetType: input.targetType,
      targetId: input.targetId,
      linkType: input.linkType,
    })
    .returning();
  if (!link) throw new AppError("INTERNAL_ERROR", "Não foi possível vincular o documento.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "previdentiary.document_linked",
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

export async function listLinkedDocuments(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  targetType: string,
  targetId: string,
) {
  requireCaseRead(account, organizationId);
  const rows = await db
    .select({ link: documentLinks, doc: documents })
    .from(documentLinks)
    .innerJoin(documents, eq(documents.id, documentLinks.documentId))
    .where(
      and(
        eq(documentLinks.organizationId, organizationId),
        eq(documentLinks.targetType, targetType),
        eq(documentLinks.targetId, targetId),
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

/* ─── Provider health ─── */

export async function getProviderHealth(
  deps: PrevidentiaryDeps,
  account: SessionAccount,
  organizationId: string,
) {
  requireCaseRead(account, organizationId);
  const { socialSecurityProvider, cnisProvider } = resolveProviders(deps);
  const [social, cnis] = await Promise.all([
    socialSecurityProvider.healthCheck(),
    cnisProvider.healthCheck(),
  ]);
  return {
    socialSecurityProvider: {
      id: socialSecurityProvider.id,
      ...social,
    },
    cnisProvider: {
      id: cnisProvider.id,
      ...cnis,
    },
  };
}

export async function listBenefitTypes(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  requireCaseRead(account, organizationId);
  const rows = await db.query.benefitTypes.findMany({
    where: eq(benefitTypes.active, true),
    orderBy: [asc(benefitTypes.code)],
  });
  return {
    items: rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      category: r.category,
      regime: r.regime,
      source: r.source,
      official: false as const,
      note: "Catálogo placeholder — não é catálogo oficial do INSS.",
    })),
  };
}
