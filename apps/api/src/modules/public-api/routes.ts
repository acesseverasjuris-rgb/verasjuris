import type { AppDatabase } from "@verasjuris/database";
import {
  crmClients,
  deadlines,
  documents,
  legalMatters,
  publicApiWebhookEndpoints,
} from "@verasjuris/database";
import { createPublicApiWebhookEndpointSchema, parseInput } from "@verasjuris/validation";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ApiDeps } from "../auth/routes.js";
import { authenticateApiCredential, requireApiScope } from "./auth.js";
import { PUBLIC_OPENAPI } from "./openapi.js";

async function orgScopedList<T>(
  db: AppDatabase,
  organizationId: string,
  query: () => Promise<T[]>,
): Promise<{ organizationId: string; items: T[] }> {
  void db;
  return { organizationId, items: await query() };
}

export async function registerPublicApiRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  app.get("/openapi.json", async (_request, reply) => reply.send(PUBLIC_OPENAPI));

  const withAuth = async (
    request: Parameters<typeof authenticateApiCredential>[1],
    scope: string,
  ) => {
    const limit = deps.rateLimiter.consume(`public-api:${request.ip ?? "unknown"}`, 120, 60_000);
    if (!limit.allowed) {
      const { AppError } = await import("@verasjuris/types");
      throw new AppError("RATE_LIMIT", "Limite de taxa da API pública excedido.");
    }
    const ctx = await authenticateApiCredential(deps.db, request);
    requireApiScope(ctx, scope);
    return ctx;
  };

  app.get("/clients", async (request, reply) => {
    const ctx = await withAuth(request, "clients.read");
    return reply.send(
      await orgScopedList(deps.db, ctx.organizationId, () =>
        deps.db.query.crmClients.findMany({
          where: eq(crmClients.organizationId, ctx.organizationId),
          limit: 100,
        }),
      ),
    );
  });

  app.get("/matters", async (request, reply) => {
    const ctx = await withAuth(request, "matters.read");
    return reply.send(
      await orgScopedList(deps.db, ctx.organizationId, () =>
        deps.db.query.legalMatters.findMany({
          where: eq(legalMatters.organizationId, ctx.organizationId),
          limit: 100,
        }),
      ),
    );
  });

  app.get("/documents", async (request, reply) => {
    const ctx = await withAuth(request, "documents.read");
    return reply.send(
      await orgScopedList(deps.db, ctx.organizationId, () =>
        deps.db.query.documents.findMany({
          where: eq(documents.organizationId, ctx.organizationId),
          limit: 100,
        }),
      ),
    );
  });

  app.get("/deadlines", async (request, reply) => {
    const ctx = await withAuth(request, "deadlines.read");
    return reply.send(
      await orgScopedList(deps.db, ctx.organizationId, () =>
        deps.db.query.deadlines.findMany({
          where: eq(deadlines.organizationId, ctx.organizationId),
          limit: 100,
        }),
      ),
    );
  });

  app.get("/analytics/summary", async (request, reply) => {
    const ctx = await withAuth(request, "analytics.read");
    return reply.send({
      organizationId: ctx.organizationId,
      summary: { status: "ok", note: "Read-model analytics; detalhes no módulo analytics." },
    });
  });

  app.get("/marketplace/listings", async (request, reply) => {
    const ctx = await withAuth(request, "marketplace.read");
    return reply.send({ organizationId: ctx.organizationId, items: [] });
  });

  app.get("/billing/summary", async (request, reply) => {
    const ctx = await withAuth(request, "billing.read");
    return reply.send({ organizationId: ctx.organizationId, summary: { status: "ok" } });
  });

  app.get("/webhooks", async (request, reply) => {
    const ctx = await withAuth(request, "webhooks.manage");
    const items = await deps.db.query.publicApiWebhookEndpoints.findMany({
      where: eq(publicApiWebhookEndpoints.organizationId, ctx.organizationId),
    });
    return reply.send({ organizationId: ctx.organizationId, items });
  });

  app.post("/webhooks", async (request, reply) => {
    const ctx = await withAuth(request, "webhooks.manage");
    const body = parseInput(createPublicApiWebhookEndpointSchema, request.body ?? {});
    const [row] = await deps.db
      .insert(publicApiWebhookEndpoints)
      .values({
        organizationId: ctx.organizationId,
        apiClientId: ctx.apiClientId,
        url: body.url,
        secretReference: body.secretReference,
        events: body.events,
        active: body.active,
        retryPolicy: { maxAttempts: body.retryMaxAttempts },
      })
      .returning();
    return reply.status(201).send({ endpoint: row });
  });
}
