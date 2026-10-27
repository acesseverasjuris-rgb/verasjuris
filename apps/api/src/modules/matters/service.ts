import { recordAudit } from "@verasjuris/audit";
import {
  assertMatterTransition,
  policyLegalCatalog,
  policyLegalMatter,
  policyMatterFee,
  policyMatterParty,
  policyMatterTeam,
  type MatterStatus,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  crmClients,
  crmInteractions,
  crmOpportunities,
  crmTags,
  isUniqueViolation,
  legalAreas,
  legalDemandTypes,
  legalMatterFeeArrangements,
  legalMatterParties,
  legalMatters,
  legalMatterSequences,
  legalMatterTags,
  legalMatterTeamMembers,
  legalMatterTimelineEvents,
  legalSubareas,
  organizationMembers,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { slugifyName } from "@verasjuris/validation";
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { RequestMeta } from "../auth/service.js";
import { ensureDemandTypesCatalog } from "./catalog.js";

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

function requireMatterPermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyLegalMatter>[1],
) {
  const decision = policyLegalMatter(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function requirePartyPermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyMatterParty>[1],
) {
  const decision = policyMatterParty(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function requireTeamPermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyMatterTeam>[1],
) {
  const decision = policyMatterTeam(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function requireFeePermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyMatterFee>[1],
) {
  const decision = policyMatterFee(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function requireCatalogPermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyLegalCatalog>[1],
) {
  const decision = policyLegalCatalog(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

async function requireActiveMembershipInOrg(
  db: AppDatabase | DbTx,
  organizationId: string,
  membershipId: string,
) {
  const row = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.id, membershipId),
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.status, "active"),
    ),
  });
  if (!row) {
    throw new AppError("NOT_FOUND", "Não encontramos este participante ativo na organização.");
  }
  return row;
}

async function requireClientInOrg(
  db: AppDatabase | DbTx,
  organizationId: string,
  clientId: string,
) {
  const client = await db.query.crmClients.findFirst({
    where: and(eq(crmClients.id, clientId), eq(crmClients.organizationId, organizationId)),
  });
  if (!client) {
    throw new AppError("NOT_FOUND", "Não encontramos este cliente no seu acesso.");
  }
  if (client.status === "archived") {
    throw new AppError("VALIDATION_ERROR", "Não é possível vincular um cliente arquivado.", [
      { path: "clientId", message: "Escolha um cliente ativo ou inativo." },
    ]);
  }
  return client;
}

async function assertLegalAreaInOrg(
  db: AppDatabase | DbTx,
  organizationId: string,
  legalAreaId: string | null | undefined,
) {
  if (!legalAreaId) return null;
  const area = await db.query.legalAreas.findFirst({
    where: and(eq(legalAreas.id, legalAreaId), eq(legalAreas.organizationId, organizationId)),
  });
  if (!area) {
    throw new AppError("NOT_FOUND", "Não encontramos esta área jurídica no seu acesso.");
  }
  return area;
}

async function assertDemandTypeInOrg(
  db: AppDatabase | DbTx,
  organizationId: string,
  demandTypeId: string | null | undefined,
) {
  if (!demandTypeId) return null;
  const row = await db.query.legalDemandTypes.findFirst({
    where: and(
      eq(legalDemandTypes.id, demandTypeId),
      eq(legalDemandTypes.organizationId, organizationId),
    ),
  });
  if (!row) {
    throw new AppError("NOT_FOUND", "Não encontramos este tipo de demanda no seu acesso.");
  }
  return row;
}

async function assertSubareaInOrg(
  db: AppDatabase | DbTx,
  organizationId: string,
  legalSubareaId: string | null | undefined,
  legalAreaId: string | null | undefined,
) {
  if (!legalSubareaId) return null;
  const row = await db.query.legalSubareas.findFirst({
    where: and(
      eq(legalSubareas.id, legalSubareaId),
      eq(legalSubareas.organizationId, organizationId),
    ),
  });
  if (!row) {
    throw new AppError("NOT_FOUND", "Não encontramos esta subárea no seu acesso.");
  }
  if (legalAreaId && row.legalAreaId !== legalAreaId) {
    throw new AppError("VALIDATION_ERROR", "A subárea não pertence à área jurídica informada.", [
      { path: "legalSubareaId", message: "Selecione uma subárea compatível com a área." },
    ]);
  }
  return row;
}

async function nextInternalReference(tx: DbTx, organizationId: string): Promise<string> {
  const year = new Date().getUTCFullYear();
  await tx
    .insert(legalMatterSequences)
    .values({ organizationId, year, lastValue: 0 })
    .onConflictDoNothing({
      target: [legalMatterSequences.organizationId, legalMatterSequences.year],
    });
  const [row] = await tx
    .select()
    .from(legalMatterSequences)
    .where(
      and(
        eq(legalMatterSequences.organizationId, organizationId),
        eq(legalMatterSequences.year, year),
      ),
    )
    .for("update");
  if (!row) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível gerar a referência do caso.");
  }
  const next = row.lastValue + 1;
  await tx
    .update(legalMatterSequences)
    .set({ lastValue: next })
    .where(
      and(
        eq(legalMatterSequences.organizationId, organizationId),
        eq(legalMatterSequences.year, year),
      ),
    );
  return `VJ-${year}-${String(next).padStart(6, "0")}`;
}

