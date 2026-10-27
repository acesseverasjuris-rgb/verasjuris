import {
  createChecklistItemSchema,
  createSlaPolicySchema,
  createTaskCommentSchema,
  createTaskDependencySchema,
  createTaskSchema,
  parseInput,
  taskListQuerySchema,
  updateChecklistItemSchema,
  updateTaskSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  addChecklistItem,
  addTaskComment,
  addTaskDependency,
  countTasksOverview,
  createSlaPolicy,
  createTask,
  getTask,
  listTasks,
  updateChecklistItem,
  updateTask,
} from "./service.js";

function orgId(params: { organizationId?: string }): string {
  return parseInput(uuidSchema, params.organizationId);
}

export async function registerTaskRoutes(app: FastifyInstance, deps: ApiDeps) {
  app.get("/organizations/:organizationId/tasks/overview", async (request) => {
    const account = await requireAccount(deps, request);
    return countTasksOverview(
      deps.db,
      account,
      orgId(request.params as { organizationId?: string }),
    );
  });

  app.get("/organizations/:organizationId/tasks", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    const query = parseInput(taskListQuerySchema, request.query ?? {});
    return listTasks(deps.db, account, organizationId, query);
  });

  app.post("/organizations/:organizationId/tasks", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    const input = parseInput(createTaskSchema, request.body);
    const task = await createTask(deps.db, account, organizationId, input, meta(request));
    return reply.status(201).send({ task });
  });

  app.get("/organizations/:organizationId/tasks/:taskId", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; taskId?: string };
    return getTask(deps.db, account, orgId(params), parseInput(uuidSchema, params.taskId));
  });

  app.patch("/organizations/:organizationId/tasks/:taskId", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; taskId?: string };
    const input = parseInput(updateTaskSchema, request.body);
    return {
      task: await updateTask(
        deps.db,
        account,
        orgId(params),
        parseInput(uuidSchema, params.taskId),
        input,
        meta(request),
      ),
    };
  });

  app.post("/organizations/:organizationId/tasks/:taskId/checklist", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; taskId?: string };
    const input = parseInput(createChecklistItemSchema, request.body);
    const item = await addChecklistItem(
      deps.db,
      account,
      orgId(params),
      parseInput(uuidSchema, params.taskId),
      input,
      meta(request),
    );
    return reply.status(201).send({ item });
  });

  app.patch("/organizations/:organizationId/tasks/:taskId/checklist/:itemId", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      taskId?: string;
      itemId?: string;
    };
    const input = parseInput(updateChecklistItemSchema, request.body);
    return {
      item: await updateChecklistItem(
        deps.db,
        account,
        orgId(params),
        parseInput(uuidSchema, params.taskId),
        parseInput(uuidSchema, params.itemId),
        input,
        meta(request),
      ),
    };
  });

  app.post("/organizations/:organizationId/tasks/:taskId/comments", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; taskId?: string };
    const input = parseInput(createTaskCommentSchema, request.body);
    const comment = await addTaskComment(
      deps.db,
      account,
      orgId(params),
      parseInput(uuidSchema, params.taskId),
      input,
      meta(request),
    );
    return reply.status(201).send({ comment });
  });

  app.post("/organizations/:organizationId/tasks/:taskId/dependencies", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; taskId?: string };
    const input = parseInput(createTaskDependencySchema, request.body);
    const dependency = await addTaskDependency(
      deps.db,
      account,
      orgId(params),
      parseInput(uuidSchema, params.taskId),
      input,
      meta(request),
    );
    return reply.status(201).send({ dependency });
  });

  app.post("/organizations/:organizationId/sla-policies", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    const input = parseInput(createSlaPolicySchema, request.body);
    const policy = await createSlaPolicy(deps.db, account, organizationId, input, meta(request));
    return reply.status(201).send({ policy });
  });
}
