import { AppError } from "@verasjuris/types";

/**
 * Exportação de documentos gerados (HTML seguro sempre; PDF/DOCX só com engine real).
 * Sem engine → `NotConfiguredDocumentExportProvider` — nunca arquivo falso.
 */

export const DOCUMENT_EXPORT_FORMATS = ["html", "pdf", "docx"] as const;
export type DocumentExportFormat = (typeof DOCUMENT_EXPORT_FORMATS)[number];

export type DocumentExportRequest = {
  html: string;
  title?: string;
  format: DocumentExportFormat;
  signal?: AbortSignal;
};

export type DocumentExportResult = {
  format: DocumentExportFormat;
  /** Conteúdo exportado (HTML sanitizado, ou bytes de PDF/DOCX quando configurado). */
  body: string | Uint8Array;
  mimeType: string;
  filenameHint: string;
};

export type DocumentExportHealth = {
  status: "ok" | "partial" | "not_configured";
  formats: Readonly<Record<DocumentExportFormat, boolean>>;
  detail?: string;
  checkedAt: string;
};

export interface DocumentExportProvider {
  readonly id: string;
  export(request: DocumentExportRequest): Promise<DocumentExportResult>;
  healthCheck(): Promise<DocumentExportHealth>;
}

const DANGEROUS_TAGS =
  /<\/?(?:script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select|svg|math)(?:\s[^>]*)?>/gi;
const EVENT_HANDLER_ATTR = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URL_ATTR =
  /\s+(href|src|xlink:href|action)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|\s*javascript:[^\s>]*)/gi;
const DATA_URI_SCRIPT =
  /\s+(href|src)\s*=\s*(?:"\s*data:text\/html[^"]*"|'\s*data:text\/html[^']*')/gi;

/** Sanitização conservadora de HTML (sem dependência externa). Não é um browser XSS filter completo. */
export function sanitizeExportHtml(html: string): string {
  return html
    .replace(DANGEROUS_TAGS, "")
    .replace(EVENT_HANDLER_ATTR, "")
    .replace(JS_URL_ATTR, "")
    .replace(DATA_URI_SCRIPT, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}

function titleToFilename(title: string | undefined, ext: string): string {
  const base = (title ?? "documento")
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 80);
  return `${base || "documento"}.${ext}`;
}

/**
 * HTML sempre disponível (sanitizado). PDF e DOCX recusam com NOT_CONFIGURED.
 */
export class SafeHtmlDocumentExportProvider implements DocumentExportProvider {
  readonly id = "safe_html";

  export(request: DocumentExportRequest): Promise<DocumentExportResult> {
    if (request.format === "html") {
      const body = sanitizeExportHtml(request.html);
      return Promise.resolve({
        format: "html",
        body,
        mimeType: "text/html; charset=utf-8",
        filenameHint: titleToFilename(request.title, "html"),
      });
    }
    return Promise.reject(
      new AppError(
        "NOT_CONFIGURED",
        `Exportação ${request.format.toUpperCase()} não está configurada. Nenhum arquivo foi gerado.`,
      ),
    );
  }

  healthCheck(): Promise<DocumentExportHealth> {
    return Promise.resolve({
      status: "partial",
      formats: { html: true, pdf: false, docx: false },
      detail: "Somente HTML sanitizado disponível; PDF/DOCX não configurados.",
      checkedAt: new Date().toISOString(),
    });
  }
}

/** Stub: nenhuma exportação (nem HTML) — use quando o recurso de export estiver desligado. */
export class NotConfiguredDocumentExportProvider implements DocumentExportProvider {
  readonly id = "not_configured";

  export(request: DocumentExportRequest): Promise<DocumentExportResult> {
    if (request.format === "html") {
      // HTML seguro permanece disponível via SafeHtml; este stub recusa tudo.
      return Promise.reject(
        new AppError(
          "NOT_CONFIGURED",
          "O serviço de exportação de documentos não está configurado. Nenhum arquivo foi gerado.",
        ),
      );
    }
    return Promise.reject(
      new AppError(
        "NOT_CONFIGURED",
        `Exportação ${request.format.toUpperCase()} não está configurada. Nenhum arquivo foi gerado.`,
      ),
    );
  }

  healthCheck(): Promise<DocumentExportHealth> {
    return Promise.resolve({
      status: "not_configured",
      formats: { html: false, pdf: false, docx: false },
      detail: "Nenhum provedor de exportação configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}

/**
 * Padrão de produto: HTML sanitizado sempre; PDF/DOCX → not_configured até haver engine real.
 */
export function createDocumentExportProvider(): DocumentExportProvider {
  return new SafeHtmlDocumentExportProvider();
}
