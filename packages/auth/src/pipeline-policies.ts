import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

export function policyPipeline(
  membership: AccessMembership,
  required: Extract<PermissionKey, "pipeline.read" | "pipeline.manage" | "pipeline.move">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyAnalysis(
  membership: AccessMembership,
  required: Extract<PermissionKey, "analysis.read" | "analysis.manage">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyProposal(
  membership: AccessMembership,
  required: Extract<
    PermissionKey,
    "proposal.read" | "proposal.create" | "proposal.approve" | "proposal.send"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyEngagement(
  membership: AccessMembership,
  required: Extract<PermissionKey, "engagement.read" | "engagement.manage">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
