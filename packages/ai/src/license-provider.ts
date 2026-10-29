import { AppError } from "@verasjuris/types";

/**
 * License server externo / validação de licença — stub futuro (Etapa 22).
 * Default: NOT_CONFIGURED — nunca afirma licença válida sem server real.
 */

export type LicenseProviderHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type LicenseValidationStatus =
  | "valid"
  | "expired"
  | "revoked"
  | "unknown"
  | "not_configured";

export type ValidateLicenseInput = {
  organizationId?: string;
  licenseKey?: string;
  productKey?: string;
  signal?: AbortSignal;
};

export type LicenseValidationResult = {
  providerKey: string;
  status: LicenseValidationStatus;
  externalLicenseId: string | null;
  expiresAt?: string | null;
  seats?: number | null;
  detail?: string;
};

export interface LicenseProvider {
  readonly id: string;
  validateLicense(input: ValidateLicenseInput): Promise<LicenseValidationResult>;
  healthCheck(): Promise<LicenseProviderHealth>;
}

const MESSAGE =
  "Nenhum provedor de licença externo está configurado. Entitlements internos seguem no domínio de monetização.";

export class NotConfiguredLicenseProvider implements LicenseProvider {
  readonly id = "not_configured";

  validateLicense(_input: ValidateLicenseInput): Promise<LicenseValidationResult> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      externalLicenseId: null,
      expiresAt: null,
      seats: null,
      detail: MESSAGE,
    });
  }

  healthCheck(): Promise<LicenseProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: MESSAGE,
      checkedAt: new Date().toISOString(),
    });
  }
}

export function licenseProviderNotConfiguredError(): AppError {
  return new AppError("LICENSE_PROVIDER_NOT_CONFIGURED", MESSAGE);
}
