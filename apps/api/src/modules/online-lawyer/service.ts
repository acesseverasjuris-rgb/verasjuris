import type {
  ConflictCheckProvider,
  OABVerificationProvider,
  OABVerificationResult,
  PaymentProvider,
  VideoConferenceProvider,
} from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import {
  policyLawyerAvailability,
  policyOnlineConsultation,
  policyOnlineLegalRequest,
  policyOnlineMatchCandidate,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  consultationClosures,
  consultationTermsAcceptances,
  conversationParticipants,
  conversationThreads,
  documentAclEntries,
  documentLinks,
  documents,
  isUniqueViolation,
  lawyerAvailability,
  lawyerAvailabilityOverrides,
  lawyerProfiles,
  legalAreas,
  legalMatters,
  onlineConsultationPayments,
  onlineConsultationReviews,
  onlineConsultations,
  onlineLegalMatchCandidates,
  onlineLegalRequests,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, asc, count, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { authorize, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import { assertCanReadDocument, requireDocumentInOrg } from "../documents/service.js";
import { OnlineLawyerMatchingService } from "./matching.js";

type DbTx = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

export type OnlineLawyerModuleDeps = {
  paymentProvider: PaymentProvider;
  oabVerificationProvider: OABVerificationProvider;
  conflictCheckProvider: ConflictCheckProvider;
  videoConferenceProvider: VideoConferenceProvider;
  offerTtlMinutes?: number;
};

const matcher = new OnlineLawyerMatchingService();

function serializeRequest(
  row: typeof onlineLegalRequests.$inferSelect,
  options?: { includeSummary?: boolean },
) {
  const includeSummary = options?.includeSummary ?? true;
  return {
    id: row.id,
    organizationId: row.organizationId,
    requesterUserId: row.requesterUserId,
    clientId: row.clientId,
    legalAreaId: row.legalAreaId,
    subareaId: row.subareaId,
    urgency: row.urgency,
    stateCode: row.stateCode,
    summary: includeSummary ? row.summary : undefined,
    preferredMode: row.preferredMode,
    status: row.status,
    acceptedMatchId: row.acceptedMatchId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializeMatch(
  row: typeof onlineLegalMatchCandidates.$inferSelect,
  preview?: {
    stateCode?: string;
    urgency?: string;
    preferredMode?: string;
    legalAreaId?: string | null;
  },
) {
  return {
    id: row.id,
    requestId: row.requestId,
    lawyerProfileId: row.lawyerProfileId,
    totalScore: row.totalScore,
    scoreBreakdown: row.scoreBreakdown,
    status: row.status,
    offeredAt: iso(row.offeredAt),
    expiresAt: iso(row.expiresAt),
    respondedAt: iso(row.respondedAt),
    requestPreview: preview ?? null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializeConsultation(row: typeof onlineConsultations.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    requestId: row.requestId,
    clientId: row.clientId,
    lawyerProfileId: row.lawyerProfileId,
    matchCandidateId: row.matchCandidateId,
    status: row.status,
    mode: row.mode,
    scheduledAt: iso(row.scheduledAt),
    startedAt: iso(row.startedAt),
    endedAt: iso(row.endedAt),
    timezone: row.timezone,
    calendarEventId: row.calendarEventId,
    contractId: row.contractId,
    conversationThreadId: row.conversationThreadId,
    priceCents: row.priceCents,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function requireRequestInOrg(
  db: AppDatabase | DbTx,
  organizationId: string,
  requestId: string,
) {
  const row = await db.query.onlineLegalRequests.findFirst({
    where: and(
      eq(onlineLegalRequests.id, requestId),
      eq(onlineLegalRequests.organizationId, organizationId),
    ),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos esta solicitação.");
  return row;
}

async function linkRequestDocuments(
  tx: DbTx,
  organizationId: string,
  requestId: string,
  documentIds: string[],
  actorMembershipId: string,
) {
  for (const documentId of documentIds) {
    await requireDocumentInOrg(tx, organizationId, documentId);
    await tx.insert(documentLinks).values({
      organizationId,
      documentId,
      linkType: "online_legal_request_attachment",
      targetType: "online_legal_request",
      targetId: requestId,
      createdByMembershipId: actorMembershipId,
    });
  }
}

async function listRequestDocumentIds(db: AppDatabase | DbTx, requestId: string) {
  const links = await db.query.documentLinks.findMany({
    where: and(
      eq(documentLinks.targetType, "online_legal_request"),
      eq(documentLinks.targetId, requestId),
      eq(documentLinks.linkType, "online_legal_request_attachment"),
    ),
  });
  return links.map((l) => l.documentId);
}

async function grantRequestDocumentsToLawyer(
  tx: DbTx,
  organizationId: string,
  requestId: string,
  lawyerUserId: string,
) {
  const docIds = await listRequestDocumentIds(tx, requestId);
  for (const documentId of docIds) {
    await tx
      .insert(documentAclEntries)
      .values({
        organizationId,
        documentId,
        principalType: "user",
        principalId: lawyerUserId,
        permission: "read",
      })
      .onConflictDoNothing();
    await tx
      .insert(documentAclEntries)
      .values({
        organizationId,
        documentId,
        principalType: "user",
        principalId: lawyerUserId,
        permission: "download",
      })
      .onConflictDoNothing();
  }
}

async function resolveLegalAreaTerms(
  db: AppDatabase,
  organizationId: string,
  legalAreaId: string | null,
): Promise<{ name: string; slug: string } | null> {
  if (!legalAreaId) return null;
  const area = await db.query.legalAreas.findFirst({
    where: and(eq(legalAreas.id, legalAreaId), eq(legalAreas.organizationId, organizationId)),
  });
  return area ? { name: area.name, slug: area.slug } : null;
}

async function assertLawyerProfile(db: AppDatabase, userId: string) {
  const profile = await db.query.lawyerProfiles.findFirst({
    where: eq(lawyerProfiles.userId, userId),
  });
  if (!profile) {
    throw new AppError("NOT_FOUND", "Perfil de advogado não encontrado para este usuário.");
  }
  return profile;
}

export async function getOnlineLawyerProvidersStatus(
  account: SessionAccount,
  organizationId: string,
  deps: OnlineLawyerModuleDeps,
) {
  authorize(account, organizationId, (access) =>
    policyOnlineLegalRequest(access, "online_lawyer.request"),
  );
  const [payment, oab, conflict, video] = await Promise.all([
    deps.paymentProvider.healthCheck(),
    deps.oabVerificationProvider.healthCheck(),
    deps.conflictCheckProvider.healthCheck(),
    deps.videoConferenceProvider.healthCheck(),
  ]);
  return { payment, oab, conflict, video };
}

export async function createOnlineLegalRequest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    clientId?: string;
    legalAreaId?: string;
    subareaId?: string;
    urgency: "low" | "normal" | "high" | "urgent";
    stateCode: string;
    summary: string;
    preferredMode: "text" | "audio" | "video" | "in_person" | "other";
    status: (typeof onlineLegalRequests.$inferSelect)["status"];
    documentIds?: string[];
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyOnlineLegalRequest(access, "online_lawyer.request"),
  );

  const status = input.status === "draft" || input.status === "submitted" ? input.status : "draft";

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(onlineLegalRequests)
      .values({
        organizationId,
        requesterUserId: account.user.id,
        clientId: input.clientId ?? null,
        legalAreaId: input.legalAreaId ?? null,
        subareaId: input.subareaId ?? null,
        urgency: input.urgency,
        stateCode: input.stateCode,
        summary: input.summary,
        preferredMode: input.preferredMode,
        status,
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a solicitação.");

    if (input.documentIds?.length) {
      await linkRequestDocuments(
        tx,
        organizationId,
        row.id,
        input.documentIds,
        membership.membershipId,
      );
    }

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "online_legal_request.created",
      resourceType: "online_legal_request",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { status: row.status, urgency: row.urgency, stateCode: row.stateCode },
    });

    return { request: serializeRequest(row) };
  });
}

export async function listOnlineLegalRequests(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { status?: string; stateCode?: string; limit: number; offset: number },
) {
  authorize(account, organizationId, (access) =>
    policyOnlineLegalRequest(access, "online_lawyer.request"),
  );
  const filters = [eq(onlineLegalRequests.organizationId, organizationId)];
  if (query.status) filters.push(eq(onlineLegalRequests.status, query.status as never));
  if (query.stateCode)
    filters.push(eq(onlineLegalRequests.stateCode, query.stateCode.toUpperCase()));
  const where = and(...filters);
  const items = await db.query.onlineLegalRequests.findMany({
    where,
    orderBy: desc(onlineLegalRequests.createdAt),
    limit: query.limit,
    offset: query.offset,
  });
  const totalRow = await db.select({ total: count() }).from(onlineLegalRequests).where(where);
  return {
    items: items.map((row) => serializeRequest(row)),
    total: totalRow[0]?.total ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getOnlineLegalRequest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  requestId: string,
) {
  authorize(account, organizationId, (access) =>
    policyOnlineLegalRequest(access, "online_lawyer.request"),
  );
  const row = await requireRequestInOrg(db, organizationId, requestId);
  const documentIds = await listRequestDocumentIds(db, requestId);
  return { request: serializeRequest(row), documentIds };
}

export async function cancelOnlineLegalRequest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  requestId: string,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyOnlineLegalRequest(access, "online_lawyer.request"),
  );
  return db.transaction(async (tx) => {
    const row = await requireRequestInOrg(tx, organizationId, requestId);
    if (row.requesterUserId !== account.user.id) {
      throw new AppError("AUTHORIZATION_ERROR", "Somente o solicitante pode cancelar.");
    }
    if (row.status === "cancelled" || row.status === "matched" || row.status === "converted") {
      throw new AppError("CONFLICT", "Esta solicitação não pode ser cancelada no status atual.");
    }
    const [updated] = await tx
      .update(onlineLegalRequests)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(onlineLegalRequests.id, requestId))
      .returning();
    await tx
      .update(onlineLegalMatchCandidates)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(onlineLegalMatchCandidates.requestId, requestId),
          inArray(onlineLegalMatchCandidates.status, ["pending", "offered"]),
        ),
      );
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "online_legal_request.cancelled",
      resourceType: "online_legal_request",
      resourceId: requestId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
    return { request: serializeRequest(updated!) };
  });
}

export async function generateMatchCandidates(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  requestId: string,
  options: { offerTtlMinutes: number; limit: number },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyOnlineLegalRequest(access, "online_lawyer.request"),
  );
  const request = await requireRequestInOrg(db, organizationId, requestId);
  if (!["submitted", "matching"].includes(request.status)) {
    throw new AppError("CONFLICT", "Só é possível gerar matches para solicitações enviadas.");
  }

  const areaTerms = await resolveLegalAreaTerms(db, organizationId, request.legalAreaId);
  const lawyers = await db.query.lawyerProfiles.findMany();
  const ranked = matcher.rank(
    lawyers,
    {
      stateCode: request.stateCode,
      urgency: request.urgency,
      preferredMode: request.preferredMode,
      legalAreaName: areaTerms?.name ?? null,
      legalAreaSlug: areaTerms?.slug ?? null,
    },
    options.limit,
  );

  const now = new Date();
  const expiresAt = new Date(now.getTime() + options.offerTtlMinutes * 60_000);

  return db.transaction(async (tx) => {
    await tx
      .update(onlineLegalRequests)
      .set({ status: "matching", updatedAt: now })
      .where(eq(onlineLegalRequests.id, requestId));

    const created: (typeof onlineLegalMatchCandidates.$inferSelect)[] = [];
    for (const match of ranked) {
      const [row] = await tx
        .insert(onlineLegalMatchCandidates)
        .values({
          requestId,
          lawyerProfileId: match.lawyerProfileId,
          scoreBreakdown: match.scoreBreakdown,
          totalScore: match.totalScore,
          status: "offered",
          offeredAt: now,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: [
            onlineLegalMatchCandidates.requestId,
            onlineLegalMatchCandidates.lawyerProfileId,
          ],
          set: {
            scoreBreakdown: match.scoreBreakdown,
            totalScore: match.totalScore,
            status: "offered",
            offeredAt: now,
            expiresAt,
            updatedAt: now,
          },
        })
        .returning();
      if (row) created.push(row);
    }

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "online_legal_request.matches_generated",
      resourceType: "online_legal_request",
      resourceId: requestId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { count: created.length, offerTtlMinutes: options.offerTtlMinutes },
    });

    return {
      items: created.map((row) =>
        serializeMatch(row, {
          stateCode: request.stateCode,
          urgency: request.urgency,
          preferredMode: request.preferredMode,
          legalAreaId: request.legalAreaId,
        }),
      ),
    };
  });
}

