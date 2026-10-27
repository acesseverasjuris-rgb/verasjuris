import { describe, expect, it } from "vitest";
import { readFeatureFlags } from "./feature-flags.js";

describe("feature flags", () => {
  it("fica desligado sem configuração explícita", () => {
    expect(readFeatureFlags({})).toEqual({ ai: false, externalIntegrations: false });
  });

  it("liga apenas o valor 1", () => {
    expect(readFeatureFlags({ FEATURE_AI: "1", FEATURE_EXTERNAL_INTEGRATIONS: "true" })).toEqual({
      ai: true,
      externalIntegrations: false,
    });
  });
});
