import {
  administrativeProcessListQuerySchema,
  closeAdministrativeProcessSchema,
  createAdministrativeAppealSchema,
  createAdministrativeDecisionSchema,
  createAdministrativeDeadlineSchema,
  createAdministrativeProcessSchema,
  createAdministrativeRequestSchema,
  createAdministrativeRequirementSchema,
  parseInput,
  reopenAdministrativeProcessSchema,
  updateAdministrativeAppealSchema,
  updateAdministrativeDeadlineSchema,
  updateAdministrativeProcessSchema,
  updateAdministrativeRequestSchema,
  updateAdministrativeRequirementSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  addAdministrativeAppeal,
  addAdministrativeDecision,
  addAdministrativeDeadline,
  addAdministrativeRequest,
  addAdministrativeRequirement,
  closeAdministrativeProcess,
  createAdministrativeProcess,
  getAdministrativeProcess,
  listAdministrativeAppeals,
  listAdministrativeBodiesCatalog,
  listAdministrativeDeadlines,
  listAdministrativeDecisions,
  listAdministrativeProcesses,
  listAdministrativeProcessTimeline,
  listAdministrativeRequests,
  listAdministrativeRequirements,
  reopenAdministrativeProcess,
  updateAdministrativeAppeal,
  updateAdministrativeDeadline,
  updateAdministrativeProcess,
  updateAdministrativeRequest,
  updateAdministrativeRequirement,
} from "./service.js";

function orgId(params: { organizationId?: string }): string {
  return parseInput(uuidSchema, params.organizationId);
}

function matterId(params: { matterId?: string }): string {
  return parseInput(uuidSchema, params.matterId);
}

function processId(params: { processId?: string }): string {
  return parseInput(uuidSchema, params.processId);
}