export async function listRequestMatchCandidates(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  requestId: string,
) {
  authorize(account, organizationId, (access) =>
    policyOnlineLegalRequest(access, "online_lawyer.match.read"),
  );
  const request = await requireRequestInOrg(db, organizationId, requestId);
  const items = await db.query.onlineLegalMatchCandidates.findMany({
    where: eq(onlineLegalMatchCandidates.requestId, requestId),
    orderBy: [
      desc(onlineLegalMatchCandidates.totalScore),
      asc(onlineLegalMatchCandidates.lawyerProfileId),
    ],
  });
  const preview = {
    stateCode: request.stateCode,
    urgency: request.urgency,
    preferredMode: request.preferredMode,
    legalAreaId: request.legalAreaId,
  };
  return {
    items: items.map((row) => serializeMatch(row, preview)),
  };
}

export async function listLawyerOfferedMatches(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number },
) {
  authorize(account, organizationId, (access) =>
    policyOnlineMatchCandidate(access, "online_lawyer.match.read"),
  );
  await assertLawyerProfile(db, account.user.id);
  const now = new Date();
  const items = await db.query.onlineLegalMatchCandidates.findMany({
    where: and(
      eq(onlineLegalMatchCandidates.lawyerProfileId, account.user.id),
      eq(onlineLegalMatchCandidates.status, "offered"),
    ),
    orderBy: desc(onlineLegalMatchCandidates.offeredAt),
    limit: query.limit,
    offset: query.offset,
  });

  const enriched = [];
  for (const row of items) {
    const request = await db.query.onlineLegalRequests.findFirst({
      where: and(
        eq(onlineLegalRequests.id, row.requestId),
        eq(onlineLegalRequests.organizationId, organizationId),
      ),
    });
    if (!request) continue;
    if (row.expiresAt && row.expiresAt.getTime() < now.getTime()) continue;
    enriched.push(
      serializeMatch(row, {
        stateCode: request.stateCode,
        urgency: request.urgency,
        preferredMode: request.preferredMode,
        legalAreaId: request.legalAreaId,
      }),
    );
  }
  return { items: enriched, limit: query.limit, offset: query.offset };
}

