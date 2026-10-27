import { recordAudit } from "@verasjuris/audit";
import {
  assertOpportunityStageTransition,
  nextActionForStage,
  policyAnalysis,
  policyEngagement,
  policyPipeline,
  policyProposal,
  type OpportunityStage,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  crmAnalyses,
  crmEngagements,
  crmIntakes,
  crmInteractions,
  crmLeads,
  crmLossReasons,
  crmOpportunities,
  crmProposals,
  crmTriages,
  legalAreas,
  legalMatters,
  organizationMembers,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, sql } from "drizzle-orm";
import type { RequestMeta } from "../auth/service.js";
import { convertLead, listTimeline } from "../crm/service.js";
import { createMatterFromOpportunity, getMatter, listMatters } from "../matters/service.js";
import { ensureLossReasonsCatalog } from "./catalog.js";

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

function requirePipelinePermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyPipeline>[1],
) {
  const decision = policyPipeline(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function requireAnalysisPermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyAnalysis>[1],
) {
  const decision = policyAnalysis(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function requireProposalPermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyProposal>[1],
) {
  const decision = policyProposal(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function requireEngagementPermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyEngagement>[1],
) {
  const decision = policyEngagement(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

async function requireActiveMembershipInOrg(
  db: AppDatabase,
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
    throw new AppError(
      "VALIDATION_ERROR",
      "O responsável precisa ser um participante ativo desta organização.",
    );
  }
}

async function assertLeadInOrg(db: AppDatabase, organizationId: string, leadId: string) {
  const row = await db.query.crmLeads.findFirst({
    where: and(eq(crmLeads.id, leadId), eq(crmLeads.organizationId, organizationId)),
    columns: { id: true, name: true },
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");
  return row;
}

async function assertIntakeInOrg(db: AppDatabase, organizationId: string, intakeId: string) {
  const row = await db.query.crmIntakes.findFirst({
    where: and(eq(crmIntakes.id, intakeId), eq(crmIntakes.organizationId, organizationId)),
    columns: { id: true, leadId: true },
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este atendimento no seu acesso.");
  return row;
}

async function assertLegalAreaInOrg(
  db: AppDatabase,
  organizationId: string,
  legalAreaId: string | undefined | null,
) {
  if (!legalAreaId) return;
  const row = await db.query.legalAreas.findFirst({
    where: and(eq(legalAreas.organizationId, organizationId), eq(legalAreas.id, legalAreaId)),
    columns: { id: true },
  });
  if (!row) {
    throw new AppError(
      "VALIDATION_ERROR",
      "A área jurídica informada não pertence à organização ativa.",
      [{ path: "legalAreaId", message: "Área jurídica inválida para esta organização." }],
    );
  }
}

async function requireOpportunity(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
  permission: Parameters<typeof policyPipeline>[1] = "pipeline.read",
) {
  requirePipelinePermission(account, organizationId, permission);
  const opportunity = await db.query.crmOpportunities.findFirst({
    where: and(
      eq(crmOpportunities.id, opportunityId),
      eq(crmOpportunities.organizationId, organizationId),
    ),
  });
  if (!opportunity) throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");
  return opportunity;
}

async function requireProposal(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  proposalId: string,
  permission: Parameters<typeof policyProposal>[1] = "proposal.read",
) {
  requireProposalPermission(account, organizationId, permission);
  const proposal = await db.query.crmProposals.findFirst({
    where: and(eq(crmProposals.id, proposalId), eq(crmProposals.organizationId, organizationId)),
  });
  if (!proposal) throw new AppError("NOT_FOUND", "Não encontramos esta proposta no seu acesso.");
  return proposal;
}

function mapOpportunitySummary(opportunity: {
  id: string;
  title: string;
  stage: string;
  status: string;
  leadId: string | null;
  intakeId: string | null;
  clientId: string | null;
  caseId: string | null;
  legalAreaId: string | null;
  responsibleMembershipId: string | null;
  estimatedValueCents: number | null;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  lostAt: Date | null;
  archivedAt: Date | null;
  wonAt: Date | null;
}) {
  return {
    id: opportunity.id,
    title: opportunity.title,
    stage: opportunity.stage,
    status: opportunity.status,
    leadId: opportunity.leadId,
    intakeId: opportunity.intakeId,
    clientId: opportunity.clientId,
    caseId: opportunity.caseId,
    legalAreaId: opportunity.legalAreaId,
    responsibleMembershipId: opportunity.responsibleMembershipId,
    estimatedValueCents: opportunity.estimatedValueCents,
    currency: opportunity.currency,
    lostAt: opportunity.lostAt?.toISOString() ?? null,
    archivedAt: opportunity.archivedAt?.toISOString() ?? null,
    wonAt: opportunity.wonAt?.toISOString() ?? null,
    createdAt: opportunity.createdAt.toISOString(),
    updatedAt: opportunity.updatedAt.toISOString(),
  };
}

async function buildNextActionContext(
  db: AppDatabase,
  organizationId: string,
  opportunity: {
    stage: string;
    intakeId: string | null;
    triageId: string | null;
    clientId: string | null;
    caseId: string | null;
    id: string;
  },
) {
  const analysis = await db.query.crmAnalyses.findFirst({
    where: and(
      eq(crmAnalyses.opportunityId, opportunity.id),
      eq(crmAnalyses.organizationId, organizationId),
    ),
    columns: { status: true },
  });
  const proposals = await db.query.crmProposals.findMany({
    where: and(
      eq(crmProposals.opportunityId, opportunity.id),
      eq(crmProposals.organizationId, organizationId),
    ),
    orderBy: [desc(crmProposals.version)],
    limit: 1,
    columns: { status: true },
  });
  const engagement = await db.query.crmEngagements.findFirst({
    where: and(
      eq(crmEngagements.opportunityId, opportunity.id),
      eq(crmEngagements.organizationId, organizationId),
    ),
    columns: { status: true },
  });
  let triageStatus: string | null = null;
  if (opportunity.triageId) {
    const triage = await db.query.crmTriages.findFirst({
      where: eq(crmTriages.id, opportunity.triageId),
      columns: { status: true },
    });
    triageStatus = triage?.status ?? null;
  } else if (opportunity.intakeId) {
    const triage = await db.query.crmTriages.findFirst({
      where: and(
        eq(crmTriages.intakeId, opportunity.intakeId),
        eq(crmTriages.organizationId, organizationId),
      ),
      columns: { status: true },
    });
    triageStatus = triage?.status ?? null;
  }
  const hasTriageReady = triageStatus === "ready_for_analysis" || triageStatus === "reviewed";
  const latestProposal = proposals[0];
  return nextActionForStage(opportunity.stage as OpportunityStage, {
    hasIntake: Boolean(opportunity.intakeId),
    hasTriageReady,
    hasAnalysisCompleted: analysis?.status === "completed",
    hasProposal: proposals.length > 0,
    proposalStatus: latestProposal?.status ?? null,
    hasEngagementActive: engagement?.status === "active",
    hasClient: Boolean(opportunity.clientId),
    hasCase: Boolean(opportunity.caseId),
  });
}

export async function listLossReasons(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  requirePipelinePermission(account, organizationId, "pipeline.read");
  await ensureLossReasonsCatalog(db, organizationId);
  const reasons = await db.query.crmLossReasons.findMany({
    where: and(eq(crmLossReasons.organizationId, organizationId), eq(crmLossReasons.active, true)),
    orderBy: [asc(crmLossReasons.sortOrder), asc(crmLossReasons.name)],
  });
  return reasons.map((reason) => ({
    id: reason.id,
    slug: reason.slug,
    name: reason.name,
    sortOrder: reason.sortOrder,
  }));
}

type OpportunityListQuery = {
  q?: string;
  stage?: string;
  status?: string;
  legalAreaId?: string;
  responsibleMembershipId?: string;
  sourceId?: string;
  channelId?: string;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
  sort: "createdAt" | "updatedAt" | "title";
  order: "asc" | "desc";
};

function opportunityListFilters(query: OpportunityListQuery, organizationId: string) {
  const filters = [eq(crmOpportunities.organizationId, organizationId)];
  if (query.stage) {
    filters.push(
      eq(crmOpportunities.stage, query.stage as (typeof crmOpportunities.stage.enumValues)[number]),
    );
  }
  if (query.status) {
    filters.push(
      eq(
        crmOpportunities.status,
        query.status as (typeof crmOpportunities.status.enumValues)[number],
      ),
    );
  }
  if (query.legalAreaId) filters.push(eq(crmOpportunities.legalAreaId, query.legalAreaId));
  if (query.responsibleMembershipId) {
    filters.push(eq(crmOpportunities.responsibleMembershipId, query.responsibleMembershipId));
  }
  if (query.from) filters.push(gte(crmOpportunities.createdAt, new Date(query.from)));
  if (query.to) filters.push(lte(crmOpportunities.createdAt, new Date(query.to)));
  if (query.q) {
    const term = `%${query.q}%`;
    filters.push(ilike(crmOpportunities.title, term));
  }
  return filters;
}

async function applyLeadSourceChannelFilters(
  db: AppDatabase,
  organizationId: string,
  query: OpportunityListQuery,
  filters: ReturnType<typeof opportunityListFilters>,
) {
  if (!query.sourceId && !query.channelId) return filters;
  const leadFilters = [eq(crmLeads.organizationId, organizationId)];
  if (query.sourceId) leadFilters.push(eq(crmLeads.sourceId, query.sourceId));
  if (query.channelId) leadFilters.push(eq(crmLeads.channelId, query.channelId));
  const matchingLeads = await db.query.crmLeads.findMany({
    where: and(...leadFilters),
    columns: { id: true },
  });
  const leadIds = matchingLeads.map((lead) => lead.id);
  if (leadIds.length === 0) return null;
  filters.push(inArray(crmOpportunities.leadId, leadIds));
  return filters;
}

export async function listOpportunities(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: OpportunityListQuery,
) {
  requirePipelinePermission(account, organizationId, "pipeline.read");
  let filters = opportunityListFilters(query, organizationId);
  const withLeadFilter = await applyLeadSourceChannelFilters(db, organizationId, query, filters);
  if (withLeadFilter === null) {
    return { items: [], total: 0, limit: query.limit, offset: query.offset };
  }
  filters = withLeadFilter;

  const orderColumn =
    query.sort === "title"
      ? crmOpportunities.title
      : query.sort === "createdAt"
        ? crmOpportunities.createdAt
        : crmOpportunities.updatedAt;
  const orderBy = query.order === "asc" ? asc(orderColumn) : desc(orderColumn);
  const where = and(...filters);
  const [totalRow] = await db.select({ value: count() }).from(crmOpportunities).where(where);
  const items = await db.query.crmOpportunities.findMany({
    where,
    orderBy: [orderBy],
    limit: query.limit,
    offset: query.offset,
  });
  return {
    items: items.map(mapOpportunitySummary),
    total: totalRow?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function boardOpportunities(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: Omit<OpportunityListQuery, "stage" | "limit" | "offset">,
) {
  requirePipelinePermission(account, organizationId, "pipeline.read");
  const listQuery: OpportunityListQuery = { ...query, limit: 500, offset: 0 };
  let filters = opportunityListFilters(listQuery, organizationId);
  const withLeadFilter = await applyLeadSourceChannelFilters(
    db,
    organizationId,
    listQuery,
    filters,
  );
  if (withLeadFilter === null) {
    return {
      stages: {
        lead: [],
        intake: [],
        triage: [],
        analysis: [],
        proposal: [],
        contracting: [],
        client: [],
        case: [],
      },
    };
  }
  filters = withLeadFilter;
  filters.push(
    sql`${crmOpportunities.stage} not in ('lost', 'archived')`,
    eq(crmOpportunities.status, "active"),
  );
  const items = await db.query.crmOpportunities.findMany({
    where: and(...filters),
    orderBy: [desc(crmOpportunities.updatedAt)],
    limit: 500,
  });
  const stages = {
    lead: [] as ReturnType<typeof mapOpportunitySummary>[],
    intake: [] as ReturnType<typeof mapOpportunitySummary>[],
    triage: [] as ReturnType<typeof mapOpportunitySummary>[],
    analysis: [] as ReturnType<typeof mapOpportunitySummary>[],
    proposal: [] as ReturnType<typeof mapOpportunitySummary>[],
    contracting: [] as ReturnType<typeof mapOpportunitySummary>[],
    client: [] as ReturnType<typeof mapOpportunitySummary>[],
    case: [] as ReturnType<typeof mapOpportunitySummary>[],
  };
  for (const item of items) {
    const summary = mapOpportunitySummary(item);
    const key = item.stage as keyof typeof stages;
    if (key in stages) stages[key].push(summary);
  }
  return { stages };
}

export async function createOpportunity(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    title: string;
    leadId?: string;
    intakeId?: string;
    legalAreaId?: string;
    responsibleMembershipId?: string;
    estimatedValueCents?: number;
    currency?: string;
  },
  meta: RequestMeta,
) {
  const actor = requirePipelinePermission(account, organizationId, "pipeline.manage");
  let title = input.title;
  let leadId = input.leadId;

  if (input.leadId) {
    const lead = await assertLeadInOrg(db, organizationId, input.leadId);
    title = input.title || lead.name;
  }
  if (input.intakeId) {
    const intake = await assertIntakeInOrg(db, organizationId, input.intakeId);
    if (!leadId && intake.leadId) leadId = intake.leadId;
  }
  await assertLegalAreaInOrg(db, organizationId, input.legalAreaId);

  if (input.responsibleMembershipId) {
    if (input.responsibleMembershipId !== actor.membershipId) {
      requirePipelinePermission(account, organizationId, "pipeline.manage");
    }
    await requireActiveMembershipInOrg(db, organizationId, input.responsibleMembershipId);
  }

  const [opportunity] = await db
    .insert(crmOpportunities)
    .values({
      organizationId,
      title,
      leadId,
      intakeId: input.intakeId,
      legalAreaId: input.legalAreaId,
      responsibleMembershipId: input.responsibleMembershipId ?? actor.membershipId,
      estimatedValueCents: input.estimatedValueCents,
      currency: input.currency ?? "BRL",
      stage: "lead",
      status: "active",
      createdByMembershipId: actor.membershipId,
    })
    .returning();
  if (!opportunity) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a oportunidade.");

  await db.insert(crmInteractions).values({
    organizationId,
    resourceType: "opportunity",
    resourceId: opportunity.id,
    type: "status_change",
    origin: "system",
    title: "Oportunidade criada",
    body: `Etapa inicial: ${opportunity.stage}`,
    actorUserId: account.user.id,
  });

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "pipeline.created",
    resourceType: "crm_opportunity",
    resourceId: opportunity.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { stage: opportunity.stage, title: opportunity.title },
  });

  return getOpportunity(db, account, organizationId, opportunity.id);
}

export async function getOpportunity(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
) {
  requirePipelinePermission(account, organizationId, "pipeline.read");
  const opportunity = await db.query.crmOpportunities.findFirst({
    where: and(
      eq(crmOpportunities.id, opportunityId),
      eq(crmOpportunities.organizationId, organizationId),
    ),
    with: {
      lead: true,
      intake: true,
      triage: true,
      client: true,
      legalArea: true,
      lossReason: true,
    },
  });
  if (!opportunity) throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");

  const analysis = await db.query.crmAnalyses.findFirst({
    where: and(
      eq(crmAnalyses.opportunityId, opportunityId),
      eq(crmAnalyses.organizationId, organizationId),
    ),
  });
  const proposals = await db.query.crmProposals.findMany({
    where: and(
      eq(crmProposals.opportunityId, opportunityId),
      eq(crmProposals.organizationId, organizationId),
    ),
    orderBy: [desc(crmProposals.version)],
    limit: 5,
  });
  const engagement = await db.query.crmEngagements.findFirst({
    where: and(
      eq(crmEngagements.opportunityId, opportunityId),
      eq(crmEngagements.organizationId, organizationId),
    ),
  });
  const legalCase = opportunity.caseId
    ? await db.query.legalMatters.findFirst({
        where: and(
          eq(legalMatters.id, opportunity.caseId),
          eq(legalMatters.organizationId, organizationId),
        ),
      })
    : null;

  const nextAction = await buildNextActionContext(db, organizationId, opportunity);

  return {
    ...mapOpportunitySummary(opportunity),
    lossReasonId: opportunity.lossReasonId,
    lossNotes: opportunity.lossNotes,
    archiveReason: opportunity.archiveReason,
    triageId: opportunity.triageId,
    lead: opportunity.lead
      ? {
          id: opportunity.lead.id,
          name: opportunity.lead.name,
          email: opportunity.lead.email,
          phone: opportunity.lead.phone,
          status: opportunity.lead.status,
        }
      : null,
    intake: opportunity.intake
      ? {
          id: opportunity.intake.id,
          title: opportunity.intake.title,
          status: opportunity.intake.status,
        }
      : null,
    triage: opportunity.triage
      ? {
          id: opportunity.triage.id,
          status: opportunity.triage.status,
          summary: opportunity.triage.summary,
        }
      : null,
    client: opportunity.client
      ? {
          id: opportunity.client.id,
          fullName: opportunity.client.fullName,
          legalName: opportunity.client.legalName,
          status: opportunity.client.status,
        }
      : null,
    legalArea: opportunity.legalArea
      ? {
          id: opportunity.legalArea.id,
          name: opportunity.legalArea.name,
          slug: opportunity.legalArea.slug,
        }
      : null,
    analysis: analysis
      ? {
          id: analysis.id,
          status: analysis.status,
          summary: analysis.summary,
          reviewedAt: analysis.reviewedAt?.toISOString() ?? null,
        }
      : null,
    proposals: proposals.map((proposal) => ({
      id: proposal.id,
      version: proposal.version,
      title: proposal.title,
      status: proposal.status,
      priceCents: proposal.priceCents,
      currency: proposal.currency,
      sentAt: proposal.sentAt?.toISOString() ?? null,
      acceptedAt: proposal.acceptedAt?.toISOString() ?? null,
    })),
    engagement: engagement
      ? {
          id: engagement.id,
          status: engagement.status,
          clientId: engagement.clientId,
          effectiveAt: engagement.effectiveAt?.toISOString() ?? null,
        }
      : null,
    case: legalCase
      ? {
          id: legalCase.id,
          title: legalCase.title,
          status: legalCase.status,
        }
      : null,
    nextAction,
  };
}

export async function updateOpportunity(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
  input: {
    title?: string;
    intakeId?: string | null;
    legalAreaId?: string | null;
    responsibleMembershipId?: string | null;
    estimatedValueCents?: number | null;
    currency?: string;
  },
  meta: RequestMeta,
) {
  requirePipelinePermission(account, organizationId, "pipeline.manage");
  const current = await requireOpportunity(
    db,
    account,
    organizationId,
    opportunityId,
    "pipeline.manage",
  );

  if (input.intakeId) await assertIntakeInOrg(db, organizationId, input.intakeId);
  await assertLegalAreaInOrg(db, organizationId, input.legalAreaId);
  if (input.responsibleMembershipId) {
    await requireActiveMembershipInOrg(db, organizationId, input.responsibleMembershipId);
  }

  const [updated] = await db
    .update(crmOpportunities)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.intakeId !== undefined ? { intakeId: input.intakeId } : {}),
      ...(input.legalAreaId !== undefined ? { legalAreaId: input.legalAreaId } : {}),
      ...(input.responsibleMembershipId !== undefined
        ? { responsibleMembershipId: input.responsibleMembershipId }
        : {}),
      ...(input.estimatedValueCents !== undefined
        ? { estimatedValueCents: input.estimatedValueCents }
        : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(crmOpportunities.id, opportunityId),
        eq(crmOpportunities.organizationId, organizationId),
      ),
    )
    .returning();
  if (!updated) throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");

  if (input.intakeId && input.intakeId !== current.intakeId) {
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "pipeline.intake_linked",
      resourceType: "crm_opportunity",
      resourceId: opportunityId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { intakeId: input.intakeId },
    });
  } else {
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "pipeline.updated",
      resourceType: "crm_opportunity",
      resourceId: opportunityId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
  }

  return getOpportunity(db, account, organizationId, opportunityId);
}

export async function linkIntake(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
  intakeId: string,
  meta: RequestMeta,
) {
  return updateOpportunity(db, account, organizationId, opportunityId, { intakeId }, meta);
}

async function assertStagePreconditions(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunity: typeof crmOpportunities.$inferSelect,
  targetStage: OpportunityStage,
  meta: RequestMeta,
): Promise<Partial<typeof crmOpportunities.$inferInsert>> {
  const patch: Partial<typeof crmOpportunities.$inferInsert> = {};

  switch (targetStage) {
    case "intake": {
      if (!opportunity.intakeId) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Vincule um atendimento antes de avançar para a etapa de intake.",
          [{ path: "intakeId", message: "Informe um atendimento válido." }],
        );
      }
      await assertIntakeInOrg(db, organizationId, opportunity.intakeId);
      break;
    }
    case "triage": {
      if (!opportunity.intakeId) {
        throw new AppError(
          "VALIDATION_ERROR",
          "É necessário um atendimento vinculado para avançar à triagem.",
        );
      }
      const triage = await db.query.crmTriages.findFirst({
        where: and(
          eq(crmTriages.intakeId, opportunity.intakeId),
          eq(crmTriages.organizationId, organizationId),
        ),
      });
      if (!triage || (triage.status !== "ready_for_analysis" && triage.status !== "reviewed")) {
        throw new AppError(
          "CONFLICT",
          "A triagem precisa estar pronta para análise ou revisada antes de avançar.",
        );
      }
      patch.triageId = triage.id;
      break;
    }
    case "analysis": {
      const analysis = await db.query.crmAnalyses.findFirst({
        where: and(
          eq(crmAnalyses.opportunityId, opportunity.id),
          eq(crmAnalyses.organizationId, organizationId),
        ),
      });
      if (!analysis || analysis.status !== "completed") {
        throw new AppError(
          "CONFLICT",
          "Conclua a análise antes de avançar para a etapa de análise.",
        );
      }
      break;
    }
    case "proposal": {
      const [countRow] = await db
        .select({ value: count() })
        .from(crmProposals)
        .where(
          and(
            eq(crmProposals.opportunityId, opportunity.id),
            eq(crmProposals.organizationId, organizationId),
          ),
        );
      if ((countRow?.value ?? 0) < 1) {
        throw new AppError(
          "CONFLICT",
          "Crie ao menos uma proposta antes de avançar para a etapa de proposta.",
        );
      }
      break;
    }
    case "contracting": {
      const accepted = await db.query.crmProposals.findFirst({
        where: and(
          eq(crmProposals.opportunityId, opportunity.id),
          eq(crmProposals.organizationId, organizationId),
          eq(crmProposals.status, "accepted"),
        ),
      });
      const engagement = await db.query.crmEngagements.findFirst({
        where: and(
          eq(crmEngagements.opportunityId, opportunity.id),
          eq(crmEngagements.organizationId, organizationId),
        ),
      });
      if (!accepted && !engagement) {
        throw new AppError(
          "CONFLICT",
          "É necessária uma proposta aceita ou contratação iniciada para avançar.",
        );
      }
      break;
    }
    case "client": {
      if (!opportunity.clientId) {
        if (!opportunity.leadId) {
          throw new AppError(
            "VALIDATION_ERROR",
            "Vincule um cliente ou um lead convertível antes de avançar.",
          );
        }
        const { clientId } = await convertLead(
          db,
          account,
          organizationId,
          opportunity.leadId,
          meta,
        );
        patch.clientId = clientId;
      }
      break;
    }
    case "case": {
      if (!opportunity.caseId) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Abra um caso jurídico antes de avançar para a etapa de caso.",
          [{ path: "caseId", message: "Crie um caso vinculado à oportunidade." }],
        );
      }
      break;
    }
    default:
      break;
  }

  return patch;
}