async function appendTimeline(
  tx: DbTx,
  input: {
    organizationId: string;
    legalMatterId: string;
    eventType: string;
    title: string;
    body?: string | null;
    actorMembershipId?: string | null;
  },
) {
  await tx.insert(legalMatterTimelineEvents).values({
    organizationId: input.organizationId,
    legalMatterId: input.legalMatterId,
    eventType: input.eventType,
    title: input.title,
    body: input.body ?? null,
    actorMembershipId: input.actorMembershipId ?? null,
  });
}

async function requireMatter(
  db: AppDatabase | DbTx,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  permission: Parameters<typeof policyLegalMatter>[1] = "matter.read",
) {
  requireMatterPermission(account, organizationId, permission);
  const matter = await db.query.legalMatters.findFirst({
    where: and(eq(legalMatters.id, matterId), eq(legalMatters.organizationId, organizationId)),
  });
  if (!matter) {
    throw new AppError("NOT_FOUND", "Não encontramos este caso no seu acesso.");
  }
  return matter;
}

function serializeMatterSummary(matter: typeof legalMatters.$inferSelect) {
  return {
    id: matter.id,
    organizationId: matter.organizationId,
    clientId: matter.clientId,
    title: matter.title,
    internalReference: matter.internalReference,
    demandTypeId: matter.demandTypeId,
    legalAreaId: matter.legalAreaId,
    legalSubareaId: matter.legalSubareaId,
    summary: matter.summary,
    status: matter.status,
    priority: matter.priority,
    responsibleMembershipId: matter.responsibleMembershipId,
    originatingOpportunityId: matter.originatingOpportunityId,
    intakeId: matter.intakeId,
    openedAt: matter.openedAt.toISOString(),
    closedAt: matter.closedAt?.toISOString() ?? null,
    archivedAt: matter.archivedAt?.toISOString() ?? null,
    createdAt: matter.createdAt.toISOString(),
    updatedAt: matter.updatedAt.toISOString(),
  };
}

export async function createMatter(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    title: string;
    clientId: string;
    summary?: string;
    demandTypeId?: string;
    legalAreaId?: string;
    legalSubareaId?: string;
    priority?: "normal" | "high" | "urgent";
    status?: "draft" | "open" | "active";
    responsibleMembershipId?: string;
    intakeId?: string;
    originatingOpportunityId?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireMatterPermission(account, organizationId, "matter.create");
  await ensureDemandTypesCatalog(db, organizationId);
  await requireClientInOrg(db, organizationId, input.clientId);
  await assertLegalAreaInOrg(db, organizationId, input.legalAreaId);
  await assertDemandTypeInOrg(db, organizationId, input.demandTypeId);
  await assertSubareaInOrg(db, organizationId, input.legalSubareaId, input.legalAreaId);
  if (input.responsibleMembershipId) {
    await requireActiveMembershipInOrg(db, organizationId, input.responsibleMembershipId);
  }

  return db.transaction(async (tx) => {
    const internalReference = await nextInternalReference(tx, organizationId);
    const status = input.status ?? "open";
    const [matter] = await tx
      .insert(legalMatters)
      .values({
        organizationId,
        clientId: input.clientId,
        title: input.title,
        summary: input.summary,
        internalReference,
        demandTypeId: input.demandTypeId,
        legalAreaId: input.legalAreaId,
        legalSubareaId: input.legalSubareaId,
        priority: input.priority ?? "normal",
        status,
        responsibleMembershipId: input.responsibleMembershipId,
        intakeId: input.intakeId,
        originatingOpportunityId: input.originatingOpportunityId,
        createdByMembershipId: actor.membershipId,
      })
      .returning();
    if (!matter) throw new AppError("INTERNAL_ERROR", "Não foi possível abrir o caso.");

    if (input.responsibleMembershipId) {
      await tx.insert(legalMatterTeamMembers).values({
        organizationId,
        legalMatterId: matter.id,
        membershipId: input.responsibleMembershipId,
        teamRole: "responsible",
        isPrimary: true,
        assignedByMembershipId: actor.membershipId,
      });
    }

    await appendTimeline(tx, {
      organizationId,
      legalMatterId: matter.id,
      eventType: "matter.created",
      title: "Caso criado",
      body: `${matter.internalReference} — ${matter.title}`,
      actorMembershipId: actor.membershipId,
    });

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "matter.created",
      resourceType: "legal_matter",
      resourceId: matter.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        internalReference: matter.internalReference,
        clientId: matter.clientId,
        status: matter.status,
      },
    });

    return serializeMatterSummary(matter);
  });
}