export async function acceptMatchCandidate(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matchId: string,
  deps: OnlineLawyerModuleDeps,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyOnlineMatchCandidate(access, "online_lawyer.match.respond"),
  );
  const lawyer = await assertLawyerProfile(db, account.user.id);
  const now = new Date();

  const conflictResult = await deps.conflictCheckProvider.check({
    organizationId,
    parties: [{ displayName: lawyer.professionalName ?? account.user.displayName }],
    matterSummary: "Consulta online — verificação de conflitos",
  });

  try {
    return await db.transaction(async (tx) => {
      const [candidate] = await tx
        .update(onlineLegalMatchCandidates)
        .set({ status: "accepted", respondedAt: now, updatedAt: now })
        .where(
          and(
            eq(onlineLegalMatchCandidates.id, matchId),
            eq(onlineLegalMatchCandidates.status, "offered"),
            eq(onlineLegalMatchCandidates.lawyerProfileId, account.user.id),
          ),
        )
        .returning();
      if (!candidate) {
        throw new AppError("CONFLICT", "Esta oferta não está mais disponível para aceite.");
      }
      if (candidate.expiresAt && candidate.expiresAt.getTime() < now.getTime()) {
        throw new AppError("CONFLICT", "Esta oferta expirou.");
      }

      const request = await requireRequestInOrg(tx, organizationId, candidate.requestId);
      const [updatedRequest] = await tx
        .update(onlineLegalRequests)
        .set({
          status: "matched",
          acceptedMatchId: candidate.id,
          updatedAt: now,
        })
        .where(
          and(
            eq(onlineLegalRequests.id, candidate.requestId),
            inArray(onlineLegalRequests.status, ["matching", "submitted"]),
          ),
        )
        .returning();
      if (!updatedRequest) {
        throw new AppError("CONFLICT", "Outro advogado já aceitou esta solicitação.");
      }

      await tx
        .update(onlineLegalMatchCandidates)
        .set({ status: "cancelled", updatedAt: now })
        .where(
          and(
            eq(onlineLegalMatchCandidates.requestId, candidate.requestId),
            ne(onlineLegalMatchCandidates.id, candidate.id),
            eq(onlineLegalMatchCandidates.status, "offered"),
          ),
        );

      const [thread] = await tx
        .insert(conversationThreads)
        .values({
          organizationId,
          clientId: request.clientId,
          subject: `Consulta online — solicitação ${request.id.slice(0, 8)}`,
          status: "open",
          createdByUserId: account.user.id,
          contextType: "online_consultation",
          contextId: candidate.requestId,
        })
        .returning();

      await tx.insert(conversationParticipants).values([
        {
          organizationId,
          threadId: thread!.id,
          userId: request.requesterUserId,
          participantRole: "client",
        },
        {
          organizationId,
          threadId: thread!.id,
          userId: account.user.id,
          participantRole: "lawyer",
        },
      ]);

      const [consultation] = await tx
        .insert(onlineConsultations)
        .values({
          organizationId,
          requestId: request.id,
          clientId: request.clientId,
          lawyerProfileId: account.user.id,
          matchCandidateId: candidate.id,
          status: "matched",
          mode: request.preferredMode,
          conversationThreadId: thread!.id,
          priceCents: lawyer.consultationPriceCents ?? null,
        })
        .returning();

      await grantRequestDocumentsToLawyer(tx, organizationId, request.id, account.user.id);

      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "online_consultation.conflict_checked",
        resourceType: "online_consultation",
        resourceId: consultation!.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: conflictResult,
      });

      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "online_match.accepted",
        resourceType: "online_legal_match_candidate",
        resourceId: candidate.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
      });

      return {
        match: serializeMatch(candidate),
        consultation: serializeConsultation(consultation!),
        conflictCheck: conflictResult,
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Já existe consulta vinculada a esta solicitação.");
    }
    throw error;
  }
}

