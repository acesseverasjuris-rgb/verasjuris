import {
  calculateDeadlineSchema,
  changeDeadlineSchema,
  confirmDeadlineSchema,
  createDeadlineAlertRuleSchema,
  createDeadlineEscalationRuleSchema,
  createDeadlineSchema,
  deadlineListQuerySchema,
  parseInput,
  updateDeadlineSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  calculateDeadline,
  cancelDeadline,
  changeDeadlineWithHistory,
  completeDeadline,
  confirmDeadline,
  countDeadlinesOverview,
  createAlertRule,
  createDeadline,
  createEscalationRule,
  dispatchDeadlineAlerts,
  escalateDeadline,
  getDeadline,
  listDeadlines,
  updateDeadline,
} from "./service.js";

function orgId(params: { organizationId?: string }): string {
  return parseInput(uuidSchema, params.organizationId);
}

function deadlineDeps(deps: ApiDeps) {
  if (!deps.notifications || !deps.holidays) {
    throw new Error("NotificationProvider/HolidayCalendar não configurados em ApiDeps.");
  }
  return { notifications: deps.notifications, holidays: deps.holidays };
}

export async function registerDeadlineRoutes(app: FastifyInstance, deps: ApiDeps) {
  app.get("/organizations/:organizationId/deadlines/overview", async (request) => {
    const account = await requireAccount(deps, request);
    return countDeadlinesOverview(
      deps.db,
      account,
      orgId(request.params as { organizationId?: string }),
    );
  });

  app.get("/organizations/:organizationId/deadlines", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    const query = parseInput(deadlineListQuerySchema, request.query ?? {});
    return listDeadlines(deps.db, account, organizationId, query);
  });

  app.post("/organizations/:organizationId/deadlines", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    const input = parseInput(createDeadlineSchema, request.body);
    const deadline = await createDeadline(
      deps.db,
      account,
      organizationId,
      input,
      deadlineDeps(deps),
      meta(request),
    );
    return reply.status(201).send({ deadline });
  });

  app.get("/organizations/:organizationId/deadlines/:deadlineId", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; deadlineId?: string };
    return getDeadline(deps.db, account, orgId(params), parseInput(uuidSchema, params.deadlineId));
  });

  app.patch("/organizations/:organizationId/deadlines/:deadlineId", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; deadlineId?: string };
    const input = parseInput(updateDeadlineSchema, request.body);
    return {
      deadline: await updateDeadline(
        deps.db,
        account,
        orgId(params),
        parseInput(uuidSchema, params.deadlineId),
        input,
        meta(request),
      ),
    };
  });

  app.post("/organizations/:organizationId/deadlines/:deadlineId/calculate", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; deadlineId?: string };
    const input = parseInput(calculateDeadlineSchema, request.body ?? {});
    return {
      deadline: await calculateDeadline(
        deps.db,
        account,
        orgId(params),
        parseInput(uuidSchema, params.deadlineId),
        input,
        deadlineDeps(deps),
        meta(request),
      ),
    };
  });

  app.post("/organizations/:organizationId/deadlines/:deadlineId/confirm", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; deadlineId?: string };
    const input = parseInput(confirmDeadlineSchema, request.body ?? {});
    return {
      deadline: await confirmDeadline(
        deps.db,
        account,
        orgId(params),
        parseInput(uuidSchema, params.deadlineId),
        input,
        deadlineDeps(deps),
        meta(request),
      ),
    };
  });

  app.post("/organizations/:organizationId/deadlines/:deadlineId/change", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; deadlineId?: string };
    const input = parseInput(changeDeadlineSchema, request.body);
    return {
      deadline: await changeDeadlineWithHistory(
        deps.db,
        account,
        orgId(params),
        parseInput(uuidSchema, params.deadlineId),
        input,
        meta(request),
      ),
    };
  });

  app.post("/organizations/:organizationId/deadlines/:deadlineId/complete", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; deadlineId?: string };
    return {
      deadline: await completeDeadline(
        deps.db,
        account,
        orgId(params),
        parseInput(uuidSchema, params.deadlineId),
        meta(request),
      ),
    };
  });

  app.post("/organizations/:organizationId/deadlines/:deadlineId/cancel", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; deadlineId?: string };
    return {
      deadline: await cancelDeadline(
        deps.db,
        account,
        orgId(params),
        parseInput(uuidSchema, params.deadlineId),
        meta(request),
      ),
    };
  });

  app.post(
    "/organizations/:organizationId/deadlines/:deadlineId/alerts/dispatch",
    async (request) => {
      const account = await requireAccount(deps, request);
      const params = request.params as { organizationId?: string; deadlineId?: string };
      return dispatchDeadlineAlerts(
        deps.db,
        account,
        orgId(params),
        parseInput(uuidSchema, params.deadlineId),
        deadlineDeps(deps),
        meta(request),
      );
    },
  );

  app.post("/organizations/:organizationId/deadlines/:deadlineId/escalate", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; deadlineId?: string };
    return escalateDeadline(
      deps.db,
      account,
      orgId(params),
      parseInput(uuidSchema, params.deadlineId),
      deadlineDeps(deps),
      meta(request),
    );
  });

  app.post("/organizations/:organizationId/deadline-alert-rules", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    const input = parseInput(createDeadlineAlertRuleSchema, request.body);
    const rule = await createAlertRule(deps.db, account, organizationId, input, meta(request));
    return reply.status(201).send({ rule });
  });

  app.post("/organizations/:organizationId/deadline-escalation-rules", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    const input = parseInput(createDeadlineEscalationRuleSchema, request.body);
    const rule = await createEscalationRule(deps.db, account, organizationId, input, meta(request));
    return reply.status(201).send({ rule });
  });
}
