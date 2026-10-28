"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import {
  MARKETPLACE_APP_TABS,
  MarketplaceRequestsTable,
} from "../../../../components/marketplace-ui";
import {
  fetchMarketplaceOpportunities,
  hasMarketplacePermission,
  isApiFailure,
  marketplaceErrorMessage,
  type MarketplaceRequest,
} from "../../../../lib/marketplace";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function AppMarketplaceOpportunitiesPage() {
  const org = useOrgContext();
  const can = hasMarketplacePermission(org.permissions, "proposal.create");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<MarketplaceRequest[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    void fetchMarketplaceOpportunities(org.orgId).then((data) => {
      if (isApiFailure(data)) setError(marketplaceErrorMessage(data));
      else setItems(data.items);
      setLoading(false);
    });
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) return <NoPermission>Sem permissão para ver oportunidades.</NoPermission>;

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Marketplace", href: "/app/marketplace" }, { label: "Oportunidades" }]} />
      <PageHeader title="Oportunidades" description="Solicitações abertas para envio de proposta." />
      <SectionTabs label="Seções" items={MARKETPLACE_APP_TABS} current="" />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhuma oportunidade">Não há solicitações abertas no momento.</EmptyState>
      ) : null}
      {!loading && !error ? (
        <MarketplaceRequestsTable items={items} baseHref="/marketplace/solicitacoes" />
      ) : null}
    </div>
  );
}
