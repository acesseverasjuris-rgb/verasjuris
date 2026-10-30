import {
  controlApprovalListQuerySchema,
  controlEmployeeListQuerySchema,
  controlGoalListQuerySchema,
  controlKpiListQuerySchema,
  controlVendorListQuerySchema,
  createComplianceAuditSchema,
  createComplianceControlSchema,
  createComplianceIncidentSchema,
  createComplianceObligationSchema,
  createComplianceRiskSchema,
  createControlApprovalRequestSchema,
  createControlDepartmentSchema,
  createControlEmployeeSchema,
  createControlGoalSchema,
  createControlKpiSchema,
  createControlPositionSchema,
  createControlProjectSchema,
  createControlVendorSchema,
  createCostCenterSchema,
  createEmployeeLeaveRequestSchema,
  createEmployeePerformanceReviewSchema,
  createExpenseReportItemSchema,
  createExpenseReportSchema,
  createIntellectualPropertySchema,
  createInternalBudgetLineSchema,
  createInternalBudgetSchema,
  createInternalDueDiligenceSchema,
  createInternalPolicySchema,
  createProductBugSchema,
  createProductFeatureSchema,
  createProductReleaseSchema,
  createProductRoadmapSchema,
  createRoadmapItemSchema,
  createTechnologyIncidentSchema,
  createVendorReviewSchema,
  createVendorSlaSchema,
  decideControlApprovalSchema,
  decideEmployeeLeaveSchema,
  expenseReportListQuerySchema,
  internalBudgetListQuerySchema,
  parseInput,
  updateControlGoalSchema,
  uuidSchema,
} from "@verasjuris/validation";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  createComplianceAudit,
  createComplianceControl,
  createComplianceIncident,
  createComplianceObligation,
  createComplianceRisk,
  listComplianceIncidents,
  listComplianceRisks,
  addComplianceFinding,
} from "./compliance-service.js";
import {
  createControlApprovalRequest,
  createControlGoal,
  createControlKpi,
  decideControlApproval,
  getDirectorDashboard,
  listControlApprovals,
  listControlGoals,
  listControlKpis,
  refreshControlKpiSnapshot,
  updateControlGoal,
} from "./director-service.js";
import {
  addExpenseReportItem,
  approveInternalBudget,
  createCostCenter,
  createExpenseReport,
  createInternalBudget,
  createInternalBudgetLine,
  getBudgetVariance,
  listCostCenters,
  listExpenseReports,
  listInternalBudgets,
  submitExpenseReport,
} from "./finance-service.js";
import {
  createControlDepartment,
  createControlEmployee,
  createControlPosition,
  createEmployeeLeaveRequest,
  createEmployeeOnboardingPlan,
  createEmployeePerformanceReview,
  decideEmployeeLeave,
  listControlDepartments,
  listControlEmployees,
  listControlPositions,
  listEmployeeLeaves,
} from "./hr-service.js";
import {
  acknowledgeInternalPolicy,
  createIntellectualProperty,
  createInternalDueDiligence,
  createInternalPolicy,
  listIntellectualProperty,
  listInternalContractsByCategory,
  listInternalMatters,
} from "./legal-service.js";
import {
  createControlProject,
  createProductBug,
  createProductFeature,
  createProductRelease,
  createProductRoadmap,
  createRoadmapItem,
  createTechnologyIncident,
  listProductBugs,
  markProductReleaseReleased,
} from "./product-service.js";
import {
  createControlVendor,
  createVendorReview,
  createVendorSla,
  listControlVendors,
  listVendorSlas,
  recordVendorSlaResult,
} from "./vendor-service.js";

const kpiSnapshotSchema = z.object({
  period: z.string().trim().min(1).max(40),
  value: z.string().trim().max(120).optional(),
});

const markReleaseSchema = z.object({
  notes: z.string().trim().max(4000).optional(),
  commitReference: z.string().trim().max(120).optional(),
});

const onboardingPlanSchema = z.object({
  employeeId: uuidSchema,
  items: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        itemType: z.string().trim().max(40).optional(),
        description: z.string().trim().max(2000).optional(),
      }),
    )
    .max(50)
    .optional(),
});

const findingSchema = z.object({
  severity: z.enum(["critical", "high", "medium", "low"]),
  description: z.string().trim().min(2).max(4000),
  ownerMembershipId: z.string().uuid().optional(),
  remediationDueAt: z.string().datetime({ offset: true }).optional(),
});

const slaResultSchema = z.object({
  periodStart: z.string().datetime({ offset: true }),
  periodEnd: z.string().datetime({ offset: true }),
  actualValue: z.string().trim().max(120).optional(),
  status: z.enum(["met", "missed", "partial", "not_measured"]),
  notes: z.string().trim().max(2000).optional(),
});

type Params = {
  organizationId?: string;
  goalId?: string;
  kpiId?: string;
  approvalId?: string;
  employeeId?: string;
  leaveId?: string;
  budgetId?: string;
  expenseReportId?: string;
  policyId?: string;
  auditId?: string;
  vendorId?: string;
  slaId?: string;
  releaseId?: string;
};

