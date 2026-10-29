import { AppError } from "@verasjuris/types";

/**
 * Emissão / consulta de documentos fiscais (NFS-e / NF-e).
 * Default: not_configured — nunca inventa número de nota ou autorização.
 */

export type FiscalDocumentHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type FiscalDocumentKind = "nfse" | "nfe" | "other";

export type FiscalDocumentStatus =
  | "draft"
  | "submitted"
  | "authorized"
  | "rejected"
  | "cancelled"
  | "not_configured";

export type IssueFiscalDocumentInput = {
  kind: FiscalDocumentKind;
  organizationId?: string;
  invoiceId?: string;
  amountCents: number;
  currency?: string;
  description?: string;
  customerTaxId?: string;
  customerName?: string;
  serviceCode?: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export type FiscalDocumentRecord = {
  externalDocumentId: string | null;
  providerKey: string;
  kind: FiscalDocumentKind;
  status: FiscalDocumentStatus;
  number: string | null;
  accessKey: string | null;
  issuedAt?: string | null;
  pdfUrl?: string | null;
  xmlUrl?: string | null;
  amountCents: number;
  currency: string;
  detail?: string;
};

export type CancelFiscalDocumentInput = {
  externalDocumentId: string;
  reason?: string;
  signal?: AbortSignal;
};

export interface FiscalDocumentProvider {
  readonly id: string;
  issue(input: IssueFiscalDocumentInput): Promise<FiscalDocumentRecord>;
  getStatus(externalDocumentId: string, signal?: AbortSignal): Promise<FiscalDocumentRecord>;
  cancel(input: CancelFiscalDocumentInput): Promise<FiscalDocumentRecord>;
  downloadXml(externalDocumentId: string, signal?: AbortSignal): Promise<Uint8Array>;
  downloadPdf(externalDocumentId: string, signal?: AbortSignal): Promise<Uint8Array>;
  healthCheck(): Promise<FiscalDocumentHealth>;
}

const MESSAGE =
  "Nenhum provedor de documento fiscal (NFS-e/NF-e) está configurado. Emita a nota fora da plataforma e anexe evidência.";

function notConfiguredDocument(
  kind: FiscalDocumentKind = "other",
  amountCents = 0,
  currency = "BRL",
): FiscalDocumentRecord {
  return {
    externalDocumentId: null,
    providerKey: "not_configured",
    kind,
    status: "not_configured",
    number: null,
    accessKey: null,
    issuedAt: null,
    pdfUrl: null,
    xmlUrl: null,
    amountCents,
    currency,
    detail: "Provedor fiscal não configurado.",
  };
}

export class NotConfiguredFiscalDocumentProvider implements FiscalDocumentProvider {
  readonly id = "not_configured";

  issue(input: IssueFiscalDocumentInput): Promise<FiscalDocumentRecord> {
    return Promise.resolve(
      notConfiguredDocument(input.kind, input.amountCents, input.currency ?? "BRL"),
    );
  }

  getStatus(_externalDocumentId: string): Promise<FiscalDocumentRecord> {
    return Promise.resolve(notConfiguredDocument());
  }

  cancel(_input: CancelFiscalDocumentInput): Promise<FiscalDocumentRecord> {
    return Promise.reject(new AppError("FISCAL_DOCUMENT_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  downloadXml(_externalDocumentId: string): Promise<Uint8Array> {
    return Promise.reject(new AppError("FISCAL_DOCUMENT_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  downloadPdf(_externalDocumentId: string): Promise<Uint8Array> {
    return Promise.reject(new AppError("FISCAL_DOCUMENT_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  healthCheck(): Promise<FiscalDocumentHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor de documento fiscal não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
