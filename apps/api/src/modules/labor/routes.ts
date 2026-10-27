import {
  createEmploymentContractHistorySchema,
  createEmploymentContractSchema,
  createEmploymentTerminationSchema,
  createFgtsRecordSchema,
  createLaborCalculationSchema,
  createLaborCaseSchema,
  createLaborClaimItemSchema,
  createLaborLiquidationSchema,
  createLaborRemunerationItemSchema,
  createLaborRuleSetSchema,
  createVacationPeriodSchema,
  createWorkScheduleSchema,
  createWorkTimeRecordSchema,
  laborCaseListQuerySchema,
  laborCaseScopedListQuerySchema,
  linkLaborDocumentSchema,
  parseInput,
  reviewLaborCalculationSchema,
  suggestLaborDeadlinesSchema,
  suggestLaborTasksSchema,
  updateEmploymentContractSchema,
  updateLaborCaseSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  addContractHistory,
  createEmploymentContract,
  createEmploymentTermination,
  createFgtsRecord,
  createLaborCalculation,
  createLaborCase,
  createLaborClaimItem,
  createLaborLiquidation,
  createLaborRemunerationItem,
  createLaborRuleSet,
  createVacationPeriod,
  createWorkSchedule,
  createWorkTimeRecord,
  getLaborCalculation,
  getLaborCase,
  getLaborCaseTimeline,
  getLaborProvidersStatus,
  linkLaborCaseDocument,
  listContractHistory,
  listEmploymentContracts,
  listEmploymentTerminations,
  listFgtsRecords,
  listLaborCalculations,
  listLaborCaseDocuments,
  listLaborCases,
  listLaborClaims,
  listLaborLiquidations,
  listLaborRemuneration,
  listLaborRuleSets,
  listVacations,
  listWorkSchedules,
  listWorkTimeRecords,
  reviewLaborCalculation,
  runLaborCalculation,
  suggestLaborDeadlines,
  suggestLaborTasks,
  updateEmploymentContract,
  updateLaborCase,
  type LaborModuleDeps,
} from "./service.js";

type Params = {
  organizationId?: string;
  laborCaseId?: string;
  contractId?: string;
  calculationId?: string;
};

export function laborModuleDeps(deps: ApiDeps): LaborModuleDeps {
  if (
    !deps.eSocialProvider ||
    !deps.fgtsProvider ||
    !deps.laborCourtProvider ||
    !deps.timeTrackingImportProvider
  ) {
    throw new Error("Provedores trabalhistas não configurados em ApiDeps.");
  }
  return {
    eSocialProvider: deps.eSocialProvider,
    fgtsProvider: deps.fgtsProvider,
    laborCourtProvider: deps.laborCourtProvider,
    timeTrackingImportProvider: deps.timeTrackingImportProvider,
    notifications: deps.notifications,
    holidays: deps.holidays,
  };
}

