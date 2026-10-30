import { AppError } from "@verasjuris/types";

/**
 * Tradução automática de conteúdo.
 * Default: not_configured — nunca substitui o texto original.
 */

export type TranslationProviderHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type TranslateInput = {
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
  signal?: AbortSignal;
};

export type TranslateResult = {
  providerKey: string;
  status: "translated" | "failed" | "not_configured";
  translatedText: string | null;
  detectedSourceLanguage?: string | null;
  detail?: string;
};

export type DetectLanguageInput = {
  text: string;
  signal?: AbortSignal;
};

export type DetectLanguageResult = {
  providerKey: string;
  status: "ok" | "failed" | "not_configured";
  language: string | null;
  confidence: number | null;
  detail?: string;
};

export type BatchTranslateInput = {
  texts: readonly string[];
  sourceLanguage?: string;
  targetLanguage: string;
  signal?: AbortSignal;
};

export interface TranslationProvider {
  readonly id: string;
  translate(input: TranslateInput): Promise<TranslateResult>;
  detectLanguage(input: DetectLanguageInput): Promise<DetectLanguageResult>;
  batchTranslate(input: BatchTranslateInput): Promise<readonly TranslateResult[]>;
  healthCheck(): Promise<TranslationProviderHealth>;
}

const MESSAGE = "Nenhum provedor de tradução automática está configurado.";

export class NotConfiguredTranslationProvider implements TranslationProvider {
  readonly id = "not_configured";

  translate(_input: TranslateInput): Promise<TranslateResult> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      translatedText: null,
      detectedSourceLanguage: null,
      detail: MESSAGE,
    });
  }

  detectLanguage(_input: DetectLanguageInput): Promise<DetectLanguageResult> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      language: null,
      confidence: null,
      detail: MESSAGE,
    });
  }

  batchTranslate(input: BatchTranslateInput): Promise<readonly TranslateResult[]> {
    return Promise.resolve(
      input.texts.map(() => ({
        providerKey: "not_configured" as const,
        status: "not_configured" as const,
        translatedText: null,
        detectedSourceLanguage: null,
        detail: MESSAGE,
      })),
    );
  }

  healthCheck(): Promise<TranslationProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: MESSAGE,
      checkedAt: new Date().toISOString(),
    });
  }
}

export function translationProviderNotConfiguredError(): AppError {
  return new AppError("NOT_CONFIGURED", MESSAGE);
}
