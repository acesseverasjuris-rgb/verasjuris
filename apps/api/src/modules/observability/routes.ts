import { parseInput, uuidSchema } from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { requireAccount, type ApiDeps } from "../auth/routes.js";
import { ObservabilityService } from "./service.js";

export async function registerObservabilityRoutes(
  app: FastifyInstance,
  deps: ApiDeps,
): Promise<void> {
  const svc = () =>
    new ObservabilityService(
      deps.db,
      deps.observabilityProvider,
      deps.statusPageProvider,
      deps.backupProvider,
      deps.jobQueue,
    );

  app.get("/health/live", async (_request, reply) => reply.send(await svc().live()));
  app.get("/health/ready", async (_request, reply) => {
    const result = await svc().ready();
    return reply.status(result.status === "ok" ? 200 : 503).send(result);
  });

  app.get("/status", async (_request, reply) => reply.send(await svc().internalStatus()));

  app.get("/organizations/:organizationId/observability/dashboard", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    return reply.send(await svc().operationsDashboard(account, organizationId));
  });
}

export function registerObservabilityRootHealth(app: FastifyInstance, deps: ApiDeps): void {
  const svc = () =>
    new ObservabilityService(
      deps.db,
      deps.observabilityProvider,
      deps.statusPageProvider,
      deps.backupProvider,
      deps.jobQueue,
    );
  app.get("/health/live", async (_request, reply) => reply.send(await svc().live()));
  app.get("/health/ready", async (_request, reply) => {
    const result = await svc().ready();
    return reply.status(result.status === "ok" ? 200 : 503).send(result);
  });
}
