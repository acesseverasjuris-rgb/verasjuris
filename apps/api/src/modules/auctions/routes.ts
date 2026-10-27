import {
  analyzeAuctionNoticeSchema,
  auctionCostEstimateSchema,
  auctionInterestListQuerySchema,
  auctionListQuerySchema,
  compareAuctionLotsSchema,
  createAuctionAlertRuleSchema,
  createAuctionBidRuleSchema,
  createAuctionEncumbranceSchema,
  createAuctioneerSchema,
  createAuctionEventSchema,
  createAuctionLotWithDetailsSchema,
  createAuctionSchema,
  getOrCreateAuctionDueDiligenceSchema,
  linkAuctionDocumentSchema,
  parseInput,
  updateAuctionDueDiligenceSchema,
  updateAuctionLotWithDetailsSchema,
  updateAuctionSchema,
  upsertAuctionInterestSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  analyzeAuctionNotice,
  compareLots,
  createAlertRule,
  createAuction,
  createAuctioneer,
  createBidRules,
  createEncumbrance,
  createEvent,
  createLot,
  deleteAlert,
  estimateCost,
  getAuction,
  getAuctionProviderStatus,
  getLot,
  getOrCreateDueDiligence,
  linkDocument,
  listAlerts,
  listAuctions,
  listDocuments,
  listEncumbrances,
  listInterests,
  listLots,
  placeBidStub,
  removeInterest,
  syncAuctions,
  updateAuction,
  updateDueDiligence,
  updateLot,
  upsertInterest,
  type AuctionModuleDeps,
} from "./service.js";

type Params = {
  organizationId?: string;
  auctionId?: string;
  lotId?: string;
  interestId?: string;
  alertId?: string;
  itemId?: string;
};

export function auctionModuleDeps(deps: ApiDeps): AuctionModuleDeps {
  if (!deps.auctionProvider || !deps.auctionBidProvider) {
    throw new Error("auctionProvider/auctionBidProvider não configurados em ApiDeps.");
  }
  return {
    auctionProvider: deps.auctionProvider,
    auctionBidProvider: deps.auctionBidProvider,
    aiGateway: deps.aiGateway,
  };
}

