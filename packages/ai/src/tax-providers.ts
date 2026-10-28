import { AppError } from "@verasjuris/types";

/**
 * Provedores futuros de dados tributários oficiais (Receita, SEFAZ, prefeituras).
 * Default: not_configured — sem sync inventado.
 */

export type TaxProviderHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type FederalTaxAssessmentRecord = {
  externalId: string;
  taxTypeCode: string | null;
  status: string | null;
  principalCents: number | null;
  provider: string;
};

export type StateTaxAssessmentRecord = {
  externalId: string;
  stateCode: string | null;
  taxTypeCode: string | null;
  status: string | null;
  provider: string;
};

export type MunicipalTaxAssessmentRecord = {
  externalId: string;
  municipalityCode: string | null;
  taxTypeCode: string | null;
  status: string | null;
  provider: string;
};

export type TaxDebtCertificateRecord = {
  externalId: string;
  number: string | null;
  totalCents: number | null;
  status: string | null;
  provider: string;
};

export type TaxFilingRecord = {
  externalId: string;
  declarationType: string | null;
  competence: string | null;
  status: string | null;
  provider: string;
};

export interface FederalTaxProvider {
  readonly id: string;
  fetchAssessment(
    externalId: string,
    signal?: AbortSignal,
  ): Promise<FederalTaxAssessmentRecord | null>;
  fetchAssessments(query: {
    taxpayerId?: string;
    signal?: AbortSignal;
  }): Promise<FederalTaxAssessmentRecord[]>;
  healthCheck(): Promise<TaxProviderHealth>;
}

export interface StateTaxProvider {
  readonly id: string;
  fetchAssessment(
    externalId: string,
    signal?: AbortSignal,
  ): Promise<StateTaxAssessmentRecord | null>;
  fetchAssessments(query: {
    stateCode?: string;
    taxpayerId?: string;
    signal?: AbortSignal;
  }): Promise<StateTaxAssessmentRecord[]>;
  healthCheck(): Promise<TaxProviderHealth>;
}

export interface MunicipalTaxProvider {
  readonly id: string;
  fetchAssessment(
    externalId: string,
    signal?: AbortSignal,
  ): Promise<MunicipalTaxAssessmentRecord | null>;
  fetchAssessments(query: {
    municipalityCode?: string;
    taxpayerId?: string;
    signal?: AbortSignal;
  }): Promise<MunicipalTaxAssessmentRecord[]>;
  healthCheck(): Promise<TaxProviderHealth>;
}

export interface TaxDebtProvider {
  readonly id: string;
  fetchDebtCertificate(
    externalId: string,
    signal?: AbortSignal,
  ): Promise<TaxDebtCertificateRecord | null>;
  fetchDebtCertificates(query: {
    taxpayerId?: string;
    signal?: AbortSignal;
  }): Promise<TaxDebtCertificateRecord[]>;
  healthCheck(): Promise<TaxProviderHealth>;
}

export interface TaxFilingProvider {
  readonly id: string;
  fetchFiling(externalId: string, signal?: AbortSignal): Promise<TaxFilingRecord | null>;
  fetchFilings(query: {
    taxpayerId?: string;
    competence?: string;
    signal?: AbortSignal;
  }): Promise<TaxFilingRecord[]>;
  healthCheck(): Promise<TaxProviderHealth>;
}

const FEDERAL_MESSAGE =
  "Nenhum provedor de dados tributários federais está configurado. Nenhum dado oficial foi sincronizado.";
const STATE_MESSAGE =
  "Nenhum provedor de dados tributários estaduais está configurado. Nenhum dado oficial foi sincronizado.";
const MUNICIPAL_MESSAGE =
  "Nenhum provedor de dados tributários municipais está configurado. Nenhum dado oficial foi sincronizado.";
const DEBT_MESSAGE =
  "Nenhum provedor de certidões/dívida ativa tributária está configurado. Nenhum dado oficial foi sincronizado.";
const FILING_MESSAGE =
  "Nenhum provedor de declarações/obrigações acessórias está configurado. Nenhum dado oficial foi sincronizado.";

