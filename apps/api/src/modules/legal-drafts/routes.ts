import {
  confirmLegalDraftFilingSchema,
  convertLegalDraftToDocumentSchema,
  createLegalDraftSchema,
  createLegalDraftSourceSetSchema,
  createLegalDraftVersionSchema,
  exportLegalDraftQuerySchema,
  fileLegalDraftSchema,
  legalDraftAiAssistSchema,
  legalDraftListQuerySchema,
  legalDraftReasonBodySchema,
  legalDraftReviewBodySchema,
  legalDraftWorkflowTransitionSchema,
  parseInput,
  updateLegalDraftChecklistItemSchema,
  updateLegalDraftSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { aiModuleDeps } from "../ai/routes.js";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  aiAssistLegalDraft,
  approveLegalDraft,
  confirmLegalDraftFiling,
  convertLegalDraftToDocument,
  createLegalDraft,
  createLegalDraftSourceSet,
  createLegalDraftVersion,
  exportLegalDraft,
  fileLegalDraft,
  getLegalDraft,
  listLegalDrafts,
  markLegalDraftReadyToFile,
  submitLegalDraftForReview,
  transitionLegalDraftWorkflow,
  updateLegalDraft,
  updateLegalDraftChecklistItem,
} from "./service.js";

type Params = {
  organizationId?: string;
  draftId?: string;
  itemId?: string;
};

function documentDeps(deps: ApiDeps) {
  if (!deps.storage || !deps.malwareScanner) {
    throw new Error("Storage/malwareScanner não configurados em ApiDeps.");
  }
  return {
    storage: deps.storage,
    malwareScanner: deps.malwareScanner,
    maxUploadBytes: deps.documentMaxUploadBytes ?? 10 * 1024 * 1024,
  };
}

export async function registerLegalDraftRoutes(app: FastifyInstance, deps: ApiDeps) {
  const base = "/organizations/:organizationId/legal-drafts";
  const org = (params: Params) => parseInput(uuidSchema, params.organizationId);
  const draftId = (params: Params) => parseInput(uuidSchema, params.draftId);
  const itemId = (params: Params) => parseInput(uuidSchema, params.itemId);

  app.post(base, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = org(request.params as Params);
    const input = parseInput(createLegalDraftSchema, request.body);
    const result = await createLegalDraft(deps.db, account, organizationId, input, meta(request));
    return reply.status(201).send(result);
  });

  /** Alias de criação a partir de template (geração sem IA). */
  app.post(`${base}/generate`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = org(request.params as Params);
    const input = parseInput(createLegalDraftSchema, request.body);
    const result = await createLegalDraft(deps.db, account, organizationId, input, meta(request));
    return reply.status(201).send(result);
  });

  app.get(base, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(legalDraftListQuerySchema, request.query ?? {});
    return listLegalDrafts(deps.db, account, org(request.params as Params), query);
  });

  app.get(`${base}/:draftId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getLegalDraft(deps.db, account, org(params), draftId(params));
  });

  app.patch(`${base}/:draftId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updateLegalDraftSchema, request.body);
    return updateLegalDraft(deps.db, account, org(params), draftId(params), input, meta(request));
  });

  app.post(`${base}/:draftId/versions`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createLegalDraftVersionSchema, request.body ?? {});
    const result = await createLegalDraftVersion(
      deps.db,
      account,
      org(params),
      draftId(params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${base}/source-sets`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = org(request.params as Params);
    const input = parseInput(createLegalDraftSourceSetSchema, request.body);
    const result = await createLegalDraftSourceSet(
      deps.db,
      account,
      organizationId,
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${base}/:draftId/ai-assist`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const body = parseInput(legalDraftAiAssistSchema, request.body ?? {});
    const idempotencyHeader =
      (request.headers["idempotency-key"] as string | undefined) ??
      (request.headers["x-idempotency-key"] as string | undefined);
    return aiAssistLegalDraft(
      { db: deps.db, gateway: aiModuleDeps(deps).gateway },
      account,
      org(params),
      draftId(params),
      { ...body, idempotencyKey: body.idempotencyKey ?? idempotencyHeader },
      meta(request),
    );
  });

  app.post(`${base}/:draftId/review`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(legalDraftReviewBodySchema, request.body ?? {});
    return submitLegalDraftForReview(
      deps.db,
      account,
      org(params),
      draftId(params),
      input,
      meta(request),
    );
  });

  app.post(`${base}/:draftId/approve`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(legalDraftReasonBodySchema, request.body ?? {});
    return approveLegalDraft(deps.db, account, org(params), draftId(params), input, meta(request));
  });

  app.post(`${base}/:draftId/ready-to-file`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(legalDraftReasonBodySchema, request.body ?? {});
    return markLegalDraftReadyToFile(
      deps.db,
      account,
      org(params),
      draftId(params),
      input,
      meta(request),
    );
  });

  app.post(`${base}/:draftId/file`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(fileLegalDraftSchema, request.body);
    return fileLegalDraft(deps.db, account, org(params), draftId(params), input, meta(request));
  });

  app.post(`${base}/:draftId/confirm`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(confirmLegalDraftFilingSchema, request.body);
    return confirmLegalDraftFiling(
      deps.db,
      account,
      org(params),
      draftId(params),
      input,
      meta(request),
    );
  });

  app.post(`${base}/:draftId/workflow`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(legalDraftWorkflowTransitionSchema, request.body);
    return transitionLegalDraftWorkflow(
      deps.db,
      account,
      org(params),
      draftId(params),
      input,
      meta(request),
    );
  });

  app.patch(`${base}/:draftId/checklist-items/:itemId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updateLegalDraftChecklistItemSchema, request.body);
    return updateLegalDraftChecklistItem(
      deps.db,
      account,
      org(params),
      draftId(params),
      itemId(params),
      input,
      meta(request),
    );
  });

  app.post(`${base}/:draftId/convert-to-document`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const body = parseInput(convertLegalDraftToDocumentSchema, request.body ?? {});
    const result = await convertLegalDraftToDocument(
      deps.db,
      account,
      org(params),
      draftId(params),
      documentDeps(deps),
      meta(request),
      body,
    );
    return reply.status(201).send(result);
  });

  app.get(`${base}/:draftId/export`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const query = parseInput(exportLegalDraftQuerySchema, request.query ?? {});
    return exportLegalDraft(deps.db, account, org(params), draftId(params), query.format);
  });
}
