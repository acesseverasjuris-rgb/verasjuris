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
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../../components/ai-ui";
import { DOCUMENTOS_JURIDICOS_TABS } from "../../../../../components/legal-template-ui";
import { LayerTag } from "../../../../../components/legal-review-ui";
import {
  createLegalDraft,
  generateLegalDraft,
  hasLegalDraftPermission,
  isApiFailure,
  aiErrorMessage,
} from "../../../../../lib/legal-drafts";
import {
  LEGAL_TEMPLATE_TYPE_LABELS,
  fetchLegalTemplates,
  isApiFailure as isTemplateFailure,
  type LegalTemplateSummary,
  type LegalTemplateType,
} from "../../../../../lib/legal-templates";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function NovaMinutaPage() {
  const org = useOrgContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const canCreate = hasLegalDraftPermission(org.permissions, "create");

  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState<LegalTemplateType>("other");
  const [templateId, setTemplateId] = useState("");
  const [content, setContent] = useState("");
  const [legalMatterId, setLegalMatterId] = useState(searchParams.get("legalMatterId") ?? "");
  const [templates, setTemplates] = useState<LegalTemplateSummary[]>([]);
  const [useGenerate, setUseGenerate] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!org.ready || !org.orgId || !canCreate) return;
    void (async () => {
      const data = await fetchLegalTemplates(org.orgId!, {
        includeSystem: true,
        active: true,
        limit: 100,
      });
      if (!isTemplateFailure(data)) setTemplates(data.items);
    })();
  }, [org.ready, org.orgId, canCreate]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Documentos jurídicos", href: "/app/documentos-juridicos" },
    { label: "Minutas", href: "/app/documentos-juridicos/minutas" },
    { label: "Nova" },
  ];

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!org.orgId || !canCreate) return;
    setSaving(true);
    setError(null);
    const body = {
      title: title.trim(),
      documentType,
      templateId: templateId || undefined,
      content: content.trim() || undefined,
      legalMatterId: legalMatterId.trim() || undefined,
      idempotencyKey: `draft-create-${crypto.randomUUID()}`,
    };
    const data =
      useGenerate && templateId
        ? await generateLegalDraft(org.orgId, body)
        : await createLegalDraft(org.orgId, body);
    if (isApiFailure(data)) {
      setError(aiErrorMessage(data, "Não foi possível criar a minuta."));
      setSaving(false);
      return;
    }
    router.push(`/app/documentos-juridicos/minutas/${data.draft.id}`);
  }

  if (org.ready && !canCreate) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para criar minutas.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Nova minuta"
        description="Gere a partir de um modelo (sem IA) ou inicie em branco. Revisão e protocolo são etapas humanas posteriores."
      />
      <SectionTabs
        label="Seções de documentos jurídicos"
        items={DOCUMENTOS_JURIDICOS_TABS}
        current="/app/documentos-juridicos/minutas"
      />

      <Alert tone="info" title="FONTE → AÇÃO">
        A geração a partir de modelo preenche variáveis declaradas. Assistência de IA, se usada
        depois, exige revisão humana.
      </Alert>

      <form className="vj-card vj-stack" onSubmit={(event) => void onSubmit(event)}>
        <LayerTag layer="FONTE" />
        <FormField id="draft-title" label="Título">
          <Input
            id="draft-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={2}
            autoComplete="off"
          />
        </FormField>
        <div className="vj-split">
          <FormField id="draft-type" label="Tipo de documento">
            <Select
              id="draft-type"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as LegalTemplateType)}
            >
              {Object.entries(LEGAL_TEMPLATE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="draft-template" label="Modelo (opcional)">
            <Select
              id="draft-template"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">Sem modelo</option>
              {templates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <FormField id="draft-matter" label="ID do caso (opcional)">
          <Input
            id="draft-matter"
            value={legalMatterId}
            onChange={(e) => setLegalMatterId(e.target.value)}
            autoComplete="off"
            className="vj-technical"
          />
        </FormField>
        <label className="vj-inline-actions">
          <input
            type="checkbox"
            checked={useGenerate}
            onChange={(e) => setUseGenerate(e.target.checked)}
            disabled={!templateId}
          />
          Gerar a partir do modelo (sem IA)
        </label>
        <FormField id="draft-content" label="Conteúdo inicial (opcional)">
          <Textarea
            id="draft-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
          />
        </FormField>
        {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
        <button type="submit" className="vj-button vj-button-primary" disabled={saving}>
          {saving ? "Criando…" : "Criar minuta"}
        </button>
      </form>
    </div>
  );
}