export async function registerAuctionRoutes(app: FastifyInstance, deps: ApiDeps) {
  const org = (params: Params) => parseInput(uuidSchema, params.organizationId);
  const auctionId = (params: Params) => parseInput(uuidSchema, params.auctionId);
  const lotId = (params: Params) => parseInput(uuidSchema, params.lotId);
  const root = "/organizations/:organizationId";
  const base = `${root}/auctions`;
  const moduleDeps = () => auctionModuleDeps(deps);

  /* rotas estáticas (antes de /:auctionId) */
  app.get(`${root}/auction-provider/status`, async (request) => {
    const account = await requireAccount(deps, request);
    return getAuctionProviderStatus(account, org(request.params as Params), moduleDeps());
  });

  app.post(`${root}/auction-provider/sync`, async (request) => {
    const account = await requireAccount(deps, request);
    return syncAuctions(
      deps.db,
      account,
      org(request.params as Params),
      moduleDeps(),
      meta(request),
    );
  });

  app.post(`${base}/compare`, async (request) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(compareAuctionLotsSchema, request.body ?? {});
    return compareLots(deps.db, account, org(request.params as Params), input.lotIds);
  });

  app.post(`${base}/estimate-cost`, async (request) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(auctionCostEstimateSchema, request.body ?? {});
    return estimateCost(deps.db, account, org(request.params as Params), input);
  });

  app.post(`${base}/analyze-notice`, async (request) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(analyzeAuctionNoticeSchema, request.body ?? {});
    return analyzeAuctionNotice(
      deps.db,
      account,
      org(request.params as Params),
      input,
      moduleDeps(),
      meta(request),
    );
  });

  /* interesses / alertas / due diligence */
  app.get(`${root}/auction-interests`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(auctionInterestListQuerySchema, request.query ?? {});
    return listInterests(deps.db, account, org(request.params as Params), query);
  });

  app.delete(`${root}/auction-interests/:interestId`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    await removeInterest(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.interestId),
      meta(request),
    );
    return reply.status(204).send();
  });

  app.get(`${root}/auction-alerts`, async (request) => {
    const account = await requireAccount(deps, request);
    return listAlerts(deps.db, account, org(request.params as Params));
  });

  app.post(`${root}/auction-alerts`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createAuctionAlertRuleSchema, request.body);
    const result = await createAlertRule(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.delete(`${root}/auction-alerts/:alertId`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    await deleteAlert(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.alertId),
      meta(request),
    );
    return reply.status(204).send();
  });

  app.post(`${root}/auction-due-diligence`, async (request) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(getOrCreateAuctionDueDiligenceSchema, request.body);
    return getOrCreateDueDiligence(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
  });

  app.patch(`${root}/auction-due-diligence/:itemId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updateAuctionDueDiligenceSchema, request.body ?? {});
    return updateDueDiligence(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.itemId),
      input,
      meta(request),
    );
  });

  app.post(`${root}/auctioneers`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createAuctioneerSchema, request.body);
    const result = await createAuctioneer(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  /* leilões */
  app.get(base, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(auctionListQuerySchema, request.query ?? {});
    return listAuctions(deps.db, account, org(request.params as Params), query);
  });

  app.post(base, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createAuctionSchema, request.body);
    const result = await createAuction(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${base}/:auctionId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getAuction(deps.db, account, org(params), auctionId(params));
  });

  app.patch(`${base}/:auctionId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updateAuctionSchema, request.body);
    return updateAuction(deps.db, account, org(params), auctionId(params), input, meta(request));
  });

  app.post(`${base}/:auctionId/events`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createAuctionEventSchema, request.body);
    const result = await createEvent(
      deps.db,
      account,
      org(params),
      auctionId(params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${base}/:auctionId/lots`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listLots(deps.db, account, org(params), auctionId(params));
  });

  app.post(`${base}/:auctionId/lots`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createAuctionLotWithDetailsSchema, request.body);
    const result = await createLot(
      deps.db,
      account,
      org(params),
      auctionId(params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${base}/:auctionId/bid-rules`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createAuctionBidRuleSchema, request.body ?? {});
    const result = await createBidRules(
      deps.db,
      account,
      org(params),
      auctionId(params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.put(`${base}/:auctionId/interest`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(upsertAuctionInterestSchema, request.body ?? {});
    return upsertInterest(deps.db, account, org(params), auctionId(params), input, meta(request));
  });

  app.get(`${base}/:auctionId/documents`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const query = request.query as { lotId?: string };
    return listDocuments(
      deps.db,
      account,
      org(params),
      auctionId(params),
      query.lotId ? parseInput(uuidSchema, query.lotId) : undefined,
    );
  });

  app.post(`${base}/:auctionId/documents`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(linkAuctionDocumentSchema, request.body);
    const result = await linkDocument(
      deps.db,
      account,
      org(params),
      auctionId(params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  /**
   * Lance eletrônico: se chamado, retorna NOT_CONFIGURED.
   * A API nunca afirma que o usuário está dando lance.
   */
  app.post(`${base}/:auctionId/bid`, async (request) => {
    const account = await requireAccount(deps, request);
    return placeBidStub(account, org(request.params as Params), moduleDeps());
  });

  /* lotes */
  app.get(`${root}/auction-lots/:lotId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getLot(deps.db, account, org(params), lotId(params));
  });

  app.patch(`${root}/auction-lots/:lotId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updateAuctionLotWithDetailsSchema, request.body);
    return updateLot(deps.db, account, org(params), lotId(params), input, meta(request));
  });

  app.get(`${root}/auction-lots/:lotId/encumbrances`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listEncumbrances(deps.db, account, org(params), lotId(params));
  });

  app.post(`${root}/auction-lots/:lotId/encumbrances`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createAuctionEncumbranceSchema, request.body);
    const result = await createEncumbrance(
      deps.db,
      account,
      org(params),
      lotId(params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });
}
