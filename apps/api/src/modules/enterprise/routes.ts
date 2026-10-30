import {
  createEnterpriseSlaSchema,
  createEnterpriseSsoConfigSchema,
  createScimConfigSchema,
  parseInput,
  updateEnterpriseBrandingSchema,
  updateOrganizationSecurityPolicySchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAccount, type ApiDeps } from "../auth/routes.js";
import { EnterpriseService } from "./service.js";

export async function registerEnterpriseRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  const svc = () =>
    new EnterpriseService(
      deps.db,
      deps.ssoProvider!,
      deps.scimProvider!,
      deps.customDomainProvider!,
    );

  app.get("/organizations/:organizationId/enterprise/sso", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    return reply.send(await svc().listSso(account, organizationId));
  });

  app.put("/organizations/:organizationId/enterprise/sso", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    const body = parseInput(createEnterpriseSsoConfigSchema, request.body ?? {});
    return reply.send(await svc().getOrCreateSso(account, organizationId, body));
  });

  app.put("/organizations/:organizationId/enterprise/scim", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    const body = parseInput(createScimConfigSchema, request.body ?? {});
    return reply.send(await svc().scimConfig(account, organizationId, body));
  });

  app.get("/organizations/:organizationId/enterprise/security-policy", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    return reply.send(await svc().getSecurityPolicy(account, organizationId));
  });

  app.put("/organizations/:organizationId/enterprise/security-policy", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    const body = parseInput(updateOrganizationSecurityPolicySchema, request.body ?? {});
    return reply.send(await svc().upsertSecurityPolicy(account, organizationId, body));
  });

  app.get("/organizations/:organizationId/enterprise/slas", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    return reply.send(await svc().listSlas(account, organizationId));
  });

  app.post("/organizations/:organizationId/enterprise/slas", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    const body = parseInput(createEnterpriseSlaSchema, request.body ?? {});
    return reply.status(201).send(await svc().createSla(account, organizationId, body));
  });

  app.put("/organizations/:organizationId/enterprise/branding", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    const body = parseInput(updateEnterpriseBrandingSchema, request.body ?? {});
    return reply.send(await svc().updateBranding(account, organizationId, body));
  });

  app.post("/organizations/:organizationId/enterprise/domain/verify", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    const body = parseInput(
      z.object({ domain: z.string().trim().min(3).max(253) }),
      request.body ?? {},
    );
    return reply.send(await svc().verifyDomain(account, organizationId, body.domain));
  });
}
