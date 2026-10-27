import { describe, expect, it } from "vitest";
import {
  DEFAULT_AI_FEATURES,
  LABOR_AI_FEATURES,
  NotConfiguredCNISProvider,
  NotConfiguredESocialProvider,
  NotConfiguredFGTSProvider,
  NotConfiguredLaborCourtProvider,
  NotConfiguredSocialSecurityProvider,
  PREVIDENTIARY_AI_FEATURES,
} from "./index.js";

describe("Prompt 16 — previdentiary/labor AI features", () => {
  it("registra features previdenciárias e trabalhistas com requires_review", () => {
    for (const feature of [...PREVIDENTIARY_AI_FEATURES, ...LABOR_AI_FEATURES]) {
      expect(DEFAULT_AI_FEATURES[feature]?.outputDisposition).toBe("requires_review");
      expect(DEFAULT_AI_FEATURES[feature]?.requires).toContain("STRUCTURED_OUTPUT");
    }
  });
});

describe("Prompt 16 — external providers not_configured", () => {
  it("SocialSecurity/CNIS/eSocial/FGTS/LaborCourt rejeitam com código dedicado", async () => {
    await expect(new NotConfiguredSocialSecurityProvider().fetchBenefits({})).rejects.toMatchObject(
      {
        code: "SOCIAL_SECURITY_PROVIDER_NOT_CONFIGURED",
      },
    );
    await expect(new NotConfiguredCNISProvider().fetchCNIS({})).rejects.toMatchObject({
      code: "CNIS_PROVIDER_NOT_CONFIGURED",
    });
    await expect(
      new NotConfiguredESocialProvider().fetchEmploymentRelationships({}),
    ).rejects.toMatchObject({ code: "ESOCIAL_PROVIDER_NOT_CONFIGURED" });
    await expect(new NotConfiguredFGTSProvider().fetchBalance({})).rejects.toMatchObject({
      code: "FGTS_PROVIDER_NOT_CONFIGURED",
    });
    await expect(new NotConfiguredLaborCourtProvider().fetchProcess("x")).rejects.toMatchObject({
      code: "LABOR_COURT_PROVIDER_NOT_CONFIGURED",
    });

    await expect(new NotConfiguredSocialSecurityProvider().healthCheck()).resolves.toMatchObject({
      status: "not_configured",
    });
  });
});
