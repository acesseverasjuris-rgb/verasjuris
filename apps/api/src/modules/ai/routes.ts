import {
  aiJobListQuerySchema,
  aiPromptKeyParamSchema,
  aiPromptVersionParamSchema,
  aiRequestListQuerySchema,
  aiUsageQuerySchema,
  createAiPromptVersionSchema,
  parseInput,
  upsertAiBudgetSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  activateAiPromptVersion,
  cancelAiJob,
  createAiPromptVersion,
  getAiJob,
  getAiRequest,
  getAiStatus,
  getAiUsage,
  listAiBudgets,
  listAiJobs,
  listAiModels,
  listAiPrompts,
  listAiRequests,
  upsertAiBudget,
  type AiModuleDeps,
} from "./service.js";

export function aiModuleDeps(deps: ApiDeps): AiModuleDeps {
  if (!deps.aiGateway || !deps.ocrProvider || !deps.publicOpportunityProvider) {
    throw new Error("aiGateway/ocrProvider/publicOpportunityProvider não configurados em ApiDeps.");
  }
  return {
    gateway: deps.aiGateway,
    ocr: deps.ocrProvider,
    publicOpportunities: deps.publicOpportunityProvider,
  };
}

function orgId(params: { organizationId?: string }): string {
  return parseInput(uuidSchema, params.organizationId);
}

export async function registerAiRoutes(app: FastifyInstance, deps: ApiDeps) {
  const base = "/organizations/:organizationId/ai";

  app.get(`${base}/status`, async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    return getAiStatus(deps.db, account, organizationId, aiModuleDeps(deps));
  });

  app.get(`${base}/models`, async (request) => {
    const account = await requireAccount(deps, request);
    return listAiModels(deps.db, account, orgId(request.params as { organizationId?: string }));
  });

  app.get(`${base}/prompts`, async (request) => {
    const account = await requireAccount(deps, request);
    return listAiPrompts(deps.db, account, orgId(request.params as { organizationId?: string }));
  });

  app.post(`${base}/prompts`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    const input = parseInput(createAiPromptVersionSchema, request.body);
    const result = await createAiPromptVersion(
      deps.db,
      account,
      organizationId,
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${base}/prompts/:promptKey/versions/:version/activate`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      promptKey?: string;
      version?: string;
    };
    return activateAiPromptVersion(
      deps.db,
      account,
      orgId(params),
      parseInput(aiPromptKeyParamSchema, params.promptKey),
      parseInput(aiPromptVersionParamSchema, params.version),
      meta(request),
    );
  });

  app.get(`${base}/usage`, async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    const query = parseInput(aiUsageQuerySchema, request.query ?? {});
    return getAiUsage(deps.db, account, organizationId, query);
  });

  app.get(`${base}/requests`, async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    const query = parseInput(aiRequestListQuerySchema, request.query ?? {});
    return listAiRequests(deps.db, account, organizationId, query);
  });

  app.get(`${base}/requests/:requestId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; requestId?: string };
    return getAiRequest(deps.db, account, orgId(params), parseInput(uuidSchema, params.requestId));
  });

  app.get(`${base}/jobs`, async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    const query = parseInput(aiJobListQuerySchema, request.query ?? {});
    return listAiJobs(deps.db, account, organizationId, query);
  });

  app.get(`${base}/jobs/:jobId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; jobId?: string };
    return getAiJob(deps.db, account, orgId(params), parseInput(uuidSchema, params.jobId));
  });

  app.post(`${base}/jobs/:jobId/cancel`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; jobId?: string };
    return cancelAiJob(
      deps.db,
      account,
      orgId(params),
      parseInput(uuidSchema, params.jobId),
      meta(request),
    );
  });

  app.get(`${base}/budgets`, async (request) => {
    const account = await requireAccount(deps, request);
    return listAiBudgets(deps.db, account, orgId(request.params as { organizationId?: string }));
  });

  app.put(`${base}/budgets`, async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    const input = parseInput(upsertAiBudgetSchema, request.body);
    return upsertAiBudget(deps.db, account, organizationId, input, meta(request));
  });
}
