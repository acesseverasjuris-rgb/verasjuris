import { AppError } from "@verasjuris/types";

/**
 * Provedor futuro de dados previdenciários oficiais (Meu INSS / APIs).
 * Default: not_configured — sem sync inventado.
 */

export type SocialSecurityHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type SocialSecurityBenefitRecord = {
  externalId: string;
  nb: string | null;
  benefitType: string | null;
  status: string | null;
  provider: string;
  metadata: Record<string, string>;
};

export type SocialSecurityRequestRecord = {
  externalId: string;
  protocol: string | null;
  status: string | null;
  provider: string;
};

export type SocialSecurityRequirementRecord = {
  externalId: string;
  description: string;
  dueDate: string | null;
  status: string | null;
};

export type SocialSecurityDecisionRecord = {
  externalId: string;
  decidedAt: string | null;
  outcome: string | null;
  summary: string | null;
};

export type SocialSecurityExamRecord = {
  externalId: string;
  scheduledAt: string | null;
  examType: string | null;
  status: string | null;
};

export type SocialSecurityCnisSnapshot = {
  externalId: string;
  retrievedAt: string;
  entriesCount: number | null;
  provider: string;
};

export interface SocialSecurityProvider {
  readonly id: string;
  fetchBenefit(
    externalId: string,
    signal?: AbortSignal,
  ): Promise<SocialSecurityBenefitRecord | null>;
  fetchBenefits(query: {
    nit?: string;
    signal?: AbortSignal;
  }): Promise<SocialSecurityBenefitRecord[]>;
  fetchRequest(
    externalId: string,
    signal?: AbortSignal,
  ): Promise<SocialSecurityRequestRecord | null>;
  fetchRequirements(
    requestExternalId: string,
    signal?: AbortSignal,
  ): Promise<SocialSecurityRequirementRecord[]>;
  fetchDecision(
    requestExternalId: string,
    signal?: AbortSignal,
  ): Promise<SocialSecurityDecisionRecord | null>;
  fetchExam(externalId: string, signal?: AbortSignal): Promise<SocialSecurityExamRecord | null>;
  fetchCNIS(query: {
    nit?: string;
    signal?: AbortSignal;
  }): Promise<SocialSecurityCnisSnapshot | null>;
  healthCheck(): Promise<SocialSecurityHealth>;
}

const MESSAGE =
  "Nenhum provedor de previdência social está configurado. Nenhum dado oficial foi sincronizado nem inventado.";

export class NotConfiguredSocialSecurityProvider implements SocialSecurityProvider {
  readonly id = "not_configured";

  fetchBenefit(
    _externalId: string,
    _signal?: AbortSignal,
  ): Promise<SocialSecurityBenefitRecord | null> {
    return Promise.reject(new AppError("SOCIAL_SECURITY_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  fetchBenefits(_query: {
    nit?: string;
    signal?: AbortSignal;
  }): Promise<SocialSecurityBenefitRecord[]> {
    return Promise.reject(new AppError("SOCIAL_SECURITY_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  fetchRequest(
    _externalId: string,
    _signal?: AbortSignal,
  ): Promise<SocialSecurityRequestRecord | null> {
    return Promise.reject(new AppError("SOCIAL_SECURITY_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  fetchRequirements(
    _requestExternalId: string,
    _signal?: AbortSignal,
  ): Promise<SocialSecurityRequirementRecord[]> {
    return Promise.reject(new AppError("SOCIAL_SECURITY_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  fetchDecision(
    _requestExternalId: string,
    _signal?: AbortSignal,
  ): Promise<SocialSecurityDecisionRecord | null> {
    return Promise.reject(new AppError("SOCIAL_SECURITY_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  fetchExam(_externalId: string, _signal?: AbortSignal): Promise<SocialSecurityExamRecord | null> {
    return Promise.reject(new AppError("SOCIAL_SECURITY_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  fetchCNIS(_query: {
    nit?: string;
    signal?: AbortSignal;
  }): Promise<SocialSecurityCnisSnapshot | null> {
    return Promise.reject(new AppError("SOCIAL_SECURITY_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  healthCheck(): Promise<SocialSecurityHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Nenhum provedor de previdência social configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
