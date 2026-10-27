"use client";

import {
  Alert,
  Breadcrumb,
  Button,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from "@verasjuris/ui";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import {
  IA_TABS,
  NoPermission,
  NotConfiguredNotice,
  SectionTabs,
} from "../../../../../components/ai-ui";
import { aiErrorMessage, isNotConfigured } from "../../../../../lib/ai";
import { fetchDocuments, type DocumentSummary } from "../../../../../lib/documents";
import {
  createLegalReview,
  createLegalReviewSet,
  hasLegalReviewPermission,
  isApiFailure,
  LEGAL_REVIEW_ROLE_LABELS,
  LEGAL_REVIEW_TYPE_LABELS,
  type LegalReviewDocumentRole,
  type LegalReviewType,
} from "../../../../../lib/legal-review";
import { useOrgContext } from "../../../../../lib/use-org-context";

type DocRow = {
  documentId: string;
  roleInReview: LegalReviewDocumentRole;
};

export default function NovaRevisaoPage() {
  const router = useRouter();
  const org = useOrgContext();
  const canCreate = hasLegalReviewPermission(org.permissions, "create");
  const formId = useId();

  const [name, setName] = useState("");
  const [reviewType, setReviewType] = useState<LegalReviewType>("content_review");
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selected, setSelected] = useState<DocRow[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notConfigured, setNotConfigured] = useState(false);

  useEffect(() => {
    if (!org.ready || !org.orgId || !canCreate) {
      setLoadingDocs(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const data = await fetchDocuments(org.orgId!, { status: "active", limit: 100 });
      if (cancelled) return;
      if (isApiFailure(data)) {
        setError(aiErrorMessage(data, "Não foi possível carregar documentos."));
        setDocuments([]);
      } else {
        setDocuments(data.items);
      }
      setLoadingDocs(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, canCreate]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "IA", href: "/app/ia" },
    { label: "Revisão", href: "/app/ia/revisao" },
    { label: "Nova" },
  ];

  function toggleDocument(doc: DocumentSummary) {
    setSelected((prev) => {
      const exists = prev.find((row) => row.documentId === doc.id);
      if (exists) return prev.filter((row) => row.documentId !== doc.id);
      return [...prev, { documentId: doc.id, roleInReview: "other" }];
    });
  }

  function setRole(documentId: string, roleInReview: LegalReviewDocumentRole) {
    setSelected((prev) =>
      prev.map((row) => (row.documentId === documentId ? { ...row, roleInReview } : row)),
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!org.orgId) {
      setError("Nenhuma organização ativa.");
      return;
    }
    const next: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2)
      next.name = "Informe um nome com ao menos 2 caracteres.";
    if (selected.length === 0) next.documents = "Selecione ao menos um documento.";
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;

    setPending(true);
    setError(null);
    setNotConfigured(false);

    const setResult = await createLegalReviewSet(org.orgId, {
      name: name.trim(),
      documents: selected.map((row, index) => ({
        documentId: row.documentId,
        roleInReview: row.roleInReview,
        sortOrder: index,
        documentVersionId:
          documents.find((doc) => doc.id === row.documentId)?.currentVersionId ?? undefined,
      })),
    });
    if (isApiFailure(setResult)) {
      if (isNotConfigured(setResult)) setNotConfigured(true);
      else setError(aiErrorMessage(setResult, "Não foi possível criar o conjunto de revisão."));
      setPending(false);
      return;
    }

    const setId = setResult.set.id;
    const reviewResult = await createLegalReview(org.orgId, {
      reviewType,
      reviewSetId: setId,
      idempotencyKey: `web-review-${setId}-${Date.now()}`,
    });
    if (isApiFailure(reviewResult)) {
      if (isNotConfigured(reviewResult)) setNotConfigured(true);
      else setError(aiErrorMessage(reviewResult, "Não foi possível iniciar a revisão."));
      setPending(false);
      return;
    }

    router.push(`/app/ia/revisao/${reviewResult.review.id}`);
  }

  if (org.ready && !canCreate) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para criar revisões assistidas.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Nova revisão assistida"
        description="Monte o conjunto de documentos, indique o papel de cada um e solicite a análise. A IA sugere; a pessoa confirma."
      />
      <SectionTabs label="Seções de IA" items={IA_TABS} current="/app/ia/revisao" />

      {notConfigured ? <NotConfiguredNotice /> : null}
      {error ? <ErrorState title="Não foi possível criar a revisão">{error}</ErrorState> : null}

      <form id={formId} className="vj-card vj-stack" onSubmit={(event) => void onSubmit(event)}>
        <Alert tone="info" title="ANÁLISE · Apoio assistivo">
          Nenhum resultado será aplicado automaticamente ao caso. Revise cada apontamento antes de
          decidir.
        </Alert>

        <FormField id="rev-name" label="Nome do conjunto" error={fieldErrors.name}>
          <Input
            id="rev-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            autoComplete="off"
            placeholder="Ex.: Contestação × petição inicial"
          />
        </FormField>

        <FormField id="rev-type" label="Tipo de revisão">
          <Select
            id="rev-type"
            value={reviewType}
            onChange={(event) => setReviewType(event.target.value as LegalReviewType)}
          >
            {Object.entries(LEGAL_REVIEW_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>

        <fieldset
          className="vj-stack"
          aria-describedby={fieldErrors.documents ? "rev-docs-err" : undefined}
        >
          <legend className="vj-section-title">Documentos (FONTE)</legend>
          {fieldErrors.documents ? (
            <p id="rev-docs-err" className="vj-field-error" role="alert">
              {fieldErrors.documents}
            </p>
          ) : null}
          {loadingDocs ? <LoadingState label="Carregando documentos" /> : null}
          {!loadingDocs && documents.length === 0 ? (
            <p className="vj-meta">
              Nenhum documento ativo encontrado. <a href="/app/documentos">Cadastre documentos</a>{" "}
              antes de solicitar a revisão.
            </p>
          ) : null}
          <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {documents.map((doc) => {
              const checked = selected.some((row) => row.documentId === doc.id);
              const role =
                selected.find((row) => row.documentId === doc.id)?.roleInReview ?? "other";
              return (
                <li key={doc.id} className="vj-inline-actions" style={{ alignItems: "flex-start" }}>
                  <label className="vj-inline-actions" style={{ flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDocument(doc)}
                      aria-label={`Incluir ${doc.title}`}
                    />
                    <span>
                      <strong>{doc.title}</strong>
                      <span className="vj-meta" style={{ display: "block" }}>
                        {doc.currentVersion?.originalFilename ?? "Sem versão atual"}
                      </span>
                    </span>
                  </label>
                  {checked ? (
                    <Select
                      aria-label={`Papel de ${doc.title}`}
                      value={role}
                      onChange={(event) =>
                        setRole(doc.id, event.target.value as LegalReviewDocumentRole)
                      }
                    >
                      {Object.entries(LEGAL_REVIEW_ROLE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </fieldset>

        <div className="vj-inline-actions">
          <Button type="submit" disabled={pending || loadingDocs}>
            {pending ? "Gerando revisão…" : "Criar conjunto e revisar"}
          </Button>
          <a className="vj-button vj-button-secondary" href="/app/ia/revisao">
            Cancelar
          </a>
        </div>
      </form>
    </div>
  );
}
