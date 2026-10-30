import { parseInput, updateAccessibilityPreferencesSchema } from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { requireAccount, type ApiDeps } from "../auth/routes.js";
import { AccessibilityService } from "./service.js";

export async function registerAccessibilityRoutes(
  app: FastifyInstance,
  deps: ApiDeps,
): Promise<void> {
  const svc = () => new AccessibilityService(deps.db);

  app.get("/me/accessibility-preferences", async (request, reply) => {
    const account = await requireAccount(deps, request);
    return reply.send(await svc().get(account));
  });

  app.put("/me/accessibility-preferences", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(updateAccessibilityPreferencesSchema, request.body ?? {});
    return reply.send(await svc().put(account, body));
  });
}
