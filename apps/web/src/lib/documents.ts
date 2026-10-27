import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { ApiFailure } from "./types";
import { apiErrorMessage, getActiveMembership, getActiveOrgId, isApiFailure } from "./crm";

export { apiErrorMessage, getActiveMembership, getActiveOrgId, isApiFailure };

export type DocumentOwnerType =
  | "organization"
  | "legal_matter"
  | "judicial_process"
  | "administrative_process"
  | "client"
  | "intake";

export type DocumentStatus = "draft" | "active" | "archived";

export type DocumentConfidentiality = "normal" | "restricted" | "confidential";

export type DocumentVersionStatus =
  | "uploading"
  | "quarantined"
  | "available"
  | "rejected"
  | "failed";

export type DocumentScanStatus = "not_configured" | "pending" | "clean" | "infected" | "error";

export type DocumentCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  active?: boolean;
  sortOrder?: number;
};

export type DocumentVersionSummary = {
  id: string;
  versionNumber: number;
  originalFilename: string;
  safeFilename?: string;
  mimeTypeDeclared?: string;
  mimeTypeDetected?: string;
  sizeBytes: number;
  status: DocumentVersionStatus;
  scanStatus: DocumentScanStatus;
  scanProvider?: string | null;
  scanResult?: string | null;
  createdAt: string;
  uploadedByMembershipId?: string | null;
};

