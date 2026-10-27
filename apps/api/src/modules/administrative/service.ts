import { recordAudit } from "@verasjuris/audit";
import {
  assertAdministrativeAppealTransition,
  assertAdministrativeDeadlineTransition,
  assertAdministrativeProcessTransition,
  assertAdministrativeRequestTransition,
  assertAdministrativeRequirementTransition,
  policyAdministrativeAppeal,
  policyAdministrativeDecision,
  policyAdministrativeDeadline,
  policyAdministrativeProcess,
  policyAdministrativeRequest,
  policyAdministrativeRequirement,
  type AdministrativeAppealStatus,
  type AdministrativeDeadlineStatus,
  type AdministrativeProcessStatus,
  type AdministrativeRequestStatus,
  type AdministrativeRequirementStatus,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  administrativeAppeals,
  administrativeBodies,
  administrativeDeadlines,
  administrativeDecisions,
  administrativeProcesses,
  administrativeProcessStatusHistory,
  administrativeProcessTimelineEvents,
  administrativeRequests,
  administrativeRequirements,
  isUniqueViolation,
  legalMatters,
  legalMatterTimelineEvents,
  normalizeAdministrativeNumber,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";
import type { RequestMeta } from "../auth/service.js";
import { syncCentralFromAdministrative } from "../deadlines/service.js";
import { ensureAdministrativeReferenceCatalog } from "./catalog.js";

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
  permission: Parameters<typeof policyAdministrativeProcess>[1],
) {
  const decision = policyAdministrativeProcess(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function requireRequestPermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyAdministrativeRequest>[1],
) {
  const decision = policyAdministrativeRequest(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function requireRequirementPermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyAdministrativeRequirement>[1],
) {
  const decision = policyAdministrativeRequirement(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function requireDeadlinePermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyAdministrativeDeadline>[1],
) {
  const decision = policyAdministrativeDeadline(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function requireDecisionPermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyAdministrativeDecision>[1],
) {
  const decision = policyAdministrativeDecision(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function requireAppealPermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyAdministrativeAppeal>[1],
) {
  const decision = policyAdministrativeAppeal(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function parseOptionalDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}

function serializeProcess(
  row: typeof administrativeProcesses.$inferSelect,
  body?: typeof administrativeBodies.$inferSelect | null,
) {
  const catalogRef = body
    ? { id: body.id, name: body.name, acronym: body.acronym, code: body.code }
    : null;
  return {
    id: row.id,
    organizationId: row.organizationId,
    legalMatterId: row.legalMatterId,
    administrativeBodyId: row.administrativeBodyId,
    administrativeBody: catalogRef,
    body: catalogRef,
    number: row.number ?? "",
    normalizedNumber: row.normalizedNumber,
    protocolNumber: row.protocolNumber,
    protocolDate: row.protocolDate?.toISOString() ?? null,
    protocolSource: row.protocolSource,
    protocolReference: row.protocolReference,
    externalReference: row.externalReference,
    subject: row.subject,
    description: row.description,
    status: row.status,
    currentPhase: row.currentPhase,
    priority: row.priority,
    filedAt: row.filedAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    lastActivityAt: row.lastActivityAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    closureReason: row.closureReason,
    closureNotes: row.closureNotes,
    source: row.source,
    sourceReference: row.sourceReference,
    sourceUpdatedAt: row.sourceUpdatedAt?.toISOString() ?? null,
    responsibleMembershipId: row.responsibleMembershipId,
    createdByMembershipId: row.createdByMembershipId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeRequest(row: typeof administrativeRequests.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    administrativeProcessId: row.administrativeProcessId,
    requestType: row.requestType,
    title: row.title,
    description: row.description ?? "",
    status: row.status,
    requestedAt: row.requestedAt?.toISOString() ?? null,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    protocolNumber: row.protocolNumber,
    protocolReference: row.protocolReference,
    justification: row.justification,
    submitJustification: row.justification,
    source: row.source,
    createdByMembershipId: row.createdByMembershipId,
    reviewedByMembershipId: row.reviewedByMembershipId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeRequirement(row: typeof administrativeRequirements.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    administrativeProcessId: row.administrativeProcessId,
    relatedRequestId: row.relatedRequestId,
    title: row.title,
    description: row.description,
    issuedAt: row.issuedAt?.toISOString() ?? null,
    dueAt: row.dueAt?.toISOString() ?? null,
    status: row.status,
    source: row.source,
    sourceReference: row.sourceReference,
    respondedAt: row.respondedAt?.toISOString() ?? null,
    responseSummary: row.responseSummary,
    responsibleMembershipId: row.responsibleMembershipId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeDeadline(row: typeof administrativeDeadlines.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    administrativeProcessId: row.administrativeProcessId,
    requirementId: row.requirementId,
    title: row.title,
    dueAt: row.dueAt.toISOString(),
    timezone: row.timezone,
    status: row.status,
    calculationSource: row.calculationSource,
    calculationNotes: row.calculationNotes,
    confirmedByMembershipId: row.confirmedByMembershipId,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    centralDeadlineId: row.centralDeadlineId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeDecision(row: typeof administrativeDecisions.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    administrativeProcessId: row.administrativeProcessId,
    relatedRequestId: row.relatedRequestId,
    decisionType: row.decisionType,
    title: row.title,
    summary: row.summary,
    outcome: row.outcome,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    notifiedAt: row.notifiedAt?.toISOString() ?? null,
    source: row.source,
    sourceReference: row.sourceReference,
    documentId: row.documentId,
    createdByMembershipId: row.createdByMembershipId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeAppeal(row: typeof administrativeAppeals.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    administrativeProcessId: row.administrativeProcessId,
    parentDecisionId: row.parentDecisionId,
    appealType: row.appealType,
    title: row.title,
    summary: row.summary,
    status: row.status,
    deadlineId: row.deadlineId,
    filedAt: row.filedAt?.toISOString() ?? null,
    protocolNumber: row.protocolNumber,
    source: row.source,
    documentId: row.documentId,
    createdByMembershipId: row.createdByMembershipId,
    approvedByMembershipId: row.approvedByMembershipId,
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

async function requireProcessInOrg(
  db: AppDatabase | DbTx,
  organizationId: string,
  processId: string,
) {
  const process = await db.query.administrativeProcesses.findFirst({
    where: and(
      eq(administrativeProcesses.id, processId),
      eq(administrativeProcesses.organizationId, organizationId),
    ),
  });
  if (!process) {
    throw new AppError("NOT_FOUND", "Não encontramos este processo administrativo no seu acesso.");
  }
  return process;
}

async function requireProcessInMatter(
  db: AppDatabase | DbTx,
  organizationId: string,
  matterId: string,
  processId: string,
) {
  const process = await db.query.administrativeProcesses.findFirst({
    where: and(
      eq(administrativeProcesses.id, processId),
      eq(administrativeProcesses.organizationId, organizationId),
      eq(administrativeProcesses.legalMatterId, matterId),
    ),
  });
  if (!process) {
    throw new AppError("NOT_FOUND", "Não encontramos este processo administrativo no seu acesso.");
  }
  return process;
}

async function assertBody(db: AppDatabase | DbTx, bodyId: string) {
  const body = await db.query.administrativeBodies.findFirst({
    where: eq(administrativeBodies.id, bodyId),
  });
  if (!body || !body.active) {
    throw new AppError("VALIDATION_ERROR", "Órgão administrativo inválido ou inativo.", [
      { path: "administrativeBodyId", message: "Selecione um órgão válido." },
    ]);
  }
  return body;
}

async function appendProcessTimeline(
  tx: DbTx,
  input: {
    organizationId: string;
    administrativeProcessId: string;
    legalMatterId: string;
    eventType: string;
    title: string;
    body?: string | null;
    occurredAt?: Date;
    source?: "manual" | "document" | "import";
    actorMembershipId?: string | null;
    projectToMatter?: boolean;
  },
) {
  const occurredAt = input.occurredAt ?? new Date();
  await tx.insert(administrativeProcessTimelineEvents).values({
    organizationId: input.organizationId,
    administrativeProcessId: input.administrativeProcessId,
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

async function recordStatusChange(
  tx: DbTx,
  input: {
    organizationId: string;
    processId: string;
    fromStatus: AdministrativeProcessStatus | null;
    toStatus: AdministrativeProcessStatus;
    notes?: string | null;
    actorMembershipId?: string | null;
  },
) {
  await tx.insert(administrativeProcessStatusHistory).values({
    organizationId: input.organizationId,
    administrativeProcessId: input.processId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    notes: input.notes ?? null,
    actorMembershipId: input.actorMembershipId ?? null,
  });
}

function assertEditable(process: typeof administrativeProcesses.$inferSelect) {
  if (process.status === "closed" || process.status === "archived") {
    throw new AppError(
      "CONFLICT",
      "Processo encerrado ou arquivado não pode ser editado desta forma. Reabra-o primeiro.",
    );
  }
}

function assertSubmittedFields(input: {
  status?: string;
  submittedAt?: string | null;
  protocolNumber?: string | null;
  justification?: string | null;
  source?: string;
}) {
  if (input.status !== "submitted") return;
  if (!input.submittedAt) {
    throw new AppError("VALIDATION_ERROR", "Informe a data de envio ao registrar como submetido.", [
      { path: "submittedAt", message: "Informe submittedAt." },
    ]);
  }
  if (!input.protocolNumber?.trim() && !input.justification?.trim()) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Informe o número de protocolo ou uma justificativa ao registrar o envio.",
      [{ path: "protocolNumber", message: "Protocolo ou justificativa é obrigatório." }],
    );
  }
  if (input.source !== undefined && input.source !== "manual") {
    throw new AppError(
      "VALIDATION_ERROR",
      "Sem integração com o órgão, o envio só pode ser registrado como manual.",
      [{ path: "source", message: "Use source=manual." }],
    );
  }
}

export async function listAdministrativeBodiesCatalog(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  requireProcessPermission(account, organizationId, "administrative_process.read");
  await ensureAdministrativeReferenceCatalog(db);
  const rows = await db.query.administrativeBodies.findMany({
    where: eq(administrativeBodies.active, true),
    orderBy: [asc(administrativeBodies.name)],
  });
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    acronym: row.acronym,
    bodyType: row.bodyType,
    jurisdiction: row.jurisdiction,
    stateCode: row.stateCode,
    municipalityCode: row.municipalityCode,
    parentBodyId: row.parentBodyId,
    source: row.source,
  }));
}

export async function listAdministrativeProcesses(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  query: {
    q?: string;
    status?: string;
    administrativeBodyId?: string;
    limit: number;
    offset: number;
  },
) {
  requireProcessPermission(account, organizationId, "administrative_process.read");
  await requireMatterInOrg(db, organizationId, matterId);
  await ensureAdministrativeReferenceCatalog(db);

  const filters = [
    eq(administrativeProcesses.organizationId, organizationId),
    eq(administrativeProcesses.legalMatterId, matterId),
  ];
  if (query.status) {
    filters.push(eq(administrativeProcesses.status, query.status as AdministrativeProcessStatus));
  }
  if (query.administrativeBodyId) {
    filters.push(eq(administrativeProcesses.administrativeBodyId, query.administrativeBodyId));
  }
  if (query.q) {
    const normalized = normalizeAdministrativeNumber(query.q);
    filters.push(
      or(
        ilike(administrativeProcesses.subject, `%${query.q}%`),
        ilike(administrativeProcesses.number, `%${query.q}%`),
        ilike(administrativeProcesses.protocolNumber, `%${query.q}%`),
        normalized ? ilike(administrativeProcesses.normalizedNumber, `%${normalized}%`) : undefined,
      )!,
    );
  }

  const where = and(...filters);
  const [totalRow] = await db.select({ value: count() }).from(administrativeProcesses).where(where);
  const items = await db.query.administrativeProcesses.findMany({
    where,
    orderBy: [desc(administrativeProcesses.updatedAt)],
    limit: query.limit,
    offset: query.offset,
    with: { body: true },
  });
  return {
    items: items.map((row) => serializeProcess(row, row.body)),
    total: totalRow?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getAdministrativeProcess(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  processId: string,
) {
  requireProcessPermission(account, organizationId, "administrative_process.read");
  const process = await requireProcessInOrg(db, organizationId, processId);
  const [body, requests, requirements, deadlines, decisions, appeals, timeline] = await Promise.all(
    [
      db.query.administrativeBodies.findFirst({
        where: eq(administrativeBodies.id, process.administrativeBodyId),
      }),
      db.query.administrativeRequests.findMany({
        where: eq(administrativeRequests.administrativeProcessId, processId),
        orderBy: [desc(administrativeRequests.createdAt)],
      }),
      db.query.administrativeRequirements.findMany({
        where: eq(administrativeRequirements.administrativeProcessId, processId),
        orderBy: [desc(administrativeRequirements.createdAt)],
      }),
      db.query.administrativeDeadlines.findMany({
        where: eq(administrativeDeadlines.administrativeProcessId, processId),
        orderBy: [desc(administrativeDeadlines.dueAt)],
      }),
      db.query.administrativeDecisions.findMany({
        where: eq(administrativeDecisions.administrativeProcessId, processId),
        orderBy: [desc(administrativeDecisions.createdAt)],
      }),
      db.query.administrativeAppeals.findMany({
        where: eq(administrativeAppeals.administrativeProcessId, processId),
        orderBy: [desc(administrativeAppeals.createdAt)],
      }),
      db.query.administrativeProcessTimelineEvents.findMany({
        where: eq(administrativeProcessTimelineEvents.administrativeProcessId, processId),
        orderBy: [desc(administrativeProcessTimelineEvents.occurredAt)],
      }),
    ],
  );

  return {
    ...serializeProcess(process, body),
    requests: requests.map(serializeRequest),
    requirements: requirements.map(serializeRequirement),
    deadlines: deadlines.map(serializeDeadline),
    decisions: decisions.map(serializeDecision),
    appeals: appeals.map(serializeAppeal),
    timeline: timeline.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      title: row.title,
      summary: row.body,
      body: row.body,
      source: row.source,
      eventAt: row.occurredAt.toISOString(),
      occurredAt: row.occurredAt.toISOString(),
      recordedAt: row.recordedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      relatedEntityType: null as string | null,
      relatedEntityId: null as string | null,
      actorMembershipId: row.actorMembershipId,
    })),
  };
}

export async function createAdministrativeProcess(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  input: {
    administrativeBodyId: string;
    subject: string;
    description?: string;
    number?: string;
    protocolNumber?: string;
    protocolDate?: string;
    protocolSource?: "manual" | "document" | "import";
    protocolReference?: string;
    externalReference?: string;
    status?: AdministrativeProcessStatus;
    currentPhase?: string;
    priority?: "low" | "normal" | "high" | "urgent";
    filedAt?: string;
    startedAt?: string;
    responsibleMembershipId?: string;
    source?: "manual";
    sourceReference?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireProcessPermission(account, organizationId, "administrative_process.create");
  if (input.responsibleMembershipId) {
    requireProcessPermission(account, organizationId, "administrative_process.assign");
  }
  await ensureAdministrativeReferenceCatalog(db);
  await requireMatterInOrg(db, organizationId, matterId);
  await assertBody(db, input.administrativeBodyId);

  const number = input.number?.trim() || null;
  const normalizedNumber = number ? normalizeAdministrativeNumber(number) : null;
  const initialStatus = (input.status ?? "draft") as AdministrativeProcessStatus;

  try {
    return await db.transaction(async (tx) => {
      const now = new Date();
      const [created] = await tx
        .insert(administrativeProcesses)
        .values({
          organizationId,
          legalMatterId: matterId,
          administrativeBodyId: input.administrativeBodyId,
          number,
          normalizedNumber,
          protocolNumber: input.protocolNumber ?? null,
          protocolDate: parseOptionalDate(input.protocolDate) ?? null,
          protocolSource: input.protocolSource ?? (input.protocolNumber ? "manual" : null),
          protocolReference: input.protocolReference ?? null,
          externalReference: input.externalReference ?? null,
          subject: input.subject,
          description: input.description ?? null,
          status: initialStatus,
          currentPhase: input.currentPhase ?? null,
          priority: input.priority ?? "normal",
          filedAt: parseOptionalDate(input.filedAt) ?? null,
          startedAt: parseOptionalDate(input.startedAt) ?? null,
          lastActivityAt: now,
          source: "manual",
          sourceReference: input.sourceReference ?? null,
          responsibleMembershipId: input.responsibleMembershipId ?? null,
          createdByMembershipId: actor.membershipId,
        })
        .returning();
      if (!created) {
        throw new AppError(
          "INTERNAL_ERROR",
          "Não foi possível cadastrar o processo administrativo.",
        );
      }

      await recordStatusChange(tx, {
        organizationId,
        processId: created.id,
        fromStatus: null,
        toStatus: initialStatus,
        notes: "Status inicial",
        actorMembershipId: actor.membershipId,
      });

      await appendProcessTimeline(tx, {
        organizationId,
        administrativeProcessId: created.id,
        legalMatterId: matterId,
        eventType: "administrative_process.created",
        title: `Processo administrativo “${created.subject}” cadastrado`,
        actorMembershipId: actor.membershipId,
        projectToMatter: true,
      });

      if (created.protocolNumber) {
        await appendProcessTimeline(tx, {
          organizationId,
          administrativeProcessId: created.id,
          legalMatterId: matterId,
          eventType: "administrative_process.protocol",
          title: `Protocolo ${created.protocolNumber} registrado`,
          body: "Registro manual — não confirma integração com o órgão.",
          actorMembershipId: actor.membershipId,
        });
      }

      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "administrative_process.created",
        resourceType: "administrative_process",
        resourceId: created.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: {
          subject: created.subject,
          legalMatterId: matterId,
          status: created.status,
          source: created.source,
          protocolNumber: created.protocolNumber,
        },
      });

      return serializeProcess(created);
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(
        "CONFLICT",
        "Já existe um processo administrativo com este número nesta organização.",
      );
    }
    throw error;
  }
}

export async function updateAdministrativeProcess(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  processId: string,
  input: {
    administrativeBodyId?: string;
    subject?: string;
    description?: string | null;
    number?: string | null;
    protocolNumber?: string | null;
    protocolDate?: string | null;
    protocolSource?: "manual" | "document" | "import" | null;
    protocolReference?: string | null;
    externalReference?: string | null;
    status?: AdministrativeProcessStatus;
    currentPhase?: string | null;
    priority?: "low" | "normal" | "high" | "urgent";
    filedAt?: string | null;
    startedAt?: string | null;
    responsibleMembershipId?: string | null;
    sourceReference?: string | null;
  },
  meta: RequestMeta,
) {
  const actor = requireProcessPermission(account, organizationId, "administrative_process.update");
  if (input.responsibleMembershipId !== undefined) {
    requireProcessPermission(account, organizationId, "administrative_process.assign");
  }
  const process = await requireProcessInOrg(db, organizationId, processId);
  assertEditable(process);

  if (input.administrativeBodyId) await assertBody(db, input.administrativeBodyId);
  if (input.status) {
    assertAdministrativeProcessTransition(
      process.status as AdministrativeProcessStatus,
      input.status,
    );
  }

  let nextNumber = process.number;
  let nextNormalized = process.normalizedNumber;
  if (input.number !== undefined) {
    nextNumber = input.number?.trim() || null;
    nextNormalized = nextNumber ? normalizeAdministrativeNumber(nextNumber) : null;
  }

  try {
    return await db.transaction(async (tx) => {
      const now = new Date();
      const [updated] = await tx
        .update(administrativeProcesses)
        .set({
          administrativeBodyId: input.administrativeBodyId ?? process.administrativeBodyId,
          subject: input.subject ?? process.subject,
          description: input.description === undefined ? process.description : input.description,
          number: nextNumber,
          normalizedNumber: nextNormalized,
          protocolNumber:
            input.protocolNumber === undefined ? process.protocolNumber : input.protocolNumber,
          protocolDate:
            input.protocolDate === undefined
              ? process.protocolDate
              : (parseOptionalDate(input.protocolDate) ?? null),
          protocolSource:
            input.protocolSource === undefined ? process.protocolSource : input.protocolSource,
          protocolReference:
            input.protocolReference === undefined
              ? process.protocolReference
              : input.protocolReference,
          externalReference:
            input.externalReference === undefined
              ? process.externalReference
              : input.externalReference,
          status: input.status ?? process.status,
          currentPhase:
            input.currentPhase === undefined ? process.currentPhase : input.currentPhase,
          priority: input.priority ?? process.priority,
          filedAt:
            input.filedAt === undefined
              ? process.filedAt
              : (parseOptionalDate(input.filedAt) ?? null),
          startedAt:
            input.startedAt === undefined
              ? process.startedAt
              : (parseOptionalDate(input.startedAt) ?? null),
          responsibleMembershipId:
            input.responsibleMembershipId === undefined
              ? process.responsibleMembershipId
              : input.responsibleMembershipId,
          sourceReference:
            input.sourceReference === undefined ? process.sourceReference : input.sourceReference,
          lastActivityAt: now,
          updatedAt: now,
        })
        .where(eq(administrativeProcesses.id, processId))
        .returning();
      if (!updated) {
        throw new AppError("INTERNAL_ERROR", "Não foi possível atualizar o processo.");
      }

      if (input.status && input.status !== process.status) {
        await recordStatusChange(tx, {
          organizationId,
          processId,
          fromStatus: process.status as AdministrativeProcessStatus,
          toStatus: input.status,
          actorMembershipId: actor.membershipId,
        });
        await appendProcessTimeline(tx, {
          organizationId,
          administrativeProcessId: processId,
          legalMatterId: process.legalMatterId,
          eventType: "administrative_process.status_changed",
          title: `Status alterado para ${input.status}`,
          actorMembershipId: actor.membershipId,
        });
      }

      if (
        input.protocolNumber !== undefined &&
        input.protocolNumber &&
        input.protocolNumber !== process.protocolNumber
      ) {
        await appendProcessTimeline(tx, {
          organizationId,
          administrativeProcessId: processId,
          legalMatterId: process.legalMatterId,
          eventType: "administrative_process.protocol",
          title: `Protocolo ${input.protocolNumber} registrado`,
          body: "Registro manual — não confirma integração com o órgão.",
          actorMembershipId: actor.membershipId,
        });
      }

      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "administrative_process.updated",
        resourceType: "administrative_process",
        resourceId: processId,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        before: { status: process.status, number: process.number },
        after: { status: updated.status, number: updated.number },
      });

      return serializeProcess(updated);
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(
        "CONFLICT",
        "Já existe um processo administrativo com este número nesta organização.",
      );
    }
    throw error;
  }
}

export async function closeAdministrativeProcess(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  processId: string,
  input: { closureReason?: string; closureNotes?: string },
  meta: RequestMeta,
) {
  const actor = requireProcessPermission(account, organizationId, "administrative_process.close");
  const process = await requireProcessInOrg(db, organizationId, processId);
  assertAdministrativeProcessTransition(process.status as AdministrativeProcessStatus, "closed");

  return db.transaction(async (tx) => {
    const now = new Date();
    const [updated] = await tx
      .update(administrativeProcesses)
      .set({
        status: "closed",
        closedAt: now,
        closureReason: input.closureReason ?? null,
        closureNotes: input.closureNotes ?? null,
        lastActivityAt: now,
        updatedAt: now,
      })
      .where(eq(administrativeProcesses.id, processId))
      .returning();
    if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível encerrar o processo.");

    await recordStatusChange(tx, {
      organizationId,
      processId,
      fromStatus: process.status as AdministrativeProcessStatus,
      toStatus: "closed",
      notes: input.closureReason ?? null,
      actorMembershipId: actor.membershipId,
    });

    await appendProcessTimeline(tx, {
      organizationId,
      administrativeProcessId: processId,
      legalMatterId: process.legalMatterId,
      eventType: "administrative_process.closed",
      title: `Processo administrativo “${updated.subject}” encerrado`,
      actorMembershipId: actor.membershipId,
      projectToMatter: true,
    });

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "administrative_process.closed",
      resourceType: "administrative_process",
      resourceId: processId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { status: process.status },
      after: { status: updated.status, closureReason: updated.closureReason },
    });

    return serializeProcess(updated);
  });
}

export async function reopenAdministrativeProcess(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  processId: string,
  input: { notes?: string },
  meta: RequestMeta,
) {
  const actor = requireProcessPermission(account, organizationId, "administrative_process.reopen");
  const process = await requireProcessInOrg(db, organizationId, processId);
  assertAdministrativeProcessTransition(process.status as AdministrativeProcessStatus, "active");

  return db.transaction(async (tx) => {
    const now = new Date();
    const [updated] = await tx
      .update(administrativeProcesses)
      .set({
        status: "active",
        closedAt: null,
        archivedAt: null,
        closureReason: null,
        closureNotes: input.notes ?? null,
        lastActivityAt: now,
        updatedAt: now,
      })
      .where(eq(administrativeProcesses.id, processId))
      .returning();
    if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível reabrir o processo.");

    await recordStatusChange(tx, {
      organizationId,
      processId,
      fromStatus: process.status as AdministrativeProcessStatus,
      toStatus: "active",
      notes: input.notes ?? null,
      actorMembershipId: actor.membershipId,
    });

    await appendProcessTimeline(tx, {
      organizationId,
      administrativeProcessId: processId,
      legalMatterId: process.legalMatterId,
      eventType: "administrative_process.reopened",
      title: `Processo administrativo “${updated.subject}” reaberto`,
      actorMembershipId: actor.membershipId,
      projectToMatter: true,
    });

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "administrative_process.reopened",
      resourceType: "administrative_process",
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

export async function listAdministrativeProcessTimeline(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  processId: string,
) {
  requireProcessPermission(account, organizationId, "administrative_process.read");
  await requireProcessInOrg(db, organizationId, processId);
  const rows = await db.query.administrativeProcessTimelineEvents.findMany({
    where: and(
      eq(administrativeProcessTimelineEvents.organizationId, organizationId),
      eq(administrativeProcessTimelineEvents.administrativeProcessId, processId),
    ),
    orderBy: [desc(administrativeProcessTimelineEvents.occurredAt)],
  });
  return rows.map((row) => ({
    id: row.id,
    eventType: row.eventType,
    title: row.title,
    summary: row.body,
    body: row.body,
    occurredAt: row.occurredAt.toISOString(),
    eventAt: row.occurredAt.toISOString(),
    recordedAt: row.recordedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    source: row.source,
    actorMembershipId: row.actorMembershipId,
    relatedEntityType: null as string | null,
    relatedEntityId: null as string | null,
  }));
}

async function touchProcessActivity(tx: DbTx, processId: string) {
  await tx
    .update(administrativeProcesses)
    .set({ lastActivityAt: new Date(), updatedAt: new Date() })
    .where(eq(administrativeProcesses.id, processId));
}

export async function listAdministrativeRequests(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  processId: string,
) {
  requireRequestPermission(account, organizationId, "administrative_process.read");
  await requireProcessInOrg(db, organizationId, processId);
  const rows = await db.query.administrativeRequests.findMany({
    where: and(
      eq(administrativeRequests.organizationId, organizationId),
      eq(administrativeRequests.administrativeProcessId, processId),
    ),
    orderBy: [desc(administrativeRequests.updatedAt)],
  });
  return rows.map(serializeRequest);
}

export async function addAdministrativeRequest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  processId: string,
  input: {
    requestType: string;
    title: string;
    description?: string;
    status?: AdministrativeRequestStatus;
    requestedAt?: string;
    submittedAt?: string;
    protocolNumber?: string;
    protocolReference?: string;
    justification?: string;
    source?: "manual";
  },
  meta: RequestMeta,
) {
  const actor = requireRequestPermission(
    account,
    organizationId,
    "administrative_process.manage_requests",
  );
  const process = await requireProcessInOrg(db, organizationId, processId);
  assertEditable(process);
  const status = (input.status ?? "draft") as AdministrativeRequestStatus;
  assertSubmittedFields({ ...input, status, source: input.source ?? "manual" });

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(administrativeRequests)
      .values({
        organizationId,
        administrativeProcessId: processId,
        requestType: input.requestType,
        title: input.title,
        description: input.description ?? null,
        status,
        requestedAt: parseOptionalDate(input.requestedAt) ?? null,
        submittedAt: parseOptionalDate(input.submittedAt) ?? null,
        protocolNumber: input.protocolNumber ?? null,
        protocolReference: input.protocolReference ?? null,
        justification: input.justification ?? null,
        source: "manual",
        createdByMembershipId: actor.membershipId,
      })
      .returning();
    if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o requerimento.");

    await touchProcessActivity(tx, processId);
    await appendProcessTimeline(tx, {
      organizationId,
      administrativeProcessId: processId,
      legalMatterId: process.legalMatterId,
      eventType: "administrative_process.request",
      title: `Requerimento “${created.title}” registrado`,
      actorMembershipId: actor.membershipId,
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "administrative_request.created",
      resourceType: "administrative_request",
      resourceId: created.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { status: created.status, title: created.title },
    });
    return serializeRequest(created);
  });
}

export async function updateAdministrativeRequest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  processId: string,
  requestId: string,
  input: {
    requestType?: string;
    title?: string;
    description?: string | null;
    status?: AdministrativeRequestStatus;
    requestedAt?: string | null;
    submittedAt?: string | null;
    protocolNumber?: string | null;
    protocolReference?: string | null;
    justification?: string | null;
    source?: "manual";
  },
  meta: RequestMeta,
) {
  const actor = requireRequestPermission(
    account,
    organizationId,
    "administrative_process.manage_requests",
  );
  const process = await requireProcessInOrg(db, organizationId, processId);
  assertEditable(process);
  const existing = await db.query.administrativeRequests.findFirst({
    where: and(
      eq(administrativeRequests.id, requestId),
      eq(administrativeRequests.organizationId, organizationId),
      eq(administrativeRequests.administrativeProcessId, processId),
    ),
  });
  if (!existing) {
    throw new AppError("NOT_FOUND", "Não encontramos este requerimento no seu acesso.");
  }

  const nextStatus = (input.status ?? existing.status) as AdministrativeRequestStatus;
  if (input.status) {
    assertAdministrativeRequestTransition(
      existing.status as AdministrativeRequestStatus,
      input.status,
    );
  }
  assertSubmittedFields({
    status: nextStatus,
    submittedAt:
      input.submittedAt === undefined
        ? (existing.submittedAt?.toISOString() ?? null)
        : input.submittedAt,
    protocolNumber:
      input.protocolNumber === undefined ? existing.protocolNumber : input.protocolNumber,
    justification: input.justification === undefined ? existing.justification : input.justification,
    source: "manual",
  });

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(administrativeRequests)
      .set({
        requestType: input.requestType ?? existing.requestType,
        title: input.title ?? existing.title,
        description: input.description === undefined ? existing.description : input.description,
        status: nextStatus,
        requestedAt:
          input.requestedAt === undefined
            ? existing.requestedAt
            : (parseOptionalDate(input.requestedAt) ?? null),
        submittedAt:
          input.submittedAt === undefined
            ? existing.submittedAt
            : (parseOptionalDate(input.submittedAt) ?? null),
        protocolNumber:
          input.protocolNumber === undefined ? existing.protocolNumber : input.protocolNumber,
        protocolReference:
          input.protocolReference === undefined
            ? existing.protocolReference
            : input.protocolReference,
        justification:
          input.justification === undefined ? existing.justification : input.justification,
        reviewedByMembershipId:
          nextStatus === "confirmed" || nextStatus === "approved"
            ? actor.membershipId
            : existing.reviewedByMembershipId,
        updatedAt: new Date(),
      })
      .where(eq(administrativeRequests.id, requestId))
      .returning();
    if (!updated)
      throw new AppError("INTERNAL_ERROR", "Não foi possível atualizar o requerimento.");

    await touchProcessActivity(tx, processId);
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "administrative_request.updated",
      resourceType: "administrative_request",
      resourceId: requestId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { status: existing.status },
      after: { status: updated.status },
    });
    return serializeRequest(updated);
  });
}

export async function listAdministrativeRequirements(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  processId: string,
) {
  requireRequirementPermission(account, organizationId, "administrative_process.read");
  await requireProcessInOrg(db, organizationId, processId);
  const rows = await db.query.administrativeRequirements.findMany({
    where: and(
      eq(administrativeRequirements.organizationId, organizationId),
      eq(administrativeRequirements.administrativeProcessId, processId),
    ),
    orderBy: [desc(administrativeRequirements.updatedAt)],
  });
  return rows.map(serializeRequirement);
}

export async function addAdministrativeRequirement(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  processId: string,
  input: {
    title: string;
    description?: string;
    relatedRequestId?: string;
    issuedAt?: string;
    dueAt?: string;
    status?: AdministrativeRequirementStatus;
    source?: "manual";
    sourceReference?: string;
    respondedAt?: string;
    responseSummary?: string;
    responsibleMembershipId?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireRequirementPermission(
    account,
    organizationId,
    "administrative_process.manage_requirements",
  );
  const process = await requireProcessInOrg(db, organizationId, processId);
  assertEditable(process);

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(administrativeRequirements)
      .values({
        organizationId,
        administrativeProcessId: processId,
        relatedRequestId: input.relatedRequestId ?? null,
        title: input.title,
        description: input.description ?? null,
        issuedAt: parseOptionalDate(input.issuedAt) ?? null,
        dueAt: parseOptionalDate(input.dueAt) ?? null,
        status: input.status ?? "open",
        source: "manual",
        sourceReference: input.sourceReference ?? null,
        respondedAt: parseOptionalDate(input.respondedAt) ?? null,
        responseSummary: input.responseSummary ?? null,
        responsibleMembershipId: input.responsibleMembershipId ?? null,
      })
      .returning();
    if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a exigência.");

    await touchProcessActivity(tx, processId);
    await appendProcessTimeline(tx, {
      organizationId,
      administrativeProcessId: processId,
      legalMatterId: process.legalMatterId,
      eventType: "administrative_process.requirement",
      title: `Exigência “${created.title}” registrada`,
      actorMembershipId: actor.membershipId,
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "administrative_requirement.created",
      resourceType: "administrative_requirement",
      resourceId: created.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { status: created.status, title: created.title },
    });
    return serializeRequirement(created);
  });
}

export async function updateAdministrativeRequirement(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  processId: string,
  requirementId: string,
  input: {
    title?: string;
    description?: string | null;
    relatedRequestId?: string | null;
    issuedAt?: string | null;
    dueAt?: string | null;
    status?: AdministrativeRequirementStatus;
    sourceReference?: string | null;
    respondedAt?: string | null;
    responseSummary?: string | null;
    responsibleMembershipId?: string | null;
  },
  meta: RequestMeta,
) {
  requireRequirementPermission(
    account,
    organizationId,
    "administrative_process.manage_requirements",
  );
  const process = await requireProcessInOrg(db, organizationId, processId);
  assertEditable(process);
  const existing = await db.query.administrativeRequirements.findFirst({
    where: and(
      eq(administrativeRequirements.id, requirementId),
      eq(administrativeRequirements.organizationId, organizationId),
      eq(administrativeRequirements.administrativeProcessId, processId),
    ),
  });
  if (!existing) {
    throw new AppError("NOT_FOUND", "Não encontramos esta exigência no seu acesso.");
  }
  if (input.status) {
    assertAdministrativeRequirementTransition(
      existing.status as AdministrativeRequirementStatus,
      input.status,
    );
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(administrativeRequirements)
      .set({
        title: input.title ?? existing.title,
        description: input.description === undefined ? existing.description : input.description,
        relatedRequestId:
          input.relatedRequestId === undefined ? existing.relatedRequestId : input.relatedRequestId,
        issuedAt:
          input.issuedAt === undefined
            ? existing.issuedAt
            : (parseOptionalDate(input.issuedAt) ?? null),
        dueAt:
          input.dueAt === undefined ? existing.dueAt : (parseOptionalDate(input.dueAt) ?? null),
        status: input.status ?? existing.status,
        sourceReference:
          input.sourceReference === undefined ? existing.sourceReference : input.sourceReference,
        respondedAt:
          input.respondedAt === undefined
            ? existing.respondedAt
            : (parseOptionalDate(input.respondedAt) ?? null),
        responseSummary:
          input.responseSummary === undefined ? existing.responseSummary : input.responseSummary,
        responsibleMembershipId:
          input.responsibleMembershipId === undefined
            ? existing.responsibleMembershipId
            : input.responsibleMembershipId,
        updatedAt: new Date(),
      })
      .where(eq(administrativeRequirements.id, requirementId))
      .returning();
    if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível atualizar a exigência.");

    await touchProcessActivity(tx, processId);
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "administrative_requirement.updated",
      resourceType: "administrative_requirement",
      resourceId: requirementId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { status: existing.status },
      after: { status: updated.status },
    });
    return serializeRequirement(updated);
  });
}

