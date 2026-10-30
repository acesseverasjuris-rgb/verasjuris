import { describe, expect, it } from "vitest";
import { readFeatureFlags } from "./feature-flags.js";
import { resolveJurisdiction } from "./jurisdiction.js";

describe("feature flags", () => {
  it("fica desligado sem configuração explícita", () => {
    expect(readFeatureFlags({})).toEqual({
      ai: false,
      externalIntegrations: false,
      featureMfa: false,
      featurePasskeys: false,
      featurePwa: false,
      featureI18n: false,
      featureAssistant: false,
      featureEnterpriseSso: false,
      featureAccessibilityPanel: false,
    });
  });

  it("liga apenas o valor 1", () => {
    expect(
      readFeatureFlags({
        FEATURE_AI: "1",
        FEATURE_EXTERNAL_INTEGRATIONS: "true",
        FEATURE_MFA: "1",
        FEATURE_PWA: "1",
      }),
    ).toEqual({
      ai: true,
      externalIntegrations: false,
      featureMfa: true,
      featurePasskeys: false,
      featurePwa: true,
      featureI18n: false,
      featureAssistant: false,
      featureEnterpriseSso: false,
      featureAccessibilityPanel: false,
    });
  });
});

describe("resolveJurisdiction", () => {
  it("usa default BR", () => {
    expect(resolveJurisdiction().country).toBe("BR");
    expect(resolveJurisdiction().currency).toBe("BRL");
  });

  it("não assume BR quando organização é US", () => {
    const ctx = resolveJurisdiction({ organizationCountry: "US" });
    expect(ctx.country).toBe("US");
    expect(ctx.currency).toBe("USD");
    expect(ctx.legalSystem).toBe("common_law");
  });

  it("prioriza override explícito", () => {
    const ctx = resolveJurisdiction({
      organizationCountry: "BR",
      explicit: { country: "PT", language: "pt-PT" },
    });
    expect(ctx.country).toBe("PT");
    expect(ctx.language).toBe("pt-PT");
  });
});
