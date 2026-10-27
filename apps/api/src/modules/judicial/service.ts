import { recordAudit } from "@verasjuris/audit";
import {
  assertAppealTransition,
  assertHearingTransition,
  assertJudicialProcessTransition,
  policyJudicialAppeal,
  policyJudicialDecision,
  policyJudicialEnforcement,
  policyJudicialHearing,
  policyJudicialLawyer,
  policyJudicialMovement,
  policyJudicialParty,
  policyJudicialProcess,
  type JudicialAppealStatus,
  type JudicialHearingStatus,
  type JudicialProcessStatus,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  courts,
  courtUnits,
  isUniqueViolation,
  judicialAppeals,
  judicialDecisions,
  judicialDistricts,
  judicialEnforcements,
  judicialHearings,
  judicialMovements,
  judicialPhaseCatalog,
  judicialProcessLawyers,
  judicialProcessParties,
  judicialProcessPhaseHistory,
  judicialProcesses,
  judicialProcessSubjects,
  judicialProcessTimelineEvents,
  legalMatters,
  legalMatterTimelineEvents,
  proceduralClasses,
  proceduralSubjects,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { validateCnjNumber } from "@verasjuris/validation";
import { and, asc, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import type { RequestMeta } from "../auth/service.js";
import { ensureJudicialReferenceCatalog } from "./catalog.js";

type DbTx = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

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

function requireProcessPermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyJudicialProcess>[1],
) {
  const decision = policyJudicialProcess(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function requirePartyPermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyJudicialParty>[1],
) {
  const decision = policyJudicialParty(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function requireLawyerPermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyJudicialLawyer>[1],
) {
  const decision = policyJudicialLawyer(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function requireMovementPermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyJudicialMovement>[1],
) {
  const decision = policyJudicialMovement(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function requireHearingPermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyJudicialHearing>[1],
) {
  const decision = policyJudicialHearing(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function requireDecisionPermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyJudicialDecision>[1],
) {
  const decision = policyJudicialDecision(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function requireAppealPermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyJudicialAppeal>[1],
) {
  const decision = policyJudicialAppeal(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function requireEnforcementPermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyJudicialEnforcement>[1],
) {
  const decision = policyJudicialEnforcement(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function parseOptionalDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}

function serializeProcess(row: typeof judicialProcesses.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    legalMatterId: row.legalMatterId,
    cnjNumber: row.cnjNumber,
    cnjNumberNormalized: row.cnjNumberNormalized,
    tribunalId: row.tribunalId,
    courtUnitId: row.courtUnitId,
    courtUnitText: row.courtUnitText,
    districtId: row.districtId,
    districtText: row.districtText,
    proceduralClassId: row.proceduralClassId,
    primarySubjectId: row.primarySubjectId,
    status: row.status,
    currentPhaseId: row.currentPhaseId,
    filingDate: row.filingDate?.toISOString() ?? null,
    distributionDate: row.distributionDate?.toISOString() ?? null,
    confidentialityLevel: row.confidentialityLevel,
    source: row.source,
    sourceReference: row.sourceReference,
    sourceUpdatedAt: row.sourceUpdatedAt?.toISOString() ?? null,
    lastMovementAt: row.lastMovementAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    closureReason: row.closureReason,
    closureSource: row.closureSource,
    closureNotes: row.closureNotes,
    createdByMembershipId: row.createdByMembershipId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function requireMatterInOrg(
  db: AppDatabase | DbTx,
  organizationId: string,
  matterId: string,
) {
  const matter = await db.query.legalMatters.findFirst({
    where: and(eq(legalMatters.id, matterId), eq(legalMatters.organizationId, organizationId)),
  });
  if (!matter) {
    throw new AppError("NOT_FOUND", "Não encontramos este caso no seu acesso.");
  }
  return matter;
}

async function requireProcessInMatter(
  db: AppDatabase | DbTx,
  organizationId: string,
  matterId: string,
  processId: string,
) {
  const process = await db.query.judicialProcesses.findFirst({
    where: and(
      eq(judicialProcesses.id, processId),
      eq(judicialProcesses.organizationId, organizationId),
      eq(judicialProcesses.legalMatterId, matterId),
    ),
  });
  if (!process) {
    throw new AppError("NOT_FOUND", "Não encontramos este processo judicial no seu acesso.");
  }
  return process;
}

async function appendProcessTimeline(
  tx: DbTx,
  input: {
    organizationId: string;
    judicialProcessId: string;
    legalMatterId: string;
    eventType: string;
    title: string;
    body?: string | null;
    occurredAt?: Date;
    source?: "manual" | "document" | "court_provider" | "import";
    actorMembershipId?: string | null;
    projectToMatter?: boolean;
  },
) {
  const occurredAt = input.occurredAt ?? new Date();
  await tx.insert(judicialProcessTimelineEvents).values({
    organizationId: input.organizationId,
    judicialProcessId: input.judicialProcessId,
    legalMatterId: input.legalMatterId,
    eventType: input.eventType,
    title: input.title,
    body: input.body ?? null,
    occurredAt,
    source: input.source ?? "manual",
    actorMembershipId: input.actorMembershipId ?? null,
  });
  if (input.projectToMatter) {
    await tx.insert(legalMatterTimelineEvents).values({
      organizationId: input.organizationId,
      legalMatterId: input.legalMatterId,
      eventType: input.eventType,
      title: input.title,
      body: null,
      actorMembershipId: input.actorMembershipId ?? null,
      occurredAt,
    });
  }
}

async function assertTribunal(db: AppDatabase | DbTx, tribunalId: string) {
  const court = await db.query.courts.findFirst({ where: eq(courts.id, tribunalId) });
  if (!court || !court.active) {
    throw new AppError("VALIDATION_ERROR", "Tribunal inválido ou inativo.", [
      { path: "tribunalId", message: "Selecione um tribunal válido." },
    ]);
  }
  return court;
}

async function assertOptionalRefs(
  db: AppDatabase | DbTx,
  input: {
    courtUnitId?: string | null;
    districtId?: string | null;
    proceduralClassId?: string | null;
    primarySubjectId?: string | null;
    currentPhaseId?: string | null;
    tribunalId?: string;
  },
) {
  if (input.courtUnitId) {
    const unit = await db.query.courtUnits.findFirst({
      where: eq(courtUnits.id, input.courtUnitId),
    });
    if (!unit) {
      throw new AppError("VALIDATION_ERROR", "Unidade judiciária inválida.", [
        { path: "courtUnitId", message: "Selecione uma unidade válida." },
      ]);
    }
    if (input.tribunalId && unit.tribunalId !== input.tribunalId) {
      throw new AppError("VALIDATION_ERROR", "A unidade não pertence ao tribunal informado.", [
        { path: "courtUnitId", message: "Escolha uma unidade do tribunal selecionado." },
      ]);
    }
  }
  if (input.districtId) {
    const district = await db.query.judicialDistricts.findFirst({
      where: eq(judicialDistricts.id, input.districtId),
    });
    if (!district) {
      throw new AppError("VALIDATION_ERROR", "Comarca inválida.", [
        { path: "districtId", message: "Selecione uma comarca válida." },
      ]);
    }
  }
  if (input.proceduralClassId) {
    const klass = await db.query.proceduralClasses.findFirst({
      where: eq(proceduralClasses.id, input.proceduralClassId),
    });
    if (!klass) {
      throw new AppError("VALIDATION_ERROR", "Classe processual inválida.", [
        { path: "proceduralClassId", message: "Selecione uma classe válida." },
      ]);
    }
  }
  if (input.primarySubjectId) {
    const subject = await db.query.proceduralSubjects.findFirst({
      where: eq(proceduralSubjects.id, input.primarySubjectId),
    });
    if (!subject) {
      throw new AppError("VALIDATION_ERROR", "Assunto processual inválido.", [
        { path: "primarySubjectId", message: "Selecione um assunto válido." },
      ]);
    }
  }
  if (input.currentPhaseId) {
    const phase = await db.query.judicialPhaseCatalog.findFirst({
      where: eq(judicialPhaseCatalog.id, input.currentPhaseId),
    });
    if (!phase) {
      throw new AppError("VALIDATION_ERROR", "Fase processual inválida.", [
        { path: "currentPhaseId", message: "Selecione uma fase válida." },
      ]);
    }
  }
}

async function replaceSubjects(
  tx: DbTx,
  organizationId: string,
  processId: string,
  subjectIds: string[],
  primarySubjectId: string | null,
) {
  const uniqueIds = [...new Set(subjectIds)];
  if (uniqueIds.length > 0) {
    const found = await tx.query.proceduralSubjects.findMany({
      where: inArray(proceduralSubjects.id, uniqueIds),
    });
    if (found.length !== uniqueIds.length) {
      throw new AppError("VALIDATION_ERROR", "Um ou mais assuntos são inválidos.", [
        { path: "subjectIds", message: "Revise a lista de assuntos." },
      ]);
    }
  }
  await tx
    .delete(judicialProcessSubjects)
    .where(eq(judicialProcessSubjects.judicialProcessId, processId));
  if (uniqueIds.length === 0) return;
  await tx.insert(judicialProcessSubjects).values(
    uniqueIds.map((subjectId) => ({
      organizationId,
      judicialProcessId: processId,
      subjectId,
      isPrimary: primarySubjectId === subjectId,
    })),
  );
}

export async function listCourtsCatalog(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  requireProcessPermission(account, organizationId, "judicial_process.read");
  await ensureJudicialReferenceCatalog(db);
  const rows = await db.query.courts.findMany({
    where: eq(courts.active, true),
    orderBy: [asc(courts.name)],
  });
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    acronym: row.acronym,
    branch: row.branch,
    jurisdictionLevel: row.jurisdictionLevel,
    stateCode: row.stateCode,
    source: row.source,
    sourceVersion: row.sourceVersion,
  }));
}

export async function listCourtUnitsCatalog(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  tribunalId?: string,
) {
  requireProcessPermission(account, organizationId, "judicial_process.read");
  await ensureJudicialReferenceCatalog(db);
  const rows = await db.query.courtUnits.findMany({
    where: tribunalId
      ? and(eq(courtUnits.active, true), eq(courtUnits.tribunalId, tribunalId))
      : eq(courtUnits.active, true),
    orderBy: [asc(courtUnits.name)],
  });
  return rows.map((row) => ({
    id: row.id,
    tribunalId: row.tribunalId,
    code: row.code,
    name: row.name,
    unitType: row.unitType,
    districtId: row.districtId,
    source: row.source,
  }));
}

export async function listJudicialDistrictsCatalog(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  requireProcessPermission(account, organizationId, "judicial_process.read");
  await ensureJudicialReferenceCatalog(db);
  const rows = await db.query.judicialDistricts.findMany({
    where: eq(judicialDistricts.active, true),
    orderBy: [asc(judicialDistricts.name)],
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    stateCode: row.stateCode,
    tribunalId: row.tribunalId,
    source: row.source,
  }));
}

export async function listProceduralClassesCatalog(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  requireProcessPermission(account, organizationId, "judicial_process.read");
  await ensureJudicialReferenceCatalog(db);
  const rows = await db.query.proceduralClasses.findMany({
    where: eq(proceduralClasses.active, true),
    orderBy: [asc(proceduralClasses.name)],
  });
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    source: row.source,
  }));
}

export async function listProceduralSubjectsCatalog(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  requireProcessPermission(account, organizationId, "judicial_process.read");
  await ensureJudicialReferenceCatalog(db);
  const rows = await db.query.proceduralSubjects.findMany({
    where: eq(proceduralSubjects.active, true),
    orderBy: [asc(proceduralSubjects.name)],
  });
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    parentId: row.parentId,
    source: row.source,
  }));
}