export async function moveOpportunity(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
  input: { stage: OpportunityStage },
  meta: RequestMeta,
) {
  requirePipelinePermission(account, organizationId, "pipeline.move");
  const current = await requireOpportunity(
    db,
    account,
    organizationId,
    opportunityId,
    "pipeline.move",
  );

  if (input.stage === "lost" || input.stage === "archived") {
    throw new AppError(
      "VALIDATION_ERROR",
      "Use os endpoints dedicados para marcar perda ou arquivar a oportunidade.",
      [{ path: "stage", message: "Etapa inválida para este endpoint." }],
    );
  }

  assertOpportunityStageTransition(current.stage as OpportunityStage, input.stage);

  const preconditionPatch = await assertStagePreconditions(
    db,
    account,
    organizationId,
    current,
    input.stage,
    meta,
  );

  const [updated] = await db
    .update(crmOpportunities)
    .set({
      stage: input.stage,
      ...preconditionPatch,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(crmOpportunities.id, opportunityId),
        eq(crmOpportunities.organizationId, organizationId),
      ),
    )
    .returning();
  if (!updated) throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");

  await db.insert(crmInteractions).values({
    organizationId,
    resourceType: "opportunity",
    resourceId: opportunityId,
    type: "status_change",
    origin: "system",
    title: "Etapa alterada",
    body: `${current.stage} → ${updated.stage}`,
    actorUserId: account.user.id,
  });

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "pipeline.moved",
    resourceType: "crm_opportunity",
    resourceId: opportunityId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    before: { stage: current.stage },
    after: { stage: updated.stage },
  });

  return getOpportunity(db, account, organizationId, opportunityId);
}

