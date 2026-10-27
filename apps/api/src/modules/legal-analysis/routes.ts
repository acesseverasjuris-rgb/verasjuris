import {
  createLegalAnalysisSchema,
  legalAnalysisListQuerySchema,
  legalAnalysisSectionSchema,
  parseInput,
  reviewLegalAnalysisItemSchema,
  reviewLegalAnalysisSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { aiModuleDeps } from "../ai/routes.js";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  createLegalAnalysis,
  getLegalAnalysis,
  listLegalAnalyses,
  listLegalAnalysisVersions,
  reviewLegalAnalysis,
  reviewLegalAnalysisItem,
} from "./service.js";

type Params = { organizationId?: string; analysisId?: string; section?: string; itemId?: string };

export async function registerLegalAnalysisRoutes(app: FastifyInstance, deps: ApiDeps) {
  const base = "/organizations/:organizationId/legal-analyses";
  const org = (params: Params) => parseInput(uuidSchema, params.organizationId);
  const analysis = (params: Params) => parseInput(uuidSchema, params.analysisId);

  app.post(base, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = org(request.params as Params);
    const input = parseInput(createLegalAnalysisSchema, request.body);
    const idempotencyHeader =
      (request.headers["idempotency-key"] as string | undefined) ??
      (request.headers["x-idempotency-key"] as string | undefined);
    const result = await createLegalAnalysis(
      { db: deps.db, gateway: aiModuleDeps(deps).gateway },
      account,
      organizationId,
      { ...input, idempotencyKey: input.idempotencyKey ?? idempotencyHeader },
      meta(request),
    );
    return reply.status(result.replayed ? 200 : 201).send(result);
  });

  app.get(base, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(legalAnalysisListQuerySchema, request.query ?? {});
    return listLegalAnalyses(deps.db, account, org(request.params as Params), query);
  });

  app.get(`${base}/:analysisId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getLegalAnalysis(deps.db, account, org(params), analysis(params));
  });

  app.get(`${base}/:analysisId/versions`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listLegalAnalysisVersions(deps.db, account, org(params), analysis(params));
  });

  app.post(`${base}/:analysisId/items/:section/:itemId/review`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(reviewLegalAnalysisItemSchema, request.body);
    return reviewLegalAnalysisItem(
      deps.db,
      account,
      org(params),
      analysis(params),
      parseInput(legalAnalysisSectionSchema, params.section),
      parseInput(uuidSchema, params.itemId),
      input,
      meta(request),
    );
  });

  app.post(`${base}/:analysisId/review`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(reviewLegalAnalysisSchema, request.body ?? {});
    return reviewLegalAnalysis(
      deps.db,
      account,
      org(params),
      analysis(params),
      input,
      meta(request),
    );
  });
}
