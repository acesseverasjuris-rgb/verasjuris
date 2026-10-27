import {
  archiveOpportunitySchema,
  caseListQuerySchema,
  createCaseSchema,
  createEngagementSchema,
  createOpportunitySchema,
  createProposalSchema,
  loseOpportunitySchema,
  moveOpportunitySchema,
  opportunityListQuerySchema,
  parseInput,
  updateOpportunitySchema,
  updateProposalSchema,
  upsertAnalysisSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  activateEngagement,
  approveProposal,
  archiveOpportunity,
  acceptProposal,
  boardOpportunities,
  createCaseFromOpportunity,
  createEngagement,
  createOpportunity,
  createProposal,
  getAnalysis,
  getCase,
  getEngagement,
  getOpportunity,
  listCases,
  listLossReasons,
  listOpportunities,
  listOpportunityTimeline,
  listProposals,
  loseOpportunity,
  moveOpportunity,
  rejectProposal,
  restoreOpportunity,
  sendProposal,
  updateOpportunity,
  updateProposal,
  upsertAnalysis,
} from "./service.js";

function organizationIdFromParams(params: { organizationId?: string }): string {
  return parseInput(uuidSchema, params.organizationId);
}

export async function registerPipelineRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  app.get("/organizations/:organizationId/loss-reasons", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    return { lossReasons: await listLossReasons(deps.db, account, organizationId) };
  });

  app.get("/organizations/:organizationId/opportunities", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const query = parseInput(opportunityListQuerySchema, request.query ?? {});
    return await listOpportunities(deps.db, account, organizationId, {
      ...query,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
      sort: query.sort ?? "updatedAt",
      order: query.order ?? "desc",
    });
  });

  app.get("/organizations/:organizationId/opportunities/board", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const query = parseInput(opportunityListQuerySchema, request.query ?? {});
    return await boardOpportunities(deps.db, account, organizationId, {
      q: query.q,
      status: query.status,
      legalAreaId: query.legalAreaId,
      responsibleMembershipId: query.responsibleMembershipId,
      sourceId: query.sourceId,
      channelId: query.channelId,
      from: query.from,
      to: query.to,
      sort: query.sort ?? "updatedAt",
      order: query.order ?? "desc",
    });
  });

  app.post("/organizations/:organizationId/opportunities", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const input = parseInput(createOpportunitySchema, request.body);
    const opportunity = await createOpportunity(
      deps.db,
      account,
      organizationId,
      {
        ...input,
        currency: input.currency ?? "BRL",
      },
      meta(request),
    );
    return reply.status(201).send({ opportunity });
  });

  app.get("/organizations/:organizationId/opportunities/:opportunityId", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const params = request.params as { opportunityId?: string };
    const opportunityId = parseInput(uuidSchema, params.opportunityId);
    return { opportunity: await getOpportunity(deps.db, account, organizationId, opportunityId) };
  });

  app.patch("/organizations/:organizationId/opportunities/:opportunityId", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const params = request.params as { opportunityId?: string };
    const opportunityId = parseInput(uuidSchema, params.opportunityId);
    const input = parseInput(updateOpportunitySchema, request.body);
    const opportunity = await updateOpportunity(
      deps.db,
      account,
      organizationId,
      opportunityId,
      input,
      meta(request),
    );
    return { opportunity };
  });

  app.post("/organizations/:organizationId/opportunities/:opportunityId/move", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const params = request.params as { opportunityId?: string };
    const opportunityId = parseInput(uuidSchema, params.opportunityId);
    const input = parseInput(moveOpportunitySchema, request.body);
    const opportunity = await moveOpportunity(
      deps.db,
      account,
      organizationId,
      opportunityId,
      input,
      meta(request),
    );
    return { opportunity };
  });

  app.post("/organizations/:organizationId/opportunities/:opportunityId/lose", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const params = request.params as { opportunityId?: string };
    const opportunityId = parseInput(uuidSchema, params.opportunityId);
    const input = parseInput(loseOpportunitySchema, request.body);
    const opportunity = await loseOpportunity(
      deps.db,
      account,
      organizationId,
      opportunityId,
      input,
      meta(request),
    );
    return { opportunity };
  });

  app.post(
    "/organizations/:organizationId/opportunities/:opportunityId/archive",
    async (request) => {
      const account = await requireAccount(deps, request);
      const organizationId = organizationIdFromParams(
        request.params as { organizationId?: string },
      );
      const params = request.params as { opportunityId?: string };
      const opportunityId = parseInput(uuidSchema, params.opportunityId);
      const input = parseInput(archiveOpportunitySchema, request.body ?? {});
      const opportunity = await archiveOpportunity(
        deps.db,
        account,
        organizationId,
        opportunityId,
        input,
        meta(request),
      );
      return { opportunity };
    },
  );

  app.post(
    "/organizations/:organizationId/opportunities/:opportunityId/restore",
    async (request) => {
      const account = await requireAccount(deps, request);
      const organizationId = organizationIdFromParams(
        request.params as { organizationId?: string },
      );
      const params = request.params as { opportunityId?: string };
      const opportunityId = parseInput(uuidSchema, params.opportunityId);
      const opportunity = await restoreOpportunity(
        deps.db,
        account,
        organizationId,
        opportunityId,
        meta(request),
      );
      return { opportunity };
    },
  );

  app.get(
    "/organizations/:organizationId/opportunities/:opportunityId/analysis",
    async (request) => {
      const account = await requireAccount(deps, request);
      const organizationId = organizationIdFromParams(
        request.params as { organizationId?: string },
      );
      const params = request.params as { opportunityId?: string };
      const opportunityId = parseInput(uuidSchema, params.opportunityId);
      return { analysis: await getAnalysis(deps.db, account, organizationId, opportunityId) };
    },
  );

  app.put(
    "/organizations/:organizationId/opportunities/:opportunityId/analysis",
    async (request) => {
      const account = await requireAccount(deps, request);
      const organizationId = organizationIdFromParams(
        request.params as { organizationId?: string },
      );
      const params = request.params as { opportunityId?: string };
      const opportunityId = parseInput(uuidSchema, params.opportunityId);
      const input = parseInput(upsertAnalysisSchema, request.body ?? {});
      const analysis = await upsertAnalysis(
        deps.db,
        account,
        organizationId,
        opportunityId,
        input,
        meta(request),
      );
      return { analysis };
    },
  );

  app.get(
    "/organizations/:organizationId/opportunities/:opportunityId/proposals",
    async (request) => {
      const account = await requireAccount(deps, request);
      const organizationId = organizationIdFromParams(
        request.params as { organizationId?: string },
      );
      const params = request.params as { opportunityId?: string };
      const opportunityId = parseInput(uuidSchema, params.opportunityId);
      return { proposals: await listProposals(deps.db, account, organizationId, opportunityId) };
    },
  );

  app.post(
    "/organizations/:organizationId/opportunities/:opportunityId/proposals",
    async (request, reply) => {
      const account = await requireAccount(deps, request);
      const organizationId = organizationIdFromParams(
        request.params as { organizationId?: string },
      );
      const params = request.params as { opportunityId?: string };
      const opportunityId = parseInput(uuidSchema, params.opportunityId);
      const input = parseInput(createProposalSchema, request.body);
      const proposal = await createProposal(
        deps.db,
        account,
        organizationId,
        opportunityId,
        {
          ...input,
          priceCents: input.priceCents ?? 0,
          currency: input.currency ?? "BRL",
        },
        meta(request),
      );
      return reply.status(201).send({ proposal });
    },
  );

  app.patch("/organizations/:organizationId/proposals/:proposalId", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const params = request.params as { proposalId?: string };
    const proposalId = parseInput(uuidSchema, params.proposalId);
    const input = parseInput(updateProposalSchema, request.body);
    const proposal = await updateProposal(
      deps.db,
      account,
      organizationId,
      proposalId,
      input,
      meta(request),
    );
    return { proposal };
  });

  app.post("/organizations/:organizationId/proposals/:proposalId/approve", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const params = request.params as { proposalId?: string };
    const proposalId = parseInput(uuidSchema, params.proposalId);
    const proposal = await approveProposal(
      deps.db,
      account,
      organizationId,
      proposalId,
      meta(request),
    );
    return { proposal };
  });

  app.post("/organizations/:organizationId/proposals/:proposalId/send", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const params = request.params as { proposalId?: string };
    const proposalId = parseInput(uuidSchema, params.proposalId);
    const proposal = await sendProposal(
      deps.db,
      account,
      organizationId,
      proposalId,
      meta(request),
    );
    return { proposal };
  });

  app.post("/organizations/:organizationId/proposals/:proposalId/accept", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const params = request.params as { proposalId?: string };
    const proposalId = parseInput(uuidSchema, params.proposalId);
    const proposal = await acceptProposal(
      deps.db,
      account,
      organizationId,
      proposalId,
      meta(request),
    );
    return { proposal };
  });

  app.post("/organizations/:organizationId/proposals/:proposalId/reject", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const params = request.params as { proposalId?: string };
    const proposalId = parseInput(uuidSchema, params.proposalId);
    const proposal = await rejectProposal(
      deps.db,
      account,
      organizationId,
      proposalId,
      meta(request),
    );
    return { proposal };
  });

  app.get(
    "/organizations/:organizationId/opportunities/:opportunityId/engagement",
    async (request) => {
      const account = await requireAccount(deps, request);
      const organizationId = organizationIdFromParams(
        request.params as { organizationId?: string },
      );
      const params = request.params as { opportunityId?: string };
      const opportunityId = parseInput(uuidSchema, params.opportunityId);
      return { engagement: await getEngagement(deps.db, account, organizationId, opportunityId) };
    },
  );

  app.post(
    "/organizations/:organizationId/opportunities/:opportunityId/engagement",
    async (request, reply) => {
      const account = await requireAccount(deps, request);
      const organizationId = organizationIdFromParams(
        request.params as { organizationId?: string },
      );
      const params = request.params as { opportunityId?: string };
      const opportunityId = parseInput(uuidSchema, params.opportunityId);
      const input = parseInput(createEngagementSchema, request.body ?? {});
      const engagement = await createEngagement(
        deps.db,
        account,
        organizationId,
        opportunityId,
        input,
        meta(request),
      );
      return reply.status(201).send({ engagement });
    },
  );

  app.post(
    "/organizations/:organizationId/opportunities/:opportunityId/engagement/activate",
    async (request) => {
      const account = await requireAccount(deps, request);
      const organizationId = organizationIdFromParams(
        request.params as { organizationId?: string },
      );
      const params = request.params as { opportunityId?: string };
      const opportunityId = parseInput(uuidSchema, params.opportunityId);
      const engagement = await activateEngagement(
        deps.db,
        account,
        organizationId,
        opportunityId,
        meta(request),
      );
      return { engagement };
    },
  );

  app.post(
    "/organizations/:organizationId/opportunities/:opportunityId/case",
    async (request, reply) => {
      const account = await requireAccount(deps, request);
      const organizationId = organizationIdFromParams(
        request.params as { organizationId?: string },
      );
      const params = request.params as { opportunityId?: string };
      const opportunityId = parseInput(uuidSchema, params.opportunityId);
      const input = parseInput(createCaseSchema, request.body);
      const matter = await createCaseFromOpportunity(
        deps.db,
        account,
        organizationId,
        opportunityId,
        input,
        meta(request),
      );
      return reply.status(201).send({ matter, case: matter });
    },
  );

  app.get(
    "/organizations/:organizationId/opportunities/:opportunityId/timeline",
    async (request) => {
      const account = await requireAccount(deps, request);
      const organizationId = organizationIdFromParams(
        request.params as { organizationId?: string },
      );
      const params = request.params as { opportunityId?: string };
      const opportunityId = parseInput(uuidSchema, params.opportunityId);
      return await listOpportunityTimeline(deps.db, account, organizationId, opportunityId);
    },
  );

  app.get("/organizations/:organizationId/cases", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const query = parseInput(caseListQuerySchema, request.query ?? {});
    return await listCases(deps.db, account, organizationId, {
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      status: query.status,
    });
  });

  app.post("/organizations/:organizationId/cases", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const body = request.body as { opportunityId?: string } & Record<string, unknown>;
    const opportunityId = parseInput(uuidSchema, body.opportunityId);
    const input = parseInput(createCaseSchema, body);
    const matter = await createCaseFromOpportunity(
      deps.db,
      account,
      organizationId,
      opportunityId,
      input,
      meta(request),
    );
    return reply.status(201).send({ matter, case: matter });
  });

  app.get("/organizations/:organizationId/cases/:caseId", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const params = request.params as { caseId?: string };
    const caseId = parseInput(uuidSchema, params.caseId);
    const matter = await getCase(deps.db, account, organizationId, caseId);
    return { matter, case: matter };
  });
}