export async function loseOpportunity(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
  input: { lossReasonId: string; lossNotes?: string },
  meta: RequestMeta,
) {
  requirePipelinePermission(account, organizationId, "pipeline.manage");
  const current = await requireOpportunity(
    db,
    account,
    organizationId,
    opportunityId,
    "pipeline.manage",
  );

  const reason = await db.query.crmLossReasons.findFirst({
    where: and(
      eq(crmLossReasons.id, input.lossReasonId),
      eq(crmLossReasons.organizationId, organizationId),
      eq(crmLossReasons.active, true),
    ),
  });
  if (!reason) {
    throw new AppError("VALIDATION_ERROR", "O motivo de perda informado não é válido.", [
      { path: "lossReasonId", message: "Escolha um motivo de perda da organização." },
    ]);
  }

  assertOpportunityStageTransition(current.stage as OpportunityStage, "lost");

  const [updated] = await db
    .update(crmOpportunities)
    .set({
      stage: "lost",
      status: "lost",
      lossReasonId: input.lossReasonId,
      lossNotes: input.lossNotes,
      lostAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(crmOpportunities.id, opportunityId),
        eq(crmOpportunities.organizationId, organizationId),
      ),
    )
    .returning();
  if (!updated) throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");

  await db.insert(crmInteractions).values({
    organizationId,
    resourceType: "opportunity",
    resourceId: opportunityId,
    type: "status_change",
    origin: "system",
    title: "Oportunidade perdida",
    body: reason.name,
    actorUserId: account.user.id,
  });

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "pipeline.lost",
    resourceType: "crm_opportunity",
    resourceId: opportunityId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { lossReasonId: input.lossReasonId, stage: "lost" },
  });

  return getOpportunity(db, account, organizationId, opportunityId);
}

