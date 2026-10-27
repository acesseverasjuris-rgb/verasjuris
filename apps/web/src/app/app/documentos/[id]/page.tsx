"use client";

import { Alert, Badge, Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { NoPermission } from "../../../../components/ai-ui";
import {
  DocumentPageViewer,
  DocumentProcessingSection,
} from "../../../../components/document-processing";
import {
  DOCUMENT_CONFIDENTIALITY_LABELS,
  DOCUMENT_OWNER_TYPE_LABELS,
  DOCUMENT_SCAN_STATUS_LABELS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_VERSION_STATUS_LABELS,
  apiErrorMessage,
  documentDownloadUrl,
  documentStatusTone,
  fetchDocument,
  formatFileSize,
  hasDocumentPermission,
  isApiFailure,
  type DocumentDetail,
} from "../../../../lib/documents";
import { hasPermission } from "../../../../lib/ai";
import { useOrgContext } from "../../../../lib/use-org-context";

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <p>
      <strong>{label}:</strong> {value}
    </p>
  );
}

export default function DocumentoDetailPage() {
  const params = useParams<{ id: string }>();
  const documentId = params.id;
  const org = useOrgContext();
  const canRead = hasDocumentPermission(org.permissions, "read");
  const canDownload = hasDocumentPermission(org.permissions, "download");
  const canSeeProcessing = hasPermission(org.permissions, "document_intelligence.read");

  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    const orgId = org.orgId;
    let cancelled = false;
    void (async () => {
      const data = await fetchDocument(orgId, documentId);
      if (cancelled) return;
      if (isApiFailure(data)) {
        setError(apiErrorMessage(data, "Não foi possível carregar o documento."));
      } else {
        setDocument(data.document);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, canRead, documentId]);

  const base = [
    { label: "Painel", href: "/app" },
    { label: "Documentos", href: "/app/documentos" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={[...base, { label: "Detalhe" }]} />
        <NoPermission>
          Você não tem permissão para consultar documentos nesta organização.
        </NoPermission>
      </div>
    );
  }
  if (loading || !org.ready) return <LoadingState label="Carregando documento" />;
  if (error || !document) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={[...base, { label: "Detalhe" }]} />
        <ErrorState title="Erro ao carregar documento">
          {error ?? "Documento não encontrado."}
        </ErrorState>
      </div>
    );
  }

  const version = document.currentVersion ?? document.versions?.[0] ?? null;
  const versionUsable = version?.status === "available";

  return (
    <div className="vj-stack">
      <Breadcrumb items={[...base, { label: document.title }]} />
      <PageHeader
        title={document.title}
        eyebrow={DOCUMENT_OWNER_TYPE_LABELS[document.ownerType]}
        description={document.description ?? "Sem descrição cadastrada."}
      />

      <div className="vj-detail-grid">
        <div className="vj-stack">
          <section className="vj-card vj-stack" aria-labelledby="doc-info">
            <h2 id="doc-info" className="vj-section-title">
              Informações
            </h2>
            <p>
              <Badge tone={documentStatusTone(document.status)}>
                {DOCUMENT_STATUS_LABELS[document.status]}
              </Badge>{" "}
              <Badge>{DOCUMENT_CONFIDENTIALITY_LABELS[document.confidentialityLevel]}</Badge>
            </p>
            <MetaRow label="Categoria" value={document.category?.name ?? "—"} />
            <MetaRow label="Vínculo" value={DOCUMENT_OWNER_TYPE_LABELS[document.ownerType]} />
            <MetaRow
              label="Atualizado em"
              value={new Date(document.updatedAt).toLocaleString("pt-BR")}
            />
          </section>

          {org.orgId && canSeeProcessing ? (
            <DocumentProcessingSection
              orgId={org.orgId}
              documentId={document.id}
              versionId={versionUsable ? version?.id : null}
              canProcess={hasPermission(org.permissions, "document_intelligence.process")}
              canReview={hasPermission(org.permissions, "document_intelligence.review")}
            />
          ) : (
            <Alert tone="info" title="Processamento">
              Você não tem permissão para consultar o processamento deste documento.
            </Alert>
          )}

          {org.orgId && canSeeProcessing ? (
            <DocumentPageViewer
              orgId={org.orgId}
              documentId={document.id}
              versionId={versionUsable ? version?.id : null}
            />
          ) : null}
        </div>

        <aside className="vj-stack">
          <section className="vj-card vj-stack" aria-labelledby="doc-file">
            <h2 id="doc-file" className="vj-section-title">
              Arquivo atual
            </h2>
            {version ? (
              <>
                <p>
                  <strong>{version.originalFilename}</strong>
                </p>
                <p className="vj-meta">
                  Versão {version.versionNumber} · {formatFileSize(version.sizeBytes)}
                </p>
                <MetaRow label="Situação" value={DOCUMENT_VERSION_STATUS_LABELS[version.status]} />
                <MetaRow
                  label="Antimalware"
                  value={DOCUMENT_SCAN_STATUS_LABELS[version.scanStatus]}
                />
                {canDownload && org.orgId && versionUsable ? (
                  <a
                    className="vj-button vj-button-secondary"
                    href={documentDownloadUrl(org.orgId, document.id, version.id)}
                  >
                    Baixar arquivo
                  </a>
                ) : null}
              </>
            ) : (
              <p className="vj-meta">Nenhum arquivo enviado.</p>
            )}
          </section>

          {document.versions && document.versions.length > 1 ? (
            <section className="vj-card vj-stack" aria-labelledby="doc-versions">
              <h2 id="doc-versions" className="vj-section-title">
                Versões
              </h2>
              <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {document.versions.map((item) => (
                  <li key={item.id}>
                    v{item.versionNumber} · {item.originalFilename}
                    <div className="vj-meta">
                      {new Date(item.createdAt).toLocaleString("pt-BR")}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