export async function listJudicialPhasesCatalog(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  requireProcessPermission(account, organizationId, "judicial_process.read");
  await ensureJudicialReferenceCatalog(db);
  const rows = await db.query.judicialPhaseCatalog.findMany({
    where: eq(judicialPhaseCatalog.active, true),
    orderBy: [asc(judicialPhaseCatalog.sortOrder)],
  });
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    sortOrder: row.sortOrder,
    source: row.source,
  }));
}

export async function listJudicialProcesses(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  query: { q?: string; status?: string; tribunalId?: string; limit: number; offset: number },
) {
  requireProcessPermission(account, organizationId, "judicial_process.read");
  await requireMatterInOrg(db, organizationId, matterId);
  await ensureJudicialReferenceCatalog(db);

  const filters = [
    eq(judicialProcesses.organizationId, organizationId),
    eq(judicialProcesses.legalMatterId, matterId),
  ];
  if (query.status)
    filters.push(eq(judicialProcesses.status, query.status as JudicialProcessStatus));
  if (query.tribunalId) filters.push(eq(judicialProcesses.tribunalId, query.tribunalId));
  if (query.q) {
    const term = `%${query.q.replace(/\D/g, "") || query.q}%`;
    filters.push(
      or(
        ilike(judicialProcesses.cnjNumber, `%${query.q}%`),
        ilike(judicialProcesses.cnjNumberNormalized, term),
      )!,
    );
  }

  const where = and(...filters);
  const [totalRow] = await db.select({ value: count() }).from(judicialProcesses).where(where);
  const items = await db.query.judicialProcesses.findMany({
    where,
    orderBy: [desc(judicialProcesses.updatedAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return {
    items: items.map(serializeProcess),
    total: totalRow?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getJudicialProcess(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  processId: string,
) {
  requireProcessPermission(account, organizationId, "judicial_process.read");
  const process = await requireProcessInMatter(db, organizationId, matterId, processId);
  const subjects = await db.query.judicialProcessSubjects.findMany({
    where: eq(judicialProcessSubjects.judicialProcessId, processId),
  });
  return {
    ...serializeProcess(process),
    subjectIds: subjects.map((item) => item.subjectId),
  };
}

export async function createJudicialProcess(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  input: {
    cnjNumber: string;
    tribunalId: string;
    courtUnitId?: string;
    courtUnitText?: string;
    districtId?: string;
    districtText?: string;
    proceduralClassId?: string;
    primarySubjectId?: string;
    subjectIds?: string[];
    currentPhaseId?: string;
    filingDate?: string;
    distributionDate?: string;
    confidentialityLevel?: "public" | "restricted" | "secret";
    source?: "manual";
    sourceReference?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireProcessPermission(account, organizationId, "judicial_process.create");
  await ensureJudicialReferenceCatalog(db);
  await requireMatterInOrg(db, organizationId, matterId);

  const cnj = validateCnjNumber(input.cnjNumber);
  if (!cnj.ok) {
    throw new AppError("VALIDATION_ERROR", cnj.message, [
      { path: "cnjNumber", message: cnj.message },
    ]);
  }

  await assertTribunal(db, input.tribunalId);
  await assertOptionalRefs(db, {
    ...input,
    courtUnitId: input.courtUnitId,
    districtId: input.districtId,
    proceduralClassId: input.proceduralClassId,
    primarySubjectId: input.primarySubjectId,
    currentPhaseId: input.currentPhaseId,
    tribunalId: input.tribunalId,
  });

  const subjectIds = [
    ...new Set([
      ...(input.subjectIds ?? []),
      ...(input.primarySubjectId ? [input.primarySubjectId] : []),
    ]),
  ];

  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(judicialProcesses)
        .values({
          organizationId,
          legalMatterId: matterId,
          cnjNumber: cnj.formatted,
          cnjNumberNormalized: cnj.normalized,
          tribunalId: input.tribunalId,
          courtUnitId: input.courtUnitId ?? null,
          courtUnitText: input.courtUnitText ?? null,
          districtId: input.districtId ?? null,
          districtText: input.districtText ?? null,
          proceduralClassId: input.proceduralClassId ?? null,
          primarySubjectId: input.primarySubjectId ?? null,
          currentPhaseId: input.currentPhaseId ?? null,
          filingDate: parseOptionalDate(input.filingDate) ?? null,
          distributionDate: parseOptionalDate(input.distributionDate) ?? null,
          confidentialityLevel: input.confidentialityLevel ?? "public",
          source: "manual",
          sourceReference: input.sourceReference ?? null,
          createdByMembershipId: actor.membershipId,
        })
        .returning();
      if (!created) {
        throw new AppError(
          "INTERNAL_ERROR",
          "Não foi possível cadastrar o processo. Nenhuma alteração foi confirmada.",
        );
      }

      await replaceSubjects(
        tx,
        organizationId,
        created.id,
        subjectIds,
        input.primarySubjectId ?? null,
      );

      if (input.currentPhaseId) {
        await tx.insert(judicialProcessPhaseHistory).values({
          organizationId,
          judicialProcessId: created.id,
          phaseId: input.currentPhaseId,
          notes: "Fase inicial",
          actorMembershipId: actor.membershipId,
        });
      }

      await appendProcessTimeline(tx, {
        organizationId,
        judicialProcessId: created.id,
        legalMatterId: matterId,
        eventType: "judicial_process.created",
        title: `Processo ${created.cnjNumber} cadastrado`,
        actorMembershipId: actor.membershipId,
        projectToMatter: true,
      });

      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "judicial_process.created",
        resourceType: "judicial_process",
        resourceId: created.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: {
          cnjNumber: created.cnjNumber,
          legalMatterId: matterId,
          status: created.status,
          source: created.source,
        },
      });

      return serializeProcess(created);
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(
        "CONFLICT",
        "Já existe um processo com este número CNJ nesta organização.",
      );
    }
    throw error;
  }
}

export async function updateJudicialProcess(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  processId: string,
  input: {
    tribunalId?: string;
    courtUnitId?: string | null;
    courtUnitText?: string | null;
    districtId?: string | null;
    districtText?: string | null;
    proceduralClassId?: string | null;
    primarySubjectId?: string | null;
    subjectIds?: string[];
    filingDate?: string | null;
    distributionDate?: string | null;
    confidentialityLevel?: "public" | "restricted" | "secret";
    status?: "active" | "suspended";
    sourceReference?: string | null;
  },
  meta: RequestMeta,
) {
  const actor = requireProcessPermission(account, organizationId, "judicial_process.update");
  const process = await requireProcessInMatter(db, organizationId, matterId, processId);
  if (process.status === "closed" || process.status === "archived") {
    throw new AppError(
      "CONFLICT",
      "Processo baixado ou arquivado não pode ser editado desta forma. Reabra-o primeiro.",
    );
  }

  const nextTribunalId = input.tribunalId ?? process.tribunalId;
  if (input.tribunalId) await assertTribunal(db, input.tribunalId);
  await assertOptionalRefs(db, {
    tribunalId: nextTribunalId,
    courtUnitId: input.courtUnitId === undefined ? process.courtUnitId : input.courtUnitId,
    districtId: input.districtId === undefined ? process.districtId : input.districtId,
    proceduralClassId:
      input.proceduralClassId === undefined ? process.proceduralClassId : input.proceduralClassId,
    primarySubjectId:
      input.primarySubjectId === undefined ? process.primarySubjectId : input.primarySubjectId,
  });

  if (input.status) {
    assertJudicialProcessTransition(
      process.status as JudicialProcessStatus,
      input.status as JudicialProcessStatus,
    );
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(judicialProcesses)
      .set({
        tribunalId: nextTribunalId,
        courtUnitId: input.courtUnitId === undefined ? process.courtUnitId : input.courtUnitId,
        courtUnitText:
          input.courtUnitText === undefined ? process.courtUnitText : input.courtUnitText,
        districtId: input.districtId === undefined ? process.districtId : input.districtId,
        districtText: input.districtText === undefined ? process.districtText : input.districtText,
        proceduralClassId:
          input.proceduralClassId === undefined
            ? process.proceduralClassId
            : input.proceduralClassId,
        primarySubjectId:
          input.primarySubjectId === undefined ? process.primarySubjectId : input.primarySubjectId,
        filingDate:
          input.filingDate === undefined
            ? process.filingDate
            : (parseOptionalDate(input.filingDate) ?? null),
        distributionDate:
          input.distributionDate === undefined
            ? process.distributionDate
            : (parseOptionalDate(input.distributionDate) ?? null),
        confidentialityLevel: input.confidentialityLevel ?? process.confidentialityLevel,
        status: input.status ?? process.status,
        sourceReference:
          input.sourceReference === undefined ? process.sourceReference : input.sourceReference,
        updatedAt: new Date(),
      })
      .where(eq(judicialProcesses.id, processId))
      .returning();
    if (!updated) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível atualizar o processo.");
    }

    if (input.subjectIds) {
      const primary =
        input.primarySubjectId === undefined ? process.primarySubjectId : input.primarySubjectId;
      await replaceSubjects(tx, organizationId, processId, input.subjectIds, primary);
    } else if (input.primarySubjectId !== undefined) {
      const existing = await tx.query.judicialProcessSubjects.findMany({
        where: eq(judicialProcessSubjects.judicialProcessId, processId),
      });
      const ids = [
        ...new Set([
          ...existing.map((item) => item.subjectId),
          ...(input.primarySubjectId ? [input.primarySubjectId] : []),
        ]),
      ];
      await replaceSubjects(tx, organizationId, processId, ids, input.primarySubjectId);
    }

    await appendProcessTimeline(tx, {
      organizationId,
      judicialProcessId: processId,
      legalMatterId: matterId,
      eventType: "judicial_process.updated",
      title: `Processo ${updated.cnjNumber} atualizado`,
      actorMembershipId: actor.membershipId,
      projectToMatter: false,
    });

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "judicial_process.updated",
      resourceType: "judicial_process",
      resourceId: processId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { status: process.status, tribunalId: process.tribunalId },
      after: { status: updated.status, tribunalId: updated.tribunalId },
    });

    return serializeProcess(updated);
  });
}