export async function declineMatchCandidate(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matchId: string,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyOnlineMatchCandidate(access, "online_lawyer.match.respond"),
  );
  await assertLawyerProfile(db, account.user.id);
  const now = new Date();
  const [candidate] = await db
    .update(onlineLegalMatchCandidates)
    .set({ status: "declined", respondedAt: now, updatedAt: now })
    .where(
      and(
        eq(onlineLegalMatchCandidates.id, matchId),
        eq(onlineLegalMatchCandidates.status, "offered"),
        eq(onlineLegalMatchCandidates.lawyerProfileId, account.user.id),
      ),
    )
    .returning();
  if (!candidate) {
    throw new AppError("CONFLICT", "Esta oferta não está disponível para recusa.");
  }
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "online_match.declined",
    resourceType: "online_legal_match_candidate",
    resourceId: matchId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { match: serializeMatch(candidate) };
}

export async function createLawyerAvailabilitySlot(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    lawyerProfileId: string;
    dayOfWeek?: number | null;
    specificDate?: string;
    startTime: string;
    endTime: string;
    timezone: string;
    mode: "text" | "audio" | "video" | "in_person" | "other";
    active: boolean;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyLawyerAvailability(access, "online_lawyer.availability.manage"),
  );
  if (input.lawyerProfileId !== account.user.id) {
    throw new AppError("AUTHORIZATION_ERROR", "Gerencie apenas sua própria disponibilidade.");
  }
  const [row] = await db
    .insert(lawyerAvailability)
    .values({
      lawyerProfileId: input.lawyerProfileId,
      dayOfWeek: input.dayOfWeek ?? null,
      specificDate: input.specificDate ? new Date(input.specificDate) : null,
      startTime: input.startTime,
      endTime: input.endTime,
      timezone: input.timezone,
      mode: input.mode,
      active: input.active,
    })
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "lawyer_availability.created",
    resourceType: "lawyer_availability",
    resourceId: row!.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { availability: row };
}

