import { AppError } from "@verasjuris/types";

/**
 * Validação documental (OCR/fraud signals) via provider externo.
 * Default: NOT_CONFIGURED.
 */

export type DocumentVerificationHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type DocumentValidationInput = {
  documentStorageKey?: string;
  documentId?: string;
  documentType?: string;
  signal?: AbortSignal;
};

export type DocumentValidationResult = {
  status: "validated" | "rejected" | "review_required" | "not_configured";
  providerKey: string;
  extractedFields?: Record<string, string>;
  fraudSignals?: string[];
  checkedAt: string;
  detail?: string;
};

export interface DocumentVerificationProvider {
  readonly id: string;
  readonly key: string;
  readonly type: "document_verification";
  readonly status: "configured" | "not_configured" | "degraded" | "failed";
  validateDocument(input: DocumentValidationInput): Promise<DocumentValidationResult>;
  extractFields(input: DocumentValidationInput): Promise<Record<string, string>>;
  fraudSignals(input: DocumentValidationInput): Promise<string[]>;
  healthCheck(): Promise<DocumentVerificationHealth>;
}

const MESSAGE = "Nenhum provedor de validação documental está configurado.";

export class NotConfiguredDocumentVerificationProvider implements DocumentVerificationProvider {
  readonly id = "not_configured";
  readonly key = "not_configured";
  readonly type = "document_verification" as const;
  readonly status = "not_configured" as const;

  validateDocument(_input: DocumentValidationInput): Promise<DocumentValidationResult> {
    return Promise.reject(new AppError("DOCUMENT_VERIFICATION_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  extractFields(_input: DocumentValidationInput): Promise<Record<string, string>> {
    return Promise.reject(new AppError("DOCUMENT_VERIFICATION_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  fraudSignals(_input: DocumentValidationInput): Promise<string[]> {
    return Promise.reject(new AppError("DOCUMENT_VERIFICATION_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  healthCheck(): Promise<DocumentVerificationHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor de validação documental não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
