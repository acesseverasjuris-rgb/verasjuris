import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type AuctionPostPermission = Extract<
  PermissionKey,
  | "auction_post.read"
  | "auction_post.manage"
  | "auction_payment.manage"
  | "auction_transfer.manage"
  | "auction_delivery.manage"
>;

export function policyAuctionAward(
  membership: AccessMembership,
  required: Extract<AuctionPostPermission, "auction_post.read" | "auction_post.manage">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyAuctionPayment(
  membership: AccessMembership,
  required: Extract<AuctionPostPermission, "auction_payment.manage" | "auction_post.read">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyAuctionTransfer(
  membership: AccessMembership,
  required: Extract<AuctionPostPermission, "auction_transfer.manage" | "auction_post.read">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyAuctionDelivery(
  membership: AccessMembership,
  required: Extract<AuctionPostPermission, "auction_delivery.manage" | "auction_post.read">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
