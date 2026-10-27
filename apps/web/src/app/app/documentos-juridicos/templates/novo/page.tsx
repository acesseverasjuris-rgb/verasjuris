"use client";

import {
  Alert,
  Breadcrumb,
  ErrorState,
  FormField,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@verasjuris/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { NoPermission, SectionTabs } from "../../../../../components/ai-ui";
import { DOCUMENTOS_JURIDICOS_TABS } from "../../../../../components/legal-template-ui";
import { LayerTag } from "../../../../../components/legal-review-ui";
import {
  LEGAL_TEMPLATE_KIND_LABELS,
  LEGAL_TEMPLATE_TYPE_LABELS,
  aiErrorMessage,
  createLegalTemplate,
  hasLegalTemplatePermission,
  isApiFailure,
  type LegalTemplateContentFormat,
  type LegalTemplateDocumentKind,
  type LegalTemplateType,
} from "../../../../../lib/legal-templates";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function NovoTemplatePage() {
  const org = useOrgContext();
  const router = useRouter();
  const canCreate = hasLegalTemplatePermission(org.permissions, "create");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templateType, setTemplateType] = useState<LegalTemplateType>("other");
  const [documentKind, setDocumentKind] = useState<LegalTemplateDocumentKind>("petition");
  const [contentFormat, setContentFormat] = useState<LegalTemplateContentFormat>("html");
  const [content, setContent] = useState("<p>Prezado(a) {{cliente.nome}},</p>");
  const [variableKeys, setVariableKeys] = useState("cliente.nome");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Documentos jurídicos", href: "/app/documentos-juridicos" },
    { label: "Modelos", href: "/app/documentos-juridicos/templates" },
    { label: "Novo" },
  ];

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!org.orgId || !canCreate) return;
    setSaving(true);
    setError(null);
    const fields = variableKeys
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((key) => ({
        key,
        label: key,
        type: "text" as const,
        required: false,
      }));
    const data = await createLegalTemplate(org.orgId, {
      name: name.trim(),
      description: description.trim() || undefined,
      templateType,
      documentKind,
      content,
      contentFormat,
      variableSchema: { fields },
    });
    if (isApiFailure(data)) {
      setError(aiErrorMessage(data, "Não foi possível criar o modelo."));
      setSaving(false);
      return;
    }
    router.push(`/app/documentos-juridicos/templates/${data.template.id}`);
  }

  if (org.ready && !canCreate) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para criar modelos jurídicos.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Novo modelo jurídico"
        description="Cadastre conteúdo e variáveis. A primeira versão nasce como rascunho."
      />
      <SectionTabs
        label="Seções de documentos jurídicos"
        items={DOCUMENTOS_JURIDICOS_TABS}
        current="/app/documentos-juridicos/templates"
      />

      <Alert tone="info" title="FONTE · Modelo">
        Use expressões <code>{"{{chave}}"}</code> apenas para variáveis declaradas. Variáveis
        ausentes serão destacadas na pré-visualização.
      </Alert>

      <form className="vj-card vj-stack" onSubmit={(event) => void onSubmit(event)}>
        <LayerTag layer="FONTE" />
        <FormField id="tpl-name" label="Nome">
          <Input
            id="tpl-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={2}
            autoComplete="off"
          />
        </FormField>
        <FormField id="tpl-desc" label="Descrição">
          <Textarea
            id="tpl-desc"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
          />
        </FormField>
        <div className="vj-split">
          <FormField id="tpl-type" label="Tipo">
            <Select
              id="tpl-type"
              value={templateType}
              onChange={(event) => setTemplateType(event.target.value as LegalTemplateType)}
            >
              {Object.entries(LEGAL_TEMPLATE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="tpl-kind" label="Espécie documental">
            <Select
              id="tpl-kind"
              value={documentKind}
              onChange={(event) => setDocumentKind(event.target.value as LegalTemplateDocumentKind)}
            >
              {Object.entries(LEGAL_TEMPLATE_KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="tpl-format" label="Formato">
            <Select
              id="tpl-format"
              value={contentFormat}
              onChange={(event) =>
                setContentFormat(event.target.value as LegalTemplateContentFormat)
              }
            >
              <option value="html">HTML</option>
              <option value="markdown">Markdown</option>
              <option value="plain_text">Texto simples</option>
              <option value="structured">Estruturado</option>
            </Select>
          </FormField>
        </div>
        <FormField id="tpl-vars" label="Variáveis (chave por linha ou vírgula)">
          <Textarea
            id="tpl-vars"
            value={variableKeys}
            onChange={(event) => setVariableKeys(event.target.value)}
            rows={3}
          />
        </FormField>
        <FormField id="tpl-content" label="Conteúdo">
          <Textarea
            id="tpl-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={12}
            required
          />
        </FormField>
        {error ? <ErrorState title="Erro ao salvar">{error}</ErrorState> : null}
        <button type="submit" className="vj-button vj-button-primary" disabled={saving}>
          {saving ? "Salvando…" : "Criar modelo"}
        </button>
      </form>
    </div>
  );
}
