import type { PermissionKey } from "@verasjuris/types";
import { authorizeAccess, type AccessDecision, type AccessMembership } from "./authorize.js";

type DocumentPermission = Extract<
  PermissionKey,
  | "document.read"
  | "document.create"
  | "document.update"
  | "document.upload_version"
  | "document.download"
  | "document.manage_acl"
  | "document.archive"
  | "document.restore"
  | "document_category.manage"
  | "document_folder.manage"
>;

export function policyDocument(
  membership: AccessMembership,
  required: DocumentPermission,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyDocumentVersion(
  membership: AccessMembership,
  required: Extract<
    PermissionKey,
    "document.read" | "document.upload_version" | "document.download"
  >,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyDocumentFolder(
  membership: AccessMembership,
  required: Extract<PermissionKey, "document.read" | "document_folder.manage">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

export function policyDocumentACL(
  membership: AccessMembership,
  required: Extract<PermissionKey, "document.read" | "document.manage_acl">,
): AccessDecision {
  return authorizeAccess({ membership, required });
}

/**
 * Confidencialidade: CONFIDENTIAL exige document.read e papel elevated (owner/administrator)
 * ou ACL explícita (avaliada no serviço).
 */
export function policyDocumentConfidentiality(
  membership: AccessMembership,
  level: "normal" | "restricted" | "confidential",
): AccessDecision {
  const base = authorizeAccess({ membership, required: "document.read" });
  if (!base.ok) return base;
  if (level === "normal" || level === "restricted") return base;
  const elevated =
    membership?.roles?.includes("owner") || membership?.roles?.includes("administrator");
  if (elevated) return base;
  return {
    ok: false,
    code: "AUTHORIZATION_ERROR",
    message: "Documento confidencial exige papel elevado ou ACL explícita.",
  };
}
