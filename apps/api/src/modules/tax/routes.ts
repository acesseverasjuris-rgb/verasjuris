import {
  createTaxAdministrativeCaseSchema,
  createTaxAssessmentSchema,
  createTaxCalculationSchema,
  createTaxCaseSchema,
  createTaxCaseThesisLinkSchema,
  createTaxCompensationSchema,
  createTaxCreditSchema,
  createTaxDebtCertificateSchema,
  createTaxEnforcementCaseSchema,
  createTaxGuaranteeSchema,
  createTaxLegalThesisSchema,
  createTaxObligationSchema,
  createTaxRefundRequestSchema,
  createTaxRuleSetSchema,
  createTaxTypeSchema,
  parseInput,
  reviewTaxCalculationSchema,
  taxAssessmentListQuerySchema,
  taxCalculationListQuerySchema,
  taxCaseListQuerySchema,
  taxCompensationListQuerySchema,
  taxCreditListQuerySchema,
  taxObligationListQuerySchema,
  taxRefundListQuerySchema,
  taxThesisListQuerySchema,
  taxTypeListQuerySchema,
  updateTaxAssessmentSchema,
  updateTaxCaseSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  createTaxAdministrativeCase,
  createTaxAssessment,
  createTaxCalculation,
  createTaxCase,
  createTaxCaseThesisLink,
  createTaxCompensation,
  createTaxCredit,
  createTaxDebtCertificate,
  createTaxEnforcement,
  createTaxGuarantee,
  createTaxLegalThesis,
  createTaxObligation,
  createTaxRefund,
  createTaxRuleSet,
  createTaxType,
  getTaxCase,
  getTaxCaseTimeline,
  getTaxProvidersStatus,
  listTaxAdministrativeCases,
  listTaxAssessments,
  listTaxCalculations,
  listTaxCases,
  listTaxCaseThesisLinks,
  listTaxCompensations,
  listTaxCredits,
  listTaxDebtCertificates,
  listTaxEnforcements,
  listTaxGuarantees,
  listTaxObligations,
  listTaxRefunds,
  listTaxRuleSets,
  listTaxTheses,
  listTaxTypes,
  reviewTaxCalculation,
  runTaxCalculation,
  updateTaxAssessment,
  updateTaxCase,
  type TaxModuleDeps,
} from "./service.js";

type Params = {
  organizationId?: string;
  taxCaseId?: string;
  assessmentId?: string;
  calculationId?: string;
};

export function taxModuleDeps(deps: ApiDeps): TaxModuleDeps {
  if (
    !deps.federalTaxProvider ||
    !deps.stateTaxProvider ||
    !deps.municipalTaxProvider ||
    !deps.taxDebtProvider ||
    !deps.taxFilingProvider
  ) {
    throw new Error("Provedores tributários não configurados em ApiDeps.");
  }
  return {
    federalTaxProvider: deps.federalTaxProvider,
    stateTaxProvider: deps.stateTaxProvider,
    municipalTaxProvider: deps.municipalTaxProvider,
    taxDebtProvider: deps.taxDebtProvider,
    taxFilingProvider: deps.taxFilingProvider,
  };
}

