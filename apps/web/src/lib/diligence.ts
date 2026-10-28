import type { AiApiFailure } from "./ai";
import { aiErrorMessage, isApiFailure } from "./ai";

export { isApiFailure, aiErrorMessage };

export type DiligenceRequest = {
  id: string;
  title: string;
  status: string;
  dueAt: string | null;
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

export async function fetchDiligenceRequests(orgId: string) {
  return request<{ requests: DiligenceRequest[] }>(
    `/api/v1/organizations/${orgId}/diligence/requests`,
  );
}

export async function fetchDiligenceTypes(orgId: string) {
  return request<{ types: Array<{ key: string; name: string }> }>(
    `/api/v1/organizations/${orgId}/diligence/types`,
  );
}