export async function createMatterFromOpportunity(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
  input: {
    title: string;
    summary?: string;
    legalAreaId?: string;
    responsibleMembershipId?: string;
    demandTypeId?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireMatterPermission(account, organizationId, "matter.create");
  await ensureDemandTypesCatalog(db, organizationId);

  const opportunity = await db.query.crmOpportunities.findFirst({
    where: and(
      eq(crmOpportunities.id, opportunityId),
      eq(crmOpportunities.organizationId, organizationId),
    ),
  });
  if (!opportunity) {
    throw new AppError("NOT_FOUND", "Não encontramos esta oportunidade no seu acesso.");
  }
  if (opportunity.caseId) {
    throw new AppError("CONFLICT", "Esta oportunidade já possui um caso jurídico vinculado.");
  }
  const clientId = opportunity.clientId;
  if (!clientId) {
    throw new AppError(
      "VALIDATION_ERROR",
      "É necessário um cliente vinculado para abrir um caso.",
      [{ path: "clientId", message: "Converta o lead ou ative a contratação antes." }],
    );
  }

  await requireClientInOrg(db, organizationId, clientId);
  await assertLegalAreaInOrg(db, organizationId, input.legalAreaId ?? opportunity.legalAreaId);
  await assertDemandTypeInOrg(db, organizationId, input.demandTypeId);
  const responsibleId =
    input.responsibleMembershipId ?? opportunity.responsibleMembershipId ?? undefined;
  if (responsibleId) {
    await requireActiveMembershipInOrg(db, organizationId, responsibleId);
  }

  try {
    return await db.transaction(async (tx) => {
      const internalReference = await nextInternalReference(tx, organizationId);
      const [matter] = await tx
        .insert(legalMatters)
        .values({
          organizationId,
          clientId,
          originatingOpportunityId: opportunityId,
          intakeId: opportunity.intakeId,
          title: input.title,
          summary: input.summary,
          internalReference,
          demandTypeId: input.demandTypeId,
          legalAreaId: input.legalAreaId ?? opportunity.legalAreaId,
          responsibleMembershipId: responsibleId,
          status: "open",
          priority: "normal",
          createdByMembershipId: actor.membershipId,
        })
        .returning();
      if (!matter) throw new AppError("INTERNAL_ERROR", "Não foi possível abrir o caso.");

      const [updatedOpportunity] = await tx
        .update(crmOpportunities)
        .set({
          caseId: matter.id,
          stage: "case",
          status: "won",
          wonAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(crmOpportunities.id, opportunityId),
            eq(crmOpportunities.organizationId, organizationId),
            sql`${crmOpportunities.caseId} is null`,
          ),
        )
        .returning();
      if (!updatedOpportunity) {
        throw new AppError("CONFLICT", "Esta oportunidade já possui um caso jurídico vinculado.");
      }

      if (responsibleId) {
        await tx.insert(legalMatterTeamMembers).values({
          organizationId,
          legalMatterId: matter.id,
          membershipId: responsibleId,
          teamRole: "responsible",
          isPrimary: true,
          assignedByMembershipId: actor.membershipId,
        });
      }

      await tx.insert(crmInteractions).values({
        organizationId,
        resourceType: "opportunity",
        resourceId: opportunityId,
        type: "status_change",
        origin: "system",
        title: "Caso jurídico aberto",
        body: `${matter.internalReference} — ${matter.title}`,
        actorUserId: account.user.id,
      });

      await appendTimeline(tx, {
        organizationId,
        legalMatterId: matter.id,
        eventType: "matter.created",
        title: "Caso criado a partir do pipeline",
        body: matter.internalReference,
        actorMembershipId: actor.membershipId,
      });

      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "matter.created",
        resourceType: "legal_matter",
        resourceId: matter.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: { opportunityId, internalReference: matter.internalReference },
      });

      return serializeMatterSummary(matter);
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Esta oportunidade já possui um caso jurídico vinculado.");
    }
    throw error;
  }
}

