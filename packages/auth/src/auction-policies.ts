import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type AuctionPermission = Extract<
  PermissionKey,
  | "auction.read"
  | "auction.create"
  | "auction.update"
  | "auction.manage"
  | "auction.save"
  | "auction.alert.manage"
  | "auction.due_diligence.read"
  | "auction.due_diligence.manage"
  | "auction.documents.manage"
  | "auction.ai.analyze"
>;

export function policyAuction(
  membership: AccessMembership,
  required: AuctionPermission,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyAuctionLot(
  membership: AccessMembership,
  required: Extract<
    AuctionPermission,
    "auction.read" | "auction.create" | "auction.update" | "auction.manage"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyAuctionInterest(
  membership: AccessMembership,
  required: Extract<AuctionPermission, "auction.save" | "auction.read">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyAuctionAlert(
  membership: AccessMembership,
  required: Extract<AuctionPermission, "auction.alert.manage" | "auction.read">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyAuctionDueDiligence(
  membership: AccessMembership,
  required: Extract<
    AuctionPermission,
    "auction.due_diligence.read" | "auction.due_diligence.manage"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

/**
 * Leilão global (organizationId nulo) é somente leitura para qualquer organização;
 * apenas cadastros da própria organização podem ser alterados.
 */
export function policyAuctionMutation(
  membership: AccessMembership,
  required: Extract<AuctionPermission, "auction.update" | "auction.manage">,
  auctionOrganizationId: string | null,
  actorOrganizationId: string,
): AccessDecision {
  const base = authorizeAccess({ membership, required });
  if (!base.ok) return base;
  if (auctionOrganizationId === null || auctionOrganizationId !== actorOrganizationId) {
    return {
      ok: false,
      code: "AUTHORIZATION_ERROR",
      message: "Leilões de referência global não podem ser alterados pela organização.",
    };
  }
  return base;
}
