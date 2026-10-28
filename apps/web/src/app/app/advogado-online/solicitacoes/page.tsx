"use client";

import {
  Breadcrumb,
  ButtonLink,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import {
  ADVOGADO_ONLINE_TABS,
  OnlineLawyerProvidersBanner,
  OnlineRequestsTable,
} from "../../../../components/online-lawyer-ui";
import {
  fetchOnlineLawyerProvidersStatus,
  fetchOnlineLegalRequests,
  hasOnlineLawyerPermission,
  isApiFailure,
  onlineLawyerErrorMessage,
  type OnlineLawyerProvidersStatus,
  type OnlineLegalRequest,
} from "../../../../lib/online-lawyer";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function AdvogadoOnlineSolicitacoesPage() {
  const org = useOrgContext();
  const canRequest = hasOnlineLawyerPermission(org.permissions, "request");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<OnlineLawyerProvidersStatus | null>(null);
  const [items, setItems] = useState<OnlineLegalRequest[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !canRequest) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [status, requests] = await Promise.all([
        fetchOnlineLawyerProvidersStatus(org.orgId!),
        fetchOnlineLegalRequests(org.orgId!, { limit: 50 }),
      ]);
      if (cancelled) return;
      if (!isApiFailure(status)) setProviders(status);
      if (isApiFailure(requests)) {
        setError(onlineLawyerErrorMessage(requests, "Não foi possível listar solicitações."));
      } else {
        setItems(requests.items);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, canRequest]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Advogado Online", href: "/app/advogado-online" },
    { label: "Solicitações" },
  ];

  if (org.ready && !canRequest) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para listar solicitações.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Solicitações"
        actions={
          <ButtonLink href="/app/advogado-online/solicitacoes/nova" variant="primary">
            Nova solicitação
          </ButtonLink>
        }
      />
      <SectionTabs
        label="Seções"
        items={ADVOGADO_ONLINE_TABS}
        current="/app/advogado-online/solicitacoes"
      />
      <OnlineLawyerProvidersBanner status={providers} />
      {loading || !org.ready ? <LoadingState label="Carregando solicitações" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length > 0 ? (
        <OnlineRequestsTable items={items} baseHref="/app/advogado-online/solicitacoes" />
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhuma solicitação">Registre a primeira solicitação.</EmptyState>
      ) : null}
    </div>
  );
}
