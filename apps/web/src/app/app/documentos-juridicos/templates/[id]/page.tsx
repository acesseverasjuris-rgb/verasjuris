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
  Textarea,
} from "@verasjuris/ui";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../../components/ai-ui";
import {
  DOCUMENTOS_JURIDICOS_TABS,
  HighlightedPreview,
  TemplateKindBadge,
  TemplateScopeBadge,
  TemplateTypeBadge,
  TemplateVersionStatusBadge,
  VersionList,
} from "../../../../../components/legal-template-ui";
import { LayerTag } from "../../../../../components/legal-review-ui";
import {
  activateLegalTemplateVersion,
  aiErrorMessage,
  approveLegalTemplateVersion,
  createLegalTemplateVersion,
  duplicateLegalTemplate,
  fetchLegalTemplate,
  hasLegalTemplatePermission,
  isApiFailure,
  previewLegalTemplateVersion,
  submitLegalTemplateVersionForReview,
  updateLegalTemplate,
  variableFieldsFromSchema,
  type LegalTemplateSummary,
  type LegalTemplateVersion,
  type TemplatePreviewResult,
  type TemplateVariableField,
} from "../../../../../lib/legal-templates";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function TemplateDetailPage() {
  const params = useParams<{ id: string }>();
  const templateId = params.id;
  const router = useRouter();
  const org = useOrgContext();

  const canRead = hasLegalTemplatePermission(org.permissions, "read");
  const canUpdate = hasLegalTemplatePermission(org.permissions, "update");
  const canApprove = hasLegalTemplatePermission(org.permissions, "approve");
  const canActivate = hasLegalTemplatePermission(org.permissions, "activate");
  const canCreate = hasLegalTemplatePermission(org.permissions, "create");

  const [template, setTemplate] = useState<LegalTemplateSummary | null>(null);
  const [versions, setVersions] = useState<LegalTemplateVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<LegalTemplateVersion | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [changelog, setChangelog] = useState("");
  const [previewContextText, setPreviewContextText] = useState("{}");
  const [preview, setPreview] = useState<TemplatePreviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (orgId: string) => {
      setLoading(true);
      setError(null);
      const data = await fetchLegalTemplate(orgId, templateId);
      if (isApiFailure(data)) {
        setError(aiErrorMessage(data, "Não foi possível carregar o modelo."));
        setTemplate(null);
      } else {
        setTemplate(data.template);
        setVersions(data.versions);
        setName(data.template.name);
        setDescription(data.template.description ?? "");
        const version = data.currentVersion ?? data.versions[0] ?? null;
        setSelectedVersion(version);
        setContent(version?.content ?? "");
      }
      setLoading(false);
    },
    [templateId],
  );

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    void load(org.orgId);
  }, [org.ready, org.orgId, canRead, load]);

  const fields = useMemo(
    () => variableFieldsFromSchema(selectedVersion?.variableSchema),
    [selectedVersion],
  );

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Documentos jurídicos", href: "/app/documentos-juridicos" },
    { label: "Modelos", href: "/app/documentos-juridicos/templates" },
    { label: template?.name ?? "Modelo" },
  ];

  async function saveMeta() {
    if (!org.orgId || !template || !canUpdate) return;
    setBusy(true);
    setActionError(null);
    const data = await updateLegalTemplate(org.orgId, template.id, {
      name: name.trim(),
      description: description.trim() || null,
    });
    if (isApiFailure(data)) {
      setActionError(aiErrorMessage(data, "Não foi possível atualizar o modelo."));
    } else {
      setTemplate(data.template);
    }
    setBusy(false);
  }

  async function saveNewVersion() {
    if (!org.orgId || !template || !canUpdate) return;
    setBusy(true);
    setActionError(null);
    const data = await createLegalTemplateVersion(org.orgId, template.id, {
      content,
      contentFormat: (selectedVersion?.contentFormat as "html") ?? "html",
      variableSchema: {
        fields: fields.length
          ? fields
          : [{ key: "exemplo", label: "Exemplo", type: "text", required: false }],
      },
      changelog: changelog.trim() || undefined,
    });
    if (isApiFailure(data)) {
      setActionError(aiErrorMessage(data, "Não foi possível criar a versão."));
    } else {
      setSelectedVersion(data.version);
      setChangelog("");
      await load(org.orgId);
    }
    setBusy(false);
  }

  async function runPreview() {
    if (!org.orgId || !template || !selectedVersion) return;
    setBusy(true);
    setActionError(null);
    let context: Record<string, unknown> = {};
    try {
      context = JSON.parse(previewContextText || "{}") as Record<string, unknown>;
    } catch {
      setActionError("Contexto de pré-visualização deve ser um JSON válido.");
      setBusy(false);
      return;
    }
    const data = await previewLegalTemplateVersion(
      org.orgId,
      template.id,
      selectedVersion.id,
      context,
    );
    if (isApiFailure(data)) {
      setActionError(aiErrorMessage(data, "Não foi possível gerar a pré-visualização."));
      setPreview(null);
    } else {
      setPreview(data.preview);
    }
    setBusy(false);
  }

  async function onSubmitReview() {
    if (!org.orgId || !template || !selectedVersion || !canUpdate) return;
    setBusy(true);
    setActionError(null);
    const data = await submitLegalTemplateVersionForReview(
      org.orgId,
      template.id,
      selectedVersion.id,
    );
    if (isApiFailure(data)) {
      setActionError(aiErrorMessage(data, "Não foi possível enviar para revisão."));
    } else {
      await load(org.orgId);
    }
    setBusy(false);
  }

  async function onApprove() {
    if (!org.orgId || !template || !selectedVersion || !canApprove) return;
    setBusy(true);
    setActionError(null);
    const data = await approveLegalTemplateVersion(org.orgId, template.id, selectedVersion.id);
    if (isApiFailure(data)) {
      setActionError(aiErrorMessage(data, "Não foi possível aprovar a versão."));
    } else {
      await load(org.orgId);
    }
    setBusy(false);
  }

  async function onActivate() {
    if (!org.orgId || !template || !selectedVersion || !canActivate) return;
    setBusy(true);
    setActionError(null);
    const data = await activateLegalTemplateVersion(org.orgId, template.id, selectedVersion.id);
    if (isApiFailure(data)) {
      setActionError(aiErrorMessage(data, "Não foi possível ativar a versão."));
    } else {
      await load(org.orgId);
    }
    setBusy(false);
  }

  async function onDuplicate() {
    if (!org.orgId || !template || !canCreate) return;
    setBusy(true);
    setActionError(null);
    const data = await duplicateLegalTemplate(org.orgId, template.id);
    if (isApiFailure(data)) {
      setActionError(aiErrorMessage(data, "Não foi possível duplicar o modelo."));
      setBusy(false);
      return;
    }
    router.push(`/app/documentos-juridicos/templates/${data.template.id}`);
  }

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar este modelo.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title={template?.name ?? "Modelo"}
        description="Edite metadados, versões e pré-visualize variáveis ausentes destacadas."
        actions={
          canCreate ? (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void onDuplicate()}
            >
              Duplicar para a organização
            </Button>
          ) : null
        }
      />
      <SectionTabs
        label="Seções de documentos jurídicos"
        items={DOCUMENTOS_JURIDICOS_TABS}
        current="/app/documentos-juridicos/templates"
      />

      {loading || !org.ready ? <LoadingState label="Carregando modelo" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {actionError ? <ErrorState title="Ação">{actionError}</ErrorState> : null}

      {template ? (
        <>
          <section className="vj-card vj-stack" aria-labelledby="tpl-meta">
            <h2 id="tpl-meta" className="vj-section-title">
              Metadados
            </h2>
            <LayerTag layer="FONTE" />
            <div className="vj-inline-actions">
              <TemplateTypeBadge type={template.templateType} />
              <TemplateKindBadge kind={template.documentKind} />
              <TemplateScopeBadge scope={template.scope} />
            </div>
            {canUpdate ? (
              <>
                <FormField id="tpl-name" label="Nome">
                  <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} />
                </FormField>
                <FormField id="tpl-desc" label="Descrição">
                  <Textarea
                    id="tpl-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </FormField>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void saveMeta()}
                >
                  Salvar metadados
                </Button>
              </>
            ) : (
              <p className="vj-prose">{template.description ?? "Sem descrição."}</p>
            )}
          </section>

          <section className="vj-card vj-stack" aria-labelledby="tpl-versions">
            <h2 id="tpl-versions" className="vj-section-title">
              Versões
            </h2>
            <VersionList
              versions={versions}
              currentVersionId={template.currentVersionId}
              onSelect={(version) => {
                setSelectedVersion(version);
                setContent(version.content);
                setPreview(null);
              }}
            />
            {selectedVersion ? (
              <div className="vj-inline-actions">
                <TemplateVersionStatusBadge status={selectedVersion.status} />
                <span className="vj-meta">v{selectedVersion.version}</span>
                {canUpdate && selectedVersion.status === "draft" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void onSubmitReview()}
                  >
                    Enviar para revisão
                  </Button>
                ) : null}
                {canApprove && selectedVersion.status === "review" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void onApprove()}
                  >
                    Aprovar
                  </Button>
                ) : null}
                {canActivate &&
                (selectedVersion.status === "approved" || selectedVersion.status === "active") ? (
                  <Button
                    type="button"
                    variant="primary"
                    disabled={busy}
                    onClick={() => void onActivate()}
                  >
                    Ativar versão
                  </Button>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="vj-card vj-stack" aria-labelledby="tpl-vars">
            <h2 id="tpl-vars" className="vj-section-title">
              Variáveis
            </h2>
            {fields.length === 0 ? (
              <p className="vj-meta">Nenhuma variável declarada nesta versão.</p>
            ) : (
              <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {fields.map((field: TemplateVariableField) => (
                  <li key={field.key}>
                    <strong className="vj-technical">{field.key}</strong>
                    <span className="vj-meta">
                      {" "}
                      · {field.label} · {field.type}
                      {field.required ? " · obrigatória" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {canUpdate ? (
            <section className="vj-card vj-stack" aria-labelledby="tpl-content">
              <h2 id="tpl-content" className="vj-section-title">
                Conteúdo (nova versão)
              </h2>
              <FormField id="tpl-body" label="Conteúdo">
                <Textarea
                  id="tpl-body"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={14}
                />
              </FormField>
              <FormField id="tpl-changelog" label="Changelog">
                <Input
                  id="tpl-changelog"
                  value={changelog}
                  onChange={(e) => setChangelog(e.target.value)}
                />
              </FormField>
              <Button
                type="button"
                variant="primary"
                disabled={busy}
                onClick={() => void saveNewVersion()}
              >
                Criar nova versão
              </Button>
            </section>
          ) : null}

          <section className="vj-card vj-stack" aria-labelledby="tpl-preview">
            <h2 id="tpl-preview" className="vj-section-title">
              Pré-visualização
            </h2>
            <LayerTag layer="ANÁLISE" />
            <Alert tone="info" title="Variáveis ausentes">
              Valores não informados aparecem destacados. Nada é persistido nesta ação.
            </Alert>
            <FormField id="tpl-context" label="Contexto JSON">
              <Textarea
                id="tpl-context"
                value={previewContextText}
                onChange={(e) => setPreviewContextText(e.target.value)}
                rows={4}
              />
            </FormField>
            <Button
              type="button"
              variant="secondary"
              disabled={busy || !selectedVersion}
              onClick={() => void runPreview()}
            >
              Pré-visualizar
            </Button>
            {preview ? (
              <>
                {preview.missingVariables.length > 0 ? (
                  <p className="vj-meta">
                    Ausentes: {preview.missingVariables.join(", ")}
                    {preview.requiredMissing.length
                      ? ` (obrigatórias: ${preview.requiredMissing.join(", ")})`
                      : ""}
                  </p>
                ) : (
                  <p className="vj-meta">Nenhuma variável ausente no contexto informado.</p>
                )}
                <HighlightedPreview
                  rendered={preview.rendered}
                  missingVariables={preview.missingVariables}
                />
              </>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
