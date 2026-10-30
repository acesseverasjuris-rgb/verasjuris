import { AppError } from "@verasjuris/types";

/**
 * Língua de sinais / Libras (ex.: VLibras quando aplicável).
 * Default: not_configured.
 */

export type SignLanguageProviderHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type SignLanguageRenderInput = {
  text: string;
  language?: "libras" | "asl" | string;
  signal?: AbortSignal;
};

export type SignLanguageRenderResult = {
  providerKey: string;
  status: "ready" | "processing" | "failed" | "not_configured";
  videoUrl: string | null;
  widgetConfig: Record<string, unknown> | null;
  detail?: string;
};

export interface SignLanguageProvider {
  readonly id: string;
  render(input: SignLanguageRenderInput): Promise<SignLanguageRenderResult>;
  healthCheck(): Promise<SignLanguageProviderHealth>;
}

const MESSAGE =
  "Nenhum provedor de língua de sinais está configurado. Integração Libras/VLibras indisponível.";

export class NotConfiguredSignLanguageProvider implements SignLanguageProvider {
  readonly id = "not_configured";

  render(_input: SignLanguageRenderInput): Promise<SignLanguageRenderResult> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      videoUrl: null,
      widgetConfig: null,
      detail: MESSAGE,
    });
  }

  healthCheck(): Promise<SignLanguageProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: MESSAGE,
      checkedAt: new Date().toISOString(),
    });
  }
}

export function signLanguageProviderNotConfiguredError(): AppError {
  return new AppError("NOT_CONFIGURED", MESSAGE);
}
