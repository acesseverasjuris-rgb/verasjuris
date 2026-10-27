"use client";

import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from "@verasjuris/ui";
import { useParams } from "next/navigation";
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
} from "../../../../../lib/documents";
import { fetchMatter } from "../../../../../lib/matters";

function readQueryParam(name: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name) ?? "";
}

export default function CasoDocumentosPage() {
  const params = useParams<{ id: string }>();
  const matterId = params.id;
  const progressId = useId();

  const [canRead, setCanRead] = useState(true);
  const [canCreate, setCanCreate] = useState(false);
  const [canUpload, setCanUpload] = useState(false);
  const [canDownload, setCanDownload] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

  const [matterTitle, setMatterTitle] = useState("Caso");
  const [matterRef, setMatterRef] = useState("");
  const [items, setItems] = useState<DocumentSummary[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<DocumentStatus | "">("");
  const [categoryId, setCategoryId] = useState("");
  const [ownerType, setOwnerType] = useState<DocumentOwnerType | "">("legal_matter");
  const [ownerId, setOwnerId] = useState(matterId);

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
      const effectiveOwnerType = next.ownerType || "legal_matter";
      const effectiveOwnerId = next.ownerId || matterId;

      const data = await fetchDocuments(activeId, {
        q: next.q || undefined,
        status: next.status || undefined,
        categoryId: next.categoryId || undefined,
        ownerType: effectiveOwnerType,
        ownerId: effectiveOwnerId,
        limit: 50,
      });
      if (isApiFailure(data)) {
        setError(apiErrorMessage(data, "Não foi possível listar os documentos do caso."));
        setLoading(false);
        return;
      }
      setItems(data.items);
      setTotal(data.total);
      setLoading(false);
    },
    [q, status, categoryId, ownerType, ownerId, matterId],
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
      const initialOwnerType =
        (readQueryParam("ownerType") as DocumentOwnerType | "") || "legal_matter";
      const initialOwnerId = readQueryParam("ownerId") || matterId;
      setQ(initialQ);
      setStatus(initialStatus);
      setCategoryId(initialCategory);
      setOwnerType(initialOwnerType);
      setOwnerId(initialOwnerId);

      const [matterData, categoriesData] = await Promise.all([
        fetchMatter(activeId, matterId),
        fetchDocumentCategories(activeId),
      ]);
      if (!isApiFailure(matterData)) {
        setMatterTitle(matterData.matter.title);
        setMatterRef(matterData.matter.internalReference);
      }
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
  }, [matterId, load]);

  async function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orgId) return;
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    if (categoryId) params.set("categoryId", categoryId);
    if (ownerType && ownerType !== "legal_matter") params.set("ownerType", ownerType);
    if (ownerId && ownerId !== matterId) params.set("ownerId", ownerId);
    const qs = params.toString();
    const base = `/app/casos/${matterId}/documentos`;
    window.history.replaceState(null, "", qs ? `${base}?${qs}` : base);
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
        ownerType: "legal_matter",
        ownerId: matterId,
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
    setOwnerType("legal_matter");
    setOwnerId(matterId);
    await load(orgId, {
      q,
      status,
      categoryId,
      ownerType: "legal_matter",
      ownerId: matterId,
    });
  }

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Casos", href: "/app/casos" },
    { label: matterRef || matterTitle, href: `/app/casos/${matterId}` },
    { label: "Documentos" },
  ];

  if (!canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <ErrorState title="Sem permissão">
          Você não tem permissão para consultar documentos deste caso.
        </ErrorState>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Documentos do caso"
        eyebrow={matterRef || undefined}
        description={`Documentos vinculados ao caso ${matterTitle}.`}
        actions={
          <ButtonLink href="/app/documentos" variant="secondary">
            Todos os documentos
          </ButtonLink>
        }
      />

      <form className="vj-card vj-stack" onSubmit={applyFilters} aria-label="Filtros de documentos">
        <div className="vj-split">
          <FormField id="matter-doc-q" label="Busca">
            <Input
              id="matter-doc-q"
              name="q"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Título ou trecho"
              autoComplete="off"
            />
          </FormField>
          <FormField id="matter-doc-status" label="Situação">
            <Select
              id="matter-doc-status"
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
          <FormField id="matter-doc-category" label="Categoria">
            <Select
              id="matter-doc-category"
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
          <FormField
            id="matter-doc-owner-type"
            label="Escopo"
            hint="Por padrão, documentos do caso. Processos vinculados podem ser filtrados via URL."
          >
            <Select
              id="matter-doc-owner-type"
              name="ownerType"
              value={ownerType}
              onChange={(event) => {
                const next = event.target.value as DocumentOwnerType | "";
                setOwnerType(next || "legal_matter");
                if (!next || next === "legal_matter") setOwnerId(matterId);
              }}
            >
              <option value="legal_matter">Caso</option>
              <option value="judicial_process">Processo judicial</option>
              <option value="administrative_process">Processo administrativo</option>
            </Select>
          </FormField>
        </div>
        {ownerType === "judicial_process" || ownerType === "administrative_process" ? (
          <FormField id="matter-doc-owner-id" label="Identificador do processo">
            <Input
              id="matter-doc-owner-id"
              name="ownerId"
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
              autoComplete="off"
              required
            />
          </FormField>
        ) : null}
        <div className="vj-form-actions">
          <Button type="submit">Filtrar</Button>
        </div>
      </form>

      {canCreate && canUpload ? (
        <form
          className="vj-card vj-stack"
          onSubmit={submitUpload}
          aria-labelledby="matter-doc-upload-title"
        >
          <h2 id="matter-doc-upload-title" className="vj-section-title">
            Enviar documento ao caso
          </h2>
          <FormField id="matter-upload-title" label="Título">
            <Input
              id="matter-upload-title"
              name="title"
              required
              value={uploadTitle}
              onChange={(event) => setUploadTitle(event.target.value)}
              maxLength={300}
            />
          </FormField>
          <FormField id="matter-upload-category" label="Categoria">
            <Select
              id="matter-upload-category"
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
          <FormField id="matter-upload-file" label="Arquivo">
            <Input
              id="matter-upload-file"
              name="file"
              type="file"
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
          Envie um arquivo vinculado a este caso ou ajuste os filtros.
        </EmptyState>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <>
          <p className="vj-meta" aria-live="polite">
            {total} documento{total === 1 ? "" : "s"}
            {ownerType && ownerType !== "legal_matter"
              ? ` · ${DOCUMENT_OWNER_TYPE_LABELS[ownerType]}`
              : ""}
          </p>
          <div className="vj-table-wrap">
            <table className="vj-table">
              <thead>
                <tr>
                  <th scope="col">Título</th>
                  <th scope="col">Categoria</th>
                  <th scope="col">Situação</th>
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
