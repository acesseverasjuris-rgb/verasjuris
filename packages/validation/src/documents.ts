/** Validação e normalização de CPF/CNPJ (dígitos verificadores). Sem unicidade global. */

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizeCpf(value: string): string | null {
  const digits = digitsOnly(value);
  if (digits.length !== 11) return null;
  if (/^(\d)\1+$/.test(digits)) return null;
  const calc = (base: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < base.length; i += 1) sum += Number(base[i]) * (factor - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  const d1 = calc(digits.slice(0, 9), 10);
  const d2 = calc(digits.slice(0, 10), 11);
  if (d1 !== Number(digits[9]) || d2 !== Number(digits[10])) return null;
  return digits;
}

export function normalizeCnpj(value: string): string | null {
  const digits = digitsOnly(value);
  if (digits.length !== 14) return null;
  if (/^(\d)\1+$/.test(digits)) return null;
  const calc = (base: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i += 1) sum += Number(base[i]) * (weights[i] ?? 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(digits, w1);
  const d2 = calc(digits.slice(0, 12) + String(d1), w2);
  if (d1 !== Number(digits[12]) || d2 !== Number(digits[13])) return null;
  return digits;
}

export function maskCpf(normalized: string | null | undefined): string | null {
  if (normalized?.length !== 11) return null;
  return `***.***.***-${normalized.slice(9)}`;
}

export function maskCnpj(normalized: string | null | undefined): string | null {
  if (normalized?.length !== 14) return null;
  return `**.***.***/****-${normalized.slice(12)}`;
}