export async function listLawyerAvailability(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  lawyerProfileId: string,
) {
  authorize(account, organizationId, (access) =>
    policyLawyerAvailability(access, "online_lawyer.availability.manage"),
  );
  if (lawyerProfileId !== account.user.id) {
    throw new AppError("AUTHORIZATION_ERROR", "Consulte apenas sua própria disponibilidade.");
  }
  const items = await db.query.lawyerAvailability.findMany({
    where: eq(lawyerAvailability.lawyerProfileId, lawyerProfileId),
    orderBy: asc(lawyerAvailability.createdAt),
  });
  return { items };
}

export async function updateLawyerAvailabilitySlot(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  availabilityId: string,
  input: Partial<{
    dayOfWeek: number | null;
    specificDate: string | null;
    startTime: string;
    endTime: string;
    timezone: string;
    mode: "text" | "audio" | "video" | "in_person" | "other";
    active: boolean;
  }>,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyLawyerAvailability(access, "online_lawyer.availability.manage"),
  );
  const existing = await db.query.lawyerAvailability.findFirst({
    where: eq(lawyerAvailability.id, availabilityId),
  });
  if (!existing || existing.lawyerProfileId !== account.user.id) {
    throw new AppError("NOT_FOUND", "Disponibilidade não encontrada.");
  }
  const [row] = await db
    .update(lawyerAvailability)
    .set({
      ...(input.dayOfWeek !== undefined ? { dayOfWeek: input.dayOfWeek } : {}),
      ...(input.specificDate !== undefined
        ? { specificDate: input.specificDate ? new Date(input.specificDate) : null }
        : {}),
      ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
      ...(input.endTime !== undefined ? { endTime: input.endTime } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.mode !== undefined ? { mode: input.mode } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      updatedAt: new Date(),
    })
    .where(eq(lawyerAvailability.id, availabilityId))
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "lawyer_availability.updated",
    resourceType: "lawyer_availability",
    resourceId: availabilityId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { availability: row };
}

export async function deleteLawyerAvailabilitySlot(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  availabilityId: string,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyLawyerAvailability(access, "online_lawyer.availability.manage"),
  );
  const existing = await db.query.lawyerAvailability.findFirst({
    where: eq(lawyerAvailability.id, availabilityId),
  });
  if (!existing || existing.lawyerProfileId !== account.user.id) {
    throw new AppError("NOT_FOUND", "Disponibilidade não encontrada.");
  }
  await db.delete(lawyerAvailability).where(eq(lawyerAvailability.id, availabilityId));
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "lawyer_availability.deleted",
    resourceType: "lawyer_availability",
    resourceId: availabilityId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { deleted: true };
}

export async function createLawyerAvailabilityOverride(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    lawyerProfileId: string;
    startsAt: string;
    endsAt: string;
    overrideType: string;
    reason?: string;
    active: boolean;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyLawyerAvailability(access, "online_lawyer.availability.manage"),
  );
  if (input.lawyerProfileId !== account.user.id) {
    throw new AppError("AUTHORIZATION_ERROR", "Gerencie apenas seus próprios overrides.");
  }
  const [row] = await db
    .insert(lawyerAvailabilityOverrides)
    .values({
      lawyerProfileId: input.lawyerProfileId,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      overrideType: input.overrideType,
      reason: input.reason ?? null,
      active: input.active,
    })
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "lawyer_availability_override.created",
    resourceType: "lawyer_availability_override",
    resourceId: row!.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { override: row };
}

export async function listLawyerAvailabilityOverrides(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  lawyerProfileId: string,
) {
  authorize(account, organizationId, (access) =>
    policyLawyerAvailability(access, "online_lawyer.availability.manage"),
  );
  if (lawyerProfileId !== account.user.id) {
    throw new AppError("AUTHORIZATION_ERROR", "Consulte apenas seus próprios overrides.");
  }
  const items = await db.query.lawyerAvailabilityOverrides.findMany({
    where: eq(lawyerAvailabilityOverrides.lawyerProfileId, lawyerProfileId),
    orderBy: desc(lawyerAvailabilityOverrides.startsAt),
  });
  return { items };
}

