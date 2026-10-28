import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type ExtrajudicialPermission = Extract<
  PermissionKey,
  | "extrajudicial.read"
  | "extrajudicial.create"
  | "extrajudicial.quote"
  | "extrajudicial.manage"
  | "extrajudicial.submit"
  | "extrajudicial.complete"
>;

export function policyExtrajudicialRequest(
  membership: AccessMembership,
  required: Extract<
    ExtrajudicialPermission,
    "extrajudicial.read" | "extrajudicial.create" | "extrajudicial.manage"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyExtrajudicialOrder(
  membership: AccessMembership,
  required: Extract<
    ExtrajudicialPermission,
    | "extrajudicial.read"
    | "extrajudicial.quote"
    | "extrajudicial.manage"
    | "extrajudicial.submit"
    | "extrajudicial.complete"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
