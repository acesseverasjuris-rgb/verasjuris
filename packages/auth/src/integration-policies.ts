import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type IntegrationPermission = Extract<
  PermissionKey,
  | "integration.read"
  | "integration.manage"
  | "integration.webhook.manage"
  | "integration.credential.manage"
>;

export function policyIntegration(
  membership: AccessMembership,
  required: Extract<IntegrationPermission, "integration.read" | "integration.manage">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyIntegrationWebhook(
  membership: AccessMembership,
  required: Extract<
    IntegrationPermission,
    "integration.read" | "integration.webhook.manage" | "integration.manage"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyIntegrationCredential(
  membership: AccessMembership,
  required: Extract<
    IntegrationPermission,
    "integration.read" | "integration.credential.manage" | "integration.manage"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