export async function listAdministrativeDeadlines(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  processId: string,
) {
  requireDeadlinePermission(account, organizationId, "administrative_process.read");
  await requireProcessInOrg(db, organizationId, processId);
  const rows = await db.query.administrativeDeadlines.findMany({
    where: and(
      eq(administrativeDeadlines.organizationId, organizationId),
      eq(administrativeDeadlines.administrativeProcessId, processId),
    ),
    orderBy: [asc(administrativeDeadlines.dueAt)],
  });
  return rows.map(serializeDeadline);
}

export async function addAdministrativeDeadline(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  processId: string,
  input: {
    title: string;
    dueAt: string;
    timezone?: string;
    status?: AdministrativeDeadlineStatus;
    requirementId?: string;
    calculationSource?: string;
    calculationNotes?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireDeadlinePermission(
    account,
    organizationId,
    "administrative_process.manage_deadlines",
  );
  const process = await requireProcessInOrg(db, organizationId, processId);
  assertEditable(process);
  const status = (input.status ?? "suggested") as AdministrativeDeadlineStatus;

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(administrativeDeadlines)
      .values({
        organizationId,
        administrativeProcessId: processId,
        requirementId: input.requirementId ?? null,
        title: input.title,
        dueAt: new Date(input.dueAt),
        timezone: input.timezone ?? "America/Sao_Paulo",
        status,
        calculationSource: input.calculationSource ?? "manual",
        calculationNotes: input.calculationNotes ?? null,
        confirmedByMembershipId: status === "confirmed" ? actor.membershipId : null,
        confirmedAt: status === "confirmed" ? new Date() : null,
      })
      .returning();
    if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o prazo.");

    const centralId = await syncCentralFromAdministrative(tx, {
      organizationId,
      administrativeProcessId: processId,
      administrativeDeadlineId: created.id,
      title: created.title,
      dueAt: created.dueAt,
      timezone: created.timezone,
      status: created.status,
      legalMatterId: process.legalMatterId,
      actorMembershipId: actor.membershipId,
    });
    const [linked] = await tx
      .update(administrativeDeadlines)
      .set({ centralDeadlineId: centralId, updatedAt: new Date() })
      .where(eq(administrativeDeadlines.id, created.id))
      .returning();

    await touchProcessActivity(tx, processId);
    await appendProcessTimeline(tx, {
      organizationId,
      administrativeProcessId: processId,
      legalMatterId: process.legalMatterId,
      eventType: "administrative_process.deadline",
      title: `Prazo “${created.title}” (${created.status})`,
      actorMembershipId: actor.membershipId,
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "administrative_deadline.created",
      resourceType: "administrative_deadline",
      resourceId: created.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        status: created.status,
        title: created.title,
        centralDeadlineId: centralId,
      },
    });
    return serializeDeadline(linked ?? { ...created, centralDeadlineId: centralId });
  });
}

