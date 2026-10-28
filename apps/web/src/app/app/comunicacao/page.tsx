"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../components/ai-ui";
import {
  COMUNICACAO_TABS,
  CommunicationMessagesTable,
  CommunicationProvidersBanner,
} from "../../../components/communication-ui";
import {
  communicationErrorMessage,
  fetchCommunicationMessages,
  fetchCommunicationProvidersStatus,
  hasCommunicationPermission,
  isApiFailure,
  type CommunicationMessage,
  type CommunicationProvidersStatus,
} from "../../../lib/communication";
import { useOrgContext } from "../../../lib/use-org-context";

export default function ComunicacaoDashboardPage() {
  const org = useOrgContext();
  const canRead = hasCommunicationPermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<CommunicationProvidersStatus | null>(null);
  const [recent, setRecent] = useState<CommunicationMessage[]>([]);

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
        fetchCommunicationMessages(org.orgId!, { limit: 10 }),
      ]);
      if (cancelled) return;
      if (!isApiFailure(status)) setProviders(status);
      if (isApiFailure(messages)) {
        setError(communicationErrorMessage(messages, "Não foi possível carregar comunicações."));
      } else {
        setRecent(messages.items);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, canRead]);

  const breadcrumb = [{ label: "Painel", href: "/app" }, { label: "Comunicação" }];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar comunicação.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Comunicação"
        description="Templates, histórico e preferências — com aviso claro quando canais estão NOT_CONFIGURED."
      />
      <SectionTabs
        label="Seções de comunicação"
        items={COMUNICACAO_TABS}
        current="/app/comunicacao"
      />
      <CommunicationProvidersBanner status={providers} />
      {loading || !org.ready ? <LoadingState label="Carregando comunicação" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && recent.length > 0 ? (
        <>
          <h2 className="vj-section-title">Mensagens recentes</h2>
          <CommunicationMessagesTable items={recent} caption="Mensagens recentes" />
        </>
      ) : null}
      {!loading && !error && recent.length === 0 ? (
        <EmptyState title="Nenhuma mensagem">O histórico aparecerá aqui após envios.</EmptyState>
      ) : null}
    </div>
  );
}
