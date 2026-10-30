import { AppError } from "@verasjuris/types";
import type { AccessMembership } from "./authorize.js";

/**
 * Configuração da organização interna oficial (espelha @verasjuris/config).
 * Não hardcodar ID — env VERASJURIS_INTERNAL_ORGANIZATION_ID + flag internalCompany.
 */
export type InternalControlOrganizationConfig = {
  organizationId?: string;
};

/** Membership com org id opcional para checagem cross-tenant sem vazar existência. */
export type InternalControlMembership = AccessMembership & {
  organizationId?: string;
};

const NOT_FOUND_MESSAGE = "Não encontramos este recurso no seu acesso.";

/**
 * Garante que o Control só opera na organização interna autorizada.
 * Cross-tenant / não-interna / sem membership → AppError NOT_FOUND (404),
 * nunca AUTHORIZATION_ERROR, para não vazar existência.
 */
export function assertInternalControlOrganization(
  membership: InternalControlMembership,
  org: { id: string; internalCompany: boolean } | null | undefined,
  config: InternalControlOrganizationConfig = {},
): void {
  if (!membership || membership.status === "removed") {
    throw new AppError("NOT_FOUND", NOT_FOUND_MESSAGE);
  }
  if (!org || org.internalCompany !== true) {
    throw new AppError("NOT_FOUND", NOT_FOUND_MESSAGE);
  }
  if (config.organizationId && config.organizationId !== org.id) {
    throw new AppError("NOT_FOUND", NOT_FOUND_MESSAGE);
  }
  if (membership.organizationId && membership.organizationId !== org.id) {
    throw new AppError("NOT_FOUND", NOT_FOUND_MESSAGE);
  }
}