export async function updateAdministrativeDeadline(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  processId: string,
  deadlineId: string,
  input: {
    title?: string;
    dueAt?: string;
    timezone?: string;
    status?: AdministrativeDeadlineStatus;
    requirementId?: string | null;
    calculationSource?: string;
    calculationNotes?: string | null;
  },
  meta: RequestMeta,
) {
  const actor = requireDeadlinePermission(
    account,
    organizationId,
    "administrative_process.manage_deadlines",
  );
  await requireProcessInOrg(db, organizationId, processId);
  const existing = await db.query.administrativeDeadlines.findFirst({
    where: and(
      eq(administrativeDeadlines.id, deadlineId),
      eq(administrativeDeadlines.organizationId, organizationId),
      eq(administrativeDeadlines.administrativeProcessId, processId),
    ),
  });
  if (!existing) {
    throw new AppError("NOT_FOUND", "Não encontramos este prazo no seu acesso.");
  }
  if (input.status) {
    assertAdministrativeDeadlineTransition(
      existing.status as AdministrativeDeadlineStatus,
      input.status,
    );
  }

  return db.transaction(async (tx) => {
    const nextStatus = (input.status ?? existing.status) as AdministrativeDeadlineStatus;
    const process = await requireProcessInOrg(tx, organizationId, processId);
    const [updated] = await tx
      .update(administrativeDeadlines)
      .set({
        title: input.title ?? existing.title,
        dueAt: input.dueAt ? new Date(input.dueAt) : existing.dueAt,
        timezone: input.timezone ?? existing.timezone,
        status: nextStatus,
        requirementId:
          input.requirementId === undefined ? existing.requirementId : input.requirementId,
        calculationSource: input.calculationSource ?? existing.calculationSource,
        calculationNotes:
          input.calculationNotes === undefined ? existing.calculationNotes : input.calculationNotes,
        confirmedByMembershipId:
          nextStatus === "confirmed" ? actor.membershipId : existing.confirmedByMembershipId,
        confirmedAt:
          nextStatus === "confirmed" && existing.status !== "confirmed"
            ? new Date()
            : existing.confirmedAt,
        updatedAt: new Date(),
      })
      .where(eq(administrativeDeadlines.id, deadlineId))
      .returning();
    if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível atualizar o prazo.");

    const centralId = await syncCentralFromAdministrative(tx, {
      organizationId,
      administrativeProcessId: processId,
      administrativeDeadlineId: updated.id,
      title: updated.title,
      dueAt: updated.dueAt,
      timezone: updated.timezone,
      status: updated.status,
      legalMatterId: process.legalMatterId,
      actorMembershipId: actor.membershipId,
      existingCentralId: existing.centralDeadlineId,
    });
    if (centralId !== existing.centralDeadlineId) {
      await tx
        .update(administrativeDeadlines)
        .set({ centralDeadlineId: centralId, updatedAt: new Date() })
        .where(eq(administrativeDeadlines.id, deadlineId));
      updated.centralDeadlineId = centralId;
    }

    await touchProcessActivity(tx, processId);
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "administrative_deadline.updated",
      resourceType: "administrative_deadline",
      resourceId: deadlineId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { status: existing.status },
      after: { status: updated.status, centralDeadlineId: centralId },
    });
    return serializeDeadline(updated);
  });
}

