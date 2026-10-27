import {
  createPublicOpportunityRequirementSchema,
  createPublicOpportunitySchema,
  linkPublicOpportunityDocumentSchema,
  parseInput,
  publicOpportunityInterestListQuerySchema,
  publicOpportunityListQuerySchema,
  publicOpportunityProviderSearchSchema,
  updatePublicOpportunityRequirementSchema,
  updatePublicOpportunitySchema,
  upsertPublicOpportunityInterestSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { aiModuleDeps } from "../ai/routes.js";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  archivePublicOpportunity,
  createOpportunityRequirement,
  createPublicOpportunity,
  getOpportunityProviderStatus,
  getPublicOpportunity,
  linkOpportunityDocument,
  listOpportunityDocuments,
  listOpportunityInterests,
  listOpportunityRequirements,
  listPublicOpportunities,
  removeOpportunityInterest,
  searchOpportunityProvider,
  unlinkOpportunityDocument,
  updateOpportunityRequirement,
  updatePublicOpportunity,
  upsertOpportunityInterest,
} from "./service.js";

type Params = {
  organizationId?: string;
  opportunityId?: string;
  requirementId?: string;
  linkId?: string;
};

export async function registerPublicOpportunityRoutes(app: FastifyInstance, deps: ApiDeps) {
  const org = (params: Params) => parseInput(uuidSchema, params.organizationId);
  const opp = (params: Params) => parseInput(uuidSchema, params.opportunityId);
  const root = "/organizations/:organizationId";
  const base = `${root}/public-opportunities`;

  /* provedor externo (rotas estáticas, fora de /:opportunityId) */
  app.get(`${root}/public-opportunity-provider/status`, async (request) => {
    const account = await requireAccount(deps, request);
    return getOpportunityProviderStatus(
      account,
      org(request.params as Params),
      aiModuleDeps(deps).publicOpportunities,
    );
  });

  app.post(`${root}/public-opportunity-provider/search`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(publicOpportunityProviderSearchSchema, request.body ?? {});
    return searchOpportunityProvider(
      account,
      org(request.params as Params),
      aiModuleDeps(deps).publicOpportunities,
      query,
    );
  });

  app.get(`${root}/public-opportunity-interests`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(publicOpportunityInterestListQuerySchema, request.query ?? {});
    return listOpportunityInterests(deps.db, account, org(request.params as Params), query);
  });

  app.get(base, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(publicOpportunityListQuerySchema, request.query ?? {});
    return listPublicOpportunities(deps.db, account, org(request.params as Params), query);
  });

  app.post(base, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createPublicOpportunitySchema, request.body);
    const result = await createPublicOpportunity(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${base}/:opportunityId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getPublicOpportunity(deps.db, account, org(params), opp(params));
  });

  app.patch(`${base}/:opportunityId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updatePublicOpportunitySchema, request.body);
    return updatePublicOpportunity(
      deps.db,
      account,
      org(params),
      opp(params),
      input,
      meta(request),
    );
  });

  app.delete(`${base}/:opportunityId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return archivePublicOpportunity(deps.db, account, org(params), opp(params), meta(request));
  });

  /* interesse */
  app.put(`${base}/:opportunityId/interest`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(upsertPublicOpportunityInterestSchema, request.body ?? {});
    return upsertOpportunityInterest(
      deps.db,
      account,
      org(params),
      opp(params),
      input,
      meta(request),
    );
  });

  app.delete(`${base}/:opportunityId/interest`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    await removeOpportunityInterest(deps.db, account, org(params), opp(params), meta(request));
    return reply.status(204).send();
  });

  /* requisitos */
  app.get(`${base}/:opportunityId/requirements`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listOpportunityRequirements(deps.db, account, org(params), opp(params));
  });

  app.post(`${base}/:opportunityId/requirements`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createPublicOpportunityRequirementSchema, request.body);
    const result = await createOpportunityRequirement(
      deps.db,
      account,
      org(params),
      opp(params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.patch(`${base}/:opportunityId/requirements/:requirementId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updatePublicOpportunityRequirementSchema, request.body);
    return updateOpportunityRequirement(
      deps.db,
      account,
      org(params),
      opp(params),
      parseInput(uuidSchema, params.requirementId),
      input,
      meta(request),
    );
  });

  /* documentos (document_links) */
  app.get(`${base}/:opportunityId/documents`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listOpportunityDocuments(deps.db, account, org(params), opp(params));
  });

  app.post(`${base}/:opportunityId/documents`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(linkPublicOpportunityDocumentSchema, request.body);
    const result = await linkOpportunityDocument(
      deps.db,
      account,
      org(params),
      opp(params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.delete(`${base}/:opportunityId/documents/:linkId`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    await unlinkOpportunityDocument(
      deps.db,
      account,
      org(params),
      opp(params),
      parseInput(uuidSchema, params.linkId),
      meta(request),
    );
    return reply.status(204).send();
  });
}