export async function closeJudicialProcess(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  processId: string,
  input: { closureReason?: string; closureNotes?: string },
  meta: RequestMeta,
) {
  const actor = requireProcessPermission(account, organizationId, "judicial_process.close");
  const process = await requireProcessInMatter(db, organizationId, matterId, processId);
  assertJudicialProcessTransition(process.status as JudicialProcessStatus, "closed");

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(judicialProcesses)
      .set({
        status: "closed",
        closedAt: new Date(),
        closureReason: input.closureReason ?? null,
        closureNotes: input.closureNotes ?? null,
        closureSource: "manual",
        updatedAt: new Date(),
      })
      .where(eq(judicialProcesses.id, processId))
      .returning();
    if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível baixar o processo.");

    await appendProcessTimeline(tx, {
      organizationId,
      judicialProcessId: processId,
      legalMatterId: matterId,
      eventType: "judicial_process.closed",
      title: `Processo ${updated.cnjNumber} baixado`,
      actorMembershipId: actor.membershipId,
      projectToMatter: true,
    });

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "judicial_process.closed",
      resourceType: "judicial_process",
      resourceId: processId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { status: process.status },
      after: {
        status: updated.status,
        closureReason: updated.closureReason,
        closureSource: updated.closureSource,
      },
    });

    return serializeProcess(updated);
  });
}

