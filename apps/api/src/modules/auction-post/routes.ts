import {
  auctionBidListQuerySchema,
  auctionPostListQuerySchema,
  createAuctionAwardEventSchema,
  createAuctionAwardSchema,
  createAuctionBidRecordSchema,
  createAuctionDeliveryProcessSchema,
  createAuctionParticipationSchema,
  createAuctionPaymentSchema,
  createAuctionResultSchema,
  createAuctionTransferProcessSchema,
  linkAuctionAwardDocumentSchema,
  parseInput,
  suggestAuctionAwardDeadlinesSchema,
  suggestAuctionAwardTasksSchema,
  updateAuctionAwardSchema,
  updateAuctionDeliveryProcessSchema,
  updateAuctionParticipationSchema,
  updateAuctionPaymentSchema,
  upsertAuctionRegularizationItemSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  createAward,
  createAwardEvent,
  createBidRecord,
  createDelivery,
  createParticipation,
  createPayment,
  createResult,
  createTransfer,
  getAward,
  getAwardTimeline,
  getParticipation,
  linkAwardDocument,
  listAwardDocuments,
  listAwardEvents,
  listAwards,
  listBidRecords,
  listDeliveries,
  listParticipations,
  listPayments,
  listRegularization,
  listResults,
  listTransfers,
  placeLiveBidNotConfigured,
  suggestAwardDeadlines,
  suggestAwardTasks,
  updateAward,
  updateDelivery,
  updateParticipation,
  updatePayment,
  upsertRegularizationItem,
} from "./service.js";

type Params = {
  organizationId?: string;
  participationId?: string;
  awardId?: string;
  paymentId?: string;
  deliveryId?: string;
};

