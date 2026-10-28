import {
  acceptDiligenceProposalSchema,
  completeDiligenceAssignmentSchema,
  createDiligenceExecutionEventSchema,
  createDiligenceProposalSchema,
  createDiligenceRequestSchema,
  parseInput,
  reviewDiligenceEvidenceSchema,
  submitDiligenceEvidenceSchema,
  uuidSchema,
} from "@verasjuris/validation";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  acceptDiligenceProposal,
  addDiligenceExecutionEvent,
  completeDiligenceAssignment,
  createDiligenceProposal,
  createDiligenceRequest,
  createDiligenceReview,
  listDiligenceRequests,
  listDiligenceTypes,
  openDiligenceDispute,
  publishDiligenceRequest,
  reviewDiligenceEvidence,
  submitDiligenceEvidence,
  type DiligenceModuleDeps,
} from "./service.js";

type Params = { organizationId?: string; requestId?: string; evidenceId?: string };

function diligenceDeps(deps: ApiDeps): DiligenceModuleDeps {
  if (!deps.paymentProvider) throw new Error("PaymentProvider ausente em ApiDeps.");
  return { paymentProvider: deps.paymentProvider };
}

export async function registerDiligenceRoutes(app: FastifyInstance, deps: ApiDeps) {
  const root = "/organizations/:organizationId/diligence";
  const org = (params: Params) => parseInput(uuidSchema, params.organizationId);

  app.get(`${root}/types`, async (request) => {
    await requireAccount(deps, request);
    return listDiligenceTypes(deps.db);
  });

  app.get(`${root}/requests`, async (request) => {
    const account = await requireAccount(deps, request);
    return listDiligenceRequests(deps.db, account, org(request.params as Params));
  });

  app.post(`${root}/requests`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createDiligenceRequestSchema, request.body);
    const result = await createDiligenceRequest(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/requests/:requestId/publish`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return publishDiligenceRequest(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.requestId),
      meta(request),
    );
  });

  app.post(`${root}/proposals`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createDiligenceProposalSchema, request.body);
    const result = await createDiligenceProposal(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/requests/:requestId/accept-proposal`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(acceptDiligenceProposalSchema, request.body);
    return acceptDiligenceProposal(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.requestId),
      input.proposalId,
      meta(request),
    );
  });

  app.post(`${root}/requests/:requestId/events`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createDiligenceExecutionEventSchema, request.body);
    const result = await addDiligenceExecutionEvent(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.requestId),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/requests/:requestId/evidence`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(submitDiligenceEvidenceSchema, request.body);
    const result = await submitDiligenceEvidence(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.requestId),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/evidence/:evidenceId/review`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(reviewDiligenceEvidenceSchema, request.body);
    return reviewDiligenceEvidence(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.evidenceId),
      input,
      meta(request),
    );
  });

  app.post(`${root}/requests/:requestId/complete`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    parseInput(completeDiligenceAssignmentSchema, request.body ?? {});
    return completeDiligenceAssignment(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.requestId),
      diligenceDeps(deps),
      meta(request),
    );
  });

  app.post(`${root}/requests/:requestId/review`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(
      z.object({
        rating: z.number().int().min(1).max(5),
        comment: z.string().trim().max(2000).optional(),
      }),
      request.body,
    );
    const result = await createDiligenceReview(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.requestId),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/requests/:requestId/disputes`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(
      z.object({
        reasonCode: z.string().trim().min(1).max(80),
        description: z.string().trim().min(3).max(8000),
      }),
      request.body,
    );
    const result = await openDiligenceDispute(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.requestId),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });
}