export async function listMatters(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    q?: string;
    clientId?: string;
    responsibleMembershipId?: string;
    teamMembershipId?: string;
    legalAreaId?: string;
    legalSubareaId?: string;
    demandTypeId?: string;
    status?: string;
    priority?: string;
    tagId?: string;
    from?: string;
    to?: string;
    limit: number;
    offset: number;
  },
) {
  requireMatterPermission(account, organizationId, "matter.read");
  const filters = [eq(legalMatters.organizationId, organizationId)];
  if (query.q) {
    const term = `%${query.q}%`;
    filters.push(
      or(
        ilike(legalMatters.title, term),
        ilike(legalMatters.internalReference, term),
        ilike(legalMatters.summary, term),
      )!,
    );
  }
  if (query.clientId) filters.push(eq(legalMatters.clientId, query.clientId));
  if (query.responsibleMembershipId) {
    filters.push(eq(legalMatters.responsibleMembershipId, query.responsibleMembershipId));
  }
  if (query.legalAreaId) filters.push(eq(legalMatters.legalAreaId, query.legalAreaId));
  if (query.legalSubareaId) filters.push(eq(legalMatters.legalSubareaId, query.legalSubareaId));
  if (query.demandTypeId) filters.push(eq(legalMatters.demandTypeId, query.demandTypeId));
  if (query.status) {
    filters.push(
      eq(legalMatters.status, query.status as (typeof legalMatters.status.enumValues)[number]),
    );
  }
  if (query.priority) {
    filters.push(
      eq(
        legalMatters.priority,
        query.priority as (typeof legalMatters.priority.enumValues)[number],
      ),
    );
  }
  if (query.from) filters.push(gte(legalMatters.createdAt, new Date(query.from)));
  if (query.to) filters.push(lte(legalMatters.createdAt, new Date(query.to)));

  let matterIdsByTeam: string[] | null = null;
  if (query.teamMembershipId) {
    const teamRows = await db
      .select({ id: legalMatterTeamMembers.legalMatterId })
      .from(legalMatterTeamMembers)
      .where(
        and(
          eq(legalMatterTeamMembers.organizationId, organizationId),
          eq(legalMatterTeamMembers.membershipId, query.teamMembershipId),
          isNull(legalMatterTeamMembers.removedAt),
        ),
      );
    matterIdsByTeam = teamRows.map((row) => row.id);
    if (matterIdsByTeam.length === 0) {
      return { items: [], total: 0, limit: query.limit, offset: query.offset };
    }
    filters.push(inArray(legalMatters.id, matterIdsByTeam));
  }

  if (query.tagId) {
    const tagRows = await db
      .select({ id: legalMatterTags.legalMatterId })
      .from(legalMatterTags)
      .where(
        and(
          eq(legalMatterTags.organizationId, organizationId),
          eq(legalMatterTags.tagId, query.tagId),
        ),
      );
    const ids = tagRows.map((row) => row.id);
    if (ids.length === 0) {
      return { items: [], total: 0, limit: query.limit, offset: query.offset };
    }
    filters.push(inArray(legalMatters.id, ids));
  }

  const where = and(...filters);
  const [totalRow] = await db.select({ value: count() }).from(legalMatters).where(where);
  const items = await db.query.legalMatters.findMany({
    where,
    orderBy: [desc(legalMatters.updatedAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return {
    items: items.map(serializeMatterSummary),
    total: totalRow?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getMatter(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
) {
  await requireMatter(db, account, organizationId, matterId, "matter.read");
  const matter = await db.query.legalMatters.findFirst({
    where: and(eq(legalMatters.id, matterId), eq(legalMatters.organizationId, organizationId)),
    with: {
      client: true,
      legalArea: true,
      legalSubarea: true,
      demandType: true,
      parties: true,
      teamMembers: true,
      fees: true,
      tags: { with: { tag: true } },
    },
  });
  if (!matter) throw new AppError("NOT_FOUND", "Não encontramos este caso no seu acesso.");

  const timelineEvents = await db.query.legalMatterTimelineEvents.findMany({
    where: and(
      eq(legalMatterTimelineEvents.legalMatterId, matterId),
      eq(legalMatterTimelineEvents.organizationId, organizationId),
    ),
    orderBy: [desc(legalMatterTimelineEvents.occurredAt)],
    limit: 50,
  });

  return {
    ...serializeMatterSummary(matter),
    client: matter.client
      ? {
          id: matter.client.id,
          fullName: matter.client.fullName,
          legalName: matter.client.legalName,
          status: matter.client.status,
        }
      : null,
    demandType: matter.demandType
      ? { id: matter.demandType.id, name: matter.demandType.name, slug: matter.demandType.slug }
      : null,
    legalArea: matter.legalArea
      ? { id: matter.legalArea.id, name: matter.legalArea.name, slug: matter.legalArea.slug }
      : null,
    legalSubarea: matter.legalSubarea
      ? {
          id: matter.legalSubarea.id,
          name: matter.legalSubarea.name,
          slug: matter.legalSubarea.slug,
        }
      : null,
    parties: matter.parties.map((party) => ({
      id: party.id,
      partyType: party.partyType,
      position: party.position,
      personType: party.personType,
      displayName: party.displayName,
      documentNormalized: party.documentNormalized,
      roleDescription: party.roleDescription,
      isPrimary: party.isPrimary,
      clientId: party.clientId,
      contactId: party.contactId,
    })),
    team: matter.teamMembers
      .filter((member) => !member.removedAt)
      .map((member) => ({
        id: member.id,
        membershipId: member.membershipId,
        teamRole: member.teamRole,
        isPrimary: member.isPrimary,
        assignedAt: member.assignedAt.toISOString(),
      })),
    fees: matter.fees.map((fee) => ({
      id: fee.id,
      type: fee.type,
      fixedAmountCents: fee.fixedAmountCents,
      percentageBasisPoints: fee.percentageBasisPoints,
      hourlyRateCents: fee.hourlyRateCents,
      successFeeBasisPoints: fee.successFeeBasisPoints,
      description: fee.description,
      status: fee.status,
      effectiveFrom: fee.effectiveFrom.toISOString(),
      effectiveUntil: fee.effectiveUntil?.toISOString() ?? null,
    })),
    tags: matter.tags
      .filter((row) => row.tag)
      .map((row) => ({
        id: row.tag.id,
        name: row.tag.name,
        slug: row.tag.slug,
        color: row.tag.color,
      })),
    timeline: timelineEvents.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      title: event.title,
      body: event.body,
      occurredAt: event.occurredAt.toISOString(),
    })),
  };
}

export async function updateMatter(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  input: {
    title?: string;
    summary?: string | null;
    demandTypeId?: string | null;
    legalAreaId?: string | null;
    legalSubareaId?: string | null;
    priority?: "normal" | "high" | "urgent";
    responsibleMembershipId?: string | null;
    intakeId?: string | null;
  },
  meta: RequestMeta,
) {
  const actor = await requireMatter(db, account, organizationId, matterId, "matter.update");
  const areaId = input.legalAreaId !== undefined ? input.legalAreaId : actor.legalAreaId;
  if (input.legalAreaId !== undefined) {
    await assertLegalAreaInOrg(db, organizationId, input.legalAreaId);
  }
  if (input.demandTypeId !== undefined) {
    await assertDemandTypeInOrg(db, organizationId, input.demandTypeId);
  }
  if (input.legalSubareaId !== undefined) {
    await assertSubareaInOrg(db, organizationId, input.legalSubareaId, areaId);
  }

  const previousResponsible = actor.responsibleMembershipId;
  if (input.responsibleMembershipId) {
    requireMatterPermission(account, organizationId, "matter.assign");
    await requireActiveMembershipInOrg(db, organizationId, input.responsibleMembershipId);
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(legalMatters)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        ...(input.demandTypeId !== undefined ? { demandTypeId: input.demandTypeId } : {}),
        ...(input.legalAreaId !== undefined ? { legalAreaId: input.legalAreaId } : {}),
        ...(input.legalSubareaId !== undefined ? { legalSubareaId: input.legalSubareaId } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.responsibleMembershipId !== undefined
          ? { responsibleMembershipId: input.responsibleMembershipId }
          : {}),
        ...(input.intakeId !== undefined ? { intakeId: input.intakeId } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(legalMatters.id, matterId), eq(legalMatters.organizationId, organizationId)))
      .returning();
    if (!updated) throw new AppError("NOT_FOUND", "Não encontramos este caso no seu acesso.");

    if (input.responsibleMembershipId && input.responsibleMembershipId !== previousResponsible) {
      await appendTimeline(tx, {
        organizationId,
        legalMatterId: matterId,
        eventType: "matter.responsible_changed",
        title: "Responsável alterado",
        actorMembershipId: membershipOf(account, organizationId)?.membershipId,
      });
      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "matter.responsible_changed",
        resourceType: "legal_matter",
        resourceId: matterId,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: { responsibleMembershipId: input.responsibleMembershipId },
      });
    }

    await appendTimeline(tx, {
      organizationId,
      legalMatterId: matterId,
      eventType: "matter.updated",
      title: "Caso atualizado",
      actorMembershipId: membershipOf(account, organizationId)?.membershipId,
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "matter.updated",
      resourceType: "legal_matter",
      resourceId: matterId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { fields: Object.keys(input) },
    });

    return serializeMatterSummary(updated);
  });
}

