import {
  clientPortalListQuerySchema,
  createClientAppointmentRequestSchema,
  createClientDocumentRequestSchema,
  createClientPaymentRecordSchema,
  createClientRequestSchema,
  createConversationThreadSchema,
  linkOrganizationClientUserSchema,
  parseInput,
  uuidSchema,
} from "@verasjuris/validation";
import { z } from "zod";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import type { UploadedFilePayload } from "../documents/upload.js";
import { createSha256Hasher } from "@verasjuris/storage";
import { AppError } from "@verasjuris/types";
import {
  portalCreateAppointmentRequest,
  portalCreateDocumentRequest,
  portalCreateMessage,
  portalCreateRequest,
  portalCreateThread,
  portalFulfillDocumentRequest,
  portalGetCase,
  portalGetMe,
  portalListAppointmentRequests,
  portalListCalendar,
  portalListCaseProcesses,
  portalListCases,
  portalListContracts,
  portalListDocumentRequests,
  portalListDocuments,
  portalListMessages,
  portalListNotifications,
  portalListPayments,
  portalListRequests,
  portalListThreads,
  portalUploadDocument,
  staffCreateDocumentRequest,
  staffCreatePaymentRecord,
  staffLinkClientUser,
  staffPatchCalendarClientVisible,
  staffPatchTimelineClientVisible,
  type ClientPortalModuleDeps,
} from "./service.js";

type OrgParams = {
  organizationId?: string;
  matterId?: string;
  threadId?: string;
  eventId?: string;
  id?: string;
};