export async function archiveOpportunity(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
  input: { archiveReason?: string },
  meta: RequestMeta,
) {
  requirePipelinePermission(account, organizationId, "pipeline.manage");
  const current = await requireOpportunity(
    db,
    account,
    organizationId,
    opportunityId,
    "pipeline.manage",
  );

  assertOpportunityStageTransition(current.stage as OpportunityStage, "archived");

  const [updated] = await db
    .update(crmOpportunities)
    .set({
      stage: "archived",
      status: "archived",
      archiveReason: input.archiveReason,
      archivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(crmOpportunities.id, opportunityId),
        eq(crmOpportunities.organizationId, organizationId),
      ),
    )
    .returning();
  if (!updated) throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");

  await db.insert(crmInteractions).values({
    organizationId,
    resourceType: "opportunity",
    resourceId: opportunityId,
    type: "status_change",
    origin: "system",
    title: "Oportunidade arquivada",
    body: input.archiveReason ?? "Arquivada manualmente.",
    actorUserId: account.user.id,
  });

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "pipeline.archived",
    resourceType: "crm_opportunity",
    resourceId: opportunityId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { stage: "archived" },
  });

  return getOpportunity(db, account, organizationId, opportunityId);
}

export async function restoreOpportunity(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
  meta: RequestMeta,
) {
  requirePipelinePermission(account, organizationId, "pipeline.manage");
  const current = await requireOpportunity(
    db,
    account,
    organizationId,
    opportunityId,
    "pipeline.manage",
  );

  if (current.stage !== "archived" && current.stage !== "lost") {
    throw new AppError(
      "CONFLICT",
      "Somente oportunidades arquivadas ou perdidas podem ser restauradas.",
    );
  }

  assertOpportunityStageTransition(current.stage as OpportunityStage, "lead");

  const [updated] = await db
    .update(crmOpportunities)
    .set({
      stage: "lead",
      status: "active",
      archivedAt: null,
      archiveReason: null,
      lostAt: null,
      lossReasonId: null,
      lossNotes: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(crmOpportunities.id, opportunityId),
        eq(crmOpportunities.organizationId, organizationId),
      ),
    )
    .returning();
  if (!updated) throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");

  await db.insert(crmInteractions).values({
    organizationId,
    resourceType: "opportunity",
    resourceId: opportunityId,
    type: "status_change",
    origin: "system",
    title: "Oportunidade restaurada",
    body: `${current.stage} → lead`,
    actorUserId: account.user.id,
  });

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "pipeline.restored",
    resourceType: "crm_opportunity",
    resourceId: opportunityId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    before: { stage: current.stage },
    after: { stage: "lead" },
  });

  return getOpportunity(db, account, organizationId, opportunityId);
}