export async function registerTaxRoutes(app: FastifyInstance, deps: ApiDeps) {
  const root = "/organizations/:organizationId";
  const org = (params: Params) => parseInput(uuidSchema, params.organizationId);
  const caseId = (params: Params) => parseInput(uuidSchema, params.taxCaseId);
  const moduleDeps = () => taxModuleDeps(deps);

  app.get(`${root}/tax-providers/status`, async (request) => {
    const account = await requireAccount(deps, request);
    return getTaxProvidersStatus(account, org(request.params as Params), moduleDeps());
  });

  app.get(`${root}/tax-types`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(taxTypeListQuerySchema, request.query ?? {});
    return listTaxTypes(deps.db, account, org(request.params as Params), query);
  });

  app.post(`${root}/tax-types`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createTaxTypeSchema, request.body);
    const result = await createTaxType(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/tax-rule-sets`, async (request) => {
    const account = await requireAccount(deps, request);
    return listTaxRuleSets(deps.db, account, org(request.params as Params));
  });

  app.post(`${root}/tax-rule-sets`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createTaxRuleSetSchema, request.body);
    const result = await createTaxRuleSet(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/tax-theses`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(taxThesisListQuerySchema, request.query ?? {});
    return listTaxTheses(deps.db, account, org(request.params as Params), query);
  });

  app.post(`${root}/tax-theses`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createTaxLegalThesisSchema, request.body);
    const result = await createTaxLegalThesis(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  /* cases */
  app.post(`${root}/tax-cases`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createTaxCaseSchema, request.body);
    const result = await createTaxCase(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/tax-cases`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(taxCaseListQuerySchema, request.query ?? {});
    return listTaxCases(deps.db, account, org(request.params as Params), query);
  });

  app.get(`${root}/tax-cases/:taxCaseId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getTaxCase(deps.db, account, org(params), caseId(params));
  });

  app.patch(`${root}/tax-cases/:taxCaseId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updateTaxCaseSchema, request.body);
    return updateTaxCase(deps.db, account, org(params), caseId(params), input, meta(request));
  });

  app.get(`${root}/tax-cases/:taxCaseId/timeline`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getTaxCaseTimeline(deps.db, account, org(params), caseId(params));
  });

  app.post(`${root}/tax-cases/:taxCaseId/obligations`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createTaxObligationSchema, {
      ...(request.body as object),
      taxCaseId: caseId(params),
    });
    const result = await createTaxObligation(deps.db, account, org(params), input, meta(request));
    return reply.status(201).send(result);
  });

  app.get(`${root}/tax-cases/:taxCaseId/obligations`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const query = parseInput(taxObligationListQuerySchema, {
      ...(request.query as object),
      taxCaseId: caseId(params),
    });
    return listTaxObligations(deps.db, account, org(params), query);
  });

  app.post(`${root}/tax-cases/:taxCaseId/credits`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createTaxCreditSchema, {
      ...(request.body as object),
      taxCaseId: caseId(params),
    });
    const result = await createTaxCredit(deps.db, account, org(params), input, meta(request));
    return reply.status(201).send(result);
  });

  app.get(`${root}/tax-cases/:taxCaseId/credits`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const query = parseInput(taxCreditListQuerySchema, {
      ...(request.query as object),
      taxCaseId: caseId(params),
    });
    return listTaxCredits(deps.db, account, org(params), query);
  });

  app.post(`${root}/tax-cases/:taxCaseId/refunds`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createTaxRefundRequestSchema, {
      ...(request.body as object),
      taxCaseId: caseId(params),
    });
    const result = await createTaxRefund(deps.db, account, org(params), input, meta(request));
    return reply.status(201).send(result);
  });

  app.get(`${root}/tax-cases/:taxCaseId/refunds`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const query = parseInput(taxRefundListQuerySchema, {
      ...(request.query as object),
      taxCaseId: caseId(params),
    });
    return listTaxRefunds(deps.db, account, org(params), query);
  });

  app.post(`${root}/tax-cases/:taxCaseId/compensations`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createTaxCompensationSchema, {
      ...(request.body as object),
      taxCaseId: caseId(params),
    });
    const result = await createTaxCompensation(deps.db, account, org(params), input, meta(request));
    return reply.status(201).send(result);
  });

  app.get(`${root}/tax-cases/:taxCaseId/compensations`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const query = parseInput(taxCompensationListQuerySchema, {
      ...(request.query as object),
      taxCaseId: caseId(params),
    });
    return listTaxCompensations(deps.db, account, org(params), query);
  });

  app.post(`${root}/tax-cases/:taxCaseId/assessments`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createTaxAssessmentSchema, {
      ...(request.body as object),
      taxCaseId: caseId(params),
    });
    const result = await createTaxAssessment(deps.db, account, org(params), input, meta(request));
    return reply.status(201).send(result);
  });

  app.get(`${root}/tax-cases/:taxCaseId/assessments`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const query = parseInput(taxAssessmentListQuerySchema, {
      ...(request.query as object),
      taxCaseId: caseId(params),
    });
    return listTaxAssessments(deps.db, account, org(params), query);
  });

  app.patch(`${root}/tax-assessments/:assessmentId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updateTaxAssessmentSchema, request.body);
    return updateTaxAssessment(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.assessmentId),
      input,
      meta(request),
    );
  });

  app.post(`${root}/tax-cases/:taxCaseId/administrative-cases`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createTaxAdministrativeCaseSchema, {
      ...(request.body as object),
      taxCaseId: caseId(params),
    });
    const result = await createTaxAdministrativeCase(
      deps.db,
      account,
      org(params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/tax-cases/:taxCaseId/administrative-cases`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listTaxAdministrativeCases(deps.db, account, org(params), caseId(params));
  });

  app.post(`${root}/tax-cases/:taxCaseId/debt-certificates`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createTaxDebtCertificateSchema, {
      ...(request.body as object),
      taxCaseId: caseId(params),
    });
    const result = await createTaxDebtCertificate(
      deps.db,
      account,
      org(params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/tax-cases/:taxCaseId/debt-certificates`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listTaxDebtCertificates(deps.db, account, org(params), caseId(params));
  });

  app.post(`${root}/tax-cases/:taxCaseId/enforcements`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createTaxEnforcementCaseSchema, {
      ...(request.body as object),
      taxCaseId: caseId(params),
    });
    const result = await createTaxEnforcement(deps.db, account, org(params), input, meta(request));
    return reply.status(201).send(result);
  });

  app.get(`${root}/tax-cases/:taxCaseId/enforcements`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listTaxEnforcements(deps.db, account, org(params), caseId(params));
  });

  app.post(`${root}/tax-cases/:taxCaseId/guarantees`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createTaxGuaranteeSchema, {
      ...(request.body as object),
      taxCaseId: caseId(params),
    });
    const result = await createTaxGuarantee(deps.db, account, org(params), input, meta(request));
    return reply.status(201).send(result);
  });

  app.get(`${root}/tax-cases/:taxCaseId/guarantees`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listTaxGuarantees(deps.db, account, org(params), caseId(params));
  });

  app.post(`${root}/tax-cases/:taxCaseId/thesis-links`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createTaxCaseThesisLinkSchema, {
      ...(request.body as object),
      taxCaseId: caseId(params),
    });
    const result = await createTaxCaseThesisLink(
      deps.db,
      account,
      org(params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/tax-cases/:taxCaseId/thesis-links`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listTaxCaseThesisLinks(deps.db, account, org(params), caseId(params));
  });

  app.post(`${root}/tax-cases/:taxCaseId/calculations`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createTaxCalculationSchema, {
      ...(request.body as object),
      taxCaseId: caseId(params),
    });
    const result = await createTaxCalculation(deps.db, account, org(params), input, meta(request));
    return reply.status(201).send(result);
  });

  app.get(`${root}/tax-cases/:taxCaseId/calculations`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const query = parseInput(taxCalculationListQuerySchema, {
      ...(request.query as object),
      taxCaseId: caseId(params),
    });
    return listTaxCalculations(deps.db, account, org(params), query);
  });

  app.post(`${root}/tax-calculations/:calculationId/run`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const body = (request.body ?? {}) as { inputSnapshot?: Record<string, unknown> };
    return runTaxCalculation(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.calculationId),
      { inputSnapshot: body.inputSnapshot },
      meta(request),
    );
  });

  app.post(`${root}/tax-calculations/:calculationId/review`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(reviewTaxCalculationSchema, request.body);
    return reviewTaxCalculation(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.calculationId),
      input,
      meta(request),
    );
  });
}