export async function changeMatterStatus(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  nextStatus: MatterStatus,
  meta: RequestMeta,
) {
  const matter = await requireMatter(db, account, organizationId, matterId, "matter.update");
  if (nextStatus === "closed") {
    requireMatterPermission(account, organizationId, "matter.close");
  }
  if (nextStatus === "archived" || matter.status === "archived") {
    requireMatterPermission(account, organizationId, "matter.archive");
  }
  assertMatterTransition(matter.status as MatterStatus, nextStatus);

  const actor = membershipOf(account, organizationId)!;
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(legalMatters)
      .set({
        status: nextStatus,
        closedAt:
          nextStatus === "closed" ? new Date() : nextStatus === "archived" ? matter.closedAt : null,
        archivedAt: nextStatus === "archived" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(legalMatters.id, matterId), eq(legalMatters.organizationId, organizationId)))
      .returning();
    if (!updated) throw new AppError("NOT_FOUND", "Não encontramos este caso no seu acesso.");

    const action =
      nextStatus === "closed"
        ? "matter.closed"
        : nextStatus === "archived"
          ? "matter.archived"
          : matter.status === "archived"
            ? "matter.restored"
            : "matter.status_changed";

    await appendTimeline(tx, {
      organizationId,
      legalMatterId: matterId,
      eventType: action,
      title: `Status: ${matter.status} → ${nextStatus}`,
      actorMembershipId: actor.membershipId,
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action,
      resourceType: "legal_matter",
      resourceId: matterId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { status: matter.status },
      after: { status: nextStatus },
    });
    return serializeMatterSummary(updated);
  });
}

export async function closeMatter(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  meta: RequestMeta,
) {
  return changeMatterStatus(db, account, organizationId, matterId, "closed", meta);
}

export async function archiveMatter(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  meta: RequestMeta,
) {
  return changeMatterStatus(db, account, organizationId, matterId, "archived", meta);
}

export async function restoreMatter(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  meta: RequestMeta,
) {
  return changeMatterStatus(db, account, organizationId, matterId, "open", meta);
}

export async function addMatterParty(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  input: {
    displayName: string;
    position?: (typeof legalMatterParties.position.enumValues)[number];
    personType?: (typeof legalMatterParties.personType.enumValues)[number];
    partyType?: string;
    clientId?: string;
    contactId?: string;
    documentNormalized?: string;
    roleDescription?: string;
    isPrimary?: boolean;
  },
  meta: RequestMeta,
) {
  const actor = requirePartyPermission(account, organizationId, "matter.manage_parties");
  await requireMatter(db, account, organizationId, matterId, "matter.read");
  if (input.clientId) await requireClientInOrg(db, organizationId, input.clientId);

  return db.transaction(async (tx) => {
    const [party] = await tx
      .insert(legalMatterParties)
      .values({
        organizationId,
        legalMatterId: matterId,
        displayName: input.displayName,
        position: input.position ?? "other",
        personType: input.personType ?? "person",
        partyType: input.partyType ?? "party",
        clientId: input.clientId,
        contactId: input.contactId,
        documentNormalized: input.documentNormalized,
        roleDescription: input.roleDescription,
        isPrimary: input.isPrimary ?? false,
      })
      .returning();
    if (!party) throw new AppError("INTERNAL_ERROR", "Não foi possível adicionar a parte.");

    await appendTimeline(tx, {
      organizationId,
      legalMatterId: matterId,
      eventType: "matter.party_added",
      title: "Parte adicionada",
      body: party.displayName,
      actorMembershipId: actor.membershipId,
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "matter.party_added",
      resourceType: "legal_matter_party",
      resourceId: party.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { matterId, position: party.position },
    });
    return party;
  });
}