export async function listAdministrativeDecisions(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  processId: string,
) {
  requireDecisionPermission(account, organizationId, "administrative_process.read");
  await requireProcessInOrg(db, organizationId, processId);
  const rows = await db.query.administrativeDecisions.findMany({
    where: and(
      eq(administrativeDecisions.organizationId, organizationId),
      eq(administrativeDecisions.administrativeProcessId, processId),
    ),
    orderBy: [desc(administrativeDecisions.updatedAt)],
  });
  return rows.map(serializeDecision);
}

export async function addAdministrativeDecision(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  processId: string,
  input: {
    decisionType: string;
    title: string;
    summary?: string;
    outcome?: string;
    relatedRequestId?: string;
    decidedAt?: string;
    notifiedAt?: string;
    source?: "manual";
    sourceReference?: string;
    documentId?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireDecisionPermission(
    account,
    organizationId,
    "administrative_process.manage_decisions",
  );
  const process = await requireProcessInOrg(db, organizationId, processId);
  assertEditable(process);

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(administrativeDecisions)
      .values({
        organizationId,
        administrativeProcessId: processId,
        relatedRequestId: input.relatedRequestId ?? null,
        decisionType: input.decisionType,
        title: input.title,
        summary: input.summary ?? null,
        outcome: input.outcome ?? null,
        decidedAt: parseOptionalDate(input.decidedAt) ?? null,
        notifiedAt: parseOptionalDate(input.notifiedAt) ?? null,
        source: "manual",
        sourceReference: input.sourceReference ?? null,
        documentId: input.documentId ?? null,
        createdByMembershipId: actor.membershipId,
      })
      .returning();
    if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar a decisão.");

    await touchProcessActivity(tx, processId);
    await appendProcessTimeline(tx, {
      organizationId,
      administrativeProcessId: processId,
      legalMatterId: process.legalMatterId,
      eventType: "administrative_process.decision",
      title: `Decisão “${created.title}” registrada`,
      actorMembershipId: actor.membershipId,
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "administrative_decision.created",
      resourceType: "administrative_decision",
      resourceId: created.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { title: created.title, decisionType: created.decisionType },
    });
    return serializeDecision(created);
  });
}

