import { describe, expect, it } from "vitest";
import { policyCrm, policyProfessionalVerificationStatus, policyProfiles } from "./crm-policies.js";

const member = {
  status: "active" as const,
  organizationStatus: "active" as const,
  permissions: [
    "profiles.update_self",
    "crm.read",
    "crm.create",
    "crm.update",
    "crm.read_notes",
    "crm.write_notes",
  ],
  roles: ["member"],
};

const outsider = null;

describe("CRM e profiles policies", () => {
  it("permite leitura CRM com crm.read", () => {
    expect(policyCrm(member, "crm.read").ok).toBe(true);
  });

  it("nega gestão de tags sem crm.manage_tags", () => {
    expect(policyCrm(member, "crm.manage_tags").ok).toBe(false);
  });

  it("nega acesso sem membership", () => {
    expect(policyCrm(outsider, "crm.read").ok).toBe(false);
  });

  it("permite atualização própria de perfil", () => {
    expect(policyProfiles(member, "profiles.update_self").ok).toBe(true);
  });

  it("bloqueia status verified sem provedor", () => {
    const decision = policyProfessionalVerificationStatus("verified");
    expect(decision.ok).toBe(false);
  });

  it("aceita pending e not_submitted", () => {
    expect(policyProfessionalVerificationStatus("pending").ok).toBe(true);
    expect(policyProfessionalVerificationStatus("not_submitted").ok).toBe(true);
  });
});
