"use client";

import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from "@verasjuris/ui";
import { useCallback, useEffect, useId, useState } from "react";
import {
  DOCUMENT_OWNER_TYPE_LABELS,
  DOCUMENT_STATUS_LABELS,
  apiErrorMessage,
  createDocumentWithFile,
  documentDownloadUrl,
  documentStatusTone,
  fetchDocumentCategories,
  fetchDocuments,
  formatFileSize,
  getActiveMembership,
  getActiveOrgId,
  hasDocumentPermission,
  isApiFailure,
  type DocumentCategory,
  type DocumentOwnerType,
  type DocumentStatus,
  type DocumentSummary,
} from "../../../lib/documents";

function readQueryParam(name: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name) ?? "";
}

export default function DocumentosPage() {
  const progressId = useId();
  const [canRead, setCanRead] = useState(true);
  const [canCreate, setCanCreate] = useState(false);
  const [canUpload, setCanUpload] = useState(false);
  const [canDownload, setCanDownload] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

  const [items, setItems] = useState<DocumentSummary[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<DocumentStatus | "">("");
  const [categoryId, setCategoryId] = useState("");
  const [ownerType, setOwnerType] = useState<DocumentOwnerType | "">("");
  const [ownerId, setOwnerId] = useState("");

  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategoryId, setUploadCategoryId] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPending, setUploadPending] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const load = useCallback(
    async (
      activeId: string,
      filters?: {
        q?: string;
        status?: DocumentStatus | "";
        categoryId?: string;
        ownerType?: DocumentOwnerType | "";
        ownerId?: string;
      },
    ) => {
      setLoading(true);
      setError(null);
      const next = filters ?? { q, status, categoryId, ownerType, ownerId };
      const data = await fetchDocuments(activeId, {
        q: next.q || undefined,
        status: next.status || undefined,
        categoryId: next.categoryId || undefined,
        ownerType: next.ownerType || undefined,
        ownerId: next.ownerId || undefined,
        limit: 50,
      });
      if (isApiFailure(data)) {
        setError(apiErrorMessage(data, "Não foi possível listar os documentos."));
        setLoading(false);
        return;
      }
      setItems(data.items);
      setTotal(data.total);
      setLoading(false);
    },
    [q, status, categoryId, ownerType, ownerId],
  );

  useEffect(() => {
    void (async () => {
      const [activeId, membership] = await Promise.all([getActiveOrgId(), getActiveMembership()]);
      if (!activeId) {
        setError("Nenhuma organização ativa.");
        setLoading(false);
        return;
      }
      setOrgId(activeId);
      const readable = hasDocumentPermission(membership?.permissions, "read");
      setCanRead(readable);
      setCanCreate(hasDocumentPermission(membership?.permissions, "create"));
      setCanUpload(hasDocumentPermission(membership?.permissions, "upload_version"));
      setCanDownload(hasDocumentPermission(membership?.permissions, "download"));
      if (!readable) {
        setLoading(false);
        return;
      }

      const initialQ = readQueryParam("q");
      const initialStatus = readQueryParam("status") as DocumentStatus | "";
      const initialCategory = readQueryParam("categoryId");
      const initialOwnerType = readQueryParam("ownerType") as DocumentOwnerType | "";
      const initialOwnerId = readQueryParam("ownerId");
      setQ(initialQ);
      setStatus(initialStatus);
      setCategoryId(initialCategory);
      setOwnerType(initialOwnerType);
      setOwnerId(initialOwnerId);

      const categoriesData = await fetchDocumentCategories(activeId);
      if (!isApiFailure(categoriesData)) {
        setCategories(categoriesData.categories.filter((item) => item.active !== false));
      }

      await load(activeId, {
        q: initialQ,
        status: initialStatus,
        categoryId: initialCategory,
        ownerType: initialOwnerType,
        ownerId: initialOwnerId,
      });
    })();
  }, [load]);

  async function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orgId) return;
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    if (categoryId) params.set("categoryId", categoryId);
    if (ownerType) params.set("ownerType", ownerType);
    if (ownerId.trim()) params.set("ownerId", ownerId.trim());
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `/app/documentos?${qs}` : "/app/documentos");
    await load(orgId);
  }

  async function submitUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orgId || !uploadFile) return;
    if (!uploadTitle.trim()) {
      setUploadError("Informe o título do documento.");
      return;
    }

    setUploadPending(true);
    setUploadError(null);
    setUploadMessage(null);
    setUploadPercent(0);

    const result = await createDocumentWithFile(
      orgId,
      {
        title: uploadTitle.trim(),
        ownerType: "organization",
        ownerId: orgId,
        categoryId: uploadCategoryId || undefined,
        status: "active",
      },
      uploadFile,
      {
        onProgress: ({ percent }) => setUploadPercent(percent),
      },
    );

    setUploadPending(false);
    if (isApiFailure(result)) {
      setUploadError(apiErrorMessage(result, "Não foi possível enviar o documento."));
      return;
    }

    setUploadMessage(result.scanMessage);
    setUploadTitle("");
    setUploadCategoryId("");
    setUploadFile(null);
    setUploadPercent(100);
    await load(orgId);
  }

  const breadcrumb = [{ label: "Painel", href: "/app" }, { label: "Documentos" }];

  if (!canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <ErrorState title="Sem permissão">
          Você não tem permissão para consultar documentos nesta organização.
        </ErrorState>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Documentos"
        description="Repositório documental da organização. Arquivos são enviados com metadados; a verificação antimalware depende da configuração do ambiente."
      />

      <form className="vj-card vj-stack" onSubmit={applyFilters} aria-label="Filtros de documentos">
        <div className="vj-split">
          <FormField id="doc-q" label="Busca">
            <Input
              id="doc-q"
              name="q"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Título ou trecho"
              autoComplete="off"
            />
          </FormField>
          <FormField id="doc-status" label="Situação">
            <Select
              id="doc-status"
              name="status"
              value={status}
              onChange={(event) => setStatus(event.target.value as DocumentStatus | "")}
            >
              <option value="">Todas</option>
              {(Object.keys(DOCUMENT_STATUS_LABELS) as DocumentStatus[]).map((key) => (
                <option key={key} value={key}>
                  {DOCUMENT_STATUS_LABELS[key]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div className="vj-split">
          <FormField id="doc-category" label="Categoria">
            <Select
              id="doc-category"
              name="categoryId"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="doc-owner-type" label="Vínculo">
            <Select
              id="doc-owner-type"
              name="ownerType"
              value={ownerType}
              onChange={(event) => setOwnerType(event.target.value as DocumentOwnerType | "")}
            >
              <option value="">Todos</option>
              {(Object.keys(DOCUMENT_OWNER_TYPE_LABELS) as DocumentOwnerType[]).map((key) => (
                <option key={key} value={key}>
                  {DOCUMENT_OWNER_TYPE_LABELS[key]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <FormField id="doc-owner-id" label="Identificador do vínculo" hint="Opcional">
          <Input
            id="doc-owner-id"
            name="ownerId"
            value={ownerId}
            onChange={(event) => setOwnerId(event.target.value)}
            autoComplete="off"
          />
        </FormField>
        <div className="vj-form-actions">
          <Button type="submit">Filtrar</Button>
        </div>
      </form>

      {canCreate && canUpload ? (
        <form
          className="vj-card vj-stack"
          onSubmit={submitUpload}
          aria-labelledby="doc-upload-title"
        >
          <h2 id="doc-upload-title" className="vj-section-title">
            Enviar documento
          </h2>
          <FormField id="upload-title" label="Título">
            <Input
              id="upload-title"
              name="title"
              required
              value={uploadTitle}
              onChange={(event) => setUploadTitle(event.target.value)}
              maxLength={300}
            />
          </FormField>
          <FormField id="upload-category" label="Categoria">
            <Select
              id="upload-category"
              name="categoryId"
              value={uploadCategoryId}
              onChange={(event) => setUploadCategoryId(event.target.value)}
            >
              <option value="">Sem categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="upload-file" label="Arquivo">
            <Input
              id="upload-file"
              name="file"
              type="file"
              accept="image/*,application/pdf,.pdf,.png,.jpg,.jpeg"
              capture="environment"
              required
              onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
            />
          </FormField>
          {uploadPending ? (
            <div>
              <label htmlFor={progressId} className="vj-meta">
                Progresso do envio: {uploadPercent}%
              </label>
              <progress
                id={progressId}
                max={100}
                value={uploadPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={uploadPercent}
              >
                {uploadPercent}%
              </progress>
            </div>
          ) : null}
          {uploadError ? (
            <p role="alert" className="vj-field-error">
              {uploadError}
            </p>
          ) : null}
          {uploadMessage ? (
            <Alert tone="info" title="Envio concluído">
              {uploadMessage}
            </Alert>
          ) : null}
          <div className="vj-form-actions">
            <Button type="submit" disabled={uploadPending || !uploadFile}>
              {uploadPending ? "Enviando…" : "Enviar"}
            </Button>
          </div>
        </form>
      ) : null}

      {loading ? <LoadingState label="Carregando documentos" /> : null}
      {error ? <ErrorState title="Erro ao carregar documentos">{error}</ErrorState> : null}

      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhum documento foi adicionado.">
          Envie um arquivo ou ajuste os filtros para localizar documentos existentes.
        </EmptyState>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <>
          <p className="vj-meta" aria-live="polite">
            {total} documento{total === 1 ? "" : "s"}
          </p>
          <div className="vj-table-wrap">
            <table className="vj-table">
              <thead>
                <tr>
                  <th scope="col">Título</th>
                  <th scope="col">Categoria</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Vínculo</th>
                  <th scope="col">Arquivo</th>
                  <th scope="col">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((doc) => {
                  const version = doc.currentVersion;
                  return (
                    <tr key={doc.id}>
                      <td data-label="Título">
                        <a href={`/app/documentos/${doc.id}`}>
                          <strong>{doc.title}</strong>
                        </a>
                        {doc.description ? <div className="vj-meta">{doc.description}</div> : null}
                      </td>
                      <td data-label="Categoria">{doc.category?.name ?? "—"}</td>
                      <td data-label="Situação">
                        <Badge tone={documentStatusTone(doc.status)}>
                          {DOCUMENT_STATUS_LABELS[doc.status]}
                        </Badge>
                      </td>
                      <td data-label="Vínculo">
                        <div>{DOCUMENT_OWNER_TYPE_LABELS[doc.ownerType]}</div>
                      </td>
                      <td data-label="Arquivo">
                        {version ? (
                          <>
                            <div>{version.originalFilename}</div>
                            <div className="vj-meta">{formatFileSize(version.sizeBytes)}</div>
                            {canDownload && orgId && version.status === "available" ? (
                              <a href={documentDownloadUrl(orgId, doc.id, version.id)}>Baixar</a>
                            ) : null}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td data-label="Atualizado">
                        {new Date(doc.updatedAt).toLocaleString("pt-BR")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