export async function removeMatterParty(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  partyId: string,
  meta: RequestMeta,
) {
  const actor = requirePartyPermission(account, organizationId, "matter.manage_parties");
  await requireMatter(db, account, organizationId, matterId, "matter.read");
  const party = await db.query.legalMatterParties.findFirst({
    where: and(
      eq(legalMatterParties.id, partyId),
      eq(legalMatterParties.legalMatterId, matterId),
      eq(legalMatterParties.organizationId, organizationId),
    ),
  });
  if (!party) throw new AppError("NOT_FOUND", "Não encontramos esta parte no seu acesso.");

  await db.transaction(async (tx) => {
    await tx.delete(legalMatterParties).where(eq(legalMatterParties.id, partyId));
    await appendTimeline(tx, {
      organizationId,
      legalMatterId: matterId,
      eventType: "matter.party_removed",
      title: "Parte removida",
      body: party.displayName,
      actorMembershipId: actor.membershipId,
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "matter.party_removed",
      resourceType: "legal_matter_party",
      resourceId: partyId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { matterId },
    });
  });
  return { ok: true as const };
}

export async function addMatterTeamMember(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  input: {
    membershipId: string;
    teamRole?: (typeof legalMatterTeamMembers.teamRole.enumValues)[number];
    isPrimary?: boolean;
  },
  meta: RequestMeta,
) {
  const actor = requireTeamPermission(account, organizationId, "matter.manage_team");
  await requireMatter(db, account, organizationId, matterId, "matter.read");
  await requireActiveMembershipInOrg(db, organizationId, input.membershipId);

  return db.transaction(async (tx) => {
    const existing = await tx.query.legalMatterTeamMembers.findFirst({
      where: and(
        eq(legalMatterTeamMembers.legalMatterId, matterId),
        eq(legalMatterTeamMembers.membershipId, input.membershipId),
      ),
    });
    let member: typeof legalMatterTeamMembers.$inferSelect | undefined;
    if (existing) {
      const [updated] = await tx
        .update(legalMatterTeamMembers)
        .set({
          removedAt: null,
          teamRole: input.teamRole ?? existing.teamRole,
          isPrimary: input.isPrimary ?? existing.isPrimary,
          assignedAt: new Date(),
          assignedByMembershipId: actor.membershipId,
          updatedAt: new Date(),
        })
        .where(eq(legalMatterTeamMembers.id, existing.id))
        .returning();
      member = updated;
    } else {
      const [created] = await tx
        .insert(legalMatterTeamMembers)
        .values({
          organizationId,
          legalMatterId: matterId,
          membershipId: input.membershipId,
          teamRole: input.teamRole ?? "collaborator",
          isPrimary: input.isPrimary ?? false,
          assignedByMembershipId: actor.membershipId,
        })
        .returning();
      member = created;
    }
    if (!member) throw new AppError("INTERNAL_ERROR", "Não foi possível adicionar o membro.");

    if (input.isPrimary || input.teamRole === "responsible") {
      await tx
        .update(legalMatterTeamMembers)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(
          and(
            eq(legalMatterTeamMembers.legalMatterId, matterId),
            eq(legalMatterTeamMembers.organizationId, organizationId),
            isNull(legalMatterTeamMembers.removedAt),
            sql`${legalMatterTeamMembers.id} <> ${member.id}`,
          ),
        );
      await tx
        .update(legalMatterTeamMembers)
        .set({ isPrimary: true, teamRole: input.teamRole ?? "responsible", updatedAt: new Date() })
        .where(eq(legalMatterTeamMembers.id, member.id));
      await tx
        .update(legalMatters)
        .set({ responsibleMembershipId: input.membershipId, updatedAt: new Date() })
        .where(eq(legalMatters.id, matterId));
    }

    await appendTimeline(tx, {
      organizationId,
      legalMatterId: matterId,
      eventType: "matter.team_member_added",
      title: "Membro adicionado à equipe",
      actorMembershipId: actor.membershipId,
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "matter.team_member_added",
      resourceType: "legal_matter_team",
      resourceId: member.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { matterId, membershipId: input.membershipId },
    });
    return member;
  });
}

