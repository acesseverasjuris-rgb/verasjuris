import { describe, expect, it } from "vitest";
import { AppError } from "@verasjuris/types";
import {
  maskCnpj,
  maskCpf,
  normalizeCnpj,
  normalizeCpf,
  parseInput,
  registerSchema,
  slugifyName,
} from "./index.js";

describe("validação", () => {
  it("normaliza o identificador da organização", () => {
    expect(slugifyName("Organização Café Platine")).toBe("organizacao-cafe-platine");
  });

  it("rejeita cadastro com senha curta e devolve o campo", () => {
    expect(() =>
      parseInput(registerSchema, {
        displayName: "Ana",
        email: "ana@exemplo.com",
        password: "curta",
      }),
    ).toThrow(AppError);
    try {
      parseInput(registerSchema, {
        displayName: "Ana",
        email: "ana@exemplo.com",
        password: "curta",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      if (error instanceof AppError) {
        expect(error.code).toBe("VALIDATION_ERROR");
        expect(error.details?.some((detail) => detail.path === "password")).toBe(true);
      }
    }
  });

  it("normaliza e mascara CPF/CNPJ válidos", () => {
    expect(normalizeCpf("390.533.447-05")).toBe("39053344705");
    expect(normalizeCpf("11111111111")).toBeNull();
    expect(maskCpf("39053344705")).toBe("***.***.***-05");
    expect(normalizeCnpj("11.444.777/0001-61")).toBe("11444777000161");
    expect(normalizeCnpj("00000000000000")).toBeNull();
    expect(maskCnpj("11444777000161")).toBe("**.***.***/****-61");
  });
});
