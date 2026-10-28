import { AppError } from "@verasjuris/types";

/**
 * Verificação de CPF/identidade via bureau — distinto de validação matemática de dígitos.
 * Default: NOT_CONFIGURED. Nunca tratar format validation como identidade confirmada.
 */

export type CPFVerificationHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type CPFVerificationQuery = {
  cpfDigits: string;
  fullName?: string;
  birthDate?: string;
  signal?: AbortSignal;
};

export type CPFVerificationResult = {
  verified: false | true;
  providerKey: string;
  checkedAt: string;
  detail?: string;
  /** Nunca expor CPF completo em logs. */
  cpfMasked?: string;
};

export interface CPFVerificationProvider {
  readonly id: string;
  readonly key: string;
  readonly type: "cpf_verification";
  readonly status: "configured" | "not_configured" | "degraded" | "failed";
  verify(query: CPFVerificationQuery): Promise<CPFVerificationResult>;
  healthCheck(): Promise<CPFVerificationHealth>;
}

const MESSAGE =
  "Nenhum provedor de verificação de CPF/identidade está configurado. Validação de dígitos não prova identidade.";

export class NotConfiguredCPFVerificationProvider implements CPFVerificationProvider {
  readonly id = "not_configured";
  readonly key = "not_configured";
  readonly type = "cpf_verification" as const;
  readonly status = "not_configured" as const;

  verify(_query: CPFVerificationQuery): Promise<CPFVerificationResult> {
    return Promise.reject(new AppError("CPF_VERIFICATION_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  healthCheck(): Promise<CPFVerificationHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor de verificação de CPF não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}

/** Validação matemática de dígitos — NÃO é prova de identidade. */
export function isValidCpfChecksum(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  const calc = (base: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      sum += Number(base[i]) * (factor - i);
    }
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  const d1 = calc(digits.slice(0, 9), 10);
  const d2 = calc(digits.slice(0, 10), 11);
  return d1 === Number(digits[9]) && d2 === Number(digits[10]);
}

export function maskCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return "***";
  return `***.***.${digits.slice(6, 9)}-**`;
}
