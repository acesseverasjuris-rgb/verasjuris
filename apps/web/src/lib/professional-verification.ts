import type { AiApiFailure } from "./ai";
import { aiErrorMessage, isApiFailure } from "./ai";

export { isApiFailure, aiErrorMessage };

export type VerificationCase = {
  id: string;
  verificationType: string;
  status: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T | AiApiFailure> {
  try {
    const response = await fetch(path, {
      ...init,
      credentials: "include",
      headers: { accept: "application/json", ...(init?.headers ?? {}) },
    });
    const body = (await response.json().catch(() => ({}))) as T & AiApiFailure;
    if (!response.ok) {
      return {
        httpStatus: response.status,
        error: {
          code: body.error?.code ?? "INTERNAL_ERROR",
          message: body.error?.message ?? "Falha na requisição.",
        },
      };
    }
    return body;
  } catch {
    return {
      error: {
        code: "NETWORK_ERROR",
        message: "Não foi possível falar com o serviço VerasJuris.",
      },
    };
  }
}

export async function fetchOwnVerificationCases(orgId: string) {
  return request<{ cases: VerificationCase[] }>(
    `/api/v1/organizations/${orgId}/professional-verification/cases`,
  );
}

export async function fetchVerificationProvidersStatus() {
  return request<{
    oab: { status: string };
    cpf: { status: string };
    document: { status: string };
    biometric: { status: string };
  }>("/api/v1/professional-verification/providers/status");
}