export async function getAnalysis(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
) {
  requireAnalysisPermission(account, organizationId, "analysis.read");
  await requireOpportunity(db, account, organizationId, opportunityId, "pipeline.read");
  const analysis = await db.query.crmAnalyses.findFirst({
    where: and(
      eq(crmAnalyses.opportunityId, opportunityId),
      eq(crmAnalyses.organizationId, organizationId),
    ),
  });
  if (!analysis) throw new AppError("NOT_FOUND", "Não encontramos análise para esta oportunidade.");
  return {
    id: analysis.id,
    opportunityId: analysis.opportunityId,
    summary: analysis.summary,
    feasibilityNotes: analysis.feasibilityNotes,
    riskNotes: analysis.riskNotes,
    missingInformation: analysis.missingInformation,
    recommendedNextStep: analysis.recommendedNextStep,
    responsibleMembershipId: analysis.responsibleMembershipId,
    status: analysis.status,
    reviewedAt: analysis.reviewedAt?.toISOString() ?? null,
    createdAt: analysis.createdAt.toISOString(),
    updatedAt: analysis.updatedAt.toISOString(),
  };
}

export async function upsertAnalysis(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
  input: {
    summary?: string;
    feasibilityNotes?: string;
    riskNotes?: string;
    missingInformation?: string;
    recommendedNextStep?: string;
    status?: "draft" | "in_review" | "completed";
  },
  meta: RequestMeta,
) {
  const actor = requireAnalysisPermission(account, organizationId, "analysis.manage");
  const opportunity = await requireOpportunity(
    db,
    account,
    organizationId,
    opportunityId,
    "pipeline.read",
  );
  const existing = await db.query.crmAnalyses.findFirst({
    where: and(
      eq(crmAnalyses.opportunityId, opportunityId),
      eq(crmAnalyses.organizationId, organizationId),
    ),
  });

  const completing = input.status === "completed";
  const wasTriage = opportunity.stage === "triage";

  if (!existing) {
    const [analysis] = await db
      .insert(crmAnalyses)
      .values({
        organizationId,
        opportunityId,
        summary: input.summary,
        feasibilityNotes: input.feasibilityNotes,
        riskNotes: input.riskNotes,
        missingInformation: input.missingInformation,
        recommendedNextStep: input.recommendedNextStep,
        status: input.status ?? "draft",
        responsibleMembershipId: actor.membershipId,
        createdByMembershipId: actor.membershipId,
        ...(completing ? { reviewedAt: new Date() } : {}),
      })
      .returning();
    if (!analysis) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a análise.");

    if (completing && wasTriage) {
      await db
        .update(crmOpportunities)
        .set({ stage: "analysis", updatedAt: new Date() })
        .where(eq(crmOpportunities.id, opportunityId));
    }

    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: completing ? "analysis.completed" : "analysis.created",
      resourceType: "crm_analysis",
      resourceId: analysis.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { status: analysis.status },
    });

    return getAnalysis(db, account, organizationId, opportunityId);
  }

  const [updated] = await db
    .update(crmAnalyses)
    .set({
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      ...(input.feasibilityNotes !== undefined ? { feasibilityNotes: input.feasibilityNotes } : {}),
      ...(input.riskNotes !== undefined ? { riskNotes: input.riskNotes } : {}),
      ...(input.missingInformation !== undefined
        ? { missingInformation: input.missingInformation }
        : {}),
      ...(input.recommendedNextStep !== undefined
        ? { recommendedNextStep: input.recommendedNextStep }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(completing && existing.status !== "completed" ? { reviewedAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(crmAnalyses.id, existing.id), eq(crmAnalyses.organizationId, organizationId)))
    .returning();
  if (!updated) throw new AppError("NOT_FOUND", "Não encontramos análise para esta oportunidade.");

  if (completing && wasTriage) {
    await db
      .update(crmOpportunities)
      .set({ stage: "analysis", updatedAt: new Date() })
      .where(eq(crmOpportunities.id, opportunityId));
  }

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: completing ? "analysis.completed" : "analysis.updated",
    resourceType: "crm_analysis",
    resourceId: existing.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    before: { status: existing.status },
    after: { status: updated.status },
  });

  return getAnalysis(db, account, organizationId, opportunityId);
}

