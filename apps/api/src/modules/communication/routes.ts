import {
  communicationListQuerySchema,
  createCommunicationPreferenceSchema,
  createCommunicationTemplateSchema,
  createCommunicationTemplateVersionSchema,
  parseInput,
  sendCommunicationMessageSchema,
  updateCommunicationPreferenceSchema,
  updateCommunicationTemplateSchema,
  upsertCommunicationConsentSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  communicationModuleDeps,
  createCommunicationPreference,
  createCommunicationTemplate,
  createCommunicationTemplateVersion,
  deleteCommunicationTemplate,
  getCommunicationMessageHistory,
  getCommunicationProvidersStatus,
  getCommunicationTemplate,
  listCommunicationConsents,
  listCommunicationMessages,
  listCommunicationPreferences,
  listCommunicationTemplateVersions,
  listCommunicationTemplates,
  retryCommunicationMessage,
  sendCommunicationMessage,
  updateCommunicationPreference,
  updateCommunicationTemplate,
  upsertCommunicationConsent,
} from "./service.js";

type Params = {
  organizationId?: string;
  templateId?: string;
  preferenceId?: string;
  messageId?: string;
};

export async function registerCommunicationRoutes(app: FastifyInstance, deps: ApiDeps) {
  const root = "/organizations/:organizationId";
  const org = (params: Params) => parseInput(uuidSchema, params.organizationId);
  const moduleDeps = () =>
    communicationModuleDeps({
      communicationEmailProvider: deps.communicationEmailProvider,
      communicationSmsProvider: deps.communicationSmsProvider,
      communicationWhatsappProvider: deps.communicationWhatsappProvider,
      communicationPushProvider: deps.communicationPushProvider,
    });

  app.get(`${root}/communication/providers/status`, async (request) => {
    const account = await requireAccount(deps, request);
    return getCommunicationProvidersStatus(account, org(request.params as Params), moduleDeps());
  });

  app.get(`${root}/communication/templates`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = communicationListQuerySchema.parse(request.query ?? {});
    return listCommunicationTemplates(deps.db, account, org(request.params as Params), {
      channel: query.channel,
      limit: query.limit,
      offset: query.offset,
    });
  });

  app.post(`${root}/communication/templates`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createCommunicationTemplateSchema, request.body);
    const result = await createCommunicationTemplate(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/communication/templates/:templateId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getCommunicationTemplate(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.templateId),
    );
  });

  app.patch(`${root}/communication/templates/:templateId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updateCommunicationTemplateSchema, request.body);
    return updateCommunicationTemplate(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.templateId),
      input,
      meta(request),
    );
  });

  app.delete(`${root}/communication/templates/:templateId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return deleteCommunicationTemplate(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.templateId),
    );
  });

  app.get(`${root}/communication/templates/:templateId/versions`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listCommunicationTemplateVersions(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.templateId),
    );
  });

  app.post(`${root}/communication/templates/:templateId/versions`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const body = parseInput(createCommunicationTemplateVersionSchema, request.body);
    const result = await createCommunicationTemplateVersion(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.templateId),
      body,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/communication/preferences`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = request.query as { userId?: string };
    const userId = query.userId ? parseInput(uuidSchema, query.userId) : undefined;
    return listCommunicationPreferences(deps.db, account, org(request.params as Params), {
      userId,
    });
  });

  app.post(`${root}/communication/preferences`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createCommunicationPreferenceSchema, request.body);
    const result = await createCommunicationPreference(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.patch(`${root}/communication/preferences/:preferenceId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params & { preferenceId?: string };
    const input = parseInput(updateCommunicationPreferenceSchema, request.body);
    return updateCommunicationPreference(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.preferenceId),
      input,
      meta(request),
    );
  });

  app.get(`${root}/communication/consents`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = request.query as { subjectType?: string; subjectId?: string };
    const subjectId = query.subjectId ? parseInput(uuidSchema, query.subjectId) : undefined;
    return listCommunicationConsents(deps.db, account, org(request.params as Params), {
      subjectType: query.subjectType,
      subjectId,
    });
  });

  app.post(`${root}/communication/consents`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(upsertCommunicationConsentSchema, request.body);
    const result = await upsertCommunicationConsent(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/communication/messages`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(sendCommunicationMessageSchema, request.body);
    const result = await sendCommunicationMessage(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
      moduleDeps(),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/communication/messages`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(communicationListQuerySchema, request.query ?? {});
    return listCommunicationMessages(deps.db, account, org(request.params as Params), query);
  });

  app.get(`${root}/communication/messages/:messageId/history`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getCommunicationMessageHistory(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.messageId),
    );
  });

  app.post(`${root}/communication/messages/:messageId/retry`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return retryCommunicationMessage(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.messageId),
      meta(request),
      moduleDeps(),
    );
  });
}