export async function registerControlRoutes(app: FastifyInstance, deps: ApiDeps) {
  const root = "/organizations/:organizationId/control";
  const org = (params: Params) => parseInput(uuidSchema, params.organizationId);

  /* ── Director ── */
  app.get(`${root}/director/dashboard`, async (request) => {
    const account = await requireAccount(deps, request);
    return getDirectorDashboard(deps.db, account, org(request.params as Params));
  });

  app.get(`${root}/goals`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(controlGoalListQuerySchema, request.query ?? {});
    return listControlGoals(deps.db, account, org(request.params as Params), query);
  });

  app.post(`${root}/goals`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createControlGoalSchema, request.body);
    const result = await createControlGoal(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.patch(`${root}/goals/:goalId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updateControlGoalSchema, request.body);
    return updateControlGoal(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.goalId),
      input,
      meta(request),
    );
  });

  app.get(`${root}/kpis`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(controlKpiListQuerySchema, request.query ?? {});
    return listControlKpis(deps.db, account, org(request.params as Params), query);
  });

  app.post(`${root}/kpis`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createControlKpiSchema, request.body);
    const result = await createControlKpi(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/kpis/:kpiId/snapshots`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(kpiSnapshotSchema, request.body);
    const result = await refreshControlKpiSnapshot(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.kpiId),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/approvals`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(controlApprovalListQuerySchema, request.query ?? {});
    return listControlApprovals(deps.db, account, org(request.params as Params), query);
  });

  app.post(`${root}/approvals`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createControlApprovalRequestSchema, request.body);
    const result = await createControlApprovalRequest(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/approvals/:approvalId/decide`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(decideControlApprovalSchema, request.body);
    return decideControlApproval(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.approvalId),
      input,
      meta(request),
    );
  });

  /* ── HR ── */
  app.get(`${root}/hr/departments`, async (request) => {
    const account = await requireAccount(deps, request);
    return listControlDepartments(deps.db, account, org(request.params as Params));
  });

  app.post(`${root}/hr/departments`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createControlDepartmentSchema, request.body);
    const result = await createControlDepartment(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/hr/positions`, async (request) => {
    const account = await requireAccount(deps, request);
    const departmentId = (request.query as { departmentId?: string })?.departmentId;
    return listControlPositions(
      deps.db,
      account,
      org(request.params as Params),
      departmentId ? parseInput(uuidSchema, departmentId) : undefined,
    );
  });

  app.post(`${root}/hr/positions`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createControlPositionSchema, request.body);
    const result = await createControlPosition(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/hr/employees`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(controlEmployeeListQuerySchema, request.query ?? {});
    return listControlEmployees(deps.db, account, org(request.params as Params), query);
  });

  app.post(`${root}/hr/employees`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createControlEmployeeSchema, request.body);
    const result = await createControlEmployee(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/hr/onboarding-plans`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(onboardingPlanSchema, request.body);
    const result = await createEmployeeOnboardingPlan(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/hr/reviews`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createEmployeePerformanceReviewSchema, request.body);
    const result = await createEmployeePerformanceReview(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/hr/leaves`, async (request) => {
    const account = await requireAccount(deps, request);
    const employeeId = (request.query as { employeeId?: string })?.employeeId;
    return listEmployeeLeaves(
      deps.db,
      account,
      org(request.params as Params),
      employeeId ? parseInput(uuidSchema, employeeId) : undefined,
    );
  });

  app.post(`${root}/hr/leaves`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createEmployeeLeaveRequestSchema, request.body);
    const result = await createEmployeeLeaveRequest(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/hr/leaves/:leaveId/decide`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(decideEmployeeLeaveSchema, request.body);
    return decideEmployeeLeave(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.leaveId),
      input,
      meta(request),
    );
  });

  /* ── Finance ── */
  app.get(`${root}/finance/cost-centers`, async (request) => {
    const account = await requireAccount(deps, request);
    return listCostCenters(deps.db, account, org(request.params as Params));
  });

  app.post(`${root}/finance/cost-centers`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createCostCenterSchema, request.body);
    const result = await createCostCenter(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/finance/budgets`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(internalBudgetListQuerySchema, request.query ?? {});
    return listInternalBudgets(deps.db, account, org(request.params as Params), query);
  });

  app.post(`${root}/finance/budgets`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createInternalBudgetSchema, request.body);
    const result = await createInternalBudget(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/finance/budgets/:budgetId/lines`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createInternalBudgetLineSchema, {
      ...(request.body as object),
      budgetId: parseInput(uuidSchema, params.budgetId),
    });
    const result = await createInternalBudgetLine(
      deps.db,
      account,
      org(params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/finance/budgets/:budgetId/approve`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return approveInternalBudget(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.budgetId),
      meta(request),
    );
  });

  app.get(`${root}/finance/budgets/:budgetId/variance`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getBudgetVariance(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.budgetId),
    );
  });

  app.get(`${root}/finance/expenses`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(expenseReportListQuerySchema, request.query ?? {});
    return listExpenseReports(deps.db, account, org(request.params as Params), query);
  });

  app.post(`${root}/finance/expenses`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createExpenseReportSchema, request.body);
    const result = await createExpenseReport(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/finance/expenses/:expenseReportId/items`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createExpenseReportItemSchema, {
      ...(request.body as object),
      expenseReportId: parseInput(uuidSchema, params.expenseReportId),
    });
    const result = await addExpenseReportItem(deps.db, account, org(params), input, meta(request));
    return reply.status(201).send(result);
  });

  app.post(`${root}/finance/expenses/:expenseReportId/submit`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return submitExpenseReport(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.expenseReportId),
      meta(request),
    );
  });

  /* ── Legal ── */
  app.get(`${root}/legal/ip`, async (request) => {
    const account = await requireAccount(deps, request);
    return listIntellectualProperty(deps.db, account, org(request.params as Params));
  });

  app.post(`${root}/legal/ip`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createIntellectualPropertySchema, request.body);
    const result = await createIntellectualProperty(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/legal/due-diligence`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createInternalDueDiligenceSchema, request.body);
    const result = await createInternalDueDiligence(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/legal/policies`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createInternalPolicySchema, request.body);
    const result = await createInternalPolicy(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/legal/policies/:policyId/acknowledge`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(
      z.object({ employeeId: z.string().uuid().optional() }),
      request.body ?? {},
    );
    const result = await acknowledgeInternalPolicy(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.policyId),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/legal/matters`, async (request) => {
    const account = await requireAccount(deps, request);
    return listInternalMatters(deps.db, account, org(request.params as Params));
  });

  app.get(`${root}/legal/contracts`, async (request) => {
    const account = await requireAccount(deps, request);
    const category = (request.query as { category?: string })?.category;
    return listInternalContractsByCategory(
      deps.db,
      account,
      org(request.params as Params),
      category,
    );
  });

  /* ── Compliance ── */
  app.get(`${root}/compliance/risks`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(
      z.object({
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).default(0),
        category: z.string().optional(),
        status: z.string().optional(),
      }),
      request.query ?? {},
    );
    return listComplianceRisks(deps.db, account, org(request.params as Params), query);
  });

  app.post(`${root}/compliance/risks`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createComplianceRiskSchema, request.body);
    const result = await createComplianceRisk(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/compliance/controls`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createComplianceControlSchema, request.body);
    const result = await createComplianceControl(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/compliance/incidents`, async (request) => {
    const account = await requireAccount(deps, request);
    return listComplianceIncidents(deps.db, account, org(request.params as Params));
  });

  app.post(`${root}/compliance/incidents`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createComplianceIncidentSchema, request.body);
    const result = await createComplianceIncident(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/compliance/audits`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createComplianceAuditSchema, request.body);
    const result = await createComplianceAudit(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/compliance/audits/:auditId/findings`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(findingSchema, request.body);
    const result = await addComplianceFinding(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.auditId),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/compliance/obligations`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createComplianceObligationSchema, request.body);
    const result = await createComplianceObligation(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  /* ── Vendors ── */
  app.get(`${root}/vendors`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(controlVendorListQuerySchema, request.query ?? {});
    return listControlVendors(deps.db, account, org(request.params as Params), query);
  });

  app.post(`${root}/vendors`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createControlVendorSchema, request.body);
    const result = await createControlVendor(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/vendors/:vendorId/slas`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listVendorSlas(deps.db, account, org(params), parseInput(uuidSchema, params.vendorId));
  });

  app.post(`${root}/vendors/slas`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createVendorSlaSchema, request.body);
    const result = await createVendorSla(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/vendors/slas/:slaId/results`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(slaResultSchema, request.body);
    const result = await recordVendorSlaResult(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.slaId),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/vendors/reviews`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createVendorReviewSchema, request.body);
    const result = await createVendorReview(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  /* ── Product ── */
  app.post(`${root}/product/roadmaps`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createProductRoadmapSchema, request.body);
    const result = await createProductRoadmap(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/product/roadmap-items`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createRoadmapItemSchema, request.body);
    const result = await createRoadmapItem(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/product/bugs`, async (request) => {
    const account = await requireAccount(deps, request);
    return listProductBugs(deps.db, account, org(request.params as Params));
  });

  app.post(`${root}/product/bugs`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createProductBugSchema, request.body);
    const result = await createProductBug(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
      {
        issueTrackerProvider: deps.issueTrackerProvider,
        deploymentProvider: deps.deploymentProvider,
      },
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/product/tech-incidents`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createTechnologyIncidentSchema, request.body);
    const result = await createTechnologyIncident(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/product/releases`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createProductReleaseSchema, request.body);
    const result = await createProductRelease(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/product/releases/:releaseId/mark-released`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(markReleaseSchema, request.body ?? {});
    return markProductReleaseReleased(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.releaseId),
      input,
      meta(request),
      { deploymentProvider: deps.deploymentProvider },
    );
  });

  app.post(`${root}/product/features`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createProductFeatureSchema, request.body);
    const result = await createProductFeature(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/product/projects`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createControlProjectSchema, request.body);
    const result = await createControlProject(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });
}