export async function listAdministrativeAppeals(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  processId: string,
) {
  requireAppealPermission(account, organizationId, "administrative_process.read");
  await requireProcessInOrg(db, organizationId, processId);
  const rows = await db.query.administrativeAppeals.findMany({
    where: and(
      eq(administrativeAppeals.organizationId, organizationId),
      eq(administrativeAppeals.administrativeProcessId, processId),
    ),
    orderBy: [desc(administrativeAppeals.updatedAt)],
  });
  return rows.map(serializeAppeal);
}

export async function addAdministrativeAppeal(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  processId: string,
  input: {
    appealType: string;
    title: string;
    summary?: string;
    parentDecisionId?: string;
    status?: AdministrativeAppealStatus;
    deadlineId?: string;
    filedAt?: string;
    protocolNumber?: string;
    source?: "manual";
    documentId?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireAppealPermission(
    account,
    organizationId,
    "administrative_process.manage_appeals",
  );
  const process = await requireProcessInOrg(db, organizationId, processId);
  assertEditable(process);
  const status = (input.status ?? "draft") as AdministrativeAppealStatus;
  if (status === "filed" && !input.protocolNumber?.trim()) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Informe o número de protocolo ao registrar o recurso como protocolado.",
      [{ path: "protocolNumber", message: "Protocolo obrigatório para filed." }],
    );
  }

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(administrativeAppeals)
      .values({
        organizationId,
        administrativeProcessId: processId,
        parentDecisionId: input.parentDecisionId ?? null,
        appealType: input.appealType,
        title: input.title,
        summary: input.summary ?? null,
        status,
        deadlineId: input.deadlineId ?? null,
        filedAt: parseOptionalDate(input.filedAt) ?? null,
        protocolNumber: input.protocolNumber ?? null,
        source: "manual",
        documentId: input.documentId ?? null,
        createdByMembershipId: actor.membershipId,
      })
      .returning();
    if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o recurso.");

    await touchProcessActivity(tx, processId);
    await appendProcessTimeline(tx, {
      organizationId,
      administrativeProcessId: processId,
      legalMatterId: process.legalMatterId,
      eventType: "administrative_process.appeal",
      title: `Recurso “${created.title}” registrado`,
      actorMembershipId: actor.membershipId,
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "administrative_appeal.created",
      resourceType: "administrative_appeal",
      resourceId: created.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { status: created.status, title: created.title },
    });
    return serializeAppeal(created);
  });
}

