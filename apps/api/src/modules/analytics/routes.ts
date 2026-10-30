import {
  analyticsDashboardQuerySchema,
  analyticsExportListQuerySchema,
  analyticsMetricListQuerySchema,
  analyticsQuerySchema,
  createAnalyticsExportSchema,
  parseInput,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  getAnalyticsDashboard,
  listAnalyticsMetrics,
  queryAnalytics,
  type AnalyticsModuleDeps,
} from "./analytics-service.js";
import {
  createAnalyticsExport,
  getAnalyticsExport,
  listAnalyticsExports,
} from "./export-service.js";

type Params = { organizationId?: string; exportId?: string };

function analyticsDeps(deps: ApiDeps): AnalyticsModuleDeps {
  return {
    biProvider: deps.biProvider,
    warehouseProvider: deps.warehouseProvider,
  };
}

export async function registerAnalyticsRoutes(app: FastifyInstance, deps: ApiDeps) {
  const root = "/organizations/:organizationId/analytics";
  const org = (params: Params) => parseInput(uuidSchema, params.organizationId);

  app.get(`${root}/metrics`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(analyticsMetricListQuerySchema, request.query ?? {});
    return listAnalyticsMetrics(
      deps.db,
      account,
      org(request.params as Params),
      query,
      analyticsDeps(deps),
    );
  });

  app.post(`${root}/query`, async (request) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(analyticsQuerySchema, request.body);
    return queryAnalytics(
      deps.db,
      account,
      org(request.params as Params),
      input,
      analyticsDeps(deps),
      meta(request),
    );
  });

  app.get(`${root}/dashboard`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(analyticsDashboardQuerySchema, request.query ?? {});
    return getAnalyticsDashboard(
      deps.db,
      account,
      org(request.params as Params),
      query,
      analyticsDeps(deps),
    );
  });

  app.post(`${root}/export`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createAnalyticsExportSchema, request.body);
    const result = await createAnalyticsExport(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/export`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(analyticsExportListQuerySchema, request.query ?? {});
    return listAnalyticsExports(deps.db, account, org(request.params as Params), query);
  });

  app.get(`${root}/export/:exportId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getAnalyticsExport(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.exportId),
    );
  });
}
