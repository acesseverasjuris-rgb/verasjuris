import { AppError } from "@verasjuris/types";

/**
 * Conciliação bancária / extrato externo ↔ ledger interno.
 * Default: not_configured — nunca marca matched fictício.
 */

export type ReconciliationHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type ReconciliationMatchStatus =
  | "unmatched"
  | "matched"
  | "partial"
  | "review_required"
  | "resolved"
  | "not_configured";

/** Formatos de importação suportados por adaptadores futuros (OFX/CNAB/CSV). */
export const RECONCILIATION_IMPORT_FORMATS = ["ofx", "cnab", "csv", "manual"] as const;

export type ReconciliationImportFormat = (typeof RECONCILIATION_IMPORT_FORMATS)[number];

export type ReconciliationImportHint = {
  format: ReconciliationImportFormat;
  label: string;
  /** Extensões ou MIME tipicamente aceitos; vazio se not_configured. */
  acceptedExtensions?: readonly string[];
  detail?: string;
};

export type FetchExternalStatementsInput = {
  organizationId?: string;
  accountReference?: string;
  from?: string;
  to?: string;
  /** Dica de formato quando o adaptador importa arquivo (OFX/CNAB/CSV). */
  importFormat?: ReconciliationImportFormat;
  signal?: AbortSignal;
};

export type ImportExternalStatementInput = {
  organizationId?: string;
  accountReference?: string;
  format: ReconciliationImportFormat;
  /** Conteúdo bruto do extrato (texto ou bytes). */
  rawContent: string | Uint8Array;
  filename?: string;
  signal?: AbortSignal;
};

export type ExternalStatementLine = {
  externalLineId: string;
  occurredAt: string;
  amountCents: number;
  currency: string;
  description?: string | null;
  counterparty?: string | null;
};

export type ExternalStatementPage = {
  providerKey: string;
  status: "ok" | "unavailable" | "not_configured";
  lines: readonly ExternalStatementLine[];
  nextCursor?: string | null;
};

export type SuggestReconciliationMatchInput = {
  organizationId?: string;
  ledgerTransactionId?: string;
  externalLineId?: string;
  amountCents?: number;
  currency?: string;
  signal?: AbortSignal;
};

export type ReconciliationSuggestion = {
  providerKey: string;
  status: ReconciliationMatchStatus;
  externalLineId: string | null;
  ledgerTransactionId: string | null;
  confidence?: number | null;
  detail?: string;
};

export type ConfirmReconciliationMatchInput = {
  organizationId?: string;
  externalLineId: string;
  ledgerTransactionId: string;
  notes?: string;
  signal?: AbortSignal;
};

export type ReconciliationMatchRecord = {
  providerKey: string;
  status: ReconciliationMatchStatus;
  externalReference: string | null;
  ledgerTransactionId: string | null;
  matchedAt?: string | null;
  detail?: string;
};

export interface ReconciliationProvider {
  readonly id: string;
  /** Dicas de formatos de importação; default vazio / not_configured. */
  getImportHints?(signal?: AbortSignal): Promise<readonly ReconciliationImportHint[]>;
  /** Importação de arquivo de extrato; default rejeita com NOT_CONFIGURED. */
  importStatements?(input: ImportExternalStatementInput): Promise<ExternalStatementPage>;
  fetchStatements(input: FetchExternalStatementsInput): Promise<ExternalStatementPage>;
  suggestMatch(input: SuggestReconciliationMatchInput): Promise<ReconciliationSuggestion>;
  confirmMatch(input: ConfirmReconciliationMatchInput): Promise<ReconciliationMatchRecord>;
  healthCheck(): Promise<ReconciliationHealth>;
}

const MESSAGE =
  "Nenhum provedor de conciliação financeira está configurado. Concilie extratos manualmente no ledger.";

export class NotConfiguredReconciliationProvider implements ReconciliationProvider {
  readonly id = "not_configured";

  getImportHints(_signal?: AbortSignal): Promise<readonly ReconciliationImportHint[]> {
    // Hints honestos: formatos futuros listados, sem parser ativo.
    return Promise.resolve([
      {
        format: "ofx",
        label: "OFX",
        acceptedExtensions: [],
        detail: "Importação OFX não configurada.",
      },
      {
        format: "cnab",
        label: "CNAB",
        acceptedExtensions: [],
        detail: "Importação CNAB não configurada.",
      },
      {
        format: "csv",
        label: "CSV",
        acceptedExtensions: [],
        detail: "Importação CSV não configurada.",
      },
      {
        format: "manual",
        label: "Manual",
        acceptedExtensions: [],
        detail: "Conciliação manual no ledger permanece disponível.",
      },
    ]);
  }

  importStatements(_input: ImportExternalStatementInput): Promise<ExternalStatementPage> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      lines: [],
      nextCursor: null,
    });
  }

  fetchStatements(_input: FetchExternalStatementsInput): Promise<ExternalStatementPage> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      lines: [],
      nextCursor: null,
    });
  }

  suggestMatch(_input: SuggestReconciliationMatchInput): Promise<ReconciliationSuggestion> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      externalLineId: null,
      ledgerTransactionId: null,
      confidence: null,
      detail: "Provedor de conciliação não configurado.",
    });
  }

  confirmMatch(_input: ConfirmReconciliationMatchInput): Promise<ReconciliationMatchRecord> {
    return Promise.reject(new AppError("RECONCILIATION_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  healthCheck(): Promise<ReconciliationHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor de conciliação financeira não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