export async function reopenJudicialProcess(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  processId: string,
  input: { notes?: string },
  meta: RequestMeta,
) {
  const actor = requireProcessPermission(account, organizationId, "judicial_process.reopen");
  const process = await requireProcessInMatter(db, organizationId, matterId, processId);
  assertJudicialProcessTransition(process.status as JudicialProcessStatus, "active");

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(judicialProcesses)
      .set({
        status: "active",
        closedAt: null,
        closureReason: null,
        closureNotes: input.notes ?? null,
        closureSource: null,
        updatedAt: new Date(),
      })
      .where(eq(judicialProcesses.id, processId))
      .returning();
    if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível reabrir o processo.");

    await appendProcessTimeline(tx, {
      organizationId,
      judicialProcessId: processId,
      legalMatterId: matterId,
      eventType: "judicial_process.reopened",
      title: `Processo ${updated.cnjNumber} reaberto`,
      actorMembershipId: actor.membershipId,
      projectToMatter: true,
    });

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "judicial_process.reopened",
      resourceType: "judicial_process",
      resourceId: processId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { status: process.status },
      after: { status: updated.status },
    });

    return serializeProcess(updated);
  });
}

export async function changeJudicialPhase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  processId: string,
  input: { phaseId: string; notes?: string },
  meta: RequestMeta,
) {
  const actor = requireProcessPermission(account, organizationId, "judicial_process.manage_phase");
  const process = await requireProcessInMatter(db, organizationId, matterId, processId);
  const phase = await db.query.judicialPhaseCatalog.findFirst({
    where: eq(judicialPhaseCatalog.id, input.phaseId),
  });
  if (!phase || !phase.active) {
    throw new AppError("VALIDATION_ERROR", "Fase processual inválida.", [
      { path: "phaseId", message: "Selecione uma fase válida." },
    ]);
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(judicialProcesses)
      .set({ currentPhaseId: input.phaseId, updatedAt: new Date() })
      .where(eq(judicialProcesses.id, processId))
      .returning();
    if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível alterar a fase.");

    await tx.insert(judicialProcessPhaseHistory).values({
      organizationId,
      judicialProcessId: processId,
      phaseId: input.phaseId,
      notes: input.notes ?? null,
      actorMembershipId: actor.membershipId,
    });

    await appendProcessTimeline(tx, {
      organizationId,
      judicialProcessId: processId,
      legalMatterId: matterId,
      eventType: "judicial_process.phase_changed",
      title: `Fase alterada para ${phase.name}`,
      actorMembershipId: actor.membershipId,
      projectToMatter: true,
    });

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "judicial_process.phase_changed",
      resourceType: "judicial_process",
      resourceId: processId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { currentPhaseId: process.currentPhaseId },
      after: { currentPhaseId: input.phaseId, phaseName: phase.name },
    });

    return serializeProcess(updated);
  });
}