export async function updateLawyerAvailabilityOverride(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  overrideId: string,
  input: Partial<{
    startsAt: string;
    endsAt: string;
    overrideType: string;
    reason: string | null;
    active: boolean;
  }>,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyLawyerAvailability(access, "online_lawyer.availability.manage"),
  );
  const existing = await db.query.lawyerAvailabilityOverrides.findFirst({
    where: eq(lawyerAvailabilityOverrides.id, overrideId),
  });
  if (!existing || existing.lawyerProfileId !== account.user.id) {
    throw new AppError("NOT_FOUND", "Override não encontrado.");
  }
  const [row] = await db
    .update(lawyerAvailabilityOverrides)
    .set({
      ...(input.startsAt !== undefined ? { startsAt: new Date(input.startsAt) } : {}),
      ...(input.endsAt !== undefined ? { endsAt: new Date(input.endsAt) } : {}),
      ...(input.overrideType !== undefined ? { overrideType: input.overrideType } : {}),
      ...(input.reason !== undefined ? { reason: input.reason } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      updatedAt: new Date(),
    })
    .where(eq(lawyerAvailabilityOverrides.id, overrideId))
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "lawyer_availability_override.updated",
    resourceType: "lawyer_availability_override",
    resourceId: overrideId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { override: row };
}

export async function deleteLawyerAvailabilityOverride(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  overrideId: string,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyLawyerAvailability(access, "online_lawyer.availability.manage"),
  );
  const existing = await db.query.lawyerAvailabilityOverrides.findFirst({
    where: eq(lawyerAvailabilityOverrides.id, overrideId),
  });
  if (!existing || existing.lawyerProfileId !== account.user.id) {
    throw new AppError("NOT_FOUND", "Override não encontrado.");
  }
  await db
    .delete(lawyerAvailabilityOverrides)
    .where(eq(lawyerAvailabilityOverrides.id, overrideId));
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "lawyer_availability_override.deleted",
    resourceType: "lawyer_availability_override",
    resourceId: overrideId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { deleted: true };
}

export async function patchOnlineLawyerProfileFields(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    onlineServiceEnabled?: boolean;
    serviceStates?: string;
    consultationModes?: string;
    availabilityStatus?: "available" | "busy" | "away" | "offline";
    acceptsUrgent?: boolean;
    consultationPriceCents?: number;
    practiceAreas?: string;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyLawyerAvailability(access, "online_lawyer.availability.manage"),
  );
  const userId = account.user.id;
  const [row] = await db
    .update(lawyerProfiles)
    .set({
      ...(input.onlineServiceEnabled !== undefined
        ? { onlineServiceEnabled: input.onlineServiceEnabled }
        : {}),
      ...(input.serviceStates !== undefined ? { serviceStates: input.serviceStates } : {}),
      ...(input.consultationModes !== undefined
        ? { consultationModes: input.consultationModes }
        : {}),
      ...(input.availabilityStatus !== undefined
        ? { availabilityStatus: input.availabilityStatus }
        : {}),
      ...(input.acceptsUrgent !== undefined ? { acceptsUrgent: input.acceptsUrgent } : {}),
      ...(input.consultationPriceCents !== undefined
        ? { consultationPriceCents: input.consultationPriceCents }
        : {}),
      ...(input.practiceAreas !== undefined ? { practiceAreas: input.practiceAreas } : {}),
      updatedAt: new Date(),
    })
    .where(eq(lawyerProfiles.userId, userId))
    .returning();
  if (!row) {
    throw new AppError("NOT_FOUND", "Perfil de advogado não encontrado.");
  }
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "online_lawyer.profile_updated",
    resourceType: "lawyer_profile",
    resourceId: userId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { lawyerProfile: row };
}

async function requireConsultationInOrg(
  db: AppDatabase | DbTx,
  organizationId: string,
  consultationId: string,
) {
  const row = await db.query.onlineConsultations.findFirst({
    where: and(
      eq(onlineConsultations.id, consultationId),
      or(
        eq(onlineConsultations.organizationId, organizationId),
        sql`${onlineConsultations.organizationId} IS NULL`,
      ),
    ),
  });
  if (!row || row.organizationId !== organizationId) {
    throw new AppError("NOT_FOUND", "Consulta não encontrada.");
  }
  return row;
}

export async function listOnlineConsultations(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { status?: string; limit: number; offset: number },
) {
  authorize(account, organizationId, (access) =>
    policyOnlineConsultation(access, "online_lawyer.consultation.read"),
  );
  const filters = [eq(onlineConsultations.organizationId, organizationId)];
  if (query.status) filters.push(eq(onlineConsultations.status, query.status as never));
  const where = and(...filters);
  const items = await db.query.onlineConsultations.findMany({
    where,
    orderBy: desc(onlineConsultations.createdAt),
    limit: query.limit,
    offset: query.offset,
  });
  return { items: items.map(serializeConsultation), limit: query.limit, offset: query.offset };
}

