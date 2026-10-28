import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type ContractPermission = Extract<
  PermissionKey,
  | "contract.read"
  | "contract.create"
  | "contract.update"
  | "contract.manage_parties"
  | "contract.manage_clauses"
  | "contract.review"
  | "contract.approve"
  | "contract.request_signature"
  | "contract.record_signature"
  | "contract.manage_renewal"
  | "contract.terminate"
  | "contract.manage_obligations"
  | "contract.archive"
>;

export function policyContract(
  membership: AccessMembership,
  required: Extract<
    ContractPermission,
    "contract.read" | "contract.create" | "contract.update" | "contract.archive"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyContractVersion(
  membership: AccessMembership,
  required: Extract<
    ContractPermission,
    "contract.read" | "contract.create" | "contract.update" | "contract.review"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyContractClause(
  membership: AccessMembership,
  required: Extract<ContractPermission, "contract.read" | "contract.manage_clauses">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyContractApproval(
  membership: AccessMembership,
  required: Extract<ContractPermission, "contract.read" | "contract.review" | "contract.approve">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policySignatureRequest(
  membership: AccessMembership,
  required: Extract<
    ContractPermission,
    "contract.read" | "contract.request_signature" | "contract.record_signature"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyContractTermination(
  membership: AccessMembership,
  required: Extract<ContractPermission, "contract.read" | "contract.terminate">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}
