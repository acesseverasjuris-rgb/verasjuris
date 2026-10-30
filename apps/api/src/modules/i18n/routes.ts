import {
  createContentTranslationSchema,
  jurisdictionContextSchema,
  parseInput,
  requestMachineTranslationSchema,
  updateLocalePreferencesSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAccount, type ApiDeps } from "../auth/routes.js";
import { I18nService } from "./service.js";

export async function registerI18nRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  const svc = () => new I18nService(deps.db, deps.translationProvider!);

  app.put("/me/locale-preferences", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(updateLocalePreferencesSchema, request.body ?? {});
    return reply.send(await svc().updateLocalePreferences(account, body));
  });

  app.put("/organizations/:organizationId/i18n/default-locale", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    const body = parseInput(
      z.object({ locale: z.string().trim().min(2).max(16) }),
      request.body ?? {},
    );
    return reply.send(
      await svc().setOrganizationDefaultLocale(account, organizationId, body.locale),
    );
  });

  app.get("/organizations/:organizationId/i18n/translations", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    return reply.send(await svc().listTranslations(account, organizationId));
  });

  app.post("/organizations/:organizationId/i18n/translations", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    const body = parseInput(createContentTranslationSchema, request.body ?? {});
    return reply.status(201).send(await svc().createTranslation(account, organizationId, body));
  });

  app.post("/organizations/:organizationId/i18n/translate", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    const body = parseInput(requestMachineTranslationSchema, request.body ?? {});
    return reply.send(await svc().requestMachineTranslation(account, organizationId, body));
  });

  app.post("/i18n/jurisdiction/check-br", async (request, reply) => {
    await requireAccount(deps, request);
    const body = parseInput(jurisdictionContextSchema, request.body ?? {});
    return reply.send(svc().checkBrCalculationJurisdiction(body));
  });
}
