import { AppError } from "@verasjuris/types";

export type JurisdictionContext = {
  country: string;
  region?: string;
  legalSystem?: string;
  language: string;
  currency: string;
  timezone: string;
};

/**
 * Regras brasileiras só se aplicam com jurisdiction.country === "BR" declarado.
 * Nunca aplicar silenciosamente regras BR a outros países.
 */
export function assertJurisdictionForBrRules(
  ctx: JurisdictionContext | null | undefined,
  ruleName: string,
): void {
  if (!ctx?.country) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Jurisdição obrigatória para aplicar a regra "${ruleName}". Declare country (ISO 3166-1 alpha-2).`,
    );
  }
  if (ctx.country.toUpperCase() !== "BR") {
    throw new AppError(
      "VALIDATION_ERROR",
      `A regra brasileira "${ruleName}" não se aplica a country=${ctx.country}. Informe jurisdiction BR explicitamente.`,
    );
  }
}

export function requireDeclaredJurisdiction(
  ctx: JurisdictionContext | null | undefined,
): JurisdictionContext {
  if (!ctx?.country || !ctx.language || !ctx.currency || !ctx.timezone) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Contexto de jurisdição incompleto (country, language, currency, timezone).",
    );
  }
  return { ...ctx, country: ctx.country.toUpperCase(), currency: ctx.currency.toUpperCase() };
}
