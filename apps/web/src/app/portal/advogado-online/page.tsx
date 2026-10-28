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
import { PortalAccessDenied } from "../../../components/client-portal-ui";
import {
  OnlineLawyerProvidersBanner,
  OnlineRequestsTable,
} from "../../../components/online-lawyer-ui";
import {
  fetchOnlineLawyerProvidersStatus,
  fetchOnlineLegalRequests,
  hasOnlineLawyerPermission,
  isApiFailure,
  onlineLawyerErrorMessage,
  type OnlineLawyerProvidersStatus,
  type OnlineLegalRequest,
} from "../../../lib/online-lawyer";
import { usePortalContext } from "../../../lib/use-portal-context";
import { useOrgContext } from "../../../lib/use-org-context";

export default function PortalAdvogadoOnlinePage() {
  const portal = usePortalContext();
  const org = useOrgContext();
  const canRequest = hasOnlineLawyerPermission(org.permissions, "request");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<OnlineLawyerProvidersStatus | null>(null);
  const [items, setItems] = useState<OnlineLegalRequest[]>([]);

  useEffect(() => {
    if (!portal.ready || !portal.linked || !portal.orgId || !canRequest) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [status, requests] = await Promise.all([
        fetchOnlineLawyerProvidersStatus(portal.orgId!),
        fetchOnlineLegalRequests(portal.orgId!, { limit: 20 }),
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
  }, [portal.ready, portal.linked, portal.orgId, canRequest]);

  const breadcrumb = [
    { label: "Portal", href: "/portal" },
    { label: "Advogado Online", href: "/portal/advogado-online" },
  ];

  if (portal.ready && !portal.linked) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <PortalAccessDenied message={portal.deniedMessage ?? undefined} />
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Advogado Online"
        description="Solicite orientação jurídica remota."
        actions={
          canRequest ? (
            <ButtonLink href="/portal/advogado-online/nova" variant="primary">
              Nova solicitação
            </ButtonLink>
          ) : null
        }
      />
      <OnlineLawyerProvidersBanner status={providers} />
      {!canRequest ? (
        <EmptyState title="Sem permissão">
          Seu perfil não pode solicitar Advogado Online nesta organização.
        </EmptyState>
      ) : null}
      {canRequest && (loading || !portal.ready) ? <LoadingState label="Carregando" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {canRequest && !loading && !error && items.length > 0 ? (
        <OnlineRequestsTable items={items} baseHref="/portal/advogado-online" />
      ) : null}
      {canRequest && !loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhuma solicitação">Crie uma nova solicitação para começar.</EmptyState>
      ) : null}
    </div>
  );
}
