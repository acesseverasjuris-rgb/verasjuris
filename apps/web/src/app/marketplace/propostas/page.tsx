"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../components/ai-ui";
import {
  MARKETPLACE_PUBLIC_TABS,
  MarketplaceProposalsTable,
} from "../../../components/marketplace-ui";
import {
  fetchMyMarketplaceProposals,
  hasMarketplacePermission,
  isApiFailure,
  marketplaceErrorMessage,
  type MarketplaceProposal,
} from "../../../lib/marketplace";
import { useOrgContext } from "../../../lib/use-org-context";

export default function MarketplaceProposalsPage() {
  const org = useOrgContext();
  const can = hasMarketplacePermission(org.permissions, "proposal.manage");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<MarketplaceProposal[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void fetchMyMarketplaceProposals(org.orgId).then((data) => {
      if (cancelled) return;
      if (isApiFailure(data)) setError(marketplaceErrorMessage(data));
      else setItems(data.items);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para ver propostas.</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[{ label: "Marketplace", href: "/marketplace" }, { label: "Propostas" }]}
      />
      <PageHeader title="Minhas propostas" />
      <SectionTabs label="Seções" items={MARKETPLACE_PUBLIC_TABS} current="" />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhuma proposta">Envie propostas em oportunidades abertas.</EmptyState>
      ) : null}
      {!loading && !error ? <MarketplaceProposalsTable items={items} /> : null}
    </div>
  );
}
