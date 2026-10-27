import { CitationEngine, createResearchGatewayFromEnv, type ResearchGateway } from "@verasjuris/ai";
import {
  citationListQuerySchema,
  createCitationSchema,
  parseInput,
  uuidSchema,
  verifyCitationSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  createCitation,
  getCitation,
  listCitations,
  verifyCitation,
  type CitationsModuleDeps,
} from "./service.js";

type Params = {
  organizationId?: string;
  citationId?: string;
};

export function citationsModuleDeps(deps: ApiDeps): CitationsModuleDeps {
  const research: ResearchGateway =
    deps.researchGateway ??
    createResearchGatewayFromEnv({
      LEGAL_SOURCE_PROVIDER: process.env.LEGAL_SOURCE_PROVIDER ?? "not_configured",
    });
  return {
    researchGateway: research,
    citationEngine: deps.citationEngine ?? new CitationEngine(),
  };
}

export async function registerCitationRoutes(app: FastifyInstance, deps: ApiDeps) {
  const org = (params: Params) => parseInput(uuidSchema, params.organizationId);
  const base = "/organizations/:organizationId/citations";

  app.get(base, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(citationListQuerySchema, request.query ?? {});
    return listCitations(deps.db, account, org(request.params as Params), query);
  });

  app.post(base, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createCitationSchema, request.body);
    const result = await createCitation(
      deps.db,
      account,
      org(request.params as Params),
      input,
      citationsModuleDeps(deps),
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${base}/:citationId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getCitation(deps.db, account, org(params), parseInput(uuidSchema, params.citationId));
  });

  app.post(`${base}/:citationId/verify`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(verifyCitationSchema, request.body ?? {});
    return verifyCitation(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.citationId),
      input,
      citationsModuleDeps(deps),
      meta(request),
    );
  });
}
