import { describe, expect, it } from "vitest";
import { redactSensitive } from "./redact.js";

describe("redação de dados sensíveis", () => {
  it("remove senha, token e biometria em objetos aninhados", () => {
    const result = redactSensitive({
      email: "ana@exemplo.com",
      password: "nao-registrar",
      nested: { refreshToken: "abc", action: "login" },
      items: [{ biometria: "raw" }],
    });
    expect(result).toEqual({
      email: "ana@exemplo.com",
      password: "[redacted]",
      nested: { refreshToken: "[redacted]", action: "login" },
      items: [{ biometria: "[redacted]" }],
    });
  });
});