export type DocumentSummary = {
  id: string;
  ownerType: DocumentOwnerType;
  ownerId: string;
  categoryId?: string | null;
  category?: Pick<DocumentCategory, "id" | "name" | "slug"> | null;
  folderId?: string | null;
  title: string;
  description?: string | null;
  status: DocumentStatus;
  confidentialityLevel: DocumentConfidentiality;
  currentVersionId?: string | null;
  currentVersion?: DocumentVersionSummary | null;
  retentionUntil?: string | null;
  legalHold?: boolean;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentDetail = DocumentSummary & {
  versions?: DocumentVersionSummary[];
  timeline?: DocumentTimelineItem[];
};

export type DocumentTimelineItem = {
  id: string;
  eventType: string;
  title: string;
  summary?: string | null;
  versionId?: string | null;
  eventAt: string;
  createdAt?: string;
};

export type DocumentListResult = {
  items: DocumentSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type DocumentListQuery = {
  q?: string;
  status?: DocumentStatus;
  categoryId?: string;
  ownerType?: DocumentOwnerType;
  ownerId?: string;
  folderId?: string;
  limit?: number;
  offset?: number;
};

export type CreateDocumentInput = {
  title: string;
  description?: string;
  ownerType: DocumentOwnerType;
  ownerId: string;
  categoryId?: string;
  folderId?: string;
  confidentialityLevel?: DocumentConfidentiality;
  status?: DocumentStatus;
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  draft: "Rascunho",
  active: "Ativo",
  archived: "Arquivado",
};

export const DOCUMENT_CONFIDENTIALITY_LABELS: Record<DocumentConfidentiality, string> = {
  normal: "Normal",
  restricted: "Restrito",
  confidential: "Confidencial",
};

export const DOCUMENT_OWNER_TYPE_LABELS: Record<DocumentOwnerType, string> = {
  organization: "Organização",
  legal_matter: "Caso",
  judicial_process: "Processo judicial",
  administrative_process: "Processo administrativo",
  client: "Cliente",
  intake: "Atendimento",
};

export const DOCUMENT_VERSION_STATUS_LABELS: Record<DocumentVersionStatus, string> = {
  uploading: "Enviando",
  quarantined: "Em quarentena",
  available: "Disponível",
  rejected: "Recusado",
  failed: "Falhou",
};

export const DOCUMENT_SCAN_STATUS_LABELS: Record<DocumentScanStatus, string> = {
  not_configured: "Verificação antimalware não configurada",
  pending: "Verificação pendente",
  clean: "Sem ameaças detectadas",
  infected: "Ameaça detectada",
  error: "Erro na verificação",
};

function jsonHeaders(): HeadersInit {
  return { "content-type": "application/json", [CSRF_HEADER]: "1" };
}

function orgPath(orgId: string, suffix: string): string {
  return `/api/v1/organizations/${orgId}${suffix}`;
}

function buildQuery(query: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export function hasDocumentPermission(
  permissions: readonly string[] | undefined,
  action:
    | "read"
    | "create"
    | "update"
    | "upload_version"
    | "download"
    | "manage_acl"
    | "archive"
    | "restore",
): boolean {
  if (!permissions) return false;
  return permissions.includes(`document.${action}`);
}

export function documentStatusTone(
  status: DocumentStatus,
): "neutral" | "success" | "warning" | "error" {
  if (status === "active") return "success";
  if (status === "draft") return "warning";
  return "neutral";
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

/** User-facing message after upload based on scan status. Never expose storageKey. */
export function uploadScanMessage(
  scanStatus: DocumentScanStatus | string | null | undefined,
): string {
  if (scanStatus === "not_configured" || !scanStatus) {
    return "Documento enviado. A verificação antimalware não está configurada.";
  }
  if (scanStatus === "pending") {
    return "Documento enviado. A verificação antimalware está pendente.";
  }
  if (scanStatus === "clean") {
    return "Documento enviado. Nenhuma ameaça foi detectada na verificação.";
  }
  if (scanStatus === "infected") {
    return "Documento enviado, mas a verificação detectou uma ameaça.";
  }
  if (scanStatus === "error") {
    return "Documento enviado. A verificação antimalware retornou erro.";
  }
  return "Documento enviado.";
}

function stripStorageKey<T extends Record<string, unknown>>(item: T): T {
  if (!item || typeof item !== "object") return item;
  const { storageKey: _storageKey, ...rest } = item as T & { storageKey?: unknown };
  return rest as T;
}

function sanitizeVersion(version: DocumentVersionSummary): DocumentVersionSummary {
  return stripStorageKey(version as unknown as Record<string, unknown>) as DocumentVersionSummary;
}

function sanitizeDocument(doc: DocumentSummary): DocumentSummary {
  const cleaned = stripStorageKey(doc as unknown as Record<string, unknown>) as DocumentSummary;
  return {
    ...cleaned,
    currentVersion: cleaned.currentVersion
      ? sanitizeVersion(cleaned.currentVersion)
      : cleaned.currentVersion,
  };
}

export async function fetchDocumentCategories(
  orgId: string,
): Promise<{ categories: DocumentCategory[] } | ApiFailure> {
  const response = await fetch(orgPath(orgId, "/document-categories"), { cache: "no-store" });
  const body = (await response.json()) as
    | {
        categories?: DocumentCategory[];
        documentCategories?: DocumentCategory[];
        items?: DocumentCategory[];
      }
    | ApiFailure;
  if (isApiFailure(body)) return body;
  return {
    categories: body.categories ?? body.documentCategories ?? body.items ?? [],
  };
}

export async function fetchDocuments(
  orgId: string,
  query: DocumentListQuery = {},
): Promise<DocumentListResult | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/documents${buildQuery(query)}`), {
    cache: "no-store",
  });
  const body = (await response.json()) as
    | {
        items?: DocumentSummary[];
        documents?: DocumentSummary[];
        total?: number;
        limit?: number;
        offset?: number;
      }
    | ApiFailure;
  if (isApiFailure(body)) return body;
  const items = (body.items ?? body.documents ?? []).map(sanitizeDocument);
  return {
    items,
    total: body.total ?? items.length,
    limit: body.limit ?? 20,
    offset: body.offset ?? 0,
  };
}

export async function fetchDocument(
  orgId: string,
  documentId: string,
): Promise<{ document: DocumentDetail } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/documents/${documentId}`), { cache: "no-store" });
  const body = (await response.json()) as
    | { document?: DocumentDetail }
    | DocumentDetail
    | ApiFailure;
  if (isApiFailure(body)) return body;
  const raw =
    "document" in body && body.document
      ? body.document
      : "id" in body && typeof body.id === "string"
        ? (body as DocumentDetail)
        : null;
  if (!raw) {
    return { error: { code: "NOT_FOUND", message: "Documento não encontrado." } };
  }
  return {
    document: {
      ...sanitizeDocument(raw),
      versions: (raw.versions ?? []).map(sanitizeVersion),
      timeline: raw.timeline ?? [],
    },
  };
}

export async function createDocument(
  orgId: string,
  input: CreateDocumentInput,
): Promise<{ document: { id: string } & Partial<DocumentDetail> } | ApiFailure> {
  const response = await fetch(orgPath(orgId, "/documents"), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as { document?: { id: string } } | ApiFailure;
  if (isApiFailure(body)) return body;
  if (body.document) return { document: body.document };
  return {
    error: { code: "INTERNAL_ERROR", message: "Resposta inválida ao criar o documento." },
  };
}

export type UploadVersionResult = {
  version: DocumentVersionSummary;
  document?: DocumentDetail;
};

export type UploadProgressHandler = (progress: {
  loaded: number;
  total: number;
  percent: number;
}) => void;

/**
 * Multipart upload with real XHR progress events.
 * Expected endpoint: POST /documents/:documentId/versions
 */
export function uploadDocumentVersion(
  orgId: string,
  documentId: string,
  file: File,
  options: {
    onProgress?: UploadProgressHandler;
    signal?: AbortSignal;
  } = {},
): Promise<UploadVersionResult | ApiFailure> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file, file.name);

    xhr.open("POST", orgPath(orgId, `/documents/${documentId}/versions`));
    xhr.setRequestHeader(CSRF_HEADER, "1");
    xhr.responseType = "json";

    if (options.signal) {
      if (options.signal.aborted) {
        resolve({ error: { code: "ABORTED", message: "Envio cancelado." } });
        return;
      }
      options.signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.upload.onprogress = (event) => {
      if (!options.onProgress) return;
      const total = event.lengthComputable ? event.total : file.size;
      const loaded = event.loaded;
      const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
      options.onProgress({ loaded, total, percent });
    };

    xhr.onload = () => {
      const body = (xhr.response ?? {}) as
        | UploadVersionResult
        | { version?: DocumentVersionSummary; document?: DocumentDetail }
        | ApiFailure;
      if (xhr.status >= 200 && xhr.status < 300 && !isApiFailure(body)) {
        const version = body.version;
        if (!version) {
          resolve({
            error: { code: "INTERNAL_ERROR", message: "Resposta inválida ao enviar o arquivo." },
          });
          return;
        }
        resolve({
          version: sanitizeVersion(version),
          document: body.document
            ? {
                ...sanitizeDocument(body.document),
                versions: (body.document.versions ?? []).map(sanitizeVersion),
              }
            : undefined,
        });
        return;
      }
      if (isApiFailure(body)) {
        resolve(body);
        return;
      }
      resolve({
        error: {
          code: "UPLOAD_FAILED",
          message: `Não foi possível enviar o arquivo (HTTP ${xhr.status}).`,
        },
      });
    };

    xhr.onerror = () => {
      resolve({
        error: { code: "NETWORK_ERROR", message: "Falha de rede ao enviar o documento." },
      });
    };

    xhr.onabort = () => {
      resolve({ error: { code: "ABORTED", message: "Envio cancelado." } });
    };

    xhr.send(form);
  });
}

export function documentDownloadUrl(orgId: string, documentId: string, versionId?: string): string {
  if (versionId) {
    return orgPath(orgId, `/documents/${documentId}/versions/${versionId}/download`);
  }
  return orgPath(orgId, `/documents/${documentId}/download`);
}

export async function createDocumentWithFile(
  orgId: string,
  input: CreateDocumentInput,
  file: File,
  options: { onProgress?: UploadProgressHandler; signal?: AbortSignal } = {},
): Promise<
  { document: { id: string }; version: DocumentVersionSummary; scanMessage: string } | ApiFailure
> {
  const created = await createDocument(orgId, input);
  if (isApiFailure(created)) return created;

  const uploaded = await uploadDocumentVersion(orgId, created.document.id, file, options);
  if (isApiFailure(uploaded)) return uploaded;

  return {
    document: { id: created.document.id },
    version: uploaded.version,
    scanMessage: uploadScanMessage(uploaded.version.scanStatus),
  };
}
