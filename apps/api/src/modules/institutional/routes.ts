import { parseInput } from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ApiDeps } from "../auth/routes.js";
import { InstitutionalService } from "./service.js";

export async function registerInstitutionalRoutes(
  app: FastifyInstance,
  deps: ApiDeps,
): Promise<void> {
  const svc = () => new InstitutionalService(deps.db);

  app.get("/institutional/policies", async (request, reply) => {
    const query = parseInput(
      z.object({ locale: z.string().trim().min(2).max(16).optional() }),
      request.query ?? {},
    );
    return reply.send(await svc().list(query.locale));
  });

  app.get("/institutional/policies/:slug", async (request, reply) => {
    const params = request.params as { slug?: string };
    const query = parseInput(
      z.object({ locale: z.string().trim().min(2).max(16).default("pt-BR") }),
      request.query ?? {},
    );
    const slug = parseInput(z.string().trim().min(2).max(80), params.slug);
    return reply.send(await svc().getBySlug(slug, query.locale));
  });
}
