import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";
import type { ClientPortalContext } from "./client-portal-context.js";

type ClientPortalStaffPermission = Extract<
  PermissionKey,
  | "client_portal.link_user"
  | "client_portal.manage_requests"
  | "client_portal.manage_payments"
  | "crm.read"
  | "matter.read"
  | "document.read"
  | "document.download"
  | "contract.read"
  | "communication.read"
  | "communication.send"
>;

export function policyClientPortal(
  membership: AccessMembership,
  required: Extract<
    ClientPortalStaffPermission,
    "client_portal.link_user" | "client_portal.manage_requests" | "client_portal.manage_payments"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyClientCase(
  membership: AccessMembership,
  required: Extract<ClientPortalStaffPermission, "matter.read" | "crm.read">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyClientDocument(
  membership: AccessMembership,
  required: Extract<
    ClientPortalStaffPermission,
    "document.read" | "document.download" | "crm.read"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyClientContract(
  membership: AccessMembership,
  required: Extract<ClientPortalStaffPermission, "contract.read" | "crm.read">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyClientPayment(
  membership: AccessMembership,
  required: Extract<ClientPortalStaffPermission, "client_portal.manage_payments" | "crm.read">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyClientMessage(
  membership: AccessMembership,
  required: Extract<
    ClientPortalStaffPermission,
    "communication.read" | "communication.send" | "crm.read"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export type PortalResourceScope = {
  organizationId: string;
  clientId: string;
};

function portalScopeMatches(ctx: ClientPortalContext, resource: PortalResourceScope): boolean {
  return ctx.organizationId === resource.organizationId && ctx.clientId === resource.clientId;
}

export function portalAuthorizeScope(
  ctx: ClientPortalContext,
  resource: PortalResourceScope,
): AccessDecision {
  if (!portalScopeMatches(ctx, resource)) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Não encontramos este recurso no seu acesso ao portal.",
    };
  }
  return { ok: true };
}

export function portalAuthorizeClientCase(
  ctx: ClientPortalContext,
  resource: PortalResourceScope,
): AccessDecision {
  return portalAuthorizeScope(ctx, resource);
}

export function portalAuthorizeClientDocument(
  ctx: ClientPortalContext,
  resource: PortalResourceScope,
): AccessDecision {
  return portalAuthorizeScope(ctx, resource);
}

export function portalAuthorizeClientContract(
  ctx: ClientPortalContext,
  resource: PortalResourceScope,
): AccessDecision {
  return portalAuthorizeScope(ctx, resource);
}

export function portalAuthorizeClientPayment(
  ctx: ClientPortalContext,
  resource: PortalResourceScope,
): AccessDecision {
  return portalAuthorizeScope(ctx, resource);
}

export function portalAuthorizeClientMessage(
  ctx: ClientPortalContext,
  resource: PortalResourceScope,
): AccessDecision {
  return portalAuthorizeScope(ctx, resource);
}
