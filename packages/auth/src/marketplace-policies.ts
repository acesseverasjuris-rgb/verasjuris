import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type MarketplacePermission = Extract<
  PermissionKey,
  | "marketplace.read"
  | "marketplace.request.create"
  | "marketplace.request.manage"
  | "marketplace.service.manage"
  | "marketplace.proposal.create"
  | "marketplace.proposal.manage"
  | "marketplace.engagement.manage"
  | "marketplace.delivery.manage"
  | "marketplace.dispute.open"
  | "marketplace.dispute.resolve"
  | "marketplace.review.create"
  | "marketplace.review.moderate"
>;

export function policyMarketplaceRequest(
  membership: AccessMembership,
  required: Extract<
    MarketplacePermission,
    | "marketplace.read"
    | "marketplace.request.create"
    | "marketplace.request.manage"
    | "marketplace.service.manage"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyMarketplaceProposal(
  membership: AccessMembership,
  required: Extract<
    MarketplacePermission,
    "marketplace.read" | "marketplace.proposal.create" | "marketplace.proposal.manage"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyMarketplaceEngagement(
  membership: AccessMembership,
  required: Extract<
    MarketplacePermission,
    | "marketplace.read"
    | "marketplace.engagement.manage"
    | "marketplace.delivery.manage"
    | "marketplace.review.create"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyMarketplaceDispute(
  membership: AccessMembership,
  required: Extract<
    MarketplacePermission,
    "marketplace.read" | "marketplace.dispute.open" | "marketplace.dispute.resolve"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyMarketplaceService(
  membership: AccessMembership,
  required: Extract<MarketplacePermission, "marketplace.read" | "marketplace.service.manage">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyMarketplaceReviewModerate(
  membership: AccessMembership,
  required: Extract<
    MarketplacePermission,
    "marketplace.read" | "marketplace.review.create" | "marketplace.review.moderate"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
