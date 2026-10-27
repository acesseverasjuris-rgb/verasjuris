import {
  createLegalComparisonSchema,
  legalComparisonListQuerySchema,
  parseInput,
  reviewLegalComparisonItemSchema,
  reviewLegalComparisonSchema,
  runLegalComparisonSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { aiModuleDeps } from "../ai/routes.js";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  createLegalComparison,
  getLegalComparison,
  listLegalComparisons,
  reviewLegalComparison,
  reviewLegalComparisonItem,
  runLegalComparison,
} from "./service.js";

type Params = {
  organizationId?: string;
  comparisonId?: string;
  itemId?: string;
};

export async function registerLegalComparisonRoutes(app: FastifyInstance, deps: ApiDeps) {
  const base = "/organizations/:organizationId/legal-comparisons";
  const org = (params: Params) => parseInput(uuidSchema, params.organizationId);
  const comparisonId = (params: Params) => parseInput(uuidSchema, params.comparisonId);

  app.post(base, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = org(request.params as Params);
    const input = parseInput(createLegalComparisonSchema, request.body);
    const result = await createLegalComparison(
      { db: deps.db, gateway: aiModuleDeps(deps).gateway },
      account,
      organizationId,
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(base, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(legalComparisonListQuerySchema, request.query ?? {});
    return listLegalComparisons(deps.db, account, org(request.params as Params), query);
  });

  app.get(`${base}/:comparisonId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getLegalComparison(deps.db, account, org(params), comparisonId(params));
  });

  app.post(`${base}/:comparisonId/run`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const body = parseInput(runLegalComparisonSchema, request.body ?? {});
    const idempotencyHeader =
      (request.headers["idempotency-key"] as string | undefined) ??
      (request.headers["x-idempotency-key"] as string | undefined);
    return runLegalComparison(
      { db: deps.db, gateway: aiModuleDeps(deps).gateway },
      account,
      org(params),
      comparisonId(params),
      { idempotencyKey: body.idempotencyKey ?? idempotencyHeader },
      meta(request),
    );
  });

  app.post(`${base}/:comparisonId/review`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(reviewLegalComparisonSchema, request.body ?? {});
    return reviewLegalComparison(
      deps.db,
      account,
      org(params),
      comparisonId(params),
      input,
      meta(request),
    );
  });

  app.post(`${base}/:comparisonId/items/:itemId/review`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(reviewLegalComparisonItemSchema, request.body);
    return reviewLegalComparisonItem(
      deps.db,
      account,
      org(params),
      comparisonId(params),
      parseInput(uuidSchema, params.itemId),
      input,
      meta(request),
    );
  });
}