export async function listProposals(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
) {
  requireProposalPermission(account, organizationId, "proposal.read");
  await requireOpportunity(db, account, organizationId, opportunityId, "pipeline.read");
  const proposals = await db.query.crmProposals.findMany({
    where: and(
      eq(crmProposals.opportunityId, opportunityId),
      eq(crmProposals.organizationId, organizationId),
    ),
    orderBy: [desc(crmProposals.version)],
  });
  return proposals.map((proposal) => ({
    id: proposal.id,
    version: proposal.version,
    title: proposal.title,
    scope: proposal.scope,
    exclusions: proposal.exclusions,
    priceCents: proposal.priceCents,
    currency: proposal.currency,
    paymentTerms: proposal.paymentTerms,
    validityUntil: proposal.validityUntil?.toISOString() ?? null,
    status: proposal.status,
    sentAt: proposal.sentAt?.toISOString() ?? null,
    acceptedAt: proposal.acceptedAt?.toISOString() ?? null,
    rejectedAt: proposal.rejectedAt?.toISOString() ?? null,
    createdAt: proposal.createdAt.toISOString(),
  }));
}

const IMMUTABLE_PROPOSAL_STATUSES = new Set(["sent", "accepted", "rejected"]);

export async function createProposal(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
  input: {
    title: string;
    scope?: string;
    exclusions?: string;
    priceCents?: number;
    currency?: string;
    paymentTerms?: string;
    validityUntil?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireProposalPermission(account, organizationId, "proposal.create");
  const opportunity = await requireOpportunity(
    db,
    account,
    organizationId,
    opportunityId,
    "pipeline.read",
  );

  const latest = await db.query.crmProposals.findFirst({
    where: and(
      eq(crmProposals.opportunityId, opportunityId),
      eq(crmProposals.organizationId, organizationId),
    ),
    orderBy: [desc(crmProposals.version)],
  });

  let version = 1;
  if (latest) {
    if (IMMUTABLE_PROPOSAL_STATUSES.has(latest.status)) {
      version = latest.version + 1;
    } else {
      throw new AppError(
        "CONFLICT",
        "Já existe um rascunho em andamento. Atualize a proposta atual ou aguarde conclusão do ciclo.",
      );
    }
  }

  const [proposal] = await db
    .insert(crmProposals)
    .values({
      organizationId,
      opportunityId,
      leadId: opportunity.leadId,
      clientId: opportunity.clientId,
      version,
      title: input.title,
      scope: input.scope,
      exclusions: input.exclusions,
      priceCents: input.priceCents ?? 0,
      currency: input.currency ?? "BRL",
      paymentTerms: input.paymentTerms,
      validityUntil: input.validityUntil ? new Date(input.validityUntil) : undefined,
      status: "draft",
      createdByMembershipId: actor.membershipId,
    })
    .returning();
  if (!proposal) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a proposta.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "proposal.created",
    resourceType: "crm_proposal",
    resourceId: proposal.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { version: proposal.version, status: proposal.status },
  });

  return proposal;
}

