import {
  classifyDocumentSchema,
  createDocumentLinkSchema,
  dossierQuerySchema,
  parseInput,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  classifyDocument,
  getAdministrativeDossier,
  getClientDossier,
  getJudicialDossier,
  getMatterDossier,
  linkDocument,
  unlinkDocument,
} from "./service.js";

function orgId(params: { organizationId?: string }): string {
  return parseInput(uuidSchema, params.organizationId);
}

export async function registerDossierRoutes(app: FastifyInstance, deps: ApiDeps) {
  app.get("/organizations/:organizationId/matters/:matterId/dossier", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; matterId?: string };
    const query = parseInput(dossierQuerySchema, request.query ?? {});
    return getMatterDossier(
      deps.db,
      account,
      orgId(params),
      parseInput(uuidSchema, params.matterId),
      query,
    );
  });

  app.get("/organizations/:organizationId/crm/clients/:clientId/dossier", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; clientId?: string };
    const query = parseInput(dossierQuerySchema, request.query ?? {});
    return getClientDossier(
      deps.db,
      account,
      orgId(params),
      parseInput(uuidSchema, params.clientId),
      query,
    );
  });

  app.get(
    "/organizations/:organizationId/judicial-processes/:processId/dossier",
    async (request) => {
      const account = await requireAccount(deps, request);
      const params = request.params as { organizationId?: string; processId?: string };
      const query = parseInput(dossierQuerySchema, request.query ?? {});
      return getJudicialDossier(
        deps.db,
        account,
        orgId(params),
        parseInput(uuidSchema, params.processId),
        query,
      );
    },
  );

  app.get(
    "/organizations/:organizationId/administrative-processes/:processId/dossier",
    async (request) => {
      const account = await requireAccount(deps, request);
      const params = request.params as { organizationId?: string; processId?: string };
      const query = parseInput(dossierQuerySchema, request.query ?? {});
      return getAdministrativeDossier(
        deps.db,
        account,
        orgId(params),
        parseInput(uuidSchema, params.processId),
        query,
      );
    },
  );

  app.post("/organizations/:organizationId/documents/:documentId/classify", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; documentId?: string };
    const input = parseInput(classifyDocumentSchema, request.body);
    return {
      document: await classifyDocument(
        deps.db,
        account,
        orgId(params),
        parseInput(uuidSchema, params.documentId),
        input,
        meta(request),
      ),
    };
  });

  app.post("/organizations/:organizationId/dossier/links", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    const input = parseInput(createDocumentLinkSchema, request.body);
    const link = await linkDocument(deps.db, account, organizationId, input, meta(request));
    return reply.status(201).send({ link });
  });

  app.delete("/organizations/:organizationId/dossier/links/:linkId", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; linkId?: string };
    return unlinkDocument(
      deps.db,
      account,
      orgId(params),
      parseInput(uuidSchema, params.linkId),
      meta(request),
    );
  });
}