export async function registerLaborRoutes(app: FastifyInstance, deps: ApiDeps) {
  const org = (params: Params) => parseInput(uuidSchema, params.organizationId);
  const caseId = (params: Params) => parseInput(uuidSchema, params.laborCaseId);
  const contractId = (params: Params) => parseInput(uuidSchema, params.contractId);
  const calculationId = (params: Params) => parseInput(uuidSchema, params.calculationId);
  const root = "/organizations/:organizationId";
  const moduleDeps = () => laborModuleDeps(deps);

  app.get(`${root}/labor-providers/status`, async (request) => {
    const account = await requireAccount(deps, request);
    return getLaborProvidersStatus(account, org(request.params as Params), moduleDeps());
  });

  /* cases */
  app.get(`${root}/labor-cases`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(laborCaseListQuerySchema, request.query ?? {});
    return listLaborCases(deps.db, account, org(request.params as Params), {
      ...query,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/labor-cases`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createLaborCaseSchema, request.body);
    const result = await createLaborCase(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/labor-cases/:laborCaseId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getLaborCase(deps.db, account, org(params), caseId(params));
  });

  app.patch(`${root}/labor-cases/:laborCaseId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updateLaborCaseSchema, request.body);
    return updateLaborCase(deps.db, account, org(params), caseId(params), input, meta(request));
  });

  app.get(`${root}/labor-cases/:laborCaseId/timeline`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getLaborCaseTimeline(deps.db, account, org(params), caseId(params));
  });

  app.get(`${root}/labor-cases/:laborCaseId/documents`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listLaborCaseDocuments(deps.db, account, org(params), caseId(params));
  });

  app.post(`${root}/labor-cases/:laborCaseId/documents`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(linkLaborDocumentSchema, request.body);
    const result = await linkLaborCaseDocument(
      deps.db,
      account,
      org(params),
      caseId(params),
      input,
      meta(request),
    );
    return reply.status(result.replayed ? 200 : 201).send(result);
  });

  app.post(`${root}/labor-cases/:laborCaseId/suggest-tasks`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(suggestLaborTasksSchema, request.body ?? {});
    const result = await suggestLaborTasks(
      deps.db,
      account,
      org(params),
      caseId(params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/labor-cases/:laborCaseId/suggest-deadlines`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(suggestLaborDeadlinesSchema, request.body);
    const result = await suggestLaborDeadlines(
      { db: deps.db, ...moduleDeps() },
      account,
      org(params),
      caseId(params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  /* contracts */
  app.get(`${root}/employment-contracts`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(laborCaseScopedListQuerySchema, request.query ?? {});
    return listEmploymentContracts(deps.db, account, org(request.params as Params), {
      laborCaseId: query.laborCaseId,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/employment-contracts`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createEmploymentContractSchema, request.body);
    const result = await createEmploymentContract(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.patch(`${root}/employment-contracts/:contractId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updateEmploymentContractSchema, request.body);
    return updateEmploymentContract(
      deps.db,
      account,
      org(params),
      contractId(params),
      input,
      meta(request),
    );
  });

  app.get(`${root}/employment-contracts/:contractId/history`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listContractHistory(deps.db, account, org(params), contractId(params));
  });

  app.post(`${root}/employment-contracts/:contractId/history`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const body = parseInput(createEmploymentContractHistorySchema, {
      ...(request.body as object),
      contractId: contractId(params),
    });
    const result = await addContractHistory(deps.db, account, org(params), body, meta(request));
    return reply.status(201).send(result);
  });

  /* schedules + time */
  app.get(`${root}/work-schedules`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(laborCaseScopedListQuerySchema, request.query ?? {});
    return listWorkSchedules(deps.db, account, org(request.params as Params), {
      laborCaseId: query.laborCaseId,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/work-schedules`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createWorkScheduleSchema, request.body);
    const result = await createWorkSchedule(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/work-time-records`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(laborCaseScopedListQuerySchema, request.query ?? {});
    return listWorkTimeRecords(deps.db, account, org(request.params as Params), {
      laborCaseId: query.laborCaseId,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/work-time-records`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createWorkTimeRecordSchema, request.body);
    const result = await createWorkTimeRecord(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  /* remuneration */
  app.get(`${root}/labor-remuneration`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(laborCaseScopedListQuerySchema, request.query ?? {});
    return listLaborRemuneration(deps.db, account, org(request.params as Params), {
      laborCaseId: query.laborCaseId,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/labor-remuneration`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createLaborRemunerationItemSchema, request.body);
    const result = await createLaborRemunerationItem(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  /* vacations */
  app.get(`${root}/vacations`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(laborCaseScopedListQuerySchema, request.query ?? {});
    return listVacations(deps.db, account, org(request.params as Params), {
      laborCaseId: query.laborCaseId,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/vacations`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createVacationPeriodSchema, request.body);
    const result = await createVacationPeriod(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  /* FGTS */
  app.get(`${root}/fgts`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(laborCaseScopedListQuerySchema, request.query ?? {});
    return listFgtsRecords(deps.db, account, org(request.params as Params), {
      laborCaseId: query.laborCaseId,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/fgts`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createFgtsRecordSchema, request.body);
    const result = await createFgtsRecord(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  /* terminations */
  app.get(`${root}/employment-terminations`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(laborCaseScopedListQuerySchema, request.query ?? {});
    return listEmploymentTerminations(deps.db, account, org(request.params as Params), {
      laborCaseId: query.laborCaseId,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/employment-terminations`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createEmploymentTerminationSchema, request.body);
    const result = await createEmploymentTermination(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  /* claims */
  app.get(`${root}/labor-claims`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(laborCaseScopedListQuerySchema, request.query ?? {});
    return listLaborClaims(deps.db, account, org(request.params as Params), {
      laborCaseId: query.laborCaseId,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/labor-claims`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createLaborClaimItemSchema, request.body);
    const result = await createLaborClaimItem(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  /* rule sets */
  app.get(`${root}/labor-rule-sets`, async (request) => {
    const account = await requireAccount(deps, request);
    return listLaborRuleSets(deps.db, account, org(request.params as Params));
  });

  app.post(`${root}/labor-rule-sets`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createLaborRuleSetSchema, request.body);
    const result = await createLaborRuleSet(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  /* calculations */
  app.get(`${root}/labor-calculations`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(laborCaseScopedListQuerySchema, request.query ?? {});
    return listLaborCalculations(deps.db, account, org(request.params as Params), {
      laborCaseId: query.laborCaseId,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/labor-calculations`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createLaborCalculationSchema, request.body);
    const result = await createLaborCalculation(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/labor-calculations/:calculationId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getLaborCalculation(deps.db, account, org(params), calculationId(params));
  });

  app.post(`${root}/labor-calculations/:calculationId/run`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return runLaborCalculation(deps.db, account, org(params), calculationId(params), meta(request));
  });

  app.post(`${root}/labor-calculations/:calculationId/review`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(reviewLaborCalculationSchema, request.body);
    return reviewLaborCalculation(
      deps.db,
      account,
      org(params),
      calculationId(params),
      input,
      meta(request),
    );
  });

  /* liquidations */
  app.get(`${root}/labor-liquidations`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(laborCaseScopedListQuerySchema, request.query ?? {});
    return listLaborLiquidations(deps.db, account, org(request.params as Params), {
      laborCaseId: query.laborCaseId,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/labor-liquidations`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createLaborLiquidationSchema, request.body);
    const result = await createLaborLiquidation(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });
}
