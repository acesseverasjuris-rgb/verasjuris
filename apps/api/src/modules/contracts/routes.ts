import {
  contractApprovalListQuerySchema,
  contractClauseListQuerySchema,
  contractListQuerySchema,
  contractObligationListQuerySchema,
  contractPartyListQuerySchema,
  contractRenewalListQuerySchema,
  contractTemplateListQuerySchema,
  contractTerminationListQuerySchema,
  contractVersionListQuerySchema,
  createContractAmendmentSchema,
  createContractApprovalPolicySchema,
  createContractApprovalSchema,
  createContractClauseInstanceSchema,
  createContractClauseSchema,
  createContractObligationSchema,
  createContractPartySchema,
  createContractRenewalSchema,
  createContractSchema,
  createContractTemplateSchema,
  createContractTerminationSchema,
  createContractVersionSchema,
  createManualSignatureRecordSchema,
  createSignatureRequestSchema,
  parseInput,
  signatureRequestListQuerySchema,
  updateContractApprovalSchema,
  updateContractSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  completeContractRenewal,
  createContract,
  createContractAmendment,
  createContractApproval,
  createContractApprovalPolicy,
  createContractClauseInstance,
  createContractClauseLibrary,
  createContractObligation,
  createContractParty,
  createContractRenewal,
  createContractTemplate,
  createContractTermination,
  createContractVersion,
  createSignatureRequest,
  effectiveContractTermination,
  getContract,
  getContractTimeline,
  getSignatureProvidersStatus,
  listContractAmendments,
  listContractApprovals,
  listContractClauseInstances,
  listContractClausesLibrary,
  listContractApprovalPolicies,
  listContractObligations,
  listContractParties,
  listContractRenewals,
  listContractTemplates,
  listContractTerminations,
  listContractVersions,
  listContracts,
  listSignatureRequests,
  markContractExpired,
  recordManualSignature,
  sendSignatureRequest,
  updateContract,
  updateContractApproval,
  type ContractsModuleDeps,
} from "./service.js";

type Params = {
  organizationId?: string;
  contractId?: string;
  approvalId?: string;
  signatureRequestId?: string;
  renewalId?: string;
  terminationId?: string;
};

export function contractsModuleDeps(deps: ApiDeps): ContractsModuleDeps {
  if (!deps.signatureProvider) {
    throw new Error("SignatureProvider não configurado em ApiDeps.");
  }
  return {
    signatureProvider: deps.signatureProvider,
    contractManagementProvider: deps.contractManagementProvider,
  };
}

