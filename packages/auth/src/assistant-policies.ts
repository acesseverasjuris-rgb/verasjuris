import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type AssistantPermission = Extract<
  PermissionKey,
  "assistant.read" | "assistant.use" | "assistant.manage" | "assistant.admin"
>;

export function policyAssistant(
  membership: AccessMembership,
  required: Extract<AssistantPermission, "assistant.read" | "assistant.use">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyAssistantManage(
  membership: AccessMembership,
  required: Extract<AssistantPermission, "assistant.read" | "assistant.manage" | "assistant.admin">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyAssistantAdmin(
  membership: AccessMembership,
  required: Extract<AssistantPermission, "assistant.admin">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