export async function updateAdministrativeAppeal(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  processId: string,
  appealId: string,
  input: {
    appealType?: string;
    title?: string;
    summary?: string | null;
    parentDecisionId?: string | null;
    status?: AdministrativeAppealStatus;
    deadlineId?: string | null;
    filedAt?: string | null;
    protocolNumber?: string | null;
    documentId?: string | null;
  },
  meta: RequestMeta,
) {
  const actor = requireAppealPermission(
    account,
    organizationId,
    "administrative_process.manage_appeals",
  );
  await requireProcessInOrg(db, organizationId, processId);
  const existing = await db.query.administrativeAppeals.findFirst({
    where: and(
      eq(administrativeAppeals.id, appealId),
      eq(administrativeAppeals.organizationId, organizationId),
      eq(administrativeAppeals.administrativeProcessId, processId),
    ),
  });
  if (!existing) {
    throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");
  }
  if (input.status) {
    assertAdministrativeAppealTransition(
      existing.status as AdministrativeAppealStatus,
      input.status,
    );
  }
  const nextStatus = (input.status ?? existing.status) as AdministrativeAppealStatus;
  const nextProtocol =
    input.protocolNumber === undefined ? existing.protocolNumber : input.protocolNumber;
  if (nextStatus === "filed" && !nextProtocol?.trim()) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Informe o número de protocolo ao registrar o recurso como protocolado.",
      [{ path: "protocolNumber", message: "Protocolo obrigatório para filed." }],
    );
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(administrativeAppeals)
      .set({
        appealType: input.appealType ?? existing.appealType,
        title: input.title ?? existing.title,
        summary: input.summary === undefined ? existing.summary : input.summary,
        parentDecisionId:
          input.parentDecisionId === undefined ? existing.parentDecisionId : input.parentDecisionId,
        status: nextStatus,
        deadlineId: input.deadlineId === undefined ? existing.deadlineId : input.deadlineId,
        filedAt:
          input.filedAt === undefined
            ? existing.filedAt
            : (parseOptionalDate(input.filedAt) ?? null),
        protocolNumber: nextProtocol,
        documentId: input.documentId === undefined ? existing.documentId : input.documentId,
        approvedByMembershipId:
          nextStatus === "approved" || nextStatus === "confirmed"
            ? actor.membershipId
            : existing.approvedByMembershipId,
        updatedAt: new Date(),
      })
      .where(eq(administrativeAppeals.id, appealId))
      .returning();
    if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível atualizar o recurso.");

    await touchProcessActivity(tx, processId);
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "administrative_appeal.updated",
      resourceType: "administrative_appeal",
      resourceId: appealId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { status: existing.status },
      after: { status: updated.status },
    });
    return serializeAppeal(updated);
  });
}

/** Mantido para compatibilidade com rotas aninhadas em matter. */
export async function getAdministrativeProcessInMatter(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  processId: string,
) {
  requireProcessPermission(account, organizationId, "administrative_process.read");
  return serializeProcess(await requireProcessInMatter(db, organizationId, matterId, processId));
}
