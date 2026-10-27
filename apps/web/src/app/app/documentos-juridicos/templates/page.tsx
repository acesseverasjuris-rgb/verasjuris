"use client";

import {
  Breadcrumb,
  ButtonLink,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from "@verasjuris/ui";
import { useCallback, useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import {
  DOCUMENTOS_JURIDICOS_TABS,
  TemplateListTable,
} from "../../../../components/legal-template-ui";
import {
  LEGAL_TEMPLATE_TYPE_LABELS,
  aiErrorMessage,
  fetchLegalTemplates,
  hasLegalTemplatePermission,
  isApiFailure,
  type LegalTemplateSummary,
} from "../../../../lib/legal-templates";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function TemplatesListPage() {
  const org = useOrgContext();
  const canRead = hasLegalTemplatePermission(org.permissions, "read");
  const canCreate = hasLegalTemplatePermission(org.permissions, "create");

  const [q, setQ] = useState("");
  const [templateType, setTemplateType] = useState("");
  const [items, setItems] = useState<LegalTemplateSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (orgId: string, filters: { q: string; templateType: string }) => {
    setLoading(true);
    setError(null);
    const data = await fetchLegalTemplates(orgId, {
      q: filters.q || undefined,
      templateType: filters.templateType || undefined,
      includeSystem: true,
      limit: 50,
    });
    if (isApiFailure(data)) {
      setError(aiErrorMessage(data, "Não foi possível listar os modelos."));
      setItems([]);
    } else {
      setItems(data.items);
      setTotal(data.total);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    void load(org.orgId, { q: "", templateType: "" });
  }, [org.ready, org.orgId, canRead, load]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Documentos jurídicos", href: "/app/documentos-juridicos" },
    { label: "Modelos" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar modelos jurídicos.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Modelos jurídicos"
        description="Modelos versionados da organização e do sistema. Ative apenas versões revisadas."
        actions={
          canCreate ? (
            <ButtonLink href="/app/documentos-juridicos/templates/novo" variant="primary">
              Novo modelo
            </ButtonLink>
          ) : null
        }
      />
      <SectionTabs
        label="Seções de documentos jurídicos"
        items={DOCUMENTOS_JURIDICOS_TABS}
        current="/app/documentos-juridicos/templates"
      />

      <form
        className="vj-card vj-stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (org.orgId) void load(org.orgId, { q, templateType });
        }}
      >
        <div className="vj-split">
          <FormField id="tpl-q" label="Buscar">
            <Input
              id="tpl-q"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              autoComplete="off"
            />
          </FormField>
          <FormField id="tpl-type" label="Tipo">
            <Select
              id="tpl-type"
              value={templateType}
              onChange={(event) => setTemplateType(event.target.value)}
            >
              <option value="">Todos</option>
              {Object.entries(LEGAL_TEMPLATE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <button type="submit" className="vj-button vj-button-secondary">
          Filtrar
        </button>
      </form>

      {loading || !org.ready ? <LoadingState label="Carregando modelos" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhum modelo">
          Cadastre um modelo da organização ou duplique um modelo do sistema.
        </EmptyState>
      ) : null}
      {!loading && items.length > 0 ? (
        <>
          <p className="vj-meta">{total} modelo(s)</p>
          <TemplateListTable items={items} caption="Lista de modelos jurídicos" />
        </>
      ) : null}
    </div>
  );
}
