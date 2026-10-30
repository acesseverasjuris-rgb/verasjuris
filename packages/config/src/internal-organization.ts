/**
 * VerasJuris Control — resolução da organização interna.
 * Acesso Control exige organizationId configurado (opcional) E org.internalCompany === true.
 */

export type InternalOrganizationConfig = {
  organizationId?: string;
};

export type InternalOrganizationRow = {
  internalCompany: boolean;
};

export function readInternalOrganizationConfig(
  env: NodeJS.ProcessEnv = process.env,
): InternalOrganizationConfig {
  const raw = env.VERASJURIS_INTERNAL_ORGANIZATION_ID?.trim();
  return {
    organizationId: raw && raw.length > 0 ? raw : undefined,
  };
}

/**
 * Control access gate: id must match configured internal org (when set)
 * AND the organization row must have internalCompany === true.
 */
export function isInternalOrganizationId(
  id: string,
  config: InternalOrganizationConfig,
  orgRow?: InternalOrganizationRow,
): boolean {
  if (!id) {
    return false;
  }
  if (orgRow && orgRow.internalCompany !== true) {
    return false;
  }
  if (config.organizationId && config.organizationId !== id) {
    return false;
  }
  // Sem orgRow, não autorizar — exige prova de internalCompany.
  if (!orgRow) {
    return false;
  }
  return orgRow.internalCompany === true;
}
