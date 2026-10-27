import {
  classifyDocumentManualSchema,
  createDocumentMetadataSchema,
  documentPagesQuerySchema,
  documentTextSearchQuerySchema,
  parseInput,
  processDocumentVersionSchema,
  reviewDocumentClassificationSchema,
  reviewDocumentMetadataSchema,
  suggestDocumentClassificationSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { aiModuleDeps } from "../ai/routes.js";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  classifyDocumentManual,
  createDocumentMetadata,
  getDocumentIntelligence,
  listDocumentMetadata,
  listVersionPages,
  processDocumentVersion,
  reviewDocumentClassification,
  reviewDocumentMetadata,
  searchDocumentText,
  suggestDocumentClassification,
  type DocumentIntelligenceDeps,
} from "./service.js";

type Params = {
  organizationId?: string;
  documentId?: string;
  versionId?: string;
  classificationId?: string;
  metadataId?: string;
};

function ids(params: Params) {
  return {
    organizationId: parseInput(uuidSchema, params.organizationId),
    documentId: parseInput(uuidSchema, params.documentId),
  };
}

function intelligenceDeps(deps: ApiDeps): DocumentIntelligenceDeps {
  if (!deps.storage) throw new Error("Storage não configurado em ApiDeps.");
  const ai = aiModuleDeps(deps);
  return { db: deps.db, storage: deps.storage, ocr: ai.ocr, gateway: ai.gateway };
}

export async function registerDocumentIntelligenceRoutes(app: FastifyInstance, deps: ApiDeps) {
  const docBase = "/organizations/:organizationId/documents/:documentId";

  app.get("/organizations/:organizationId/document-intelligence/search", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const query = parseInput(documentTextSearchQuerySchema, request.query ?? {});
    return searchDocumentText(
      deps.db,
      account,
      parseInput(uuidSchema, params.organizationId),
      query,
    );
  });

  app.get(`${docBase}/intelligence`, async (request) => {
    const account = await requireAccount(deps, request);
    const { organizationId, documentId } = ids(request.params as Params);
    return getDocumentIntelligence(deps.db, account, organizationId, documentId);
  });

  app.post(`${docBase}/versions/:versionId/process`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const { organizationId, documentId } = ids(params);
    const input = parseInput(processDocumentVersionSchema, request.body ?? {});
    const result = await processDocumentVersion(
      intelligenceDeps(deps),
      account,
      organizationId,
      documentId,
      parseInput(uuidSchema, params.versionId),
      input,
      meta(request),
    );
    return reply.status(result.reused ? 200 : 201).send(result);
  });

  app.get(`${docBase}/versions/:versionId/pages`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const { organizationId, documentId } = ids(params);
    const query = parseInput(documentPagesQuerySchema, request.query ?? {});
    return listVersionPages(
      deps.db,
      account,
      organizationId,
      documentId,
      parseInput(uuidSchema, params.versionId),
      query,
    );
  });

  app.post(`${docBase}/classification`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const { organizationId, documentId } = ids(request.params as Params);
    const input = parseInput(classifyDocumentManualSchema, request.body);
    const result = await classifyDocumentManual(
      deps.db,
      account,
      organizationId,
      documentId,
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${docBase}/classification/suggest`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const { organizationId, documentId } = ids(request.params as Params);
    const input = parseInput(suggestDocumentClassificationSchema, request.body ?? {});
    const result = await suggestDocumentClassification(
      intelligenceDeps(deps),
      account,
      organizationId,
      documentId,
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${docBase}/classification/:classificationId/review`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const { organizationId, documentId } = ids(params);
    const input = parseInput(reviewDocumentClassificationSchema, request.body);
    return reviewDocumentClassification(
      deps.db,
      account,
      organizationId,
      documentId,
      parseInput(uuidSchema, params.classificationId),
      input,
      meta(request),
    );
  });

  app.get(`${docBase}/metadata`, async (request) => {
    const account = await requireAccount(deps, request);
    const { organizationId, documentId } = ids(request.params as Params);
    return listDocumentMetadata(deps.db, account, organizationId, documentId);
  });

  app.post(`${docBase}/metadata`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const { organizationId, documentId } = ids(request.params as Params);
    const input = parseInput(createDocumentMetadataSchema, request.body);
    const result = await createDocumentMetadata(
      deps.db,
      account,
      organizationId,
      documentId,
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${docBase}/metadata/:metadataId/review`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const { organizationId, documentId } = ids(params);
    const input = parseInput(reviewDocumentMetadataSchema, request.body);
    return reviewDocumentMetadata(
      deps.db,
      account,
      organizationId,
      documentId,
      parseInput(uuidSchema, params.metadataId),
      input,
      meta(request),
    );
  });
}
