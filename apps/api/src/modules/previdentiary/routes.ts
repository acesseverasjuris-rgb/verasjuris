import {
  cnisImportListQuerySchema,
  compareBenefitScenariosSchema,
  createCnisImportSchema,
  createPrevidentiaryCalculationSchema,
  createPrevidentiaryCaseSchema,
  createPrevidentiaryMedicalExamSchema,
  createPrevidentiaryRequestSchema,
  createPrevidentiaryRuleSetSchema,
  createPrevidentiarySocialAssessmentSchema,
  createRuralPeriodSchema,
  createSocialSecurityBenefitSchema,
  createSocialSecurityContributionSchema,
  createSocialSecurityPeriodSchema,
  createSpecialPeriodSchema,
  linkPrevidentiaryDocumentSchema,
  parseInput,
  previdentiaryCalculationListQuerySchema,
  previdentiaryCaseListQuerySchema,
  previdentiaryRequestListQuerySchema,
  reviewCnisEntrySchema,
  reviewPrevidentiaryCalculationSchema,
  runPrevidentiaryCalculationSchema,
  socialSecurityBenefitListQuerySchema,
  updatePrevidentiaryCalculationSchema,
  updatePrevidentiaryCaseSchema,
  updatePrevidentiaryRequestSchema,
  updateSocialSecurityBenefitSchema,
  upsertPrevidentiaryClientProfileSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  compareScenarios,
  createBenefit,
  createCalculation,
  createCnisImport,
  createContribution,
  createMedicalExam,
  createPeriod,
  createPrevidentiaryCase,
  createRequest,
  createRuleSet,
  createRuralPeriod,
  createSocialAssessment,
  createSpecialPeriod,
  getBenefit,
  getCalculation,
  getClientProfile,
  getCnisImport,
  getPrevidentiaryCase,
  getProviderHealth,
  getRequest,
  linkDocument,
  listBenefitTypes,
  listBenefits,
  listCalculations,
  listCnisImports,
  listContributions,
  listLinkedDocuments,
  listMedicalExams,
  listPeriods,
  listPrevidentiaryCases,
  listRequests,
  listRuleSets,
  reviewCalculation,
  reviewCnisEntry,
  runCalculation,
  updateBenefit,
  updateCalculation,
  updatePrevidentiaryCase,
  updateRequest,
  upsertClientProfile,
} from "./service.js";

type Params = {
  organizationId?: string;
  caseId?: string;
  benefitId?: string;
  requestId?: string;
  calculationId?: string;
  importId?: string;
  entryId?: string;
  clientId?: string;
  targetType?: string;
  targetId?: string;
};

