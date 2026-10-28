import {
  acceptMarketplaceProposalSchema,
  createMarketplaceDeliverySchema,
  createMarketplaceRequestSchema,
  createMarketplaceReviewSchema,
  createMarketplaceServiceSchema,
  manualMarketplacePaymentSchema,
  marketplaceListQuerySchema,
  marketplaceProfessionalSearchSchema,
  openMarketplaceDisputeSchema,
  parseInput,
  patchMarketplaceProfileSchema,
  resolveMarketplaceDisputeSchema,
  reviewMarketplaceDeliverySchema,
  submitMarketplaceProposalSchema,
  updateMarketplaceServiceSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  acceptMarketplaceProposal,
  completeMarketplaceEngagement,
  createMarketplaceRequest,
  createMarketplaceReview,
  createProfessionalService,
  getMarketplaceDispute,
  getMarketplaceEngagement,
  getMarketplacePaymentStatus,
  getMarketplaceProfessional,
  getMarketplaceRequest,
  getMarketplaceRequestPreview,
  initiateMarketplaceProviderPayment,
  listMarketplaceCategories,
  listMarketplaceEngagements,
  listMarketplaceOpportunities,
  listMarketplaceProposalsForRequest,
  listMarketplaceRequests,
  listMyMarketplaceProposals,
  listMyProfessionalServices,
  openMarketplaceDispute,
  patchMarketplaceLawyerProfile,
  publishMarketplaceRequest,
  recordManualMarketplacePayment,
  resolveMarketplaceDispute,
  reviewMarketplaceDelivery,
  searchMarketplaceProfessionals,
  searchMarketplaceProfessionalsForOrg,
  submitMarketplaceDelivery,
  submitMarketplaceProposal,
  updateProfessionalService,
  type MarketplaceModuleDeps,
} from "./service.js";

type Params = {
  organizationId?: string;
  requestId?: string;
  proposalId?: string;
  engagementId?: string;
  deliveryId?: string;
  disputeId?: string;
  serviceId?: string;
  professionalUserId?: string;
};

function marketplaceDeps(deps: ApiDeps): MarketplaceModuleDeps {
  if (!deps.paymentProvider) {
    throw new Error("PaymentProvider não configurado em ApiDeps.");
  }
  return {
    paymentProvider: deps.paymentProvider,
    rateLimiter: deps.rateLimiter,
  };
}

