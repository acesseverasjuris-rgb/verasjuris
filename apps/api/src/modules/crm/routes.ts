import {
  contactsQuerySchema,
  createClientSchema,
  createInteractionSchema,
  createLeadSchema,
  createNoteSchema,
  createTagSchema,
  listQuerySchema,
  parseInput,
  updateClientSchema,
  updateLeadSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  convertLead,
  createClient,
  createInteraction,
  createLead,
  createNote,
  createTag,
  crmOverview,
  getClient,
  getLead,
  listChannels,
  listClients,
  listContacts,
  listLeads,
  listSources,
  listTags,
  listTimeline,
  updateClient,
  updateLead,
} from "./service.js";

function organizationIdFromParams(params: { organizationId?: string }): string {
  return parseInput(uuidSchema, params.organizationId);
}

export async function registerCrmRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  app.get("/organizations/:organizationId/crm/overview", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    return { overview: await crmOverview(deps.db, account, organizationId) };
  });

  app.get("/organizations/:organizationId/crm/leads", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const query = parseInput(listQuerySchema, request.query ?? {});
    return await listLeads(deps.db, account, organizationId, {
      ...query,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      sort: query.sort ?? "updatedAt",
      order: query.order ?? "desc",
    });
  });

  app.post("/organizations/:organizationId/crm/leads", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const input = parseInput(createLeadSchema, request.body);
    const lead = await createLead(
      deps.db,
      account,
      organizationId,
      { ...input, personType: input.personType ?? "person", name: input.name },
      meta(request),
    );
    return reply.status(201).send({ lead });
  });

  app.get("/organizations/:organizationId/crm/leads/:leadId", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const params = request.params as { leadId?: string };
    const leadId = parseInput(uuidSchema, params.leadId);
    return { lead: await getLead(deps.db, account, organizationId, leadId) };
  });

  app.patch("/organizations/:organizationId/crm/leads/:leadId", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const params = request.params as { leadId?: string };
    const leadId = parseInput(uuidSchema, params.leadId);
    const input = parseInput(updateLeadSchema, request.body) as Record<string, unknown>;
    const lead = await updateLead(deps.db, account, organizationId, leadId, input, meta(request));
    return { lead };
  });

  app.post("/organizations/:organizationId/crm/leads/:leadId/convert", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const params = request.params as { leadId?: string };
    const leadId = parseInput(uuidSchema, params.leadId);
    return await convertLead(deps.db, account, organizationId, leadId, meta(request));
  });

  app.get("/organizations/:organizationId/crm/clients", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const query = parseInput(listQuerySchema, request.query ?? {});
    return await listClients(deps.db, account, organizationId, {
      ...query,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      sort: query.sort ?? "updatedAt",
      order: query.order ?? "desc",
    });
  });

  app.post("/organizations/:organizationId/crm/clients", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const input = parseInput(createClientSchema, request.body);
    const client = await createClient(deps.db, account, organizationId, input, meta(request));
    return reply.status(201).send({ client });
  });

  app.get("/organizations/:organizationId/crm/clients/:clientId", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const params = request.params as { clientId?: string };
    const clientId = parseInput(uuidSchema, params.clientId);
    return { client: await getClient(deps.db, account, organizationId, clientId) };
  });

  app.patch("/organizations/:organizationId/crm/clients/:clientId", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const params = request.params as { clientId?: string };
    const clientId = parseInput(uuidSchema, params.clientId);
    const input = parseInput(updateClientSchema, request.body);
    const client = await updateClient(
      deps.db,
      account,
      organizationId,
      clientId,
      input,
      meta(request),
    );
    return { client };
  });

  app.get("/organizations/:organizationId/crm/contacts", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const query = parseInput(contactsQuerySchema, request.query ?? {});
    return await listContacts(deps.db, account, organizationId, {
      ...query,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.get("/organizations/:organizationId/crm/tags", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    return { tags: await listTags(deps.db, account, organizationId) };
  });

  app.post("/organizations/:organizationId/crm/tags", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const input = parseInput(createTagSchema, request.body);
    const tag = await createTag(deps.db, account, organizationId, input, meta(request));
    return reply.status(201).send({ tag });
  });

  app.get("/organizations/:organizationId/crm/sources", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    return { sources: await listSources(deps.db, account, organizationId) };
  });

  app.get("/organizations/:organizationId/crm/channels", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    return { channels: await listChannels(deps.db, account, organizationId) };
  });

  app.post("/organizations/:organizationId/crm/notes", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const input = parseInput(createNoteSchema, request.body);
    const note = await createNote(
      deps.db,
      account,
      organizationId,
      {
        ...input,
        visibility: input.visibility ?? "organization",
      },
      meta(request),
    );
    return reply.status(201).send({ note });
  });

  app.post("/organizations/:organizationId/crm/interactions", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const input = parseInput(createInteractionSchema, request.body);
    const interaction = await createInteraction(
      deps.db,
      account,
      organizationId,
      input,
      meta(request),
    );
    return reply.status(201).send({ interaction });
  });

  app.get("/organizations/:organizationId/crm/leads/:leadId/timeline", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const params = request.params as { leadId?: string };
    const leadId = parseInput(uuidSchema, params.leadId);
    return await listTimeline(deps.db, account, organizationId, "lead", leadId);
  });

  app.get("/organizations/:organizationId/crm/clients/:clientId/timeline", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const params = request.params as { clientId?: string };
    const clientId = parseInput(uuidSchema, params.clientId);
    return await listTimeline(deps.db, account, organizationId, "client", clientId);
  });
}
