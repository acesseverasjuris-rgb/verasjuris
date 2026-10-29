"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../components/ai-ui";
import {
  MARKETPLACE_PUBLIC_TABS,
  MarketplaceRequestsTable,
} from "../../../components/marketplace-ui";
import {
  fetchMarketplaceRequests,
  hasMarketplacePermission,
  isApiFailure,
  marketplaceErrorMessage,
  type MarketplaceRequest,
} from "../../../lib/marketplace";
import { useOrgContext } from "../../../lib/use-org-context";

export default function MarketplaceRequestsPage() {
  const org = useOrgContext();
  const canRead = hasMarketplacePermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<MarketplaceRequest[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void fetchMarketplaceRequests(org.orgId).then((data) => {
      if (cancelled) return;
      if (isApiFailure(data)) setError(marketplaceErrorMessage(data));
      else setItems(data.items);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, canRead]);

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb
          items={[{ label: "Marketplace", href: "/marketplace" }, { label: "Solicitações" }]}
        />
        <NoPermission>Você não tem permissão para ver solicitações do marketplace.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[{ label: "Marketplace", href: "/marketplace" }, { label: "Solicitações" }]}
      />
      <PageHeader
        title="Solicitações"
        description="Demandas publicadas pela sua organização."
        actions={
          hasMarketplacePermission(org.permissions, "request.create") ? (
            <a className="vj-button vj-button-primary" href="/marketplace/solicitacoes/nova">
              Nova solicitação
            </a>
          ) : undefined
        }
      />
      <SectionTabs label="Seções" items={MARKETPLACE_PUBLIC_TABS} current="" />
      {loading ? <LoadingState label="Carregando solicitações…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Sem solicitações">Crie a primeira demanda no marketplace.</EmptyState>
      ) : null}
      {!loading && !error ? <MarketplaceRequestsTable items={items} /> : null}
    </div>
  );
}
