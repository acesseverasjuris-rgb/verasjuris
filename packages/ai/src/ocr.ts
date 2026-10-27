import { AppError } from "@verasjuris/types";

/**
 * OCR é um provedor externo opcional. Nenhum está integrado: `NotConfiguredOCRProvider` recusa
 * com `OCR_PROVIDER_NOT_CONFIGURED`. Nunca se simula OCR (nenhum texto "inventado").
 */

export type OCRRequest = {
  data: Uint8Array;
  mimeType: string;
  /** Dicas de idioma BCP-47 (ex.: "pt-BR"). */
  languageHints?: readonly string[];
  /** Páginas 1-indexadas; ausente = todas. */
  pages?: readonly number[];
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export type OCRPage = {
  pageNumber: number;
  text: string;
  /** Confiança 0..100 (inteiro). */
  confidence: number | null;
};

export type OCRResult = {
  provider: string;
  pages: OCRPage[];
  text: string;
  /** Custo informado pelo fornecedor, em micros inteiros (persistir em OCR_USAGE, separado de LLM). */
  providerReportedCostMicros: number | null;
  /**
   * Alias opcional quando o provedor reporta custo.
   * Preferir `providerReportedCostMicros` na persistência; preencher ambos quando houver valor.
   */
  costMicros?: number | null;
};

export type OCRHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export interface OCRProvider {
  readonly id: string;
  recognize(request: OCRRequest): Promise<OCRResult>;
  healthCheck(): Promise<OCRHealth>;
}

const OCR_NOT_CONFIGURED_MESSAGE =
  "Nenhum provedor de OCR está configurado. Nenhum texto foi extraído por reconhecimento óptico.";

export class NotConfiguredOCRProvider implements OCRProvider {
  readonly id = "not_configured";

  recognize(_request: OCRRequest): Promise<OCRResult> {
    return Promise.reject(new AppError("OCR_PROVIDER_NOT_CONFIGURED", OCR_NOT_CONFIGURED_MESSAGE));
  }

  healthCheck(): Promise<OCRHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Nenhum provedor de OCR configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