export async function listPhaseHistory(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  processId: string,
) {
  requireProcessPermission(account, organizationId, "judicial_process.read");
  await requireProcessInMatter(db, organizationId, matterId, processId);
  const rows = await db.query.judicialProcessPhaseHistory.findMany({
    where: eq(judicialProcessPhaseHistory.judicialProcessId, processId),
    orderBy: [desc(judicialProcessPhaseHistory.changedAt)],
  });
  return rows.map((row) => ({
    id: row.id,
    phaseId: row.phaseId,
    changedAt: row.changedAt.toISOString(),
    notes: row.notes,
    actorMembershipId: row.actorMembershipId,
  }));
}

export async function addJudicialParty(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  processId: string,
  input: {
    displayName: string;
    proceduralRole?: typeof judicialProcessParties.$inferInsert.proceduralRole;
    side?: typeof judicialProcessParties.$inferInsert.side;
    matterPartyId?: string;
    clientId?: string;
    contactId?: string;
    documentNormalized?: string;
    isPrimary?: boolean;
    active?: boolean;
  },
  meta: RequestMeta,
) {
  const actor = requirePartyPermission(account, organizationId, "judicial_process.manage_parties");
  await requireProcessInMatter(db, organizationId, matterId, processId);

  return db.transaction(async (tx) => {
    const [party] = await tx
      .insert(judicialProcessParties)
      .values({
        organizationId,
        judicialProcessId: processId,
        displayName: input.displayName,
        proceduralRole: input.proceduralRole ?? "other",
        side: input.side ?? "other",
        matterPartyId: input.matterPartyId ?? null,
        clientId: input.clientId ?? null,
        contactId: input.contactId ?? null,
        documentNormalized: input.documentNormalized ?? null,
        isPrimary: input.isPrimary ?? false,
        active: input.active ?? true,
      })
      .returning();
    if (!party) throw new AppError("INTERNAL_ERROR", "Não foi possível incluir a parte.");

    await appendProcessTimeline(tx, {
      organizationId,
      judicialProcessId: processId,
      legalMatterId: matterId,
      eventType: "judicial_process.party_added",
      title: `Parte incluída: ${party.displayName}`,
      actorMembershipId: actor.membershipId,
      projectToMatter: false,
    });

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "judicial_process.party_added",
      resourceType: "judicial_process_party",
      resourceId: party.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        displayName: party.displayName,
        proceduralRole: party.proceduralRole,
        judicialProcessId: processId,
      },
    });

    return party;
  });
}

export async function listJudicialParties(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  processId: string,
) {
  requirePartyPermission(account, organizationId, "judicial_process.read");
  await requireProcessInMatter(db, organizationId, matterId, processId);
  return db.query.judicialProcessParties.findMany({
    where: and(
      eq(judicialProcessParties.judicialProcessId, processId),
      eq(judicialProcessParties.organizationId, organizationId),
    ),
    orderBy: [desc(judicialProcessParties.createdAt)],
  });
}

export async function addJudicialLawyer(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  processId: string,
  input: {
    displayName: string;
    partyId?: string;
    userId?: string;
    professionalProfileId?: string;
    oabNumber?: string;
    oabState?: string;
    representationType?: typeof judicialProcessLawyers.$inferInsert.representationType;
    active?: boolean;
  },
  meta: RequestMeta,
) {
  const actor = requireLawyerPermission(account, organizationId, "judicial_process.manage_lawyers");
  await requireProcessInMatter(db, organizationId, matterId, processId);

  if (input.partyId) {
    const party = await db.query.judicialProcessParties.findFirst({
      where: and(
        eq(judicialProcessParties.id, input.partyId),
        eq(judicialProcessParties.judicialProcessId, processId),
      ),
    });
    if (!party) {
      throw new AppError("VALIDATION_ERROR", "Parte inválida para este processo.", [
        { path: "partyId", message: "Selecione uma parte do processo." },
      ]);
    }
  }

  return db.transaction(async (tx) => {
    const [lawyer] = await tx
      .insert(judicialProcessLawyers)
      .values({
        organizationId,
        judicialProcessId: processId,
        displayName: input.displayName,
        partyId: input.partyId ?? null,
        userId: input.userId ?? null,
        professionalProfileId: input.professionalProfileId ?? null,
        oabNumber: input.oabNumber ?? null,
        oabState: input.oabState ?? null,
        oabVerificationStatus: "unverified",
        representationType: input.representationType ?? "counsel",
        active: input.active ?? true,
        source: "manual",
      })
      .returning();
    if (!lawyer) throw new AppError("INTERNAL_ERROR", "Não foi possível incluir o advogado.");

    await appendProcessTimeline(tx, {
      organizationId,
      judicialProcessId: processId,
      legalMatterId: matterId,
      eventType: "judicial_process.lawyer_added",
      title: `Advogado incluído: ${lawyer.displayName}`,
      actorMembershipId: actor.membershipId,
      projectToMatter: false,
    });

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "judicial_process.lawyer_added",
      resourceType: "judicial_process_lawyer",
      resourceId: lawyer.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        displayName: lawyer.displayName,
        oabVerificationStatus: lawyer.oabVerificationStatus,
        judicialProcessId: processId,
      },
    });

    return lawyer;
  });
}

export async function listJudicialLawyers(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  processId: string,
) {
  requireLawyerPermission(account, organizationId, "judicial_process.read");
  await requireProcessInMatter(db, organizationId, matterId, processId);
  return db.query.judicialProcessLawyers.findMany({
    where: and(
      eq(judicialProcessLawyers.judicialProcessId, processId),
      eq(judicialProcessLawyers.organizationId, organizationId),
    ),
    orderBy: [desc(judicialProcessLawyers.createdAt)],
  });
}