export async function registerPrevidentiaryRoutes(app: FastifyInstance, deps: ApiDeps) {
  const root = "/organizations/:organizationId";
  const org = (params: Params) => parseInput(uuidSchema, params.organizationId);

  app.get(`${root}/previdentiary/providers/health`, async (request) => {
    const account = await requireAccount(deps, request);
    return getProviderHealth(deps, account, org(request.params as Params));
  });

  app.get(`${root}/previdentiary/benefit-types`, async (request) => {
    const account = await requireAccount(deps, request);
    return listBenefitTypes(deps.db, account, org(request.params as Params));
  });

  /* cases */
  app.post(`${root}/previdentiary-cases`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createPrevidentiaryCaseSchema, request.body);
    const result = await createPrevidentiaryCase(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/previdentiary-cases`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(previdentiaryCaseListQuerySchema, request.query ?? {});
    return listPrevidentiaryCases(deps.db, account, org(request.params as Params), query);
  });

  app.get(`${root}/previdentiary-cases/:caseId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getPrevidentiaryCase(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.caseId),
    );
  });

  app.patch(`${root}/previdentiary-cases/:caseId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updatePrevidentiaryCaseSchema, request.body);
    return updatePrevidentiaryCase(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.caseId),
      input,
      meta(request),
    );
  });

  app.get(`${root}/previdentiary-cases/:caseId/periods`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listPeriods(deps.db, account, org(params), parseInput(uuidSchema, params.caseId));
  });

  app.post(`${root}/previdentiary-cases/:caseId/periods`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const caseId = parseInput(uuidSchema, params.caseId);
    const input = parseInput(createSocialSecurityPeriodSchema, {
      ...(request.body as object),
      previdentiaryCaseId: caseId,
    });
    const result = await createPeriod(deps.db, account, org(params), input, meta(request));
    return reply.status(201).send(result);
  });

  app.get(`${root}/previdentiary-cases/:caseId/contributions`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listContributions(deps.db, account, org(params), parseInput(uuidSchema, params.caseId));
  });

  app.post(`${root}/previdentiary-cases/:caseId/contributions`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const caseId = parseInput(uuidSchema, params.caseId);
    const input = parseInput(createSocialSecurityContributionSchema, {
      ...(request.body as object),
      previdentiaryCaseId: caseId,
    });
    const result = await createContribution(deps.db, account, org(params), input, meta(request));
    return reply.status(201).send(result);
  });

  app.post(`${root}/previdentiary-cases/:caseId/special-periods`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const caseId = parseInput(uuidSchema, params.caseId);
    const input = parseInput(createSpecialPeriodSchema, {
      ...(request.body as object),
      previdentiaryCaseId: caseId,
    });
    const result = await createSpecialPeriod(deps.db, account, org(params), input, meta(request));
    return reply.status(201).send(result);
  });

  app.post(`${root}/previdentiary-cases/:caseId/rural-periods`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const caseId = parseInput(uuidSchema, params.caseId);
    const input = parseInput(createRuralPeriodSchema, {
      ...(request.body as object),
      previdentiaryCaseId: caseId,
    });
    const result = await createRuralPeriod(deps.db, account, org(params), input, meta(request));
    return reply.status(201).send(result);
  });

  app.get(`${root}/previdentiary-cases/:caseId/documents`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listLinkedDocuments(
      deps.db,
      account,
      org(params),
      "previdentiary_case",
      parseInput(uuidSchema, params.caseId),
    );
  });

  app.post(`${root}/previdentiary-cases/:caseId/benefits`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const caseId = parseInput(uuidSchema, params.caseId);
    const input = parseInput(createSocialSecurityBenefitSchema, {
      ...(request.body as object),
      previdentiaryCaseId: caseId,
    });
    const result = await createBenefit(deps.db, account, org(params), input, meta(request));
    return reply.status(201).send(result);
  });

  app.get(`${root}/previdentiary-cases/:caseId/benefits`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const query = parseInput(socialSecurityBenefitListQuerySchema, {
      ...(request.query as object),
      previdentiaryCaseId: parseInput(uuidSchema, params.caseId),
    });
    return listBenefits(deps.db, account, org(params), query);
  });

  /* client profiles */
  app.get(`${root}/previdentiary-client-profiles/:clientId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const query = parseInput(previdentiaryCaseListQuerySchema.pick({ maskSensitive: true }), {
      ...(request.query as object),
    });
    return getClientProfile(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.clientId),
      { maskSensitive: query.maskSensitive },
    );
  });

  app.put(`${root}/previdentiary-client-profiles`, async (request) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(upsertPrevidentiaryClientProfileSchema, request.body);
    return upsertClientProfile(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
  });

  /* benefits */
  app.get(`${root}/previdentiary-benefits`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(socialSecurityBenefitListQuerySchema, request.query ?? {});
    return listBenefits(deps.db, account, org(request.params as Params), query);
  });

  app.get(`${root}/previdentiary-benefits/:benefitId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getBenefit(deps.db, account, org(params), parseInput(uuidSchema, params.benefitId));
  });

  app.patch(`${root}/previdentiary-benefits/:benefitId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updateSocialSecurityBenefitSchema, request.body);
    return updateBenefit(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.benefitId),
      input,
      meta(request),
    );
  });

  /* requests */
  app.post(`${root}/previdentiary-requests`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createPrevidentiaryRequestSchema, request.body);
    const result = await createRequest(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/previdentiary-requests`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(previdentiaryRequestListQuerySchema, request.query ?? {});
    return listRequests(deps.db, account, org(request.params as Params), query);
  });

  app.get(`${root}/previdentiary-requests/:requestId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getRequest(deps.db, account, org(params), parseInput(uuidSchema, params.requestId));
  });

  app.patch(`${root}/previdentiary-requests/:requestId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updatePrevidentiaryRequestSchema, request.body);
    return updateRequest(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.requestId),
      input,
      meta(request),
    );
  });

  app.post(`${root}/previdentiary-requests/:requestId/medical-exams`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const requestId = parseInput(uuidSchema, params.requestId);
    const input = parseInput(createPrevidentiaryMedicalExamSchema, {
      ...(request.body as object),
      requestId,
    });
    const result = await createMedicalExam(deps.db, account, org(params), input, meta(request));
    return reply.status(201).send(result);
  });

  app.get(`${root}/previdentiary-requests/:requestId/medical-exams`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listMedicalExams(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.requestId),
    );
  });

  app.post(
    `${root}/previdentiary-requests/:requestId/social-assessments`,
    async (request, reply) => {
      const account = await requireAccount(deps, request);
      const params = request.params as Params;
      const requestId = parseInput(uuidSchema, params.requestId);
      const input = parseInput(createPrevidentiarySocialAssessmentSchema, {
        ...(request.body as object),
        requestId,
      });
      const result = await createSocialAssessment(
        deps.db,
        account,
        org(params),
        input,
        meta(request),
      );
      return reply.status(201).send(result);
    },
  );

  /* calculations */
  app.post(`${root}/previdentiary-calculations`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createPrevidentiaryCalculationSchema, request.body);
    const result = await createCalculation(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/previdentiary-calculations`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(previdentiaryCalculationListQuerySchema, request.query ?? {});
    return listCalculations(deps.db, account, org(request.params as Params), query);
  });

  app.get(`${root}/previdentiary-calculations/:calculationId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getCalculation(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.calculationId),
    );
  });

  app.patch(`${root}/previdentiary-calculations/:calculationId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updatePrevidentiaryCalculationSchema, request.body);
    return updateCalculation(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.calculationId),
      input,
      meta(request),
    );
  });

  app.post(`${root}/previdentiary-calculations/:calculationId/run`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(runPrevidentiaryCalculationSchema, request.body ?? {});
    return runCalculation(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.calculationId),
      input,
      meta(request),
    );
  });

  app.post(`${root}/previdentiary-calculations/:calculationId/review`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(reviewPrevidentiaryCalculationSchema, request.body);
    return reviewCalculation(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.calculationId),
      input,
      meta(request),
    );
  });

  /* rule sets / scenarios */
  app.get(`${root}/previdentiary-rule-sets`, async (request) => {
    const account = await requireAccount(deps, request);
    return listRuleSets(deps.db, account, org(request.params as Params));
  });

  app.post(`${root}/previdentiary-rule-sets`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createPrevidentiaryRuleSetSchema, request.body);
    const result = await createRuleSet(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/previdentiary-scenarios/compare`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(compareBenefitScenariosSchema, request.body);
    const result = await compareScenarios(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  /* CNIS */
  app.post(`${root}/cnis-imports`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createCnisImportSchema, request.body);
    const result = await createCnisImport(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/cnis-imports`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(cnisImportListQuerySchema, request.query ?? {});
    return listCnisImports(deps.db, account, org(request.params as Params), query);
  });

  app.get(`${root}/cnis-imports/:importId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getCnisImport(deps.db, account, org(params), parseInput(uuidSchema, params.importId));
  });

  app.post(`${root}/cnis-entries/:entryId/review`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(reviewCnisEntrySchema, request.body);
    return reviewCnisEntry(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.entryId),
      input,
      meta(request),
    );
  });

  /* documents */
  app.post(`${root}/previdentiary-document-links`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(linkPrevidentiaryDocumentSchema, request.body);
    const result = await linkDocument(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/previdentiary-document-links/:targetType/:targetId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listLinkedDocuments(
      deps.db,
      account,
      org(params),
      String(params.targetType),
      parseInput(uuidSchema, params.targetId),
    );
  });
}
