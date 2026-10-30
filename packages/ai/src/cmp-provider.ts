import { AppError } from "@verasjuris/types";

/**
 * Consent Management Platform (CMP) / ConsentProvider.
 * Default: not_configured — não inventa consentimento coletado.
 */

export type ConsentProviderHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type ConsentCategory = "necessary" | "analytics" | "marketing" | "functional" | string;

export type ConsentRecord = {
  subjectKey: string;
  categories: readonly ConsentCategory[];
  granted: readonly ConsentCategory[];
  denied: readonly ConsentCategory[];
  collectedAt: string | null;
  providerKey: string;
  status: "ok" | "not_configured" | "unavailable";
  detail?: string;
};

export type CollectConsentInput = {
  subjectKey: string;
  granted: readonly ConsentCategory[];
  denied?: readonly ConsentCategory[];
  metadata?: Record<string, string>;
  signal?: AbortSignal;
};

export type GetConsentInput = {
  subjectKey: string;
  signal?: AbortSignal;
};

export interface ConsentProvider {
  readonly id: string;
  collect(input: CollectConsentInput): Promise<ConsentRecord>;
  get(input: GetConsentInput): Promise<ConsentRecord>;
  healthCheck(): Promise<ConsentProviderHealth>;
}

const MESSAGE = "Nenhum CMP / ConsentProvider está configurado.";

export class NotConfiguredConsentProvider implements ConsentProvider {
  readonly id = "not_configured";

  collect(input: CollectConsentInput): Promise<ConsentRecord> {
    return Promise.resolve({
      subjectKey: input.subjectKey,
      categories: [...input.granted, ...(input.denied ?? [])],
      granted: [],
      denied: [],
      collectedAt: null,
      providerKey: "not_configured",
      status: "not_configured",
      detail: MESSAGE,
    });
  }

  get(input: GetConsentInput): Promise<ConsentRecord> {
    return Promise.resolve({
      subjectKey: input.subjectKey,
      categories: [],
      granted: [],
      denied: [],
      collectedAt: null,
      providerKey: "not_configured",
      status: "not_configured",
      detail: MESSAGE,
    });
  }

  healthCheck(): Promise<ConsentProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: MESSAGE,
      checkedAt: new Date().toISOString(),
    });
  }
}

/** Alias explícito CMP. */
export type CMPProvider = ConsentProvider;
export const NotConfiguredCMPProvider = NotConfiguredConsentProvider;

export function consentProviderNotConfiguredError(): AppError {
  return new AppError("NOT_CONFIGURED", MESSAGE);
}