export async function registerAdministrativeRoutes(app: FastifyInstance, deps: ApiDeps) {
  app.get("/organizations/:organizationId/administrative-bodies", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    const items = await listAdministrativeBodiesCatalog(deps.db, account, organizationId);
    return { administrativeBodies: items, bodies: items, items };
  });

  const matterBase = "/organizations/:organizationId/matters/:matterId/administrative-processes";
  const processBase = "/organizations/:organizationId/administrative-processes/:processId";

  app.get(matterBase, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; matterId?: string };
    const query = parseInput(administrativeProcessListQuerySchema, request.query ?? {});
    return await listAdministrativeProcesses(deps.db, account, orgId(params), matterId(params), {
      ...query,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(matterBase, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; matterId?: string };
    const input = parseInput(createAdministrativeProcessSchema, request.body);
    const process = await createAdministrativeProcess(
      deps.db,
      account,
      orgId(params),
      matterId(params),
      input,
      meta(request),
    );
    return reply.status(201).send({ process });
  });

  app.get(processBase, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; processId?: string };
    return {
      process: await getAdministrativeProcess(deps.db, account, orgId(params), processId(params)),
    };
  });

  app.patch(processBase, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; processId?: string };
    const input = parseInput(updateAdministrativeProcessSchema, request.body);
    return {
      process: await updateAdministrativeProcess(
        deps.db,
        account,
        orgId(params),
        processId(params),
        input,
        meta(request),
      ),
    };
  });

  app.post(`${processBase}/close`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; processId?: string };
    const input = parseInput(closeAdministrativeProcessSchema, request.body ?? {});
    return {
      process: await closeAdministrativeProcess(
        deps.db,
        account,
        orgId(params),
        processId(params),
        input,
        meta(request),
      ),
    };
  });

  app.post(`${processBase}/reopen`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; processId?: string };
    const input = parseInput(reopenAdministrativeProcessSchema, request.body ?? {});
    return {
      process: await reopenAdministrativeProcess(
        deps.db,
        account,
        orgId(params),
        processId(params),
        input,
        meta(request),
      ),
    };
  });

  app.get(`${processBase}/timeline`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; processId?: string };
    const items = await listAdministrativeProcessTimeline(
      deps.db,
      account,
      orgId(params),
      processId(params),
    );
    return { timeline: items, items };
  });

  app.get(`${processBase}/requests`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; processId?: string };
    const items = await listAdministrativeRequests(
      deps.db,
      account,
      orgId(params),
      processId(params),
    );
    return { requests: items, items };
  });

  app.post(`${processBase}/requests`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; processId?: string };
    const input = parseInput(createAdministrativeRequestSchema, request.body);
    const requestRow = await addAdministrativeRequest(
      deps.db,
      account,
      orgId(params),
      processId(params),
      input,
      meta(request),
    );
    return reply.status(201).send({ request: requestRow });
  });

  app.patch(`${processBase}/requests/:requestId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      processId?: string;
      requestId?: string;
    };
    const input = parseInput(updateAdministrativeRequestSchema, request.body);
    return {
      request: await updateAdministrativeRequest(
        deps.db,
        account,
        orgId(params),
        processId(params),
        parseInput(uuidSchema, params.requestId),
        input,
        meta(request),
      ),
    };
  });

  app.get(`${processBase}/requirements`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; processId?: string };
    const items = await listAdministrativeRequirements(
      deps.db,
      account,
      orgId(params),
      processId(params),
    );
    return { requirements: items, items };
  });

  app.post(`${processBase}/requirements`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; processId?: string };
    const input = parseInput(createAdministrativeRequirementSchema, request.body);
    const requirement = await addAdministrativeRequirement(
      deps.db,
      account,
      orgId(params),
      processId(params),
      input,
      meta(request),
    );
    return reply.status(201).send({ requirement });
  });

  app.patch(`${processBase}/requirements/:requirementId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      processId?: string;
      requirementId?: string;
    };
    const input = parseInput(updateAdministrativeRequirementSchema, request.body);
    return {
      requirement: await updateAdministrativeRequirement(
        deps.db,
        account,
        orgId(params),
        processId(params),
        parseInput(uuidSchema, params.requirementId),
        input,
        meta(request),
      ),
    };
  });

  app.get(`${processBase}/deadlines`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; processId?: string };
    const items = await listAdministrativeDeadlines(
      deps.db,
      account,
      orgId(params),
      processId(params),
    );
    return { deadlines: items, items };
  });

  app.post(`${processBase}/deadlines`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; processId?: string };
    const input = parseInput(createAdministrativeDeadlineSchema, request.body);
    const deadline = await addAdministrativeDeadline(
      deps.db,
      account,
      orgId(params),
      processId(params),
      input,
      meta(request),
    );
    return reply.status(201).send({ deadline });
  });

  app.patch(`${processBase}/deadlines/:deadlineId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      processId?: string;
      deadlineId?: string;
    };
    const input = parseInput(updateAdministrativeDeadlineSchema, request.body);
    return {
      deadline: await updateAdministrativeDeadline(
        deps.db,
        account,
        orgId(params),
        processId(params),
        parseInput(uuidSchema, params.deadlineId),
        input,
        meta(request),
      ),
    };
  });

  app.get(`${processBase}/decisions`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; processId?: string };
    const items = await listAdministrativeDecisions(
      deps.db,
      account,
      orgId(params),
      processId(params),
    );
    return { decisions: items, items };
  });

  app.post(`${processBase}/decisions`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; processId?: string };
    const input = parseInput(createAdministrativeDecisionSchema, request.body);
    const decision = await addAdministrativeDecision(
      deps.db,
      account,
      orgId(params),
      processId(params),
      input,
      meta(request),
    );
    return reply.status(201).send({ decision });
  });

  app.get(`${processBase}/appeals`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; processId?: string };
    const items = await listAdministrativeAppeals(
      deps.db,
      account,
      orgId(params),
      processId(params),
    );
    return { appeals: items, items };
  });

  app.post(`${processBase}/appeals`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; processId?: string };
    const input = parseInput(createAdministrativeAppealSchema, request.body);
    const appeal = await addAdministrativeAppeal(
      deps.db,
      account,
      orgId(params),
      processId(params),
      input,
      meta(request),
    );
    return reply.status(201).send({ appeal });
  });

  app.patch(`${processBase}/appeals/:appealId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      processId?: string;
      appealId?: string;
    };
    const input = parseInput(updateAdministrativeAppealSchema, request.body);
    return {
      appeal: await updateAdministrativeAppeal(
        deps.db,
        account,
        orgId(params),
        processId(params),
        parseInput(uuidSchema, params.appealId),
        input,
        meta(request),
      ),
    };
  });
}