export async function updateProposal(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  proposalId: string,
  input: {
    title?: string;
    scope?: string;
    exclusions?: string;
    priceCents?: number;
    currency?: string;
    paymentTerms?: string;
    validityUntil?: string;
  },
  meta: RequestMeta,
) {
  requireProposalPermission(account, organizationId, "proposal.create");
  const current = await requireProposal(db, account, organizationId, proposalId, "proposal.create");

  if (current.status !== "draft" && current.status !== "internal_review") {
    throw new AppError(
      "CONFLICT",
      "Somente propostas em rascunho ou revisão interna podem ser editadas.",
    );
  }

  const [updated] = await db
    .update(crmProposals)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.scope !== undefined ? { scope: input.scope } : {}),
      ...(input.exclusions !== undefined ? { exclusions: input.exclusions } : {}),
      ...(input.priceCents !== undefined ? { priceCents: input.priceCents } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.paymentTerms !== undefined ? { paymentTerms: input.paymentTerms } : {}),
      ...(input.validityUntil !== undefined
        ? { validityUntil: input.validityUntil ? new Date(input.validityUntil) : null }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(crmProposals.id, proposalId), eq(crmProposals.organizationId, organizationId)))
    .returning();
  if (!updated) throw new AppError("NOT_FOUND", "Não encontramos esta proposta no seu acesso.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "proposal.updated",
    resourceType: "crm_proposal",
    resourceId: proposalId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });

  return updated;
}

export async function approveProposal(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  proposalId: string,
  meta: RequestMeta,
) {
  const actor = requireProposalPermission(account, organizationId, "proposal.approve");
  const current = await requireProposal(
    db,
    account,
    organizationId,
    proposalId,
    "proposal.approve",
  );

  if (current.status !== "draft" && current.status !== "internal_review") {
    throw new AppError(
      "CONFLICT",
      "Somente propostas em rascunho ou revisão interna podem ser aprovadas.",
    );
  }

  const [updated] = await db
    .update(crmProposals)
    .set({
      status: "approved",
      approvedByMembershipId: actor.membershipId,
      updatedAt: new Date(),
    })
    .where(and(eq(crmProposals.id, proposalId), eq(crmProposals.organizationId, organizationId)))
    .returning();
  if (!updated) throw new AppError("NOT_FOUND", "Não encontramos esta proposta no seu acesso.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "proposal.approved",
    resourceType: "crm_proposal",
    resourceId: proposalId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { status: "approved" },
  });

  return updated;
}

export async function sendProposal(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  proposalId: string,
  meta: RequestMeta,
) {
  requireProposalPermission(account, organizationId, "proposal.send");
  const current = await requireProposal(db, account, organizationId, proposalId, "proposal.send");

  if (current.status !== "approved") {
    throw new AppError("CONFLICT", "Somente propostas aprovadas podem ser enviadas.");
  }

  const [updated] = await db
    .update(crmProposals)
    .set({
      status: "sent",
      sentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(crmProposals.id, proposalId), eq(crmProposals.organizationId, organizationId)))
    .returning();
  if (!updated) throw new AppError("NOT_FOUND", "Não encontramos esta proposta no seu acesso.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "proposal.sent",
    resourceType: "crm_proposal",
    resourceId: proposalId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { status: "sent" },
  });

  return updated;
}

export async function acceptProposal(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  proposalId: string,
  meta: RequestMeta,
) {
  const actor = requireProposalPermission(account, organizationId, "proposal.send");
  const current = await requireProposal(db, account, organizationId, proposalId, "proposal.send");

  if (current.status === "accepted") {
    throw new AppError("CONFLICT", "Esta proposta já foi aceita. Nenhuma alteração adicional.");
  }
  if (current.status !== "sent") {
    throw new AppError("CONFLICT", "Somente propostas enviadas podem ser aceitas.");
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(crmProposals)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(crmProposals.id, proposalId),
          eq(crmProposals.organizationId, organizationId),
          eq(crmProposals.status, "sent"),
        ),
      )
      .returning();
    if (!updated) {
      const again = await tx.query.crmProposals.findFirst({
        where: eq(crmProposals.id, proposalId),
      });
      if (again?.status === "accepted") {
        throw new AppError("CONFLICT", "Esta proposta já foi aceita. Nenhuma alteração adicional.");
      }
      throw new AppError("CONFLICT", "Não foi possível aceitar a proposta.");
    }

    const existingEngagement = await tx.query.crmEngagements.findFirst({
      where: and(
        eq(crmEngagements.opportunityId, current.opportunityId),
        eq(crmEngagements.organizationId, organizationId),
      ),
    });
    if (!existingEngagement) {
      const opportunity = await tx.query.crmOpportunities.findFirst({
        where: eq(crmOpportunities.id, current.opportunityId),
      });
      await tx.insert(crmEngagements).values({
        organizationId,
        opportunityId: current.opportunityId,
        proposalId,
        clientId: opportunity?.clientId,
        status: "pending",
        acceptedAt: new Date(),
        createdByMembershipId: actor.membershipId,
      });
    }

    await tx
      .update(crmOpportunities)
      .set({ stage: "contracting", updatedAt: new Date() })
      .where(eq(crmOpportunities.id, current.opportunityId));

    await tx.insert(crmInteractions).values({
      organizationId,
      resourceType: "opportunity",
      resourceId: current.opportunityId,
      type: "status_change",
      origin: "system",
      title: "Proposta aceita",
      body: `Proposta v${updated.version} aceita.`,
      actorUserId: account.user.id,
    });

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "proposal.accepted",
      resourceType: "crm_proposal",
      resourceId: proposalId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { status: "accepted", opportunityId: current.opportunityId },
    });

    return updated;
  });
}

export async function rejectProposal(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  proposalId: string,
  meta: RequestMeta,
) {
  requireProposalPermission(account, organizationId, "proposal.send");
  const current = await requireProposal(db, account, organizationId, proposalId, "proposal.send");

  if (current.status !== "sent") {
    throw new AppError("CONFLICT", "Somente propostas enviadas podem ser rejeitadas.");
  }

  const [updated] = await db
    .update(crmProposals)
    .set({
      status: "rejected",
      rejectedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(crmProposals.id, proposalId), eq(crmProposals.organizationId, organizationId)))
    .returning();
  if (!updated) throw new AppError("NOT_FOUND", "Não encontramos esta proposta no seu acesso.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "proposal.rejected",
    resourceType: "crm_proposal",
    resourceId: proposalId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { status: "rejected" },
  });

  return updated;
}