const portalCreateClientRequestSchema = createClientRequestSchema.omit({ clientId: true });
const portalCreateAppointmentSchema = createClientAppointmentRequestSchema.omit({ clientId: true });
const portalCreateThreadSchema = createConversationThreadSchema.omit({ clientId: true });
const portalCreateDocumentRequestBodySchema = z.object({
  title: z.string().trim().min(2).max(300),
  description: z.string().trim().max(4000).optional(),
  documentKind: z.string().trim().max(80).optional(),
  legalMatterId: uuidSchema.optional(),
});
const portalUploadFieldsSchema = z.object({
  title: z.string().trim().min(2).max(300),
  ownerType: z.enum(["legal_matter", "client"]),
  ownerId: uuidSchema,
});
const portalMessageBodySchema = z.object({
  body: z.string().trim().min(1).max(20_000),
});
const fulfillDocumentRequestSchema = z.object({
  fulfilledDocumentId: uuidSchema,
});
const patchClientVisibleSchema = z.object({
  clientVisible: z.boolean(),
});
const portalCalendarQuerySchema = clientPortalListQuerySchema.extend({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

function orgId(params: OrgParams): string {
  return parseInput(uuidSchema, params.organizationId);
}

function portalDeps(deps: ApiDeps): ClientPortalModuleDeps {
  if (!deps.storage || !deps.malwareScanner) {
    throw new Error("Storage/malwareScanner não configurados em ApiDeps.");
  }
  return {
    storage: deps.storage,
    malwareScanner: deps.malwareScanner,
    maxUploadBytes: deps.documentMaxUploadBytes ?? 10 * 1024 * 1024,
  };
}

function listQuery(request: FastifyRequest) {
  const query = parseInput(clientPortalListQuerySchema, request.query ?? {});
  return { ...query, limit: query.limit ?? 20, offset: query.offset ?? 0 };
}

async function readPortalUpload(
  request: FastifyRequest,
  maxBytes: number,
): Promise<{ file: UploadedFilePayload; fields: Record<string, string> }> {
  const req = request as FastifyRequest & {
    parts: () => AsyncIterable<{
      type: "file" | "field";
      fieldname: string;
      filename?: string;
      mimetype?: string;
      file?: NodeJS.ReadableStream;
      value?: unknown;
      toBuffer?: () => Promise<Buffer>;
    }>;
  };
  if (typeof req.parts !== "function") {
    throw new AppError("VALIDATION_ERROR", "Envio multipart não está disponível neste endpoint.");
  }
  const fields: Record<string, string> = {};
  let file: UploadedFilePayload | null = null;
  for await (const part of req.parts()) {
    if (part.type === "field") {
      fields[part.fieldname] = String(part.value ?? "");
      continue;
    }
    const hasher = createSha256Hasher();
    const chunks: Buffer[] = [];
    let total = 0;
    if (part.file && typeof part.file.on === "function") {
      await new Promise<void>((resolve, reject) => {
        part.file!.on("data", (chunk: Buffer | string) => {
          const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
          total += buf.byteLength;
          if (total > maxBytes) {
            reject(new AppError("VALIDATION_ERROR", "Arquivo excede o tamanho máximo permitido."));
            return;
          }
          hasher.update(buf);
          chunks.push(buf);
        });
        part.file!.on("end", () => resolve());
        part.file!.on("error", (err: Error) => reject(err));
      });
    } else {
      const data = part.toBuffer ? await part.toBuffer() : Buffer.alloc(0);
      if (data.byteLength > maxBytes) {
        throw new AppError("VALIDATION_ERROR", "Arquivo excede o tamanho máximo permitido.");
      }
      hasher.update(data);
      chunks.push(data);
      total = data.byteLength;
    }
    file = {
      filename: part.filename || "arquivo",
      mimetype: part.mimetype || "application/octet-stream",
      data: Buffer.concat(chunks, total),
      sha256: hasher.digestHex(),
    };
  }
  if (!file) {
    throw new AppError("VALIDATION_ERROR", "Envie um arquivo no campo file.", [
      { path: "file", message: "Arquivo obrigatório." },
    ]);
  }
  return { file, fields };
}

export async function registerClientPortalRoutes(app: FastifyInstance, deps: ApiDeps) {
  const root = "/organizations/:organizationId";
  const portal = `${root}/portal`;

  app.post(`${root}/client-users`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as OrgParams);
    const input = parseInput(linkOrganizationClientUserSchema, request.body);
    const result = await staffLinkClientUser(
      deps.db,
      account,
      organizationId,
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/client-document-requests`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as OrgParams);
    const input = parseInput(createClientDocumentRequestSchema, request.body);
    const result = await staffCreateDocumentRequest(
      deps.db,
      account,
      organizationId,
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/client-payment-records`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as OrgParams);
    const input = parseInput(createClientPaymentRecordSchema, request.body);
    const result = await staffCreatePaymentRecord(
      deps.db,
      account,
      organizationId,
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.patch(`${root}/calendar-events/:eventId/client-visible`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as OrgParams;
    const organizationId = orgId(params);
    const eventId = parseInput(uuidSchema, params.eventId);
    const { clientVisible } = parseInput(patchClientVisibleSchema, request.body);
    return staffPatchCalendarClientVisible(
      deps.db,
      account,
      organizationId,
      eventId,
      clientVisible,
    );
  });

  app.patch(`${root}/matters/:matterId/timeline/:eventId/client-visible`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as OrgParams;
    const organizationId = orgId(params);
    const matterId = parseInput(uuidSchema, params.matterId);
    const eventId = parseInput(uuidSchema, params.eventId);
    const { clientVisible } = parseInput(patchClientVisibleSchema, request.body);
    return staffPatchTimelineClientVisible(
      deps.db,
      account,
      organizationId,
      matterId,
      eventId,
      clientVisible,
    );
  });

  app.get(`${portal}/me`, async (request) => {
    const account = await requireAccount(deps, request);
    return portalGetMe(deps.db, account, orgId(request.params as OrgParams));
  });

  app.get(`${portal}/cases`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = listQuery(request);
    return portalListCases(deps.db, account, orgId(request.params as OrgParams), query);
  });

  app.get(`${portal}/cases/:matterId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as OrgParams;
    return portalGetCase(deps.db, account, orgId(params), parseInput(uuidSchema, params.matterId));
  });

  app.get(`${portal}/cases/:matterId/processes`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as OrgParams;
    return portalListCaseProcesses(
      deps.db,
      account,
      orgId(params),
      parseInput(uuidSchema, params.matterId),
    );
  });

  app.get(`${portal}/documents`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = listQuery(request);
    return portalListDocuments(deps.db, account, orgId(request.params as OrgParams), {
      limit: query.limit,
      offset: query.offset,
      legalMatterId: query.legalMatterId,
    });
  });

  app.post(`${portal}/documents/upload`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as OrgParams);
    const moduleDeps = portalDeps(deps);
    const { file, fields } = await readPortalUpload(request, moduleDeps.maxUploadBytes);
    const metaFields = parseInput(portalUploadFieldsSchema, fields);
    const result = await portalUploadDocument(
      deps.db,
      account,
      organizationId,
      metaFields,
      file,
      moduleDeps,
    );
    return reply.status(201).send(result);
  });

  app.get(`${portal}/document-requests`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = listQuery(request);
    return portalListDocumentRequests(deps.db, account, orgId(request.params as OrgParams), query);
  });

  app.post(`${portal}/document-requests`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(portalCreateDocumentRequestBodySchema, request.body);
    const result = await portalCreateDocumentRequest(
      deps.db,
      account,
      orgId(request.params as OrgParams),
      input,
    );
    return reply.status(201).send(result);
  });

  app.post(`${portal}/document-requests/:id/fulfill`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as OrgParams;
    const { fulfilledDocumentId } = parseInput(fulfillDocumentRequestSchema, request.body);
    return portalFulfillDocumentRequest(
      deps.db,
      account,
      orgId(params),
      parseInput(uuidSchema, params.id),
      fulfilledDocumentId,
    );
  });

  app.get(`${portal}/threads`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = listQuery(request);
    return portalListThreads(deps.db, account, orgId(request.params as OrgParams), query);
  });

  app.post(`${portal}/threads`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(portalCreateThreadSchema, request.body);
    const result = await portalCreateThread(
      deps.db,
      account,
      orgId(request.params as OrgParams),
      input,
    );
    return reply.status(201).send(result);
  });

  app.get(`${portal}/threads/:threadId/messages`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as OrgParams;
    const query = listQuery(request);
    return portalListMessages(
      deps.db,
      account,
      orgId(params),
      parseInput(uuidSchema, params.threadId),
      query,
    );
  });

  app.post(`${portal}/threads/:threadId/messages`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as OrgParams;
    const { body } = parseInput(portalMessageBodySchema, request.body);
    const result = await portalCreateMessage(
      deps.db,
      account,
      orgId(params),
      parseInput(uuidSchema, params.threadId),
      body,
    );
    return reply.status(201).send(result);
  });

  app.get(`${portal}/contracts`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = listQuery(request);
    return portalListContracts(deps.db, account, orgId(request.params as OrgParams), query);
  });

  app.get(`${portal}/payments`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = listQuery(request);
    return portalListPayments(deps.db, account, orgId(request.params as OrgParams), query);
  });

  app.get(`${portal}/requests`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = listQuery(request);
    return portalListRequests(deps.db, account, orgId(request.params as OrgParams), query);
  });

  app.post(`${portal}/requests`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(portalCreateClientRequestSchema, request.body);
    const result = await portalCreateRequest(
      deps.db,
      account,
      orgId(request.params as OrgParams),
      input,
    );
    return reply.status(201).send(result);
  });

  app.get(`${portal}/appointment-requests`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = listQuery(request);
    return portalListAppointmentRequests(
      deps.db,
      account,
      orgId(request.params as OrgParams),
      query,
    );
  });

  app.post(`${portal}/appointment-requests`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(portalCreateAppointmentSchema, request.body);
    const result = await portalCreateAppointmentRequest(
      deps.db,
      account,
      orgId(request.params as OrgParams),
      input,
    );
    return reply.status(201).send(result);
  });

  app.get(`${portal}/calendar`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(portalCalendarQuerySchema, request.query ?? {});
    return portalListCalendar(deps.db, account, orgId(request.params as OrgParams), {
      from: query.from,
      to: query.to,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.get(`${portal}/notifications`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = listQuery(request);
    return portalListNotifications(deps.db, account, orgId(request.params as OrgParams), query);
  });
}
