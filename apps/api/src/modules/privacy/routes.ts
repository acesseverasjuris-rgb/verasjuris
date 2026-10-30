import {
  createConsentRecordSchema,
  createDsrRequestSchema,
  createOperatorSchema,
  createPrivacyIncidentSchema,
  createRetentionPolicySchema,
  parseInput,
  updateDsrRequestSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import { DsrService } from "./dsr-service.js";
import { PrivacyGovernanceService } from "./privacy-service.js";

export async function registerPrivacyRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  const gov = () => new PrivacyGovernanceService(deps.db, deps.jobQueue);
  const dsr = () => new DsrService(deps.db, deps.jobQueue);

  app.get("/organizations/:organizationId/privacy/consents", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    return reply.send(await gov().listConsents(account, organizationId));
  });

  app.post("/organizations/:organizationId/privacy/consents", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    const body = parseInput(createConsentRecordSchema, request.body ?? {});
    return reply
      .status(201)
      .send(await gov().recordConsent(account, organizationId, body, meta(request)));
  });

  app.get("/organizations/:organizationId/privacy/legal-bases", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    return reply.send(await gov().listLegalBases(account, organizationId));
  });

  app.post("/organizations/:organizationId/privacy/legal-bases", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    const body = parseInput(
      z.object({
        key: z.string().trim().min(2).max(80),
        type: z.string().trim().min(2).max(40),
        name: z.string().trim().min(2).max(200),
        description: z.string().trim().max(2000).optional(),
      }),
      request.body ?? {},
    );
    return reply.status(201).send(await gov().createLegalBasis(account, organizationId, body));
  });

  app.post("/organizations/:organizationId/privacy/data-assets", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    const body = parseInput(
      z.object({
        systemDomain: z.string().trim().min(2).max(80),
        dataCategory: z.string().trim().min(2).max(120),
        purpose: z.string().trim().min(2).max(500),
        sensitive: z.boolean().optional(),
        legalBasisId: z.string().uuid().optional(),
        retentionPolicyId: z.string().uuid().optional(),
      }),
      request.body ?? {},
    );
    return reply.status(201).send(await gov().createDataAsset(account, organizationId, body));
  });

  app.post("/organizations/:organizationId/privacy/retention-policies", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    const body = parseInput(createRetentionPolicySchema, request.body ?? {});
    return reply.status(201).send(await gov().createRetentionPolicy(account, organizationId, body));
  });

  app.post("/organizations/:organizationId/privacy/retention/enqueue", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    return reply.send(await gov().enqueueRetentionJobs(account, organizationId));
  });

  app.post(
    "/organizations/:organizationId/privacy/processing-activities",
    async (request, reply) => {
      const account = await requireAccount(deps, request);
      const organizationId = parseInput(
        uuidSchema,
        (request.params as { organizationId?: string }).organizationId,
      );
      const body = parseInput(
        z.object({
          key: z.string().trim().min(2).max(80),
          name: z.string().trim().min(2).max(200),
          purpose: z.string().trim().min(2).max(500),
          dataSubjects: z.array(z.string()).optional(),
          dataCategories: z.array(z.string()).optional(),
        }),
        request.body ?? {},
      );
      return reply
        .status(201)
        .send(await gov().createProcessingActivity(account, organizationId, body));
    },
  );

  app.post("/organizations/:organizationId/privacy/dpo", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    const body = parseInput(
      z.object({
        displayName: z.string().trim().min(2).max(200),
        email: z.string().trim().email(),
        phone: z.string().trim().max(40).optional(),
        role: z.enum(["dpo", "deputy_dpo", "privacy_contact", "other"]).optional(),
      }),
      request.body ?? {},
    );
    return reply.status(201).send(await gov().upsertDpo(account, organizationId, body));
  });

  app.post("/organizations/:organizationId/privacy/processors", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    const body = parseInput(createOperatorSchema, request.body ?? {});
    return reply.status(201).send(await gov().createProcessor(account, organizationId, body));
  });

  app.get("/organizations/:organizationId/privacy/incidents", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    return reply.send(await gov().listIncidents(account, organizationId));
  });

  app.post("/organizations/:organizationId/privacy/incidents", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    const body = parseInput(createPrivacyIncidentSchema, request.body ?? {});
    return reply
      .status(201)
      .send(await gov().createIncidentAssessment(account, organizationId, body));
  });

  app.get("/organizations/:organizationId/privacy/dsr", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    return reply.send(await dsr().list(account, organizationId));
  });

  app.post("/organizations/:organizationId/privacy/dsr", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    const body = parseInput(createDsrRequestSchema, request.body ?? {});
    return reply.status(201).send(await dsr().create(account, organizationId, body, meta(request)));
  });

  app.get("/organizations/:organizationId/privacy/dsr/:dsrId", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; dsrId?: string };
    return reply.send(
      await dsr().get(
        account,
        parseInput(uuidSchema, params.organizationId),
        parseInput(uuidSchema, params.dsrId),
      ),
    );
  });

  app.patch("/organizations/:organizationId/privacy/dsr/:dsrId", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; dsrId?: string };
    const body = parseInput(updateDsrRequestSchema, request.body ?? {});
    return reply.send(
      await dsr().updateStatus(
        account,
        parseInput(uuidSchema, params.organizationId),
        parseInput(uuidSchema, params.dsrId),
        body,
      ),
    );
  });

  app.get("/organizations/:organizationId/privacy/dsr/:dsrId/export", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; dsrId?: string };
    return reply.send(
      await dsr().exportPortability(
        account,
        parseInput(uuidSchema, params.organizationId),
        parseInput(uuidSchema, params.dsrId),
      ),
    );
  });

  app.post("/organizations/:organizationId/privacy/dsr/:dsrId/delete", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; dsrId?: string };
    return reply.send(
      await dsr().processDeletion(
        account,
        parseInput(uuidSchema, params.organizationId),
        parseInput(uuidSchema, params.dsrId),
      ),
    );
  });
}
