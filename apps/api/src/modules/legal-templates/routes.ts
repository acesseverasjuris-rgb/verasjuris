import {
  createLegalTemplateSchema,
  createLegalTemplateVersionSchema,
  legalTemplateListQuerySchema,
  parseInput,
  previewLegalTemplateVersionSchema,
  updateLegalTemplateSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  activateLegalTemplateVersion,
  approveLegalTemplateVersion,
  archiveLegalTemplate,
  createLegalTemplate,
  createLegalTemplateVersion,
  duplicateSystemTemplateToOrg,
  getLegalTemplate,
  getLegalTemplateVersion,
  listLegalTemplates,
  listLegalTemplateVersions,
  previewLegalTemplateVersion,
  submitLegalTemplateVersionForReview,
  updateLegalTemplate,
} from "./service.js";

type Params = {
  organizationId?: string;
  templateId?: string;
  versionId?: string;
};

export async function registerLegalTemplateRoutes(app: FastifyInstance, deps: ApiDeps) {
  const base = "/organizations/:organizationId/legal-document-templates";
  const org = (params: Params) => parseInput(uuidSchema, params.organizationId);
  const templateId = (params: Params) => parseInput(uuidSchema, params.templateId);
  const versionId = (params: Params) => parseInput(uuidSchema, params.versionId);

  app.post(base, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = org(request.params as Params);
    const input = parseInput(createLegalTemplateSchema, request.body);
    const result = await createLegalTemplate(
      deps.db,
      account,
      organizationId,
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(base, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(legalTemplateListQuerySchema, request.query ?? {});
    return listLegalTemplates(deps.db, account, org(request.params as Params), query);
  });

  app.get(`${base}/:templateId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getLegalTemplate(deps.db, account, org(params), templateId(params));
  });

  app.patch(`${base}/:templateId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updateLegalTemplateSchema, request.body);
    return updateLegalTemplate(
      deps.db,
      account,
      org(params),
      templateId(params),
      input,
      meta(request),
    );
  });

  app.post(`${base}/:templateId/archive`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return archiveLegalTemplate(deps.db, account, org(params), templateId(params), meta(request));
  });

  app.post(`${base}/:templateId/duplicate`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const result = await duplicateSystemTemplateToOrg(
      deps.db,
      account,
      org(params),
      templateId(params),
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${base}/:templateId/versions`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createLegalTemplateVersionSchema, request.body);
    const result = await createLegalTemplateVersion(
      deps.db,
      account,
      org(params),
      templateId(params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${base}/:templateId/versions`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listLegalTemplateVersions(deps.db, account, org(params), templateId(params));
  });

  app.get(`${base}/:templateId/versions/:versionId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getLegalTemplateVersion(
      deps.db,
      account,
      org(params),
      templateId(params),
      versionId(params),
    );
  });

  app.post(`${base}/:templateId/versions/:versionId/submit-for-review`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return submitLegalTemplateVersionForReview(
      deps.db,
      account,
      org(params),
      templateId(params),
      versionId(params),
      meta(request),
    );
  });

  app.post(`${base}/:templateId/versions/:versionId/approve`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return approveLegalTemplateVersion(
      deps.db,
      account,
      org(params),
      templateId(params),
      versionId(params),
      meta(request),
    );
  });

  app.post(`${base}/:templateId/versions/:versionId/activate`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return activateLegalTemplateVersion(
      deps.db,
      account,
      org(params),
      templateId(params),
      versionId(params),
      meta(request),
    );
  });

  app.post(`${base}/:templateId/versions/:versionId/preview`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const body = parseInput(previewLegalTemplateVersionSchema, request.body ?? {});
    return previewLegalTemplateVersion(
      deps.db,
      account,
      org(params),
      templateId(params),
      versionId(params),
      body.context,
    );
  });
}