export async function removeMatterTeamMember(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  teamMemberId: string,
  meta: RequestMeta,
) {
  const actor = requireTeamPermission(account, organizationId, "matter.manage_team");
  await requireMatter(db, account, organizationId, matterId, "matter.read");
  const member = await db.query.legalMatterTeamMembers.findFirst({
    where: and(
      eq(legalMatterTeamMembers.id, teamMemberId),
      eq(legalMatterTeamMembers.legalMatterId, matterId),
      eq(legalMatterTeamMembers.organizationId, organizationId),
    ),
  });
  if (!member || member.removedAt) {
    throw new AppError("NOT_FOUND", "Não encontramos este membro da equipe no seu acesso.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(legalMatterTeamMembers)
      .set({ removedAt: new Date(), updatedAt: new Date() })
      .where(eq(legalMatterTeamMembers.id, teamMemberId));
    await appendTimeline(tx, {
      organizationId,
      legalMatterId: matterId,
      eventType: "matter.team_member_removed",
      title: "Membro removido da equipe",
      actorMembershipId: actor.membershipId,
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "matter.team_member_removed",
      resourceType: "legal_matter_team",
      resourceId: teamMemberId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { matterId },
    });
  });
  return { ok: true as const };
}

export async function createMatterFee(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  input: {
    type: (typeof legalMatterFeeArrangements.type.enumValues)[number];
    fixedAmountCents?: number;
    percentageBasisPoints?: number;
    hourlyRateCents?: number;
    successFeeBasisPoints?: number;
    description?: string;
    status?: (typeof legalMatterFeeArrangements.status.enumValues)[number];
    effectiveFrom?: string;
    effectiveUntil?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireFeePermission(account, organizationId, "matter.manage_fees");
  await requireMatter(db, account, organizationId, matterId, "matter.read");

  return db.transaction(async (tx) => {
    const [fee] = await tx
      .insert(legalMatterFeeArrangements)
      .values({
        organizationId,
        legalMatterId: matterId,
        type: input.type,
        fixedAmountCents: input.fixedAmountCents,
        percentageBasisPoints: input.percentageBasisPoints,
        hourlyRateCents: input.hourlyRateCents,
        successFeeBasisPoints: input.successFeeBasisPoints,
        description: input.description,
        status: input.status ?? "active",
        effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : new Date(),
        effectiveUntil: input.effectiveUntil ? new Date(input.effectiveUntil) : null,
        createdByMembershipId: actor.membershipId,
      })
      .returning();
    if (!fee) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o honorário.");

    await appendTimeline(tx, {
      organizationId,
      legalMatterId: matterId,
      eventType: "matter.fee_created",
      title: "Honorários registrados",
      body: fee.type,
      actorMembershipId: actor.membershipId,
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "matter.fee_created",
      resourceType: "legal_matter_fee",
      resourceId: fee.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        matterId,
        type: fee.type,
        fixedAmountCents: fee.fixedAmountCents,
        percentageBasisPoints: fee.percentageBasisPoints,
      },
    });
    return fee;
  });
}

export async function updateMatterFee(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  feeId: string,
  input: Partial<{
    type: (typeof legalMatterFeeArrangements.type.enumValues)[number];
    fixedAmountCents: number;
    percentageBasisPoints: number;
    hourlyRateCents: number;
    successFeeBasisPoints: number;
    description: string;
    status: (typeof legalMatterFeeArrangements.status.enumValues)[number];
    effectiveFrom: string;
    effectiveUntil: string;
  }>,
  meta: RequestMeta,
) {
  const actor = requireFeePermission(account, organizationId, "matter.manage_fees");
  await requireMatter(db, account, organizationId, matterId, "matter.read");
  const fee = await db.query.legalMatterFeeArrangements.findFirst({
    where: and(
      eq(legalMatterFeeArrangements.id, feeId),
      eq(legalMatterFeeArrangements.legalMatterId, matterId),
      eq(legalMatterFeeArrangements.organizationId, organizationId),
    ),
  });
  if (!fee) throw new AppError("NOT_FOUND", "Não encontramos este arranjo de honorários.");

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(legalMatterFeeArrangements)
      .set({
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.fixedAmountCents !== undefined
          ? { fixedAmountCents: input.fixedAmountCents }
          : {}),
        ...(input.percentageBasisPoints !== undefined
          ? { percentageBasisPoints: input.percentageBasisPoints }
          : {}),
        ...(input.hourlyRateCents !== undefined ? { hourlyRateCents: input.hourlyRateCents } : {}),
        ...(input.successFeeBasisPoints !== undefined
          ? { successFeeBasisPoints: input.successFeeBasisPoints }
          : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.effectiveFrom !== undefined
          ? { effectiveFrom: new Date(input.effectiveFrom) }
          : {}),
        ...(input.effectiveUntil !== undefined
          ? { effectiveUntil: input.effectiveUntil ? new Date(input.effectiveUntil) : null }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(legalMatterFeeArrangements.id, feeId))
      .returning();
    if (!updated) throw new AppError("NOT_FOUND", "Não encontramos este arranjo de honorários.");

    await appendTimeline(tx, {
      organizationId,
      legalMatterId: matterId,
      eventType: "matter.fee_updated",
      title: "Honorários atualizados",
      actorMembershipId: actor.membershipId,
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "matter.fee_updated",
      resourceType: "legal_matter_fee",
      resourceId: feeId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { matterId, fields: Object.keys(input) },
    });
    return updated;
  });
}

