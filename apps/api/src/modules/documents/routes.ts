import {
  createDocumentAclSchema,
  createDocumentFolderSchema,
  createDocumentSchema,
  documentListQuerySchema,
  parseInput,
  updateDocumentSchema,
  uploadDocumentVersionFieldsSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  addDocumentAcl,
  createDocument,
  createDocumentFolder,
  getDocument,
  getDocumentDownloadStream,
  listDocumentCategories,
  listDocuments,
  updateDocument,
  uploadDocumentVersion,
} from "./service.js";
import { runStorageReconciliation } from "./reconciliation.js";
import { readMultipartFile } from "./upload.js";

function orgId(params: { organizationId?: string }): string {
  return parseInput(uuidSchema, params.organizationId);
}

function documentId(params: { documentId?: string }): string {
  return parseInput(uuidSchema, params.documentId);
}

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

export async function registerDocumentRoutes(app: FastifyInstance, deps: ApiDeps) {
  app.get("/organizations/:organizationId/document-categories", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    const items = await listDocumentCategories(deps.db, account, organizationId);
    return { categories: items, documentCategories: items, items };
  });

  app.get("/organizations/:organizationId/documents", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    const query = parseInput(documentListQuerySchema, request.query ?? {});
    return await listDocuments(deps.db, account, organizationId, {
      ...query,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post("/organizations/:organizationId/documents", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    const input = parseInput(createDocumentSchema, request.body);
    const document = await createDocument(deps.db, account, organizationId, input, meta(request));
    return reply.status(201).send({ document });
  });

  app.get("/organizations/:organizationId/documents/:documentId", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; documentId?: string };
    return {
      document: await getDocument(deps.db, account, orgId(params), documentId(params)),
    };
  });

  app.patch("/organizations/:organizationId/documents/:documentId", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; documentId?: string };
    const input = parseInput(updateDocumentSchema, request.body);
    return {
      document: await updateDocument(
        deps.db,
        account,
        orgId(params),
        documentId(params),
        input,
        meta(request),
      ),
    };
  });

  app.post(
    "/organizations/:organizationId/documents/:documentId/versions",
    {
      config: {
        // Multipart handled by @fastify/multipart; raise limit for this route family.
      },
      bodyLimit: 50 * 1024 * 1024,
    },
    async (request, reply) => {
      const account = await requireAccount(deps, request);
      const params = request.params as { organizationId?: string; documentId?: string };
      const organizationId = orgId(params);
      const id = documentId(params);
      const moduleDeps = documentDeps(deps);
      const file = await readMultipartFile(request, moduleDeps.maxUploadBytes);
      const fields = parseInput(uploadDocumentVersionFieldsSchema, {
        idempotencyKey:
          (request.headers["idempotency-key"] as string | undefined) ??
          (request.headers["x-idempotency-key"] as string | undefined),
      });
      const result = await uploadDocumentVersion(
        deps.db,
        account,
        organizationId,
        id,
        file,
        moduleDeps,
        meta(request),
        { idempotencyKey: fields.idempotencyKey },
      );
      return reply.status(201).send(result);
    },
  );

  async function sendDownload(request: FastifyRequest, reply: FastifyReply, versionId?: string) {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      documentId?: string;
      versionId?: string;
    };
    const download = await getDocumentDownloadStream(
      deps.db,
      account,
      orgId(params),
      documentId(params),
      documentDeps(deps),
      versionId ?? (params.versionId ? parseInput(uuidSchema, params.versionId) : undefined),
    );
    reply.header("Content-Type", download.contentType);
    reply.header(
      "Content-Disposition",
      `attachment; filename="${download.filename.replace(/"/g, "")}"`,
    );
    reply.header("X-Content-Type-Options", "nosniff");
    if (download.sizeBytes != null) {
      reply.header("Content-Length", String(download.sizeBytes));
    }
    return reply.send(download.stream);
  }

  app.get("/organizations/:organizationId/documents/:documentId/download", async (request, reply) =>
    sendDownload(request, reply),
  );

  app.get(
    "/organizations/:organizationId/documents/:documentId/versions/:versionId/download",
    async (request, reply) => {
      const params = request.params as { versionId?: string };
      return sendDownload(request, reply, parseInput(uuidSchema, params.versionId));
    },
  );

  app.post("/organizations/:organizationId/document-folders", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    const input = parseInput(createDocumentFolderSchema, request.body);
    const folder = await createDocumentFolder(
      deps.db,
      account,
      organizationId,
      input,
      meta(request),
    );
    return reply.status(201).send({ folder });
  });

  app.post("/organizations/:organizationId/documents/:documentId/acl", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; documentId?: string };
    const input = parseInput(createDocumentAclSchema, request.body);
    const entry = await addDocumentAcl(
      deps.db,
      account,
      orgId(params),
      documentId(params),
      input,
      meta(request),
    );
    return reply.status(201).send({ acl: entry });
  });

  app.post("/organizations/:organizationId/documents/storage-reconciliation", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    const storage = documentDeps(deps).storage;
    return runStorageReconciliation(deps.db, account, organizationId, storage, meta(request));
  });
}
