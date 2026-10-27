import {
  computeCnjCheckDigits,
  formatCnjNumber,
  normalizeCnjNumber,
  validateCnjNumber,
} from "./cnj.js";
import { describe, expect, it } from "vitest";

describe("CNJ validation", () => {
  it("normaliza removendo pontuação", () => {
    expect(normalizeCnjNumber("0000001-20.2016.8.26.0100")).toBe("00000012020168260100");
  });

  it("formata 20 dígitos", () => {
    expect(formatCnjNumber("00000012020168260100")).toBe("0000001-20.2016.8.26.0100");
  });

  it("aceita CNJ válidos de referência", () => {
    for (const value of ["0000001-20.2016.8.26.0100", "1234567-37.2024.5.02.0001"]) {
      const result = validateCnjNumber(value);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.message).toBe("Número CNJ válido em formato");
        expect(result.formatted).toBe(formatCnjNumber(normalizeCnjNumber(value)));
      }
    }
  });

  it("rejeita dígito verificador inválido", () => {
    const result = validateCnjNumber("0000001-99.2016.8.26.0100");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/Dígito verificador/);
    }
  });

  it("rejeita tamanho inválido", () => {
    const result = validateCnjNumber("123");
    expect(result.ok).toBe(false);
  });

  it("calcula DV conforme algoritmo CNJ", () => {
    expect(computeCnjCheckDigits("0000001", "2016", "8", "26", "0100")).toBe("20");
    expect(computeCnjCheckDigits("1234567", "2024", "5", "02", "0001")).toBe("37");
  });
});
