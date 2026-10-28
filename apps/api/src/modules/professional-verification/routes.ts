import {
  createProfessionalVerificationCaseSchema,
  createProfessionalSuspensionSchema,
  createRevalidationRequestSchema,
  parseInput,
  professionalVerificationReviewSchema,
  recordBiometricConsentSchema,
  submitProfessionalCpfSchema,
  submitProfessionalIdentityDocumentSchema,
  submitProfessionalOabSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  createProfessionalSuspension,
  createProfessionalVerificationCase,
  createRevalidationRequest,
  getProfessionalTrustSummary,
  getProfessionalVerificationProvidersStatus,
  listOrgProfessionalVerificationCases,
  listOwnProfessionalVerificationCases,
  recordBiometricConsent,
  reviewProfessionalVerificationCase,
  startBiometricSession,
  submitProfessionalCpf,
  submitProfessionalIdentityDocument,
  submitProfessionalOab,
  type ProfessionalVerificationModuleDeps,
} from "./service.js";

type Params = {
  organizationId?: string;
  caseId?: string;
  sessionId?: string;
  profileUserId?: string;
};

function moduleDeps(deps: ApiDeps): ProfessionalVerificationModuleDeps {
  if (
    !deps.oabVerificationProvider ||
    !deps.cpfVerificationProvider ||
    !deps.documentVerificationProvider ||
    !deps.biometricVerificationProvider
  ) {
    throw new Error("Provedores de verificação profissional não configurados em ApiDeps.");
  }
  return {
    oabVerificationProvider: deps.oabVerificationProvider,
    cpfVerificationProvider: deps.cpfVerificationProvider,
    documentVerificationProvider: deps.documentVerificationProvider,
    biometricVerificationProvider: deps.biometricVerificationProvider,
  };
}

export async function registerProfessionalVerificationRoutes(app: FastifyInstance, deps: ApiDeps) {
  const orgRoot = "/organizations/:organizationId";
  const org = (params: Params) => parseInput(uuidSchema, params.organizationId);

  app.get("/professional-verification/providers/status", async (request) => {
    await requireAccount(deps, request);
    return getProfessionalVerificationProvidersStatus(moduleDeps(deps));
  });

  app.get("/professional-verification/trust-summary/:profileUserId", async (request) => {
    await requireAccount(deps, request);
    const profileUserId = parseInput(uuidSchema, (request.params as Params).profileUserId);
    return getProfessionalTrustSummary(deps.db, profileUserId);
  });

  app.get(`${orgRoot}/professional-verification/cases/mine`, async (request) => {
    const account = await requireAccount(deps, request);
    return listOwnProfessionalVerificationCases(deps.db, account, org(request.params as Params));
  });

  app.get(`${orgRoot}/professional-verification/cases`, async (request) => {
    const account = await requireAccount(deps, request);
    return listOrgProfessionalVerificationCases(deps.db, account, org(request.params as Params));
  });

  app.post(`${orgRoot}/professional-verification/cases`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createProfessionalVerificationCaseSchema, request.body);
    const result = await createProfessionalVerificationCase(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${orgRoot}/professional-verification/cases/:caseId/cpf`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(submitProfessionalCpfSchema, request.body);
    return submitProfessionalCpf(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.caseId),
      input,
      moduleDeps(deps),
      meta(request),
    );
  });

  app.post(`${orgRoot}/professional-verification/cases/:caseId/oab`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(submitProfessionalOabSchema, request.body);
    return submitProfessionalOab(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.caseId),
      input,
      moduleDeps(deps),
      meta(request),
    );
  });

  app.post(
    `${orgRoot}/professional-verification/cases/:caseId/documents`,
    async (request, reply) => {
      const account = await requireAccount(deps, request);
      const params = request.params as Params;
      const input = parseInput(submitProfessionalIdentityDocumentSchema, request.body);
      const result = await submitProfessionalIdentityDocument(
        deps.db,
        account,
        org(params),
        parseInput(uuidSchema, params.caseId),
        input,
        moduleDeps(deps),
        meta(request),
      );
      return reply.status(201).send(result);
    },
  );

  app.post(
    `${orgRoot}/professional-verification/cases/:caseId/biometric/consent`,
    async (request, reply) => {
      const account = await requireAccount(deps, request);
      const params = request.params as Params;
      const input = parseInput(recordBiometricConsentSchema, request.body);
      const result = await recordBiometricConsent(
        deps.db,
        account,
        org(params),
        parseInput(uuidSchema, params.caseId),
        input,
        meta(request),
      );
      return reply.status(201).send(result);
    },
  );

  app.post(
    `${orgRoot}/professional-verification/cases/:caseId/biometric/sessions/:sessionId/start`,
    async (request) => {
      const account = await requireAccount(deps, request);
      const params = request.params as Params;
      return startBiometricSession(
        deps.db,
        account,
        org(params),
        parseInput(uuidSchema, params.caseId),
        parseInput(uuidSchema, params.sessionId),
        moduleDeps(deps),
        meta(request),
      );
    },
  );

  app.post(`${orgRoot}/professional-verification/cases/:caseId/reviews`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(professionalVerificationReviewSchema, request.body);
    return reviewProfessionalVerificationCase(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.caseId),
      input,
      moduleDeps(deps),
      meta(request),
    );
  });

  app.post(`${orgRoot}/professional-verification/suspensions`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createProfessionalSuspensionSchema, request.body);
    const result = await createProfessionalSuspension(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${orgRoot}/professional-verification/revalidations`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createRevalidationRequestSchema, request.body);
    const result = await createRevalidationRequest(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });
}
