"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import {
  COMUNICACAO_TABS,
  CommunicationMessagesTable,
  CommunicationProvidersBanner,
} from "../../../../components/communication-ui";
import {
  communicationErrorMessage,
  fetchCommunicationMessages,
  fetchCommunicationProvidersStatus,
  hasCommunicationPermission,
  isApiFailure,
  type CommunicationMessage,
  type CommunicationProvidersStatus,
} from "../../../../lib/communication";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function ComunicacaoHistoricoPage() {
  const org = useOrgContext();
  const canRead = hasCommunicationPermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<CommunicationProvidersStatus | null>(null);
  const [items, setItems] = useState<CommunicationMessage[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [status, messages] = await Promise.all([
        fetchCommunicationProvidersStatus(org.orgId!),
        fetchCommunicationMessages(org.orgId!, { limit: 50 }),
      ]);
      if (cancelled) return;
      if (!isApiFailure(status)) setProviders(status);
      if (isApiFailure(messages)) {
        setError(communicationErrorMessage(messages, "Não foi possível carregar histórico."));
      } else {
        setItems(messages.items);
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
    { label: "Histórico" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar histórico.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader title="Histórico" description="Mensagens enviadas e status real de entrega." />
      <SectionTabs
        label="Seções de comunicação"
        items={COMUNICACAO_TABS}
        current="/app/comunicacao/historico"
      />
      <CommunicationProvidersBanner status={providers} />
      {loading || !org.ready ? <LoadingState label="Carregando histórico" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length > 0 ? (
        <CommunicationMessagesTable items={items} caption="Histórico de mensagens" />
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Histórico vazio">Nenhuma mensagem registrada.</EmptyState>
      ) : null}
    </div>
  );
}
