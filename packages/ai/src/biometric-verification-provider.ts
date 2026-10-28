import { AppError } from "@verasjuris/types";

/**
 * Biometria via provider — sem simulação. Preferir referência externa; sem template bruto local.
 * Default: NOT_CONFIGURED.
 */

export type BiometricVerificationHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type BiometricSessionInput = {
  verificationCaseId: string;
  consentTermVersion: string;
  signal?: AbortSignal;
};

export type BiometricSessionResult = {
  status: "pending" | "passed" | "failed" | "review_required" | "expired" | "not_configured";
  providerKey: string;
  externalSessionRef?: string;
  /** Score opcional do provider — não logar em claro se sensível. */
  score?: number;
  checkedAt: string;
  detail?: string;
};

export interface BiometricVerificationProvider {
  readonly id: string;
  readonly key: string;
  readonly type: "biometric_verification";
  readonly status: "configured" | "not_configured" | "degraded" | "failed";
  createSession(input: BiometricSessionInput): Promise<BiometricSessionResult>;
  liveness(externalSessionRef: string, signal?: AbortSignal): Promise<BiometricSessionResult>;
  faceMatch(externalSessionRef: string, signal?: AbortSignal): Promise<BiometricSessionResult>;
  sessionStatus(externalSessionRef: string, signal?: AbortSignal): Promise<BiometricSessionResult>;
  deleteOrRetentionAction(
    externalSessionRef: string,
    action: "delete" | "extend_retention",
  ): Promise<void>;
  healthCheck(): Promise<BiometricVerificationHealth>;
}

const MESSAGE =
  "Nenhum provedor biométrico está configurado. Biometria não pode ser simulada localmente.";

export class NotConfiguredBiometricVerificationProvider implements BiometricVerificationProvider {
  readonly id = "not_configured";
  readonly key = "not_configured";
  readonly type = "biometric_verification" as const;
  readonly status = "not_configured" as const;

  createSession(_input: BiometricSessionInput): Promise<BiometricSessionResult> {
    return Promise.reject(new AppError("BIOMETRIC_VERIFICATION_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  liveness(_externalSessionRef: string, _signal?: AbortSignal): Promise<BiometricSessionResult> {
    return Promise.reject(new AppError("BIOMETRIC_VERIFICATION_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  faceMatch(_externalSessionRef: string, _signal?: AbortSignal): Promise<BiometricSessionResult> {
    return Promise.reject(new AppError("BIOMETRIC_VERIFICATION_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  sessionStatus(
    _externalSessionRef: string,
    _signal?: AbortSignal,
  ): Promise<BiometricSessionResult> {
    return Promise.reject(new AppError("BIOMETRIC_VERIFICATION_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  deleteOrRetentionAction(
    _externalSessionRef: string,
    _action: "delete" | "extend_retention",
  ): Promise<void> {
    return Promise.reject(new AppError("BIOMETRIC_VERIFICATION_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  healthCheck(): Promise<BiometricVerificationHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor biométrico não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
