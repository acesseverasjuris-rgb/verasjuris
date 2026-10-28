import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type CommunicationPermission = Extract<
  PermissionKey,
  | "communication.read"
  | "communication.send"
  | "communication.manage_templates"
  | "communication.manage_preferences"
  | "communication.manage_consents"
  | "communication.admin"
>;

export function policyCommunication(
  membership: AccessMembership,
  required: Extract<CommunicationPermission, "communication.read" | "communication.send">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyCommunicationTemplate(
  membership: AccessMembership,
  required: Extract<
    CommunicationPermission,
    "communication.read" | "communication.manage_templates" | "communication.admin"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyCommunicationPreference(
  membership: AccessMembership,
  required: Extract<
    CommunicationPermission,
    "communication.read" | "communication.manage_preferences" | "communication.admin"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyCommunicationConsent(
  membership: AccessMembership,
  required: Extract<
    CommunicationPermission,
    "communication.read" | "communication.manage_consents" | "communication.admin"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyCommunicationOutbox(
  membership: AccessMembership,
  required: Extract<CommunicationPermission, "communication.read" | "communication.admin">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyCommunicationAdmin(
  membership: AccessMembership,
  required: Extract<CommunicationPermission, "communication.admin">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
