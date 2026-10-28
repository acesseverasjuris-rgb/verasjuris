import { AppError } from "@verasjuris/types";

/**
 * Verificação de inscrição OAB — nunca marcar como verificado sem provider real.
 */

export type OABVerificationHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type OABVerificationQuery = {
  oabNumber: string;
  oabUf: string;
  professionalName?: string;
  signal?: AbortSignal;
};

export type OABVerificationResult = {
  verified: false | true;
  providerKey: string;
  situation?: string | null;
  section?: string | null;
  checkedAt: string;
  detail?: string;
};

export interface OABVerificationProvider {
  readonly id: string;
  verify(query: OABVerificationQuery): Promise<OABVerificationResult>;
  healthCheck(): Promise<OABVerificationHealth>;
}

const MESSAGE =
  "Nenhum provedor de verificação OAB está configurado. Não marque inscrição como verificada automaticamente.";

export class NotConfiguredOABVerificationProvider implements OABVerificationProvider {
  readonly id = "not_configured";

  verify(_query: OABVerificationQuery): Promise<OABVerificationResult> {
    return Promise.reject(new AppError("OAB_VERIFICATION_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  healthCheck(): Promise<OABVerificationHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor de verificação OAB não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