export class NotConfiguredFederalTaxProvider implements FederalTaxProvider {
  readonly id = "not_configured";

  fetchAssessment(
    _externalId: string,
    _signal?: AbortSignal,
  ): Promise<FederalTaxAssessmentRecord | null> {
    return Promise.reject(new AppError("FEDERAL_TAX_PROVIDER_NOT_CONFIGURED", FEDERAL_MESSAGE));
  }

  fetchAssessments(_query: {
    taxpayerId?: string;
    signal?: AbortSignal;
  }): Promise<FederalTaxAssessmentRecord[]> {
    return Promise.reject(new AppError("FEDERAL_TAX_PROVIDER_NOT_CONFIGURED", FEDERAL_MESSAGE));
  }

  healthCheck(): Promise<TaxProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor tributário federal não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}

export class NotConfiguredStateTaxProvider implements StateTaxProvider {
  readonly id = "not_configured";

  fetchAssessment(
    _externalId: string,
    _signal?: AbortSignal,
  ): Promise<StateTaxAssessmentRecord | null> {
    return Promise.reject(new AppError("STATE_TAX_PROVIDER_NOT_CONFIGURED", STATE_MESSAGE));
  }

  fetchAssessments(_query: {
    stateCode?: string;
    taxpayerId?: string;
    signal?: AbortSignal;
  }): Promise<StateTaxAssessmentRecord[]> {
    return Promise.reject(new AppError("STATE_TAX_PROVIDER_NOT_CONFIGURED", STATE_MESSAGE));
  }

  healthCheck(): Promise<TaxProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor tributário estadual não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}

export class NotConfiguredMunicipalTaxProvider implements MunicipalTaxProvider {
  readonly id = "not_configured";

  fetchAssessment(
    _externalId: string,
    _signal?: AbortSignal,
  ): Promise<MunicipalTaxAssessmentRecord | null> {
    return Promise.reject(new AppError("MUNICIPAL_TAX_PROVIDER_NOT_CONFIGURED", MUNICIPAL_MESSAGE));
  }

  fetchAssessments(_query: {
    municipalityCode?: string;
    taxpayerId?: string;
    signal?: AbortSignal;
  }): Promise<MunicipalTaxAssessmentRecord[]> {
    return Promise.reject(new AppError("MUNICIPAL_TAX_PROVIDER_NOT_CONFIGURED", MUNICIPAL_MESSAGE));
  }

  healthCheck(): Promise<TaxProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor tributário municipal não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}

export class NotConfiguredTaxDebtProvider implements TaxDebtProvider {
  readonly id = "not_configured";

  fetchDebtCertificate(
    _externalId: string,
    _signal?: AbortSignal,
  ): Promise<TaxDebtCertificateRecord | null> {
    return Promise.reject(new AppError("TAX_DEBT_PROVIDER_NOT_CONFIGURED", DEBT_MESSAGE));
  }

  fetchDebtCertificates(_query: {
    taxpayerId?: string;
    signal?: AbortSignal;
  }): Promise<TaxDebtCertificateRecord[]> {
    return Promise.reject(new AppError("TAX_DEBT_PROVIDER_NOT_CONFIGURED", DEBT_MESSAGE));
  }

  healthCheck(): Promise<TaxProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor de dívida ativa tributária não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}

export class NotConfiguredTaxFilingProvider implements TaxFilingProvider {
  readonly id = "not_configured";

  fetchFiling(_externalId: string, _signal?: AbortSignal): Promise<TaxFilingRecord | null> {
    return Promise.reject(new AppError("TAX_FILING_PROVIDER_NOT_CONFIGURED", FILING_MESSAGE));
  }

  fetchFilings(_query: {
    taxpayerId?: string;
    competence?: string;
    signal?: AbortSignal;
  }): Promise<TaxFilingRecord[]> {
    return Promise.reject(new AppError("TAX_FILING_PROVIDER_NOT_CONFIGURED", FILING_MESSAGE));
  }

  healthCheck(): Promise<TaxProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor de declarações tributárias não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