export async function registerAuctionPostRoutes(app: FastifyInstance, deps: ApiDeps) {
  const root = "/organizations/:organizationId";
  const org = (params: Params) => parseInput(uuidSchema, params.organizationId);
  const awardId = (params: Params) => parseInput(uuidSchema, params.awardId);

  /* participations */
  app.post(`${root}/auction-participations`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createAuctionParticipationSchema, request.body);
    const result = await createParticipation(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/auction-participations`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(auctionPostListQuerySchema, request.query ?? {});
    return listParticipations(deps.db, account, org(request.params as Params), query);
  });

  app.get(`${root}/auction-participations/:participationId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getParticipation(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.participationId),
    );
  });

  app.patch(`${root}/auction-participations/:participationId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updateAuctionParticipationSchema, request.body);
    return updateParticipation(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.participationId),
      input,
      meta(request),
    );
  });

  /* bids (manual/external only) */
  app.post(`${root}/auction-bids`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createAuctionBidRecordSchema, request.body);
    const result = await createBidRecord(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/auction-bids`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(auctionBidListQuerySchema, request.query ?? {});
    return listBidRecords(deps.db, account, org(request.params as Params), query);
  });

  app.post(`${root}/auction-bids/live`, async (request) => {
    const account = await requireAccount(deps, request);
    return placeLiveBidNotConfigured(deps.db, account, org(request.params as Params));
  });

  /* results */
  app.post(`${root}/auction-results`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createAuctionResultSchema, request.body);
    const result = await createResult(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/auction-results`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(auctionPostListQuerySchema, request.query ?? {});
    return listResults(deps.db, account, org(request.params as Params), query);
  });

  /* awards */
  app.post(`${root}/auction-awards`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createAuctionAwardSchema, request.body);
    const result = await createAward(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/auction-awards`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(auctionPostListQuerySchema, request.query ?? {});
    return listAwards(deps.db, account, org(request.params as Params), query);
  });

  app.get(`${root}/auction-awards/:awardId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getAward(deps.db, account, org(params), awardId(params));
  });

  app.patch(`${root}/auction-awards/:awardId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updateAuctionAwardSchema, request.body);
    return updateAward(deps.db, account, org(params), awardId(params), input, meta(request));
  });

  /* payments */
  app.post(`${root}/auction-awards/:awardId/payments`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createAuctionPaymentSchema, {
      ...(request.body as object),
      awardId: awardId(params),
    });
    const result = await createPayment(
      deps.db,
      account,
      org(params),
      awardId(params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/auction-awards/:awardId/payments`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listPayments(deps.db, account, org(params), awardId(params));
  });

  app.patch(`${root}/auction-awards/:awardId/payments/:paymentId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updateAuctionPaymentSchema, request.body);
    return updatePayment(
      deps.db,
      account,
      org(params),
      awardId(params),
      parseInput(uuidSchema, params.paymentId),
      input,
      meta(request),
    );
  });

  /* delivery */
  app.post(`${root}/auction-awards/:awardId/delivery`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createAuctionDeliveryProcessSchema, {
      ...(request.body as object),
      awardId: awardId(params),
    });
    const result = await createDelivery(
      deps.db,
      account,
      org(params),
      awardId(params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/auction-awards/:awardId/delivery`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listDeliveries(deps.db, account, org(params), awardId(params));
  });

  app.patch(`${root}/auction-awards/:awardId/delivery/:deliveryId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updateAuctionDeliveryProcessSchema, request.body);
    return updateDelivery(
      deps.db,
      account,
      org(params),
      awardId(params),
      parseInput(uuidSchema, params.deliveryId),
      input,
      meta(request),
    );
  });

  /* transfers */
  app.post(`${root}/auction-awards/:awardId/transfers`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createAuctionTransferProcessSchema, {
      ...(request.body as object),
      awardId: awardId(params),
    });
    const result = await createTransfer(
      deps.db,
      account,
      org(params),
      awardId(params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/auction-awards/:awardId/transfers`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listTransfers(deps.db, account, org(params), awardId(params));
  });

  /* events */
  app.post(`${root}/auction-awards/:awardId/events`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createAuctionAwardEventSchema, {
      ...(request.body as object),
      awardId: awardId(params),
    });
    const result = await createAwardEvent(
      deps.db,
      account,
      org(params),
      awardId(params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/auction-awards/:awardId/events`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listAwardEvents(deps.db, account, org(params), awardId(params));
  });

  /* regularization */
  app.get(`${root}/auction-awards/:awardId/regularization`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listRegularization(deps.db, account, org(params), awardId(params));
  });

  app.put(`${root}/auction-awards/:awardId/regularization`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(upsertAuctionRegularizationItemSchema, {
      ...(request.body as object),
      awardId: awardId(params),
    });
    return upsertRegularizationItem(
      deps.db,
      account,
      org(params),
      awardId(params),
      input,
      meta(request),
    );
  });

  /* documents */
  app.post(`${root}/auction-awards/:awardId/documents`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(linkAuctionAwardDocumentSchema, request.body);
    const result = await linkAwardDocument(
      deps.db,
      account,
      org(params),
      awardId(params),
      input,
      meta(request),
    );
    return reply.status(result.replayed ? 200 : 201).send(result);
  });

  app.get(`${root}/auction-awards/:awardId/documents`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listAwardDocuments(deps.db, account, org(params), awardId(params));
  });

  /* timeline */
  app.get(`${root}/auction-awards/:awardId/timeline`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getAwardTimeline(deps.db, account, org(params), awardId(params));
  });

  /* human-triggered suggestions */
  app.post(`${root}/auction-awards/:awardId/suggest-tasks`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(suggestAuctionAwardTasksSchema, request.body ?? {});
    const result = await suggestAwardTasks(
      deps.db,
      account,
      org(params),
      awardId(params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/auction-awards/:awardId/suggest-deadlines`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(suggestAuctionAwardDeadlinesSchema, request.body);
    const result = await suggestAwardDeadlines(
      {
        db: deps.db,
        notifications: deps.notifications,
        holidays: deps.holidays,
      },
      account,
      org(params),
      awardId(params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });
}
