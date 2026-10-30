/**
 * Etapa 32 — Jurisdiction isolation.
 * Never apply Brazilian legal rules outside an explicitly resolved BR context.
 */

export type JurisdictionContext = {
  country: string;
  region?: string;
  legalSystem: string;
  language: string;
  currency: string;
  timezone: string;
};

export type JurisdictionResolutionInput = {
  /** Explicit override (highest priority when set). */
  explicit?: Partial<JurisdictionContext> & { country?: string };
  organizationCountry?: string;
  organizationRegion?: string;
  organizationLanguage?: string;
  organizationCurrency?: string;
  organizationTimezone?: string;
  userLanguage?: string;
  userTimezone?: string;
};

const DEFAULTS: JurisdictionContext = {
  country: "BR",
  region: undefined,
  legalSystem: "civil_law",
  language: "pt-BR",
  currency: "BRL",
  timezone: "America/Sao_Paulo",
};

const COUNTRY_PROFILES: Record<string, Omit<JurisdictionContext, "region">> = {
  BR: {
    country: "BR",
    legalSystem: "civil_law",
    language: "pt-BR",
    currency: "BRL",
    timezone: "America/Sao_Paulo",
  },
  US: {
    country: "US",
    legalSystem: "common_law",
    language: "en-US",
    currency: "USD",
    timezone: "America/New_York",
  },
  PT: {
    country: "PT",
    legalSystem: "civil_law",
    language: "pt-PT",
    currency: "EUR",
    timezone: "Europe/Lisbon",
  },
  AR: {
    country: "AR",
    legalSystem: "civil_law",
    language: "es-AR",
    currency: "ARS",
    timezone: "America/Argentina/Buenos_Aires",
  },
  ES: {
    country: "ES",
    legalSystem: "civil_law",
    language: "es-ES",
    currency: "EUR",
    timezone: "Europe/Madrid",
  },
  EU: {
    country: "EU",
    legalSystem: "civil_law",
    language: "en-GB",
    currency: "EUR",
    timezone: "Europe/Brussels",
  },
};

function normalizeCountry(code?: string): string | undefined {
  if (!code) return undefined;
  const c = code.trim().toUpperCase();
  return c.length >= 2 ? (c.slice(0, 2) === "EU" ? "EU" : c.slice(0, 2)) : undefined;
}

/**
 * Resolve jurisdiction from explicit → organization → user → default (BR).
 * Legal modules must declare jurisdiction; never assume BR for non-BR orgs.
 */
export function resolveJurisdiction(input: JurisdictionResolutionInput = {}): JurisdictionContext {
  const country =
    normalizeCountry(input.explicit?.country) ??
    normalizeCountry(input.organizationCountry) ??
    DEFAULTS.country;

  const profile = COUNTRY_PROFILES[country] ?? {
    ...DEFAULTS,
    country,
  };

  return {
    country: profile.country,
    region: input.explicit?.region ?? input.organizationRegion,
    legalSystem: input.explicit?.legalSystem ?? profile.legalSystem,
    language:
      input.explicit?.language ??
      input.organizationLanguage ??
      input.userLanguage ??
      profile.language,
    currency: input.explicit?.currency ?? input.organizationCurrency ?? profile.currency,
    timezone:
      input.explicit?.timezone ??
      input.organizationTimezone ??
      input.userTimezone ??
      profile.timezone,
  };
}
