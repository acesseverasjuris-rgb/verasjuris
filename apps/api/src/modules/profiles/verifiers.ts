import { AppError } from "@verasjuris/types";

export type ProfessionalLicenseVerifier = {
  status: "NOT_CONFIGURED";
  verify(): Promise<never>;
};

export const professionalLicenseVerifier: ProfessionalLicenseVerifier = {
  status: "NOT_CONFIGURED",
  async verify() {
    throw new AppError("NOT_CONFIGURED", "Validação OAB ainda não está configurada.");
  },
};

export type IdentityVerificationProvider = {
  status: "NOT_CONFIGURED";
  verify(): Promise<never>;
};

export const identityVerificationProvider: IdentityVerificationProvider = {
  status: "NOT_CONFIGURED",
  async verify() {
    throw new AppError("NOT_CONFIGURED", "Verificação de identidade ainda não está configurada.");
  },
};

/**
 * Biometria documental — stub apenas.
 * Não armazenar dados biométricos; integração real exige provedor certificado e política de retenção.
 */
export type BiometricDocumentVerifier = {
  status: "NOT_CONFIGURED";
  verify(): Promise<never>;
};

export const biometricDocumentVerifier: BiometricDocumentVerifier = {
  status: "NOT_CONFIGURED",
  async verify() {
    throw new AppError(
      "NOT_CONFIGURED",
      "Verificação biométrica documental ainda não está configurada.",
    );
  },
};
