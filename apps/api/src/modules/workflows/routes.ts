import {
  cancelWorkflowRunSchema,
  createWorkflowDefinitionSchema,
  parseInput,
  pauseWorkflowDefinitionSchema,
  publishWorkflowDefinitionSchema,
  runWorkflowSchema,
  updateWorkflowDefinitionSchema,
  uuidSchema,
  workflowDefinitionListQuerySchema,
  workflowRunListQuerySchema,
  workflowTemplateListQuerySchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  cancelWorkflowRun,
  createWorkflowDefinition,
  listWorkflowDefinitions,
  listWorkflowRuns,
  listWorkflowTemplates,
  pauseWorkflowDefinition,
  publishWorkflowDefinition,
  runWorkflow,
  updateWorkflowDefinition,
  type WorkflowModuleDeps,
} from "./service.js";

type Params = {
  organizationId?: string;
  definitionId?: string;
  runId?: string;
};

function workflowDeps(deps: ApiDeps): WorkflowModuleDeps {
  return { workflowWebhookProvider: deps.workflowWebhookProvider };
}

export async function registerWorkflowRoutes(app: FastifyInstance, deps: ApiDeps) {
  const root = "/organizations/:organizationId/workflows";
  const org = (params: Params) => parseInput(uuidSchema, params.organizationId);

  app.get(`${root}/templates`, async (request) => {
    const account = await requireAccount(deps, request);
    parseInput(workflowTemplateListQuerySchema, request.query ?? {});
    return listWorkflowTemplates(deps.db, account, org(request.params as Params));
  });

  app.get(root, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(workflowDefinitionListQuerySchema, request.query ?? {});
    return listWorkflowDefinitions(deps.db, account, org(request.params as Params), query);
  });

  app.post(root, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createWorkflowDefinitionSchema, request.body);
    const result = await createWorkflowDefinition(
      deps.db,
      account,
      org(request.params as Params),
      {
        ...input,
        trigger: input.trigger as unknown as Record<string, unknown>,
        conditions: input.conditions as never,
        actions: input.actions as never,
      },
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.patch(`${root}/:definitionId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updateWorkflowDefinitionSchema, request.body);
    return updateWorkflowDefinition(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.definitionId),
      {
        ...input,
        trigger: input.trigger as unknown as Record<string, unknown> | undefined,
        conditions: input.conditions as never,
        actions: input.actions as never,
      },
      meta(request),
    );
  });

  app.post(`${root}/:definitionId/publish`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(publishWorkflowDefinitionSchema, request.body ?? {});
    return publishWorkflowDefinition(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.definitionId),
      input,
      meta(request),
    );
  });

  app.post(`${root}/:definitionId/pause`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(pauseWorkflowDefinitionSchema, request.body ?? {});
    return pauseWorkflowDefinition(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.definitionId),
      input,
      meta(request),
    );
  });

  app.post(`${root}/:definitionId/run`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(runWorkflowSchema, request.body ?? {});
    const result = await runWorkflow(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.definitionId),
      input,
      meta(request),
      workflowDeps(deps),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/runs`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(workflowRunListQuerySchema, request.query ?? {});
    return listWorkflowRuns(deps.db, account, org(request.params as Params), query);
  });

  app.post(`${root}/runs/:runId/cancel`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(cancelWorkflowRunSchema, request.body ?? {});
    return cancelWorkflowRun(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.runId),
      input,
      meta(request),
    );
  });
}
