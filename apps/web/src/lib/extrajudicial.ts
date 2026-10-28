import type { AiApiFailure } from "./ai";
import { aiErrorMessage, isApiFailure } from "./ai";

export { isApiFailure, aiErrorMessage };

export type ExtrajudicialRequest = {
  id: string;
  status: string;
  description: string;
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

export async function fetchExtrajudicialRequests(orgId: string) {
  return request<{ requests: ExtrajudicialRequest[] }>(
    `/api/v1/organizations/${orgId}/extrajudicial/requests`,
  );
}

export async function fetchExtrajudicialProvidersStatus(orgId: string) {
  return request<{ registry: { status: string }; feeTable: { status: string } }>(
    `/api/v1/organizations/${orgId}/extrajudicial/providers/status`,
  );
}
