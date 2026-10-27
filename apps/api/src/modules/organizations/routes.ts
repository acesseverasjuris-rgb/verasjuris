import { AppError } from "@verasjuris/types";
import {
  addMemberSchema,
  createInvitationSchema,
  createOrganizationSchema,
  parseInput,
  tokenSchema,
  updateMembershipSchema,
  updateOrganizationSchema,
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
  acceptInvitation,
  createInvitation,
  listInvitations,
  previewInvitation,
  resendInvitation,
  revokeInvitation,
  switchOrganization,
} from "./invitations.js";
import {
  addMember,
  createOrganization,
  listAccountAudit,
  listMembers,
  listOrganizationAudit,
  listSystemRoles,
  updateMembership,
  updateOrganization,
} from "./service.js";

export async function registerOrganizationRoutes(
  app: FastifyInstance,
  deps: ApiDeps,
): Promise<void> {
  app.get("/organizations", async (request) => {
    const account = await requireAccount(deps, request);
    return {
      organizations: account.memberships
        .filter((membership) => membership.membershipStatus !== "removed")
        .map((membership) => ({
          id: membership.organizationId,
          name: membership.organizationName,
          slug: membership.organizationSlug,
          status: membership.organizationStatus,
          membershipStatus: membership.membershipStatus,
          roles: membership.roles,
          permissions: membership.permissions,
        })),
    };
  });

  app.post("/organizations", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createOrganizationSchema, request.body);
    const organization = await createOrganization(
      deps.db,
      account,
      input.name,
      meta(request),
      deps.events,
    );
    return reply.status(201).send({ organization });
  });

  app.get("/organizations/:organizationId", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string };
    const organizationId = parseInput(uuidSchema, params.organizationId);
    const membership = requireOrganizationPermission(account, organizationId, "organization.read");
    return {
      organization: {
        id: membership.organizationId,
        name: membership.organizationName,
        slug: membership.organizationSlug,
        status: membership.organizationStatus,
        roles: membership.roles,
        permissions: membership.permissions,
      },
    };
  });

  app.post("/organizations/:organizationId/switch", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string };
    const organizationId = parseInput(uuidSchema, params.organizationId);
    const organization = await switchOrganization(deps.db, account, organizationId, meta(request));
    return { organization };
  });

  app.patch("/organizations/:organizationId", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string };
    const organizationId = parseInput(uuidSchema, params.organizationId);
    requireOrganizationPermission(account, organizationId, "organization.update");
    const input = parseInput(updateOrganizationSchema, request.body);
    const organization = await updateOrganization(
      deps.db,
      account,
      organizationId,
      input.name,
      meta(request),
    );
    return { organization };
  });

  app.get("/organizations/:organizationId/members", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string };
    const organizationId = parseInput(uuidSchema, params.organizationId);
    requireOrganizationPermission(account, organizationId, "member.read");
    return { members: await listMembers(deps.db, organizationId) };
  });

  app.post("/organizations/:organizationId/members", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string };
    const organizationId = parseInput(uuidSchema, params.organizationId);
    requireOrganizationPermission(account, organizationId, "member.manage");
    const input = parseInput(addMemberSchema, request.body);
    const member = await addMember(
      deps.db,
      account,
      organizationId,
      input.email,
      meta(request),
      deps.events,
    );
    return reply.status(201).send({ member });
  });

  app.patch("/organizations/:organizationId/members/:membershipId", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; membershipId?: string };
    const organizationId = parseInput(uuidSchema, params.organizationId);
    const membershipId = parseInput(uuidSchema, params.membershipId);
    const input = parseInput(updateMembershipSchema, request.body);
    if (input.roleKeys) {
      requireOrganizationPermission(account, organizationId, "role.assign");
    } else {
      requireOrganizationPermission(account, organizationId, "member.manage");
    }
    const member = await updateMembership(
      deps.db,
      account,
      organizationId,
      membershipId,
      input,
      meta(request),
      deps.events,
    );
    return { member };
  });

  app.get("/organizations/:organizationId/invitations", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string };
    const organizationId = parseInput(uuidSchema, params.organizationId);
    requireOrganizationPermission(account, organizationId, "member.invite");
    return { invitations: await listInvitations(deps.db, organizationId) };
  });

  app.post("/organizations/:organizationId/invitations", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string };
    const organizationId = parseInput(uuidSchema, params.organizationId);
    requireOrganizationPermission(account, organizationId, "member.invite");
    const input = parseInput(createInvitationSchema, request.body);
    const result = await createInvitation(
      deps.db,
      account,
      organizationId,
      { email: input.email, roleKey: input.roleKey ?? "member" },
      meta(request),
      {
        provider: deps.email,
        webOrigin: deps.webOrigin,
      },
    );
    return reply.status(201).send(result);
  });

  app.delete("/organizations/:organizationId/invitations/:invitationId", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; invitationId?: string };
    const organizationId = parseInput(uuidSchema, params.organizationId);
    const invitationId = parseInput(uuidSchema, params.invitationId);
    requireOrganizationPermission(account, organizationId, "member.invite");
    await revokeInvitation(deps.db, account, organizationId, invitationId, meta(request));
    return reply.status(204).send();
  });

  app.post(
    "/organizations/:organizationId/invitations/:invitationId/resend",
    async (request, reply) => {
      const account = await requireAccount(deps, request);
      const params = request.params as { organizationId?: string; invitationId?: string };
      const organizationId = parseInput(uuidSchema, params.organizationId);
      const invitationId = parseInput(uuidSchema, params.invitationId);
      requireOrganizationPermission(account, organizationId, "member.invite");
      const limit = deps.rateLimiter.consume(
        `invite-resend:${organizationId}:${invitationId}`,
        5,
        15 * 60 * 1000,
      );
      if (!limit.allowed) {
        reply.header("retry-after", String(limit.retryAfterSeconds));
        throw new AppError(
          "RATE_LIMIT",
          "Houve tentativas demais em pouco tempo. Aguarde alguns minutos. Nenhum convite foi reenviado.",
        );
      }
      const result = await resendInvitation(
        deps.db,
        account,
        organizationId,
        invitationId,
        meta(request),
        { provider: deps.email, webOrigin: deps.webOrigin },
      );
      return reply.send(result);
    },
  );

  app.get("/invitations/:token", async (request) => {
    const params = request.params as { token?: string };
    const token = parseInput(tokenSchema, params.token);
    return { invitation: await previewInvitation(deps.db, token) };
  });

  app.post("/invitations/:token/accept", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { token?: string };
    const token = parseInput(tokenSchema, params.token);
    const membership = await acceptInvitation(deps.db, account, token, meta(request), deps.events);
    return { membership };
  });

  app.get("/organizations/:organizationId/audit", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string };
    const organizationId = parseInput(uuidSchema, params.organizationId);
    requireOrganizationPermission(account, organizationId, "audit.read");
    return { events: await listOrganizationAudit(deps.db, organizationId) };
  });

  app.get("/roles", async (request) => {
    const account = await requireAccount(deps, request);
    if (!account.memberships.some((membership) => membership.permissions.includes("role.read"))) {
      throw new AppError(
        "AUTHORIZATION_ERROR",
        "Você não tem permissão para consultar os papéis. Nenhum dado foi alterado.",
      );
    }
    return { roles: await listSystemRoles(deps.db) };
  });
}

export async function registerAccountRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  app.get("/account/audit", async (request) => {
    const account = await requireAccount(deps, request);
    return { events: await listAccountAudit(deps.db, account.user.id) };
  });
}
