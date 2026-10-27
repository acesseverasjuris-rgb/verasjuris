import { z } from "zod";

/** Digits-only CNJ (20 chars): NNNNNNNDDAAAAJTROOOO */
const CNJ_DIGITS_RE = /^\d{20}$/;

/**
 * Valida número CNJ conforme Resolução CNJ nº 65/2008 (estrutura + dígito verificador).
 * Validação estrutural ≠ existência do processo no tribunal.
 */
export function normalizeCnjNumber(input: string): string {
  return input.replace(/\D/g, "");
}

export function formatCnjNumber(normalized: string): string {
  const digits = normalizeCnjNumber(normalized);
  if (digits.length !== 20) {
    throw new Error("Número CNJ normalizado deve ter 20 dígitos.");
  }
  return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
}

export function computeCnjCheckDigits(
  sequential: string,
  year: string,
  segment: string,
  court: string,
  origin: string,
): string {
  const base = `${sequential}${year}${segment}${court}${origin}00`;
  const remainder = Number(BigInt(base) % 97n);
  const dv = 98 - remainder;
  return String(dv).padStart(2, "0");
}

export type CnjValidationResult =
  | {
      ok: true;
      normalized: string;
      formatted: string;
      message: "Número CNJ válido em formato";
    }
  | { ok: false; message: string };

export function validateCnjNumber(input: string): CnjValidationResult {
  const normalized = normalizeCnjNumber(input);
  if (!CNJ_DIGITS_RE.test(normalized)) {
    return {
      ok: false,
      message: "Informe um número CNJ com 20 dígitos (formato NNNNNNN-DD.AAAA.J.TR.OOOO).",
    };
  }

  const sequential = normalized.slice(0, 7);
  const checkDigits = normalized.slice(7, 9);
  const year = normalized.slice(9, 13);
  const segment = normalized.slice(13, 14);
  const court = normalized.slice(14, 16);
  const origin = normalized.slice(16, 20);

  const yearNum = Number(year);
  if (yearNum < 1900 || yearNum > 2100) {
    return { ok: false, message: "Ano do número CNJ inválido." };
  }

  const expected = computeCnjCheckDigits(sequential, year, segment, court, origin);
  if (checkDigits !== expected) {
    return {
      ok: false,
      message: "Dígito verificador do número CNJ inválido.",
    };
  }

  return {
    ok: true,
    normalized,
    formatted: formatCnjNumber(normalized),
    message: "Número CNJ válido em formato",
  };
}

export const cnjNumberSchema = z
  .string()
  .trim()
  .min(15)
  .max(40)
  .superRefine((value, ctx) => {
    const result = validateCnjNumber(value);
    if (!result.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.message });
    }
  });