export async function getEngagement(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
) {
  requireEngagementPermission(account, organizationId, "engagement.read");
  await requireOpportunity(db, account, organizationId, opportunityId, "pipeline.read");
  const engagement = await db.query.crmEngagements.findFirst({
    where: and(
      eq(crmEngagements.opportunityId, opportunityId),
      eq(crmEngagements.organizationId, organizationId),
    ),
  });
  if (!engagement) {
    throw new AppError("NOT_FOUND", "Não encontramos contratação para esta oportunidade.");
  }
  return {
    id: engagement.id,
    opportunityId: engagement.opportunityId,
    proposalId: engagement.proposalId,
    clientId: engagement.clientId,
    status: engagement.status,
    contractReference: engagement.contractReference,
    acceptedAt: engagement.acceptedAt?.toISOString() ?? null,
    effectiveAt: engagement.effectiveAt?.toISOString() ?? null,
    closedAt: engagement.closedAt?.toISOString() ?? null,
    createdAt: engagement.createdAt.toISOString(),
  };
}

export async function createEngagement(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
  input: { proposalId?: string; contractReference?: string },
  meta: RequestMeta,
) {
  const actor = requireEngagementPermission(account, organizationId, "engagement.manage");
  const opportunity = await requireOpportunity(
    db,
    account,
    organizationId,
    opportunityId,
    "pipeline.read",
  );

  const existing = await db.query.crmEngagements.findFirst({
    where: and(
      eq(crmEngagements.opportunityId, opportunityId),
      eq(crmEngagements.organizationId, organizationId),
    ),
  });
  if (existing) {
    throw new AppError("CONFLICT", "Esta oportunidade já possui uma contratação registrada.");
  }

  if (input.proposalId) {
    const proposal = await db.query.crmProposals.findFirst({
      where: and(
        eq(crmProposals.id, input.proposalId),
        eq(crmProposals.organizationId, organizationId),
        eq(crmProposals.opportunityId, opportunityId),
      ),
    });
    if (!proposal) {
      throw new AppError(
        "VALIDATION_ERROR",
        "A proposta informada não pertence a esta oportunidade.",
      );
    }
  }

  const [engagement] = await db
    .insert(crmEngagements)
    .values({
      organizationId,
      opportunityId,
      proposalId: input.proposalId,
      clientId: opportunity.clientId,
      contractReference: input.contractReference,
      status: "pending",
      createdByMembershipId: actor.membershipId,
    })
    .returning();
  if (!engagement)
    throw new AppError("INTERNAL_ERROR", "Não foi possível registrar a contratação.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "engagement.created",
    resourceType: "crm_engagement",
    resourceId: engagement.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { status: engagement.status },
  });

  return getEngagement(db, account, organizationId, opportunityId);
}

export async function activateEngagement(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
  meta: RequestMeta,
) {
  requireEngagementPermission(account, organizationId, "engagement.manage");
  const opportunity = await requireOpportunity(
    db,
    account,
    organizationId,
    opportunityId,
    "pipeline.read",
  );

  const engagement = await db.query.crmEngagements.findFirst({
    where: and(
      eq(crmEngagements.opportunityId, opportunityId),
      eq(crmEngagements.organizationId, organizationId),
    ),
  });
  if (!engagement) {
    throw new AppError("NOT_FOUND", "Não encontramos contratação para esta oportunidade.");
  }

  if (engagement.status === "active") {
    return getEngagement(db, account, organizationId, opportunityId);
  }

  let clientId = opportunity.clientId ?? engagement.clientId;
  if (!clientId && opportunity.leadId) {
    const { clientId: convertedId } = await convertLead(
      db,
      account,
      organizationId,
      opportunity.leadId,
      meta,
    );
    clientId = convertedId;
  }

  return db.transaction(async (tx) => {
    if (!clientId) {
      throw new AppError(
        "VALIDATION_ERROR",
        "É necessário um cliente vinculado para ativar a contratação.",
      );
    }

    const [updatedEngagement] = await tx
      .update(crmEngagements)
      .set({
        status: "active",
        clientId,
        effectiveAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(crmEngagements.id, engagement.id))
      .returning();
    if (!updatedEngagement) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível ativar a contratação.");
    }

    await tx
      .update(crmOpportunities)
      .set({
        stage: "client",
        clientId,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(crmOpportunities.id, opportunityId));

    await tx.insert(crmInteractions).values({
      organizationId,
      resourceType: "opportunity",
      resourceId: opportunityId,
      type: "status_change",
      origin: "system",
      title: "Contratação ativada",
      body: `Cliente ${clientId}`,
      actorUserId: account.user.id,
    });

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "engagement.activated",
      resourceType: "crm_engagement",
      resourceId: engagement.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { status: "active", clientId },
    });

    return {
      id: updatedEngagement.id,
      opportunityId: updatedEngagement.opportunityId,
      proposalId: updatedEngagement.proposalId,
      clientId: updatedEngagement.clientId,
      status: updatedEngagement.status,
      contractReference: updatedEngagement.contractReference,
      acceptedAt: updatedEngagement.acceptedAt?.toISOString() ?? null,
      effectiveAt: updatedEngagement.effectiveAt?.toISOString() ?? null,
      closedAt: updatedEngagement.closedAt?.toISOString() ?? null,
      createdAt: updatedEngagement.createdAt.toISOString(),
    };
  });
}

export async function createCaseFromOpportunity(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
  input: {
    title: string;
    summary?: string;
    legalAreaId?: string;
    responsibleMembershipId?: string;
  },
  meta: RequestMeta,
) {
  await requireOpportunity(db, account, organizationId, opportunityId, "pipeline.read");
  return createMatterFromOpportunity(db, account, organizationId, opportunityId, input, meta);
}

export async function listCases(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number; status?: string },
) {
  return listMatters(db, account, organizationId, {
    limit: query.limit,
    offset: query.offset,
    status: query.status,
  });
}

export async function getCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  caseId: string,
) {
  return getMatter(db, account, organizationId, caseId);
}

export async function listOpportunityTimeline(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
) {
  requirePipelinePermission(account, organizationId, "pipeline.read");
  return listTimeline(db, account, organizationId, "opportunity", opportunityId);
}