export async function getOnlineConsultation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  consultationId: string,
  deps: OnlineLawyerModuleDeps,
) {
  authorize(account, organizationId, (access) =>
    policyOnlineConsultation(access, "online_lawyer.consultation.read"),
  );
  const row = await requireConsultationInOrg(db, organizationId, consultationId);
  const videoHealth =
    row.mode === "video" ? await deps.videoConferenceProvider.healthCheck() : null;
  return { consultation: serializeConsultation(row), videoProvider: videoHealth };
}

export async function acceptConsultationTerms(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  consultationId: string,
  input: { termsVersion: string; source: string },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyOnlineConsultation(access, "online_lawyer.consultation.manage"),
  );
  await requireConsultationInOrg(db, organizationId, consultationId);
  const [row] = await db
    .insert(consultationTermsAcceptances)
    .values({
      consultationId,
      userId: account.user.id,
      termsVersion: input.termsVersion,
      acceptedAt: new Date(),
      source: input.source,
    })
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "online_consultation.terms_accepted",
    resourceType: "online_consultation",
    resourceId: consultationId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { acceptance: row };
}

export async function scheduleOnlineConsultation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  consultationId: string,
  input: {
    scheduledAt: string;
    timezone: string;
    mode?: "text" | "audio" | "video" | "in_person" | "other";
  },
  deps: OnlineLawyerModuleDeps,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyOnlineConsultation(access, "online_lawyer.consultation.manage"),
  );
  const existing = await requireConsultationInOrg(db, organizationId, consultationId);
  const mode = input.mode ?? existing.mode;
  if (mode === "video") {
    await deps.videoConferenceProvider.healthCheck();
  }
  const [row] = await db
    .update(onlineConsultations)
    .set({
      scheduledAt: new Date(input.scheduledAt),
      timezone: input.timezone,
      mode,
      status: "scheduled",
      updatedAt: new Date(),
    })
    .where(eq(onlineConsultations.id, consultationId))
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "online_consultation.scheduled",
    resourceType: "online_consultation",
    resourceId: consultationId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { consultation: serializeConsultation(row!) };
}

export async function startOnlineConsultation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  consultationId: string,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyOnlineConsultation(access, "online_lawyer.consultation.manage"),
  );
  await requireConsultationInOrg(db, organizationId, consultationId);
  const now = new Date();
  const [row] = await db
    .update(onlineConsultations)
    .set({ status: "in_progress", startedAt: now, updatedAt: now })
    .where(eq(onlineConsultations.id, consultationId))
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "online_consultation.started",
    resourceType: "online_consultation",
    resourceId: consultationId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { consultation: serializeConsultation(row!) };
}

export async function completeOnlineConsultation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  consultationId: string,
  input: {
    outcome: string;
    summary?: string;
    followUpRecommended: boolean;
    createLegalMatter: boolean;
    matterTitle?: string;
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyOnlineConsultation(access, "online_lawyer.consultation.manage"),
  );
  const consultation = await requireConsultationInOrg(db, organizationId, consultationId);
  const now = new Date();

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(onlineConsultations)
      .set({ status: "completed", endedAt: now, updatedAt: now })
      .where(eq(onlineConsultations.id, consultationId))
      .returning();

    let legalMatterCreatedId: string | null = null;
    if (input.createLegalMatter && consultation.clientId) {
      const request = await tx.query.onlineLegalRequests.findFirst({
        where: eq(onlineLegalRequests.id, consultation.requestId),
      });
      const internalReference = `OL-${consultation.id.replace(/-/g, "").slice(0, 12).toUpperCase()}`;
      const [matter] = await tx
        .insert(legalMatters)
        .values({
          organizationId,
          clientId: consultation.clientId,
          title: input.matterTitle ?? `Consulta online ${consultation.id.slice(0, 8)}`,
          internalReference,
          status: "open",
          legalAreaId: request?.legalAreaId ?? null,
          createdByMembershipId: membership.membershipId,
        })
        .returning();
      legalMatterCreatedId = matter!.id;
      await tx
        .update(onlineLegalRequests)
        .set({ status: "converted", updatedAt: now })
        .where(eq(onlineLegalRequests.id, consultation.requestId));
    }

    const [closure] = await tx
      .insert(consultationClosures)
      .values({
        consultationId,
        closedByUserId: account.user.id,
        outcome: input.outcome,
        summary: input.summary ?? null,
        followUpRecommended: input.followUpRecommended,
        legalMatterCreatedId,
      })
      .returning();

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "online_consultation.completed",
      resourceType: "online_consultation",
      resourceId: consultationId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { legalMatterCreatedId },
    });

    return { consultation: serializeConsultation(updated!), closure };
  });
}

