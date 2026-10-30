import {
  createIntegrationCredentialSchema,
  parseInput,
  providerRegistryQuerySchema,
  rotateIntegrationCredentialSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  meta,
  requireAccount,
  requireOrganizationPermission,
  type ApiDeps,
} from "../auth/routes.js";
import { CourtDataSourceService } from "./court-service.js";
import { IntegrationCredentialsService } from "./credentials-service.js";
import { IntegrationRegistryService } from "./registry-service.js";

const createCourtSourceSchema = z.object({
  tribunal: z.string().trim().min(2).max(80),
  providerKey: z.string().trim().min(2).max(80),
  externalReference: z.string().trim().min(2).max(200),
  legalMatterId: z.string().uuid().optional(),
  judicialProcessId: z.string().uuid().optional(),
});

export async function registerIntegrationRoutes(
  app: FastifyInstance,
  deps: ApiDeps,
): Promise<void> {
  const registry = () => new IntegrationRegistryService(deps.db, deps.providerRegistry!);
  const credentials = () => new IntegrationCredentialsService(deps.db);
  const court = () => new CourtDataSourceService(deps.db, deps.courtIntegrationProvider!);

  app.get("/integrations/providers", async (request, reply) => {
    await requireAccount(deps, request);
    const query = parseInput(providerRegistryQuerySchema, request.query ?? {});
    return reply.send(registry().listProviders(query.type));
  });

  app.post("/integrations/providers/health", async (request, reply) => {
    await requireAccount(deps, request);
    return reply.send(await registry().healthCheckAll());
  });

  app.post(
    "/organizations/:organizationId/integrations/providers/health",
    async (request, reply) => {
      const account = await requireAccount(deps, request);
      const organizationId = parseInput(
        uuidSchema,
        (request.params as { organizationId?: string }).organizationId,
      );
      requireOrganizationPermission(account, organizationId, "integration.read");
      return reply.send(await registry().healthCheckAll(organizationId));
    },
  );

  app.get("/organizations/:organizationId/integrations/credentials", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    return reply.send(await credentials().list(account, organizationId));
  });

  app.post("/organizations/:organizationId/integrations/credentials", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    const input = parseInput(createIntegrationCredentialSchema, request.body ?? {});
    const result = await credentials().create(account, organizationId, input, meta(request));
    return reply.status(201).send(result);
  });

  app.post(
    "/organizations/:organizationId/integrations/credentials/:credentialId/rotate",
    async (request, reply) => {
      const account = await requireAccount(deps, request);
      const params = request.params as { organizationId?: string; credentialId?: string };
      const organizationId = parseInput(uuidSchema, params.organizationId);
      const credentialId = parseInput(uuidSchema, params.credentialId);
      const input = parseInput(rotateIntegrationCredentialSchema, request.body ?? {});
      return reply.send(await credentials().rotate(account, organizationId, credentialId, input));
    },
  );

  app.post(
    "/organizations/:organizationId/integrations/credentials/:credentialId/disable",
    async (request, reply) => {
      const account = await requireAccount(deps, request);
      const params = request.params as { organizationId?: string; credentialId?: string };
      const organizationId = parseInput(uuidSchema, params.organizationId);
      const credentialId = parseInput(uuidSchema, params.credentialId);
      return reply.send(await credentials().disable(account, organizationId, credentialId));
    },
  );

  app.get("/organizations/:organizationId/integrations/court-sources", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    return reply.send(await court().list(account, organizationId));
  });

  app.post("/organizations/:organizationId/integrations/court-sources", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    const input = parseInput(createCourtSourceSchema, request.body ?? {});
    const result = await court().create(account, organizationId, input, meta(request));
    return reply.status(201).send(result);
  });

  app.post(
    "/organizations/:organizationId/integrations/court-sources/:sourceId/sync",
    async (request, reply) => {
      const account = await requireAccount(deps, request);
      const params = request.params as { organizationId?: string; sourceId?: string };
      const organizationId = parseInput(uuidSchema, params.organizationId);
      const sourceId = parseInput(uuidSchema, params.sourceId);
      return reply.send(await court().sync(account, organizationId, sourceId));
    },
  );
}