export async function addJudicialMovement(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  processId: string,
  input: {
    occurredAt: string;
    title: string;
    description?: string;
    movementCode?: string;
    sequence?: number;
    sourceReference?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireMovementPermission(
    account,
    organizationId,
    "judicial_process.manage_movements",
  );
  await requireProcessInMatter(db, organizationId, matterId, processId);
  const occurredAt = new Date(input.occurredAt);

  return db.transaction(async (tx) => {
    const [movement] = await tx
      .insert(judicialMovements)
      .values({
        organizationId,
        judicialProcessId: processId,
        occurredAt,
        title: input.title,
        description: input.description ?? null,
        movementCode: input.movementCode ?? null,
        sequence: input.sequence ?? null,
        source: "manual",
        sourceReference: input.sourceReference ?? null,
        capturedAt: new Date(),
        createdByMembershipId: actor.membershipId,
      })
      .returning();
    if (!movement)
      throw new AppError("INTERNAL_ERROR", "Não foi possível registrar a movimentação.");

    await tx
      .update(judicialProcesses)
      .set({ lastMovementAt: occurredAt, updatedAt: new Date() })
      .where(eq(judicialProcesses.id, processId));

    await appendProcessTimeline(tx, {
      organizationId,
      judicialProcessId: processId,
      legalMatterId: matterId,
      eventType: "judicial_process.movement_added",
      title: input.title,
      occurredAt,
      actorMembershipId: actor.membershipId,
      projectToMatter: false,
    });

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "judicial_process.movement_added",
      resourceType: "judicial_movement",
      resourceId: movement.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { title: movement.title, source: movement.source, judicialProcessId: processId },
    });

    return {
      ...movement,
      occurredAt: movement.occurredAt.toISOString(),
      capturedAt: movement.capturedAt?.toISOString() ?? null,
      createdAt: movement.createdAt.toISOString(),
    };
  });
}