export async function registerContractRoutes(app: FastifyInstance, deps: ApiDeps) {
  const root = "/organizations/:organizationId";
  const org = (params: Params) => parseInput(uuidSchema, params.organizationId);
  const contractId = (params: Params) => parseInput(uuidSchema, params.contractId);
  const moduleDeps = () => contractsModuleDeps(deps);

  app.get(`${root}/signature-providers/status`, async (request) => {
    const account = await requireAccount(deps, request);
    return getSignatureProvidersStatus(account, org(request.params as Params), moduleDeps());
  });

  app.get(`${root}/contracts`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(contractListQuerySchema, request.query ?? {});
    return listContracts(deps.db, account, org(request.params as Params), {
      ...query,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/contracts`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createContractSchema, request.body);
    const result = await createContract(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/contracts/:contractId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getContract(deps.db, account, org(params), contractId(params));
  });

  app.patch(`${root}/contracts/:contractId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updateContractSchema, request.body);
    return updateContract(deps.db, account, org(params), contractId(params), input, meta(request));
  });

  app.post(`${root}/contracts/:contractId/versions`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const body = parseInput(createContractVersionSchema, request.body);
    const result = await createContractVersion(
      deps.db,
      account,
      org(params),
      contractId(params),
      body,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/contracts/:contractId/versions`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const query = parseInput(contractVersionListQuerySchema, request.query ?? {});
    return listContractVersions(deps.db, account, org(params), contractId(params), {
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/contracts/:contractId/parties`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const body = parseInput(createContractPartySchema, request.body);
    const result = await createContractParty(
      deps.db,
      account,
      org(params),
      contractId(params),
      body,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/contracts/:contractId/parties`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const query = parseInput(contractPartyListQuerySchema, request.query ?? {});
    return listContractParties(deps.db, account, org(params), contractId(params), {
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/contracts/:contractId/clauses`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const body = parseInput(createContractClauseInstanceSchema, request.body);
    const result = await createContractClauseInstance(
      deps.db,
      account,
      org(params),
      contractId(params),
      body,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/contracts/:contractId/clauses`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listContractClauseInstances(deps.db, account, org(params), contractId(params));
  });

  app.post(`${root}/contracts/:contractId/approvals`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const body = parseInput(createContractApprovalSchema, request.body);
    const result = await createContractApproval(
      deps.db,
      account,
      org(params),
      contractId(params),
      body,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.patch(`${root}/contracts/:contractId/approvals/:approvalId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const approvalId = parseInput(uuidSchema, params.approvalId);
    const body = parseInput(updateContractApprovalSchema, request.body);
    return updateContractApproval(
      deps.db,
      account,
      org(params),
      contractId(params),
      approvalId,
      body,
      meta(request),
    );
  });

  app.get(`${root}/contracts/:contractId/approvals`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const query = parseInput(contractApprovalListQuerySchema, request.query ?? {});
    return listContractApprovals(deps.db, account, org(params), contractId(params), {
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/contracts/:contractId/signature-requests`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const body = parseInput(createSignatureRequestSchema, request.body);
    const result = await createSignatureRequest(
      deps.db,
      account,
      org(params),
      contractId(params),
      body,
      meta(request),
      moduleDeps(),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/contracts/:contractId/signature-requests`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const query = parseInput(signatureRequestListQuerySchema, request.query ?? {});
    return listSignatureRequests(deps.db, account, org(params), contractId(params), {
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  });

  app.post(
    `${root}/contracts/:contractId/signature-requests/:signatureRequestId/send`,
    async (request) => {
      const account = await requireAccount(deps, request);
      const params = request.params as Params;
      const signatureRequestId = parseInput(uuidSchema, params.signatureRequestId);
      return sendSignatureRequest(
        deps.db,
        account,
        org(params),
        contractId(params),
        signatureRequestId,
        meta(request),
        moduleDeps(),
      );
    },
  );

  app.post(`${root}/contracts/:contractId/manual-signatures`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const body = parseInput(createManualSignatureRecordSchema, request.body);
    const result = await recordManualSignature(
      deps.db,
      account,
      org(params),
      contractId(params),
      body,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/contracts/:contractId/renewals`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const body = parseInput(createContractRenewalSchema, request.body);
    const result = await createContractRenewal(
      deps.db,
      account,
      org(params),
      contractId(params),
      body,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/contracts/:contractId/renewals/:renewalId/complete`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const renewalId = parseInput(uuidSchema, params.renewalId);
    return completeContractRenewal(
      deps.db,
      account,
      org(params),
      contractId(params),
      renewalId,
      meta(request),
    );
  });

  app.get(`${root}/contracts/:contractId/renewals`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const query = parseInput(contractRenewalListQuerySchema, request.query ?? {});
    return listContractRenewals(deps.db, account, org(params), contractId(params), {
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/contracts/:contractId/terminations`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const body = parseInput(createContractTerminationSchema, request.body);
    const result = await createContractTermination(
      deps.db,
      account,
      org(params),
      contractId(params),
      body,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(
    `${root}/contracts/:contractId/terminations/:terminationId/effective`,
    async (request) => {
      const account = await requireAccount(deps, request);
      const params = request.params as Params;
      const terminationId = parseInput(uuidSchema, params.terminationId);
      return effectiveContractTermination(
        deps.db,
        account,
        org(params),
        contractId(params),
        terminationId,
        meta(request),
      );
    },
  );

  app.get(`${root}/contracts/:contractId/terminations`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const query = parseInput(contractTerminationListQuerySchema, request.query ?? {});
    return listContractTerminations(deps.db, account, org(params), contractId(params), {
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/contracts/:contractId/obligations`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const body = parseInput(createContractObligationSchema, request.body);
    const result = await createContractObligation(
      deps.db,
      account,
      org(params),
      contractId(params),
      body,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/contracts/:contractId/obligations`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const query = parseInput(contractObligationListQuerySchema, request.query ?? {});
    return listContractObligations(deps.db, account, org(params), contractId(params), {
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/contracts/:contractId/amendments`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const body = parseInput(createContractAmendmentSchema, request.body);
    const result = await createContractAmendment(
      deps.db,
      account,
      org(params),
      contractId(params),
      body,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/contracts/:contractId/amendments`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listContractAmendments(deps.db, account, org(params), contractId(params));
  });

  app.get(`${root}/contracts/:contractId/timeline`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getContractTimeline(deps.db, account, org(params), contractId(params));
  });

  app.post(`${root}/contracts/:contractId/mark-expired`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return markContractExpired(deps.db, account, org(params), contractId(params), meta(request));
  });

  app.get(`${root}/contract-templates`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(contractTemplateListQuerySchema, request.query ?? {});
    return listContractTemplates(deps.db, account, org(request.params as Params), {
      ...query,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/contract-templates`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createContractTemplateSchema, request.body);
    const result = await createContractTemplate(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/contract-clauses`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(contractClauseListQuerySchema, request.query ?? {});
    return listContractClausesLibrary(deps.db, account, org(request.params as Params), {
      ...query,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/contract-clauses`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createContractClauseSchema, request.body);
    const result = await createContractClauseLibrary(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/contract-approval-policies`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(contractApprovalListQuerySchema, request.query ?? {});
    return listContractApprovalPolicies(deps.db, account, org(request.params as Params), {
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/contract-approval-policies`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createContractApprovalPolicySchema, request.body);
    const result = await createContractApprovalPolicy(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });
}
