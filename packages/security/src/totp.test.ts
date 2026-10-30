import { describe, expect, it } from "vitest";
import { generateTotp, generateTotpSecret, verifyTotp, buildOtpAuthUri } from "./totp.js";

describe("totp", () => {
  it("gera e verifica código na janela atual", () => {
    const secret = generateTotpSecret();
    const nowMs = 1_700_000_000_000;
    const token = generateTotp(secret, { nowMs });
    expect(token).toMatch(/^\d{6}$/);
    expect(verifyTotp(secret, token, { nowMs })).toBe(true);
    expect(verifyTotp(secret, "000000", { nowMs })).toBe(false);
  });

  it("monta otpauth URI", () => {
    const uri = buildOtpAuthUri({
      secret: "JBSWY3DPEHPK3PXP",
      accountName: "a@b.com",
      issuer: "VerasJuris",
    });
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
  });
});
