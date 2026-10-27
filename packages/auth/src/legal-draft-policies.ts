import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type LegalDraftPermission = Extract<
  PermissionKey,
  | "legal_draft.read"
  | "legal_draft.create"
  | "legal_draft.update"
  | "legal_draft.ai_assist"
  | "legal_draft.review"
  | "legal_draft.approve"
  | "legal_draft.ready_to_file"
  | "legal_draft.file"
  | "legal_draft.confirm"
>;

export function policyLegalDraft(
  membership: AccessMembership,
  required: LegalDraftPermission,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyLegalWorkflow(
  membership: AccessMembership,
  required: Extract<
    LegalDraftPermission,
    | "legal_draft.review"
    | "legal_draft.approve"
    | "legal_draft.ready_to_file"
    | "legal_draft.file"
    | "legal_draft.confirm"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