export async function listJudicialMovements(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  processId: string,
) {
  requireMovementPermission(account, organizationId, "judicial_process.read");
  await requireProcessInMatter(db, organizationId, matterId, processId);
  const rows = await db.query.judicialMovements.findMany({
    where: and(
      eq(judicialMovements.judicialProcessId, processId),
      eq(judicialMovements.organizationId, organizationId),
    ),
    orderBy: [desc(judicialMovements.occurredAt)],
  });
  return rows.map((row) => ({
    ...row,
    occurredAt: row.occurredAt.toISOString(),
    capturedAt: row.capturedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function addJudicialHearing(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  processId: string,
  input: {
    type?: typeof judicialHearings.$inferInsert.type;
    scheduledAt: string;
    timezone?: string;
    locationType?: typeof judicialHearings.$inferInsert.locationType;
    locationText?: string;
    meetingUrl?: string;
    status?: JudicialHearingStatus;
    notes?: string;
    resultSummary?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireHearingPermission(
    account,
    organizationId,
    "judicial_process.manage_hearings",
  );
  await requireProcessInMatter(db, organizationId, matterId, processId);
  const scheduledAt = new Date(input.scheduledAt);

  return db.transaction(async (tx) => {
    const [hearing] = await tx
      .insert(judicialHearings)
      .values({
        organizationId,
        judicialProcessId: processId,
        type: input.type ?? "other",
        scheduledAt,
        timezone: input.timezone ?? "America/Sao_Paulo",
        locationType: input.locationType ?? "undetermined",
        locationText: input.locationText ?? null,
        meetingUrl: input.meetingUrl ?? null,
        status: input.status ?? "scheduled",
        notes: input.notes ?? null,
        resultSummary: input.resultSummary ?? null,
        source: "manual",
      })
      .returning();
    if (!hearing) throw new AppError("INTERNAL_ERROR", "Não foi possível agendar a audiência.");

    await appendProcessTimeline(tx, {
      organizationId,
      judicialProcessId: processId,
      legalMatterId: matterId,
      eventType: "judicial_process.hearing_scheduled",
      title: `Audiência agendada (${hearing.type})`,
      occurredAt: scheduledAt,
      actorMembershipId: actor.membershipId,
      projectToMatter: true,
    });

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "judicial_process.hearing_scheduled",
      resourceType: "judicial_hearing",
      resourceId: hearing.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { status: hearing.status, type: hearing.type, judicialProcessId: processId },
    });

    return {
      ...hearing,
      scheduledAt: hearing.scheduledAt.toISOString(),
      createdAt: hearing.createdAt.toISOString(),
      updatedAt: hearing.updatedAt.toISOString(),
    };
  });
}

export async function updateJudicialHearing(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  processId: string,
  hearingId: string,
  input: {
    type?: typeof judicialHearings.$inferInsert.type;
    scheduledAt?: string;
    timezone?: string;
    locationType?: typeof judicialHearings.$inferInsert.locationType;
    locationText?: string | null;
    meetingUrl?: string | null;
    status?: JudicialHearingStatus;
    notes?: string | null;
    resultSummary?: string | null;
  },
  meta: RequestMeta,
) {
  const actor = requireHearingPermission(
    account,
    organizationId,
    "judicial_process.manage_hearings",
  );
  await requireProcessInMatter(db, organizationId, matterId, processId);
  const hearing = await db.query.judicialHearings.findFirst({
    where: and(
      eq(judicialHearings.id, hearingId),
      eq(judicialHearings.judicialProcessId, processId),
      eq(judicialHearings.organizationId, organizationId),
    ),
  });
  if (!hearing) {
    throw new AppError("NOT_FOUND", "Não encontramos esta audiência no seu acesso.");
  }

  if (input.status) {
    assertHearingTransition(hearing.status as JudicialHearingStatus, input.status);
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(judicialHearings)
      .set({
        type: input.type ?? hearing.type,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : hearing.scheduledAt,
        timezone: input.timezone ?? hearing.timezone,
        locationType: input.locationType ?? hearing.locationType,
        locationText: input.locationText === undefined ? hearing.locationText : input.locationText,
        meetingUrl: input.meetingUrl === undefined ? hearing.meetingUrl : input.meetingUrl,
        status: input.status ?? hearing.status,
        notes: input.notes === undefined ? hearing.notes : input.notes,
        resultSummary:
          input.resultSummary === undefined ? hearing.resultSummary : input.resultSummary,
        updatedAt: new Date(),
      })
      .where(eq(judicialHearings.id, hearingId))
      .returning();
    if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível atualizar a audiência.");

    await appendProcessTimeline(tx, {
      organizationId,
      judicialProcessId: processId,
      legalMatterId: matterId,
      eventType: "judicial_process.hearing_updated",
      title: `Audiência atualizada (${updated.status})`,
      occurredAt: updated.scheduledAt,
      actorMembershipId: actor.membershipId,
      projectToMatter: input.status === "held" || input.status === "cancelled",
    });

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "judicial_process.hearing_updated",
      resourceType: "judicial_hearing",
      resourceId: hearingId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { status: hearing.status },
      after: { status: updated.status },
    });

    return {
      ...updated,
      scheduledAt: updated.scheduledAt.toISOString(),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  });
}

export async function listJudicialHearings(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  processId: string,
) {
  requireHearingPermission(account, organizationId, "judicial_process.read");
  await requireProcessInMatter(db, organizationId, matterId, processId);
  const rows = await db.query.judicialHearings.findMany({
    where: and(
      eq(judicialHearings.judicialProcessId, processId),
      eq(judicialHearings.organizationId, organizationId),
    ),
    orderBy: [desc(judicialHearings.scheduledAt)],
  });
  return rows.map((row) => ({
    ...row,
    scheduledAt: row.scheduledAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function addJudicialDecision(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  processId: string,
  input: {
    decisionType?: typeof judicialDecisions.$inferInsert.decisionType;
    decidedAt?: string;
    publishedAt?: string;
    title: string;
    summary?: string;
    outcome?: string;
    sourceReference?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireDecisionPermission(
    account,
    organizationId,
    "judicial_process.manage_decisions",
  );
  await requireProcessInMatter(db, organizationId, matterId, processId);

  return db.transaction(async (tx) => {
    const [decision] = await tx
      .insert(judicialDecisions)
      .values({
        organizationId,
        judicialProcessId: processId,
        decisionType: input.decisionType ?? "other",
        decidedAt: parseOptionalDate(input.decidedAt) ?? null,
        publishedAt: parseOptionalDate(input.publishedAt) ?? null,
        title: input.title,
        summary: input.summary ?? null,
        outcome: input.outcome ?? null,
        source: "manual",
        sourceReference: input.sourceReference ?? null,
        createdByMembershipId: actor.membershipId,
      })
      .returning();
    if (!decision) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar a decisão.");

    await appendProcessTimeline(tx, {
      organizationId,
      judicialProcessId: processId,
      legalMatterId: matterId,
      eventType: "judicial_process.decision_recorded",
      title: decision.title,
      occurredAt: decision.decidedAt ?? new Date(),
      actorMembershipId: actor.membershipId,
      projectToMatter: true,
    });

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "judicial_process.decision_recorded",
      resourceType: "judicial_decision",
      resourceId: decision.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        title: decision.title,
        decisionType: decision.decisionType,
        judicialProcessId: processId,
      },
      metadata: { legalMatterAutoClosed: false },
    });

    return {
      ...decision,
      decidedAt: decision.decidedAt?.toISOString() ?? null,
      publishedAt: decision.publishedAt?.toISOString() ?? null,
      createdAt: decision.createdAt.toISOString(),
      updatedAt: decision.updatedAt.toISOString(),
    };
  });
}

export async function listJudicialDecisions(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  processId: string,
) {
  requireDecisionPermission(account, organizationId, "judicial_process.read");
  await requireProcessInMatter(db, organizationId, matterId, processId);
  const rows = await db.query.judicialDecisions.findMany({
    where: and(
      eq(judicialDecisions.judicialProcessId, processId),
      eq(judicialDecisions.organizationId, organizationId),
    ),
    orderBy: [desc(judicialDecisions.createdAt)],
  });
  return rows.map((row) => ({
    ...row,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function addJudicialAppeal(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  processId: string,
  input: {
    appealType: string;
    parentDecisionId?: string;
    appellantPartyId?: string;
    appelleePartyId?: string;
    filedAt?: string;
    protocolReference?: string;
    status?: JudicialAppealStatus;
    resultDecisionId?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireAppealPermission(account, organizationId, "judicial_process.manage_appeals");
  await requireProcessInMatter(db, organizationId, matterId, processId);
  const status = input.status ?? "draft";
  if (status === "filed" && !input.protocolReference?.trim()) {
    throw new AppError("VALIDATION_ERROR", "Informe a referência de protocolo.", [
      { path: "protocolReference", message: "Obrigatória para recurso protocolado." },
    ]);
  }

  return db.transaction(async (tx) => {
    const [appeal] = await tx
      .insert(judicialAppeals)
      .values({
        organizationId,
        judicialProcessId: processId,
        appealType: input.appealType,
        parentDecisionId: input.parentDecisionId ?? null,
        appellantPartyId: input.appellantPartyId ?? null,
        appelleePartyId: input.appelleePartyId ?? null,
        filedAt: parseOptionalDate(input.filedAt) ?? null,
        protocolReference: input.protocolReference ?? null,
        status,
        resultDecisionId: input.resultDecisionId ?? null,
        source: "manual",
      })
      .returning();
    if (!appeal) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o recurso.");

    await appendProcessTimeline(tx, {
      organizationId,
      judicialProcessId: processId,
      legalMatterId: matterId,
      eventType: "judicial_process.appeal_created",
      title: `Recurso ${appeal.appealType} (${appeal.status})`,
      actorMembershipId: actor.membershipId,
      projectToMatter: status === "filed",
    });

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "judicial_process.appeal_created",
      resourceType: "judicial_appeal",
      resourceId: appeal.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        appealType: appeal.appealType,
        status: appeal.status,
        protocolReference: appeal.protocolReference,
      },
    });

    return {
      ...appeal,
      filedAt: appeal.filedAt?.toISOString() ?? null,
      createdAt: appeal.createdAt.toISOString(),
      updatedAt: appeal.updatedAt.toISOString(),
    };
  });
}

export async function updateJudicialAppeal(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  processId: string,
  appealId: string,
  input: {
    appealType?: string;
    parentDecisionId?: string | null;
    appellantPartyId?: string | null;
    appelleePartyId?: string | null;
    filedAt?: string | null;
    protocolReference?: string | null;
    status?: JudicialAppealStatus;
    resultDecisionId?: string | null;
  },
  meta: RequestMeta,
) {
  const actor = requireAppealPermission(account, organizationId, "judicial_process.manage_appeals");
  await requireProcessInMatter(db, organizationId, matterId, processId);
  const appeal = await db.query.judicialAppeals.findFirst({
    where: and(
      eq(judicialAppeals.id, appealId),
      eq(judicialAppeals.judicialProcessId, processId),
      eq(judicialAppeals.organizationId, organizationId),
    ),
  });
  if (!appeal) {
    throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");
  }

  const nextStatus = input.status ?? (appeal.status as JudicialAppealStatus);
  if (input.status) {
    assertAppealTransition(appeal.status as JudicialAppealStatus, input.status);
  }
  const nextProtocol =
    input.protocolReference === undefined ? appeal.protocolReference : input.protocolReference;
  if (nextStatus === "filed" && !nextProtocol?.trim()) {
    throw new AppError("VALIDATION_ERROR", "Informe a referência de protocolo.", [
      { path: "protocolReference", message: "Obrigatória para recurso protocolado." },
    ]);
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(judicialAppeals)
      .set({
        appealType: input.appealType ?? appeal.appealType,
        parentDecisionId:
          input.parentDecisionId === undefined ? appeal.parentDecisionId : input.parentDecisionId,
        appellantPartyId:
          input.appellantPartyId === undefined ? appeal.appellantPartyId : input.appellantPartyId,
        appelleePartyId:
          input.appelleePartyId === undefined ? appeal.appelleePartyId : input.appelleePartyId,
        filedAt:
          input.filedAt === undefined ? appeal.filedAt : (parseOptionalDate(input.filedAt) ?? null),
        protocolReference: nextProtocol,
        status: nextStatus,
        resultDecisionId:
          input.resultDecisionId === undefined ? appeal.resultDecisionId : input.resultDecisionId,
        updatedAt: new Date(),
      })
      .where(eq(judicialAppeals.id, appealId))
      .returning();
    if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível atualizar o recurso.");

    await appendProcessTimeline(tx, {
      organizationId,
      judicialProcessId: processId,
      legalMatterId: matterId,
      eventType: "judicial_process.appeal_updated",
      title: `Recurso ${updated.appealType} (${updated.status})`,
      actorMembershipId: actor.membershipId,
      projectToMatter: updated.status === "filed" && appeal.status !== "filed",
    });

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "judicial_process.appeal_updated",
      resourceType: "judicial_appeal",
      resourceId: appealId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { status: appeal.status },
      after: { status: updated.status, protocolReference: updated.protocolReference },
    });

    return {
      ...updated,
      filedAt: updated.filedAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  });
}

export async function listJudicialAppeals(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  processId: string,
) {
  requireAppealPermission(account, organizationId, "judicial_process.read");
  await requireProcessInMatter(db, organizationId, matterId, processId);
  const rows = await db.query.judicialAppeals.findMany({
    where: and(
      eq(judicialAppeals.judicialProcessId, processId),
      eq(judicialAppeals.organizationId, organizationId),
    ),
    orderBy: [desc(judicialAppeals.createdAt)],
  });
  return rows.map((row) => ({
    ...row,
    filedAt: row.filedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function addJudicialEnforcement(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  processId: string,
  input: {
    type?: typeof judicialEnforcements.$inferInsert.type;
    status?: typeof judicialEnforcements.$inferInsert.status;
    startedAt?: string;
    endedAt?: string;
    summary?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireEnforcementPermission(
    account,
    organizationId,
    "judicial_process.manage_enforcement",
  );
  await requireProcessInMatter(db, organizationId, matterId, processId);

  return db.transaction(async (tx) => {
    const [enforcement] = await tx
      .insert(judicialEnforcements)
      .values({
        organizationId,
        judicialProcessId: processId,
        type: input.type ?? "compliance",
        status: input.status ?? "planned",
        startedAt: parseOptionalDate(input.startedAt) ?? new Date(),
        endedAt: parseOptionalDate(input.endedAt) ?? null,
        summary: input.summary ?? null,
        source: "manual",
        createdByMembershipId: actor.membershipId,
      })
      .returning();
    if (!enforcement) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o cumprimento/execução.");
    }

    await appendProcessTimeline(tx, {
      organizationId,
      judicialProcessId: processId,
      legalMatterId: matterId,
      eventType: "judicial_process.enforcement_recorded",
      title: `Cumprimento/execução (${enforcement.type})`,
      actorMembershipId: actor.membershipId,
      projectToMatter: true,
    });

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "judicial_process.enforcement_recorded",
      resourceType: "judicial_enforcement",
      resourceId: enforcement.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { type: enforcement.type, status: enforcement.status, judicialProcessId: processId },
    });

    return {
      ...enforcement,
      startedAt: enforcement.startedAt.toISOString(),
      endedAt: enforcement.endedAt?.toISOString() ?? null,
      createdAt: enforcement.createdAt.toISOString(),
      updatedAt: enforcement.updatedAt.toISOString(),
    };
  });
}

export async function listJudicialEnforcements(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  processId: string,
) {
  requireEnforcementPermission(account, organizationId, "judicial_process.read");
  await requireProcessInMatter(db, organizationId, matterId, processId);
  const rows = await db.query.judicialEnforcements.findMany({
    where: and(
      eq(judicialEnforcements.judicialProcessId, processId),
      eq(judicialEnforcements.organizationId, organizationId),
    ),
    orderBy: [desc(judicialEnforcements.startedAt)],
  });
  return rows.map((row) => ({
    ...row,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function listJudicialProcessTimeline(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  processId: string,
) {
  requireProcessPermission(account, organizationId, "judicial_process.read");
  await requireProcessInMatter(db, organizationId, matterId, processId);
  const rows = await db.query.judicialProcessTimelineEvents.findMany({
    where: and(
      eq(judicialProcessTimelineEvents.judicialProcessId, processId),
      eq(judicialProcessTimelineEvents.organizationId, organizationId),
    ),
    orderBy: [desc(judicialProcessTimelineEvents.occurredAt)],
  });
  return rows.map((row) => ({
    id: row.id,
    eventType: row.eventType,
    title: row.title,
    body: row.body,
    occurredAt: row.occurredAt.toISOString(),
    recordedAt: row.recordedAt.toISOString(),
    source: row.source,
    actorMembershipId: row.actorMembershipId,
  }));
}
