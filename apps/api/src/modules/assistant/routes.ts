import {
  createAssistantSessionSchema,
  parseInput,
  sendAssistantMessageSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAccount, type ApiDeps } from "../auth/routes.js";
import { AssistantService } from "./service.js";

export async function registerAssistantRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  const svc = () => new AssistantService(deps.db, deps.aiGateway);

  app.post("/organizations/:organizationId/assistant/conversations", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    const body = parseInput(createAssistantSessionSchema, request.body ?? {});
    return reply
      .status(201)
      .send(await svc().createConversation(account, { ...body, organizationId }));
  });

  app.get("/organizations/:organizationId/assistant/conversations", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    return reply.send(await svc().listConversations(account, organizationId));
  });

  app.post("/organizations/:organizationId/assistant/messages", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    void organizationId;
    const body = parseInput(sendAssistantMessageSchema, request.body ?? {});
    return reply.status(201).send(await svc().sendMessage(account, body));
  });

  app.post("/organizations/:organizationId/assistant/tools/:tool", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; tool?: string };
    parseInput(uuidSchema, params.organizationId);
    const body = parseInput(
      z.object({
        conversationId: z.string().uuid(),
        params: z.record(z.unknown()).default({}),
      }),
      request.body ?? {},
    );
    return reply.send(
      await svc().invokeTool(
        account,
        body.conversationId,
        params.tool as
          | "searchHelp"
          | "navigateTo"
          | "createSupportRequest"
          | "listMatters"
          | "listDeadlines"
          | "listDocuments",
        body.params,
      ),
    );
  });

  app.post("/organizations/:organizationId/assistant/feedback", async (request, reply) => {
    const account = await requireAccount(deps, request);
    parseInput(uuidSchema, (request.params as { organizationId?: string }).organizationId);
    const body = parseInput(
      z.object({
        conversationId: z.string().uuid().optional(),
        messageId: z.string().uuid().optional(),
        rating: z.enum(["positive", "negative", "neutral"]),
        comment: z.string().trim().max(2000).optional(),
      }),
      request.body ?? {},
    );
    return reply.status(201).send(await svc().feedback(account, body));
  });
}
