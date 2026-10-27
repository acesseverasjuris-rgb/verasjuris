import {
  createLegalReviewSchema,
  createLegalReviewSetSchema,
  legalReviewListQuerySchema,
  legalReviewSectionSchema,
  legalReviewSetListQuerySchema,
  parseInput,
  reviewLegalReviewItemSchema,
  reviewLegalReviewSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { aiModuleDeps } from "../ai/routes.js";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  createLegalReview,
  createLegalReviewSet,
  getLegalReview,
  getLegalReviewSet,
  listLegalReviews,
  listLegalReviewSets,
  reviewLegalReview,
  reviewLegalReviewItem,
  type LegalReviewSection,
} from "./service.js";

type Params = {
  organizationId?: string;
  setId?: string;
  reviewId?: string;
  section?: string;
  itemId?: string;
};

export async function registerLegalReviewRoutes(app: FastifyInstance, deps: ApiDeps) {
  const setsBase = "/organizations/:organizationId/legal-review-sets";
  const reviewsBase = "/organizations/:organizationId/legal-reviews";
  const org = (params: Params) => parseInput(uuidSchema, params.organizationId);
  const setId = (params: Params) => parseInput(uuidSchema, params.setId);
  const reviewId = (params: Params) => parseInput(uuidSchema, params.reviewId);

  app.post(setsBase, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = org(request.params as Params);
    const input = parseInput(createLegalReviewSetSchema, request.body);
    const result = await createLegalReviewSet(
      deps.db,
      account,
      organizationId,
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(setsBase, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(legalReviewSetListQuerySchema, request.query ?? {});
    return listLegalReviewSets(deps.db, account, org(request.params as Params), query);
  });

  app.get(`${setsBase}/:setId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getLegalReviewSet(deps.db, account, org(params), setId(params));
  });

  app.post(reviewsBase, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = org(request.params as Params);
    const input = parseInput(createLegalReviewSchema, request.body);
    const idempotencyHeader =
      (request.headers["idempotency-key"] as string | undefined) ??
      (request.headers["x-idempotency-key"] as string | undefined);
    const result = await createLegalReview(
      { db: deps.db, gateway: aiModuleDeps(deps).gateway },
      account,
      organizationId,
      { ...input, idempotencyKey: input.idempotencyKey ?? idempotencyHeader },
      meta(request),
    );
    return reply.status(result.replayed ? 200 : 201).send(result);
  });

  app.get(reviewsBase, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(legalReviewListQuerySchema, request.query ?? {});
    return listLegalReviews(deps.db, account, org(request.params as Params), query);
  });

  app.get(`${reviewsBase}/:reviewId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getLegalReview(deps.db, account, org(params), reviewId(params));
  });

  app.post(`${reviewsBase}/:reviewId/review`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(reviewLegalReviewSchema, request.body ?? {});
    return reviewLegalReview(deps.db, account, org(params), reviewId(params), input, meta(request));
  });

  app.post(`${reviewsBase}/:reviewId/items/:section/:itemId/review`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(reviewLegalReviewItemSchema, request.body);
    return reviewLegalReviewItem(
      deps.db,
      account,
      org(params),
      reviewId(params),
      parseInput(legalReviewSectionSchema, params.section) as LegalReviewSection,
      parseInput(uuidSchema, params.itemId),
      input,
      meta(request),
    );
  });
}