export async function recordManualConsultationPayment(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  consultationId: string,
  input: {
    amountCents: number;
    platformFeeCents: number;
    lawyerAmountCents: number;
    evidenceDocumentId: string;
    externalReference?: string;
  },
  deps: OnlineLawyerModuleDeps,
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyOnlineConsultation(access, "online_lawyer.consultation.manage"),
  );
  await requireConsultationInOrg(db, organizationId, consultationId);
  await requireDocumentInOrg(db, organizationId, input.evidenceDocumentId);

  const providerHealth = await deps.paymentProvider.healthCheck();
  if (providerHealth.status !== "not_configured") {
    // Pagamento via provider exige integração explícita — este endpoint é manual.
  }

  const [payment] = await db
    .insert(onlineConsultationPayments)
    .values({
      consultationId,
      amountCents: input.amountCents,
      platformFeeCents: input.platformFeeCents,
      lawyerAmountCents: input.lawyerAmountCents,
      status: "paid_manual",
      providerKey: "manual",
      externalReference: input.externalReference ?? null,
      evidenceDocumentId: input.evidenceDocumentId,
      recordedByMembershipId: membership.membershipId,
      paidAt: new Date(),
    })
    .returning();

  await db
    .update(onlineConsultations)
    .set({ status: "ready", updatedAt: new Date() })
    .where(eq(onlineConsultations.id, consultationId));

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "online_consultation.manual_payment",
    resourceType: "online_consultation_payment",
    resourceId: payment!.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });

  return { payment, provider: providerHealth };
}

export async function createOnlineConsultationReview(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  consultationId: string,
  input: { rating: number; comment?: string },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyOnlineConsultation(access, "online_lawyer.consultation.read"),
  );
  const consultation = await requireConsultationInOrg(db, organizationId, consultationId);
  if (consultation.status !== "completed") {
    throw new AppError("CONFLICT", "Só é possível avaliar consultas concluídas.");
  }
  if (consultation.lawyerProfileId === account.user.id) {
    throw new AppError("AUTHORIZATION_ERROR", "O advogado não pode avaliar a própria consulta.");
  }

  try {
    const [review] = await db
      .insert(onlineConsultationReviews)
      .values({
        consultationId,
        clientId: consultation.clientId,
        reviewerUserId: account.user.id,
        lawyerProfileId: consultation.lawyerProfileId,
        rating: input.rating,
        comment: input.comment ?? null,
        status: "published",
      })
      .returning();
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "online_consultation.review_created",
      resourceType: "online_consultation_review",
      resourceId: review!.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
    return { review };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Esta consulta já foi avaliada.");
    }
    throw error;
  }
}

export async function verifyLawyerOabWithProvider(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  deps: OnlineLawyerModuleDeps,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyLawyerAvailability(access, "online_lawyer.availability.manage"),
  );
  const profile = await assertLawyerProfile(db, account.user.id);
  if (!profile.oabNumber || !profile.oabUf) {
    throw new AppError("VALIDATION_ERROR", "Informe número e UF da OAB antes de verificar.");
  }

  let result: OABVerificationResult;
  try {
    result = await deps.oabVerificationProvider.verify({
      oabNumber: profile.oabNumber,
      oabUf: profile.oabUf,
      professionalName: profile.professionalName ?? account.user.displayName,
    });
  } catch (error) {
    if (error instanceof AppError && error.code === "OAB_VERIFICATION_PROVIDER_NOT_CONFIGURED") {
      throw error;
    }
    throw error;
  }

  if (!result.verified) {
    const [row] = await db
      .update(lawyerProfiles)
      .set({ oabVerificationStatus: "pending_verification", updatedAt: new Date() })
      .where(eq(lawyerProfiles.userId, account.user.id))
      .returning();
    return { lawyerProfile: row, verification: result };
  }

  const [row] = await db
    .update(lawyerProfiles)
    .set({ oabVerificationStatus: "verified", updatedAt: new Date() })
    .where(eq(lawyerProfiles.userId, account.user.id))
    .returning();

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "online_lawyer.oab_verified",
    resourceType: "lawyer_profile",
    resourceId: account.user.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { providerKey: result.providerKey },
  });

  return { lawyerProfile: row, verification: result };
}

export async function assertLawyerCanReadRequestDocument(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  documentId: string,
  requestId: string,
) {
  const request = await requireRequestInOrg(db, organizationId, requestId);
  const docIds = await listRequestDocumentIds(db, requestId);
  if (!docIds.includes(documentId)) {
    throw new AppError("NOT_FOUND", "Documento não vinculado à solicitação.");
  }
  const doc = await requireDocumentInOrg(db, organizationId, documentId);
  const consultation = await db.query.onlineConsultations.findFirst({
    where: eq(onlineConsultations.requestId, requestId),
  });
  const isLawyer = account.user.id !== request.requesterUserId;
  if (isLawyer && !consultation) {
    throw new AppError("AUTHORIZATION_ERROR", "Documentos completos só após aceite da consulta.");
  }
  await assertCanReadDocument(db, account, organizationId, doc);
  return doc;
}