export async function setMatterTags(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  tagIds: string[],
  meta: RequestMeta,
) {
  const actor = requireMatterPermission(account, organizationId, "matter.manage_tags");
  await requireMatter(db, account, organizationId, matterId, "matter.read");

  if (tagIds.length > 0) {
    const tags = await db.query.crmTags.findMany({
      where: and(eq(crmTags.organizationId, organizationId), inArray(crmTags.id, tagIds)),
    });
    if (tags.length !== tagIds.length) {
      throw new AppError("NOT_FOUND", "Uma ou mais tags não foram encontradas no seu acesso.");
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(legalMatterTags)
      .where(
        and(
          eq(legalMatterTags.legalMatterId, matterId),
          eq(legalMatterTags.organizationId, organizationId),
        ),
      );
    if (tagIds.length > 0) {
      await tx.insert(legalMatterTags).values(
        tagIds.map((tagId) => ({
          organizationId,
          legalMatterId: matterId,
          tagId,
        })),
      );
    }
    await appendTimeline(tx, {
      organizationId,
      legalMatterId: matterId,
      eventType: "matter.tags_updated",
      title: "Tags atualizadas",
      actorMembershipId: actor.membershipId,
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "matter.updated",
      resourceType: "legal_matter",
      resourceId: matterId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { tagCount: tagIds.length },
    });
  });
  return { ok: true as const, tagIds };
}

export async function listMatterTimeline(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
) {
  await requireMatter(db, account, organizationId, matterId, "matter.read");
  const events = await db.query.legalMatterTimelineEvents.findMany({
    where: and(
      eq(legalMatterTimelineEvents.legalMatterId, matterId),
      eq(legalMatterTimelineEvents.organizationId, organizationId),
    ),
    orderBy: [desc(legalMatterTimelineEvents.occurredAt)],
    limit: 200,
  });
  return {
    items: events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      title: event.title,
      body: event.body,
      occurredAt: event.occurredAt.toISOString(),
    })),
  };
}

export async function listDemandTypes(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  requireMatterPermission(account, organizationId, "matter.read");
  await ensureDemandTypesCatalog(db, organizationId);
  const items = await db.query.legalDemandTypes.findMany({
    where: eq(legalDemandTypes.organizationId, organizationId),
    orderBy: [asc(legalDemandTypes.sortOrder), asc(legalDemandTypes.name)],
  });
  return {
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      description: item.description,
      active: item.active,
      sortOrder: item.sortOrder,
      isSystem: item.isSystem,
    })),
  };
}

export async function createDemandType(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    name: string;
    slug?: string;
    description?: string;
    sortOrder?: number;
    active?: boolean;
  },
  meta: RequestMeta,
) {
  requireCatalogPermission(account, organizationId, "legal_catalog.manage");
  const slug = input.slug ?? slugifyName(input.name);
  try {
    const [created] = await db
      .insert(legalDemandTypes)
      .values({
        organizationId,
        name: input.name,
        slug,
        description: input.description,
        sortOrder: input.sortOrder ?? 100,
        active: input.active ?? true,
      })
      .returning();
    if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o tipo de demanda.");
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "legal_catalog.demand_type_created",
      resourceType: "legal_demand_type",
      resourceId: created.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { slug },
    });
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Já existe um tipo de demanda com este identificador.");
    }
    throw error;
  }
}

export async function listSubareas(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalAreaId?: string,
) {
  requireMatterPermission(account, organizationId, "matter.read");
  const filters = [eq(legalSubareas.organizationId, organizationId)];
  if (legalAreaId) filters.push(eq(legalSubareas.legalAreaId, legalAreaId));
  const items = await db.query.legalSubareas.findMany({
    where: and(...filters),
    orderBy: [asc(legalSubareas.sortOrder), asc(legalSubareas.name)],
  });
  return {
    items: items.map((item) => ({
      id: item.id,
      legalAreaId: item.legalAreaId,
      name: item.name,
      slug: item.slug,
      description: item.description,
      active: item.active,
      sortOrder: item.sortOrder,
    })),
  };
}

export async function createSubarea(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    legalAreaId: string;
    name: string;
    slug?: string;
    description?: string;
    sortOrder?: number;
    active?: boolean;
  },
  meta: RequestMeta,
) {
  requireCatalogPermission(account, organizationId, "legal_catalog.manage");
  const area = await assertLegalAreaInOrg(db, organizationId, input.legalAreaId);
  if (!area) throw new AppError("NOT_FOUND", "Não encontramos esta área jurídica no seu acesso.");
  const slug = input.slug ?? slugifyName(input.name);
  try {
    const [created] = await db
      .insert(legalSubareas)
      .values({
        organizationId,
        legalAreaId: input.legalAreaId,
        name: input.name,
        slug,
        description: input.description,
        sortOrder: input.sortOrder ?? 100,
        active: input.active ?? true,
      })
      .returning();
    if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a subárea.");
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "legal_catalog.subarea_created",
      resourceType: "legal_subarea",
      resourceId: created.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { slug, legalAreaId: input.legalAreaId },
    });
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Já existe uma subárea com este identificador nesta área.");
    }
    throw error;
  }
}

/** Compat pipeline — aliases. */
export const createCaseFromOpportunity = createMatterFromOpportunity;
export async function listCases(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number; status?: string },
) {
  return listMatters(db, account, organizationId, query);
}
export async function getCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  caseId: string,
) {
  return getMatter(db, account, organizationId, caseId);
}
