import {
  createIntakeSchema,
  createLegalAreaSchema,
  intakeListQuerySchema,
  parseInput,
  registerIntakeDocumentSchema,
  updateIntakeSchema,
  upsertTriageSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  convertIntake,
  createIntake,
  createLegalArea,
  getIntake,
  getTriage,
  listIntakeDocuments,
  listIntakes,
  listIntakeTimeline,
  listLegalAreas,
  registerIntakeDocument,
  updateIntake,
  upsertTriage,
} from "./service.js";

function organizationIdFromParams(params: { organizationId?: string }): string {
  return parseInput(uuidSchema, params.organizationId);
}

export async function registerIntakeRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  app.get("/organizations/:organizationId/legal-areas", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    return { legalAreas: await listLegalAreas(deps.db, account, organizationId) };
  });

  app.post("/organizations/:organizationId/legal-areas", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const input = parseInput(createLegalAreaSchema, request.body);
    const legalArea = await createLegalArea(deps.db, account, organizationId, input, meta(request));
    return reply.status(201).send({ legalArea });
  });

  app.get("/organizations/:organizationId/intakes", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const query = parseInput(intakeListQuerySchema, request.query ?? {});
    return await listIntakes(deps.db, account, organizationId, {
      ...query,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      sort: query.sort ?? "updatedAt",
      order: query.order ?? "desc",
    });
  });

  app.post("/organizations/:organizationId/intakes", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const input = parseInput(createIntakeSchema, request.body);
    const intake = await createIntake(
      deps.db,
      account,
      organizationId,
      {
        ...input,
        serviceMode: input.serviceMode ?? "online",
        urgency: input.urgency ?? "normal",
      },
      meta(request),
    );
    return reply.status(201).send({ intake });
  });

  app.get("/organizations/:organizationId/intakes/:intakeId", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const params = request.params as { intakeId?: string };
    const intakeId = parseInput(uuidSchema, params.intakeId);
    return { intake: await getIntake(deps.db, account, organizationId, intakeId) };
  });

  app.patch("/organizations/:organizationId/intakes/:intakeId", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const params = request.params as { intakeId?: string };
    const intakeId = parseInput(uuidSchema, params.intakeId);
    const input = parseInput(updateIntakeSchema, request.body);
    const intake = await updateIntake(
      deps.db,
      account,
      organizationId,
      intakeId,
      input,
      meta(request),
    );
    return { intake };
  });

  app.get("/organizations/:organizationId/intakes/:intakeId/triage", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const params = request.params as { intakeId?: string };
    const intakeId = parseInput(uuidSchema, params.intakeId);
    return { triage: await getTriage(deps.db, account, organizationId, intakeId) };
  });

  app.put("/organizations/:organizationId/intakes/:intakeId/triage", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const params = request.params as { intakeId?: string };
    const intakeId = parseInput(uuidSchema, params.intakeId);
    const input = parseInput(upsertTriageSchema, request.body);
    const triage = await upsertTriage(
      deps.db,
      account,
      organizationId,
      intakeId,
      input,
      meta(request),
    );
    return { triage };
  });

  app.get("/organizations/:organizationId/intakes/:intakeId/documents", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const params = request.params as { intakeId?: string };
    const intakeId = parseInput(uuidSchema, params.intakeId);
    return {
      documents: await listIntakeDocuments(deps.db, account, organizationId, intakeId),
    };
  });

  app.post("/organizations/:organizationId/intakes/:intakeId/documents", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const params = request.params as { intakeId?: string };
    const intakeId = parseInput(uuidSchema, params.intakeId);
    const input = parseInput(registerIntakeDocumentSchema, request.body);
    const document = await registerIntakeDocument(
      deps.db,
      account,
      organizationId,
      intakeId,
      {
        ...input,
        status: input.status ?? "pending",
      },
      meta(request),
    );
    return reply.status(201).send({ document });
  });

  app.post("/organizations/:organizationId/intakes/:intakeId/convert", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const params = request.params as { intakeId?: string };
    const intakeId = parseInput(uuidSchema, params.intakeId);
    return await convertIntake(deps.db, account, organizationId, intakeId, meta(request));
  });

  app.get("/organizations/:organizationId/intakes/:intakeId/timeline", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const params = request.params as { intakeId?: string };
    const intakeId = parseInput(uuidSchema, params.intakeId);
    return await listIntakeTimeline(deps.db, account, organizationId, intakeId);
  });
}
