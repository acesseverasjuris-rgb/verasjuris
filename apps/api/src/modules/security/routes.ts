import {
  createPentestSchema,
  createSecurityAlertSchema,
  createVulnerabilitySchema,
  enableTotpSchema,
  parseInput,
  registerPasskeySchema,
  revokeDeviceSchema,
  securityEventListQuerySchema,
  trustDeviceSchema,
  updatePentestSchema,
  updateSecurityAlertSchema,
  updateVulnerabilitySchema,
  uuidSchema,
  verifyMfaRecoveryCodeSchema,
  verifyTotpSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  meta,
  requireAccount,
  requireOrganizationPermission,
  type ApiDeps,
} from "../auth/routes.js";
import { DevicesService } from "./devices-service.js";
import { FraudSignalService } from "./fraud-signal-service.js";
import { MfaService } from "./mfa-service.js";
import { PasskeysService } from "./passkeys-service.js";
import { SecurityOpsService } from "./events-service.js";
import { SessionsSecurityService } from "./sessions-service.js";

function mfa(deps: ApiDeps) {
  return new MfaService(deps.db, deps.keyManagementProvider!, deps.appEncryptionKey);
}

export async function registerSecurityRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  const devices = () => new DevicesService(deps.db);
  const passkeys = () => new PasskeysService(deps.db);
  const sessionsSvc = () => new SessionsSecurityService(deps.db);
  const ops = () => new SecurityOpsService(deps.db);
  const fraud = () => new FraudSignalService(deps.db);

  app.get("/me/security/mfa", async (request, reply) => {
    const account = await requireAccount(deps, request);
    return reply.send(await mfa(deps).status(account));
  });

  app.post("/me/security/mfa/totp/begin", async (request, reply) => {
    const account = await requireAccount(deps, request);
    return reply.status(201).send(await mfa(deps).beginTotp(account, meta(request)));
  });

  app.post("/me/security/mfa/totp/enable", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(enableTotpSchema, request.body ?? {});
    return reply.send(await mfa(deps).enableTotp(account, body.code, meta(request)));
  });

  app.post("/me/security/mfa/totp/verify", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(verifyTotpSchema, request.body ?? {});
    return reply.send(await mfa(deps).verifyTotp(account, body.code));
  });

  app.post("/me/security/mfa/recovery/verify", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(verifyMfaRecoveryCodeSchema, request.body ?? {});
    return reply.send(await mfa(deps).verifyRecoveryCode(account, body.code));
  });

  app.delete("/me/security/mfa/totp", async (request, reply) => {
    const account = await requireAccount(deps, request);
    return reply.send(await mfa(deps).disableTotp(account));
  });

  app.get("/me/security/passkeys", async (request, reply) => {
    const account = await requireAccount(deps, request);
    return reply.send(await passkeys().list(account));
  });

  app.post("/me/security/passkeys/register/begin", async (request, reply) => {
    const account = await requireAccount(deps, request);
    return reply.send(passkeys().beginRegistration(account));
  });

  app.post("/me/security/passkeys/register/complete", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(
      registerPasskeySchema.extend({ challenge: z.string().trim().min(16).max(512) }),
      request.body ?? {},
    );
    return reply.status(201).send(await passkeys().completeRegistration(account, body));
  });

  app.post("/me/security/passkeys/authenticate/begin", async (request, reply) => {
    const account = await requireAccount(deps, request);
    return reply.send(passkeys().beginAuthentication(account));
  });

  app.post("/me/security/passkeys/authenticate/complete", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(
      z.object({
        challenge: z.string().trim().min(16),
        credentialId: z.string().trim().min(16),
        counter: z.number().int().min(0).optional(),
      }),
      request.body ?? {},
    );
    return reply.send(await passkeys().completeAuthentication(account, body));
  });

  app.delete("/me/security/passkeys/:passkeyId", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const passkeyId = parseInput(uuidSchema, (request.params as { passkeyId?: string }).passkeyId);
    return reply.send(await passkeys().revoke(account, passkeyId));
  });

  app.get("/me/security/devices", async (request, reply) => {
    const account = await requireAccount(deps, request);
    return reply.send(await devices().list(account));
  });

  app.post("/me/security/devices", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(
      z.object({
        deviceId: z.string().trim().min(2).max(120),
        deviceName: z.string().trim().max(120).optional(),
        browser: z.string().trim().max(80).optional(),
        os: z.string().trim().max(80).optional(),
      }),
      request.body ?? {},
    );
    return reply.status(201).send(await devices().upsert(account, body));
  });

  app.post("/me/security/devices/trust", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(trustDeviceSchema, request.body ?? {});
    return reply.send(await devices().trust(account, body.deviceId, body.trusted));
  });

  app.post("/me/security/devices/revoke", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(revokeDeviceSchema, request.body ?? {});
    return reply.send(await devices().revoke(account, body.deviceId));
  });

  app.get("/me/security/sessions", async (request, reply) => {
    const account = await requireAccount(deps, request);
    return reply.send(await sessionsSvc().list(account));
  });

  app.delete("/me/security/sessions/:sessionId", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const sessionId = parseInput(uuidSchema, (request.params as { sessionId?: string }).sessionId);
    const result = await sessionsSvc().revokeOne(account, sessionId, meta(request));
    return reply.send(result);
  });

  app.post("/me/security/sessions/revoke-others", async (request, reply) => {
    const account = await requireAccount(deps, request);
    return reply.send(await sessionsSvc().revokeOthers(account, meta(request)));
  });

  app.post("/me/security/sessions/revoke-all", async (request, reply) => {
    const account = await requireAccount(deps, request);
    return reply.send(await sessionsSvc().revokeAll(account, meta(request)));
  });

  app.get("/organizations/:organizationId/security/events", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    const query = parseInput(securityEventListQuerySchema, request.query ?? {});
    return reply.send(await ops().listEvents(account, organizationId, query));
  });

  app.get("/organizations/:organizationId/security/alerts", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    return reply.send(await ops().listAlerts(account, organizationId));
  });

  app.post("/organizations/:organizationId/security/alerts", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    const body = parseInput(createSecurityAlertSchema, request.body ?? {});
    return reply.status(201).send(await ops().createAlert(account, organizationId, body));
  });

  app.patch("/organizations/:organizationId/security/alerts/:alertId", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; alertId?: string };
    const organizationId = parseInput(uuidSchema, params.organizationId);
    const alertId = parseInput(uuidSchema, params.alertId);
    const body = parseInput(updateSecurityAlertSchema, request.body ?? {});
    return reply.send(await ops().updateAlert(account, organizationId, alertId, body.status));
  });

  app.get("/organizations/:organizationId/security/vulnerabilities", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    requireOrganizationPermission(account, organizationId, "security.read");
    return reply.send(await ops().listVulnerabilities(account));
  });

  app.post("/organizations/:organizationId/security/vulnerabilities", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    const body = parseInput(createVulnerabilitySchema, request.body ?? {});
    return reply.status(201).send(await ops().createVulnerability(account, organizationId, body));
  });

  app.patch(
    "/organizations/:organizationId/security/vulnerabilities/:vulnerabilityId",
    async (request, reply) => {
      const account = await requireAccount(deps, request);
      const params = request.params as { organizationId?: string; vulnerabilityId?: string };
      requireOrganizationPermission(
        account,
        parseInput(uuidSchema, params.organizationId),
        "security.admin",
      );
      const body = parseInput(updateVulnerabilitySchema, request.body ?? {});
      return reply.send(
        await ops().updateVulnerability(
          account,
          parseInput(uuidSchema, params.vulnerabilityId),
          body.status,
        ),
      );
    },
  );

  app.get("/organizations/:organizationId/security/pentests", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    return reply.send(await ops().listPentests(account, organizationId));
  });

  app.post("/organizations/:organizationId/security/pentests", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    const body = parseInput(createPentestSchema, request.body ?? {});
    return reply.status(201).send(await ops().createPentest(account, organizationId, body));
  });

  app.patch(
    "/organizations/:organizationId/security/pentests/:pentestId",
    async (request, reply) => {
      const account = await requireAccount(deps, request);
      const params = request.params as { organizationId?: string; pentestId?: string };
      const body = parseInput(updatePentestSchema, request.body ?? {});
      return reply.send(
        await ops().updatePentest(
          account,
          parseInput(uuidSchema, params.organizationId),
          parseInput(uuidSchema, params.pentestId),
          body,
        ),
      );
    },
  );

  app.get("/organizations/:organizationId/security/fraud-signals", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    return reply.send(await fraud().list(account, organizationId));
  });

  app.post("/organizations/:organizationId/security/fraud-signals", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    const body = parseInput(
      z.object({
        signalType: z.enum(["payment_anomaly", "api_abuse", "other"]),
        summary: z.string().trim().min(2).max(2000),
        metadata: z.record(z.unknown()).optional(),
      }),
      request.body ?? {},
    );
    return reply.status(201).send(await fraud().record(account, organizationId, body));
  });
}