export async function registerMarketplaceRoutes(app: FastifyInstance, deps: ApiDeps) {
  const root = "/organizations/:organizationId";
  const org = (params: Params) => parseInput(uuidSchema, params.organizationId);
  const moduleDeps = () => marketplaceDeps(deps);

  app.get("/marketplace/categories", async (request) => {
    await requireAccount(deps, request);
    return listMarketplaceCategories(deps.db);
  });

  app.get("/marketplace/professionals", async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(marketplaceProfessionalSearchSchema, request.query ?? {});
    return searchMarketplaceProfessionals(deps.db, account, query);
  });

  app.get("/marketplace/professionals/:professionalUserId", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getMarketplaceProfessional(
      deps.db,
      account,
      parseInput(uuidSchema, params.professionalUserId),
    );
  });

  app.get(`${root}/marketplace/providers/status`, async (request) => {
    const account = await requireAccount(deps, request);
    return getMarketplacePaymentStatus(account, org(request.params as Params), moduleDeps());
  });

  app.get(`${root}/marketplace/categories`, async (request) => {
    await requireAccount(deps, request);
    return listMarketplaceCategories(deps.db);
  });

  app.patch(`${root}/marketplace/profile`, async (request) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(patchMarketplaceProfileSchema, request.body ?? {});
    return patchMarketplaceLawyerProfile(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
  });

  app.get(`${root}/marketplace/professionals`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(marketplaceProfessionalSearchSchema, request.query ?? {});
    return searchMarketplaceProfessionalsForOrg(
      deps.db,
      account,
      org(request.params as Params),
      query,
    );
  });

  app.post(`${root}/marketplace/services`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createMarketplaceServiceSchema, request.body);
    const result = await createProfessionalService(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/marketplace/services/mine`, async (request) => {
    const account = await requireAccount(deps, request);
    return listMyProfessionalServices(deps.db, account, org(request.params as Params));
  });

  app.patch(`${root}/marketplace/services/:serviceId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updateMarketplaceServiceSchema, request.body ?? {});
    return updateProfessionalService(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.serviceId),
      input,
      meta(request),
    );
  });

  app.post(`${root}/marketplace/requests`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createMarketplaceRequestSchema, request.body);
    const result = await createMarketplaceRequest(
      deps.db,
      account,
      org(request.params as Params),
      input,
      moduleDeps(),
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/marketplace/requests`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(marketplaceListQuerySchema, request.query ?? {});
    return listMarketplaceRequests(deps.db, account, org(request.params as Params), {
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
  });

  app.get(`${root}/marketplace/requests/opportunities`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(marketplaceListQuerySchema, request.query ?? {});
    return listMarketplaceOpportunities(deps.db, account, org(request.params as Params), {
      limit: query.limit,
      offset: query.offset,
    });
  });

  app.get(`${root}/marketplace/requests/:requestId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getMarketplaceRequest(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.requestId),
    );
  });

  app.get(`${root}/marketplace/requests/:requestId/preview`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getMarketplaceRequestPreview(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.requestId),
    );
  });

  app.post(`${root}/marketplace/requests/:requestId/publish`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return publishMarketplaceRequest(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.requestId),
      meta(request),
    );
  });

  app.get(`${root}/marketplace/requests/:requestId/proposals`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listMarketplaceProposalsForRequest(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.requestId),
    );
  });

  app.post(`${root}/marketplace/requests/:requestId/proposals`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(submitMarketplaceProposalSchema, request.body);
    const result = await submitMarketplaceProposal(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.requestId),
      input,
      moduleDeps(),
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/marketplace/proposals/mine`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(marketplaceListQuerySchema, request.query ?? {});
    return listMyMarketplaceProposals(deps.db, account, org(request.params as Params), {
      limit: query.limit,
      offset: query.offset,
    });
  });

  app.post(`${root}/marketplace/proposals/:proposalId/accept`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(acceptMarketplaceProposalSchema, request.body ?? {});
    return acceptMarketplaceProposal(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.proposalId),
      input,
      meta(request),
    );
  });

  app.get(`${root}/marketplace/engagements`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(marketplaceListQuerySchema, request.query ?? {});
    return listMarketplaceEngagements(deps.db, account, org(request.params as Params), {
      limit: query.limit,
      offset: query.offset,
    });
  });

  app.get(`${root}/marketplace/engagements/:engagementId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getMarketplaceEngagement(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.engagementId),
    );
  });

  app.post(`${root}/marketplace/engagements/:engagementId/deliveries`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createMarketplaceDeliverySchema, request.body);
    const result = await submitMarketplaceDelivery(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.engagementId),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(
    `${root}/marketplace/engagements/:engagementId/deliveries/:deliveryId/review`,
    async (request) => {
      const account = await requireAccount(deps, request);
      const params = request.params as Params;
      const input = parseInput(reviewMarketplaceDeliverySchema, request.body);
      return reviewMarketplaceDelivery(
        deps.db,
        account,
        org(params),
        parseInput(uuidSchema, params.engagementId),
        parseInput(uuidSchema, params.deliveryId),
        input,
        meta(request),
      );
    },
  );

  app.post(`${root}/marketplace/engagements/:engagementId/complete`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return completeMarketplaceEngagement(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.engagementId),
      meta(request),
    );
  });

  app.post(`${root}/marketplace/engagements/:engagementId/disputes`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(openMarketplaceDisputeSchema, request.body);
    const result = await openMarketplaceDispute(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.engagementId),
      input,
      moduleDeps(),
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/marketplace/disputes/:disputeId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getMarketplaceDispute(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.disputeId),
    );
  });

  app.post(`${root}/marketplace/disputes/:disputeId/resolve`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(resolveMarketplaceDisputeSchema, request.body ?? {});
    return resolveMarketplaceDispute(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.disputeId),
      input,
      meta(request),
    );
  });

  app.post(`${root}/marketplace/engagements/:engagementId/reviews`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createMarketplaceReviewSchema, request.body);
    const result = await createMarketplaceReview(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.engagementId),
      input,
      moduleDeps(),
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/marketplace/engagements/:engagementId/payment/provider`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return initiateMarketplaceProviderPayment(
      account,
      org(params),
      parseInput(uuidSchema, params.engagementId),
      moduleDeps(),
    );
  });

  app.post(`${root}/marketplace/engagements/:engagementId/payment/manual`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(manualMarketplacePaymentSchema, request.body);
    return recordManualMarketplacePayment(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.engagementId),
      input,
      meta(request),
    );
  });
}
