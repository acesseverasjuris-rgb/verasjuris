import {
  employeeProfileSchema,
  lawyerProfileSchema,
  parseInput,
  partnerProfileSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import {
  meta,
  requireAccount,
  requireOrganizationPermission,
  type ApiDeps,
} from "../auth/routes.js";
import {
  getMyProfiles,
  listEmployeeProfiles,
  upsertEmployeeProfile,
  upsertLawyerProfile,
  upsertPartnerProfile,
} from "./service.js";
import { identityVerificationProvider, professionalLicenseVerifier } from "./verifiers.js";

export async function registerProfileRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  app.get("/profiles/me", async (request) => {
    const account = await requireAccount(deps, request);
    const query = request.query as { organizationId?: string };
    const organizationId = query.organizationId
      ? parseInput(uuidSchema, query.organizationId)
      : undefined;
    return { profiles: await getMyProfiles(deps.db, account, organizationId) };
  });

  app.put("/profiles/me/lawyer", async (request) => {
    const account = await requireAccount(deps, request);
    const rawBody = (request.body ?? {}) as Record<string, unknown>;
    const input = parseInput(lawyerProfileSchema, request.body);
    return {
      ...(await upsertLawyerProfile(deps.db, account, input, meta(request), rawBody)),
    };
  });

  app.put("/profiles/me/partner", async (request) => {
    const account = await requireAccount(deps, request);
    const rawBody = (request.body ?? {}) as Record<string, unknown>;
    const input = parseInput(partnerProfileSchema, request.body);
    return {
      ...(await upsertPartnerProfile(deps.db, account, input, meta(request), rawBody)),
    };
  });

  app.put("/organizations/:organizationId/profiles/employees/me", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string };
    const organizationId = parseInput(uuidSchema, params.organizationId);
    const rawBody = (request.body ?? {}) as Record<string, unknown>;
    const input = parseInput(employeeProfileSchema, request.body);
    return {
      ...(await upsertEmployeeProfile(
        deps.db,
        account,
        organizationId,
        input,
        meta(request),
        rawBody,
      )),
    };
  });

  app.get("/organizations/:organizationId/profiles/employees", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string };
    const organizationId = parseInput(uuidSchema, params.organizationId);
    requireOrganizationPermission(account, organizationId, "profiles.read");
    return await listEmployeeProfiles(deps.db, account, organizationId);
  });

  app.post("/profiles/me/lawyer/verify", async (request) => {
    await requireAccount(deps, request);
    await professionalLicenseVerifier.verify();
  });

  app.post("/profiles/me/identity/verify", async (request) => {
    await requireAccount(deps, request);
    await identityVerificationProvider.verify();
  });
}
