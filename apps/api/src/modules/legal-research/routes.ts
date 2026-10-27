import { createResearchGatewayFromEnv, type ResearchGateway } from "@verasjuris/ai";
import {
  createCaseLawRecordSchema,
  createLegalSourceSchema,
  executeLegalResearchSchema,
  legalResearchListQuerySchema,
  legalResearchRecordParamsSchema,
  linkMatterResearchSchema,
  parseInput,
  saveResearchSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  createCaseLaw,
  createLegislation,
  executeResearch,
  getLegalResearchProviderStatus,
  getResearchRecord,
  getSavedResearch,
  linkToLegalMatter,
  listCaseLaw,
  listDoctrine,
  listLegislation,
  listPrecedents,
  listResearchQueries,
  listSavedResearch,
  listSummaries,
  listThemes,
  saveResearch,
} from "./service.js";

type Params = {
  organizationId?: string;
  savedId?: string;
  sourceType?: string;
  sourceId?: string;
};

export function researchModuleDeps(deps: ApiDeps): { researchGateway: ResearchGateway } {
  return {
    researchGateway:
      deps.researchGateway ??
      createResearchGatewayFromEnv({
        LEGAL_SOURCE_PROVIDER: process.env.LEGAL_SOURCE_PROVIDER ?? "not_configured",
      }),
  };
}

export async function registerLegalResearchRoutes(app: FastifyInstance, deps: ApiDeps) {
  const org = (params: Params) => parseInput(uuidSchema, params.organizationId);
  const root = "/organizations/:organizationId";
  const base = `${root}/legal-research`;
  const gateway = () => researchModuleDeps(deps).researchGateway;

  app.get(`${base}/provider/status`, async (request) => {
    const account = await requireAccount(deps, request);
    return getLegalResearchProviderStatus(account, org(request.params as Params), gateway());
  });

  app.post(base, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(executeLegalResearchSchema, request.body ?? {});
    const result = await executeResearch(
      deps.db,
      account,
      org(request.params as Params),
      input,
      gateway(),
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(base, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(legalResearchListQuerySchema, request.query ?? {});
    return listResearchQueries(deps.db, account, org(request.params as Params), query);
  });

  /* catálogo local — rotas estáticas antes de :sourceType/:sourceId */
  app.get(`${base}/legislation`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(legalResearchListQuerySchema, request.query ?? {});
    return listLegislation(deps.db, account, org(request.params as Params), query);
  });

  app.post(`${base}/legislation`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createLegalSourceSchema, request.body);
    const result = await createLegislation(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(result.deduplicated ? 200 : 201).send(result);
  });

  app.get(`${base}/case-law`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(legalResearchListQuerySchema, request.query ?? {});
    return listCaseLaw(deps.db, account, org(request.params as Params), query);
  });

  app.post(`${base}/case-law`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createCaseLawRecordSchema, request.body);
    const result = await createCaseLaw(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(result.deduplicated ? 200 : 201).send(result);
  });

  app.get(`${base}/summaries`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(legalResearchListQuerySchema, request.query ?? {});
    return listSummaries(deps.db, account, org(request.params as Params), query);
  });

  app.get(`${base}/themes`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(legalResearchListQuerySchema, request.query ?? {});
    return listThemes(deps.db, account, org(request.params as Params), query);
  });

  app.get(`${base}/precedents`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(legalResearchListQuerySchema, request.query ?? {});
    return listPrecedents(deps.db, account, org(request.params as Params), query);
  });

  app.get(`${base}/doctrine`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(legalResearchListQuerySchema, request.query ?? {});
    return listDoctrine(deps.db, account, org(request.params as Params), query);
  });

  app.get(`${base}/saved`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(legalResearchListQuerySchema, request.query ?? {});
    return listSavedResearch(deps.db, account, org(request.params as Params), query);
  });

  app.post(`${base}/saved`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(saveResearchSchema, request.body);
    const result = await saveResearch(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${base}/saved/:savedId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getSavedResearch(deps.db, account, org(params), parseInput(uuidSchema, params.savedId));
  });

  app.get(`${base}/:sourceType/:sourceId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const parsed = parseInput(legalResearchRecordParamsSchema, {
      sourceType: params.sourceType,
      sourceId: params.sourceId,
    });
    return getResearchRecord(deps.db, account, org(params), parsed.sourceType, parsed.sourceId);
  });

  app.post(`${root}/legal-matter-research-links`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(linkMatterResearchSchema, request.body);
    const result = await linkToLegalMatter(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });
}
