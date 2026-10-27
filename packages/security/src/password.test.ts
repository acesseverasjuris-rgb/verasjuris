import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, verifyPasswordOrDummy } from "./password.js";

describe("senhas", () => {
  it("confirma a senha original e rejeita outra", async () => {
    const encoded = await hashPassword("segredo-local-12");
    expect(encoded.startsWith("scrypt$")).toBe(true);
    expect(encoded).not.toContain("segredo-local-12");
    expect(await verifyPassword("segredo-local-12", encoded)).toBe(true);
    expect(await verifyPassword("outra-senha-123", encoded)).toBe(false);
  });

  it("rejeita formato desconhecido", async () => {
    expect(await verifyPassword("segredo-local-12", "texto-simples")).toBe(false);
  });

  it("executa verificação fictícia quando não há hash", async () => {
    expect(await verifyPasswordOrDummy("segredo-local-12", null)).toBe(false);
  });
});
