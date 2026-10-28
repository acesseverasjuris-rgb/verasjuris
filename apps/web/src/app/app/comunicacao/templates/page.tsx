"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import {
  COMUNICACAO_TABS,
  CommunicationProvidersBanner,
  CommunicationTemplatesTable,
} from "../../../../components/communication-ui";
import {
  communicationErrorMessage,
  fetchCommunicationProvidersStatus,
  fetchCommunicationTemplates,
  hasCommunicationPermission,
  isApiFailure,
  type CommunicationProvidersStatus,
  type CommunicationTemplate,
} from "../../../../lib/communication";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function ComunicacaoTemplatesPage() {
  const org = useOrgContext();
  const canRead = hasCommunicationPermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<CommunicationProvidersStatus | null>(null);
  const [items, setItems] = useState<CommunicationTemplate[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [status, templates] = await Promise.all([
        fetchCommunicationProvidersStatus(org.orgId!),
        fetchCommunicationTemplates(org.orgId!, { limit: 50 }),
      ]);
      if (cancelled) return;
      if (!isApiFailure(status)) setProviders(status);
      if (isApiFailure(templates)) {
        setError(communicationErrorMessage(templates, "Não foi possível listar modelos."));
      } else {
        setItems(templates.items);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, canRead]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Comunicação", href: "/app/comunicacao" },
    { label: "Modelos" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar modelos.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader title="Modelos de comunicação" description="Templates por canal e categoria." />
      <SectionTabs
        label="Seções de comunicação"
        items={COMUNICACAO_TABS}
        current="/app/comunicacao/templates"
      />
      <CommunicationProvidersBanner status={providers} />
      {loading || !org.ready ? <LoadingState label="Carregando modelos" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length > 0 ? (
        <CommunicationTemplatesTable items={items} caption="Modelos de comunicação" />
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhum modelo">Cadastre modelos com permissão de gestão.</EmptyState>
      ) : null}
    </div>
  );
}
