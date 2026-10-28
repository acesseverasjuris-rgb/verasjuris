"use client";

import { Breadcrumb, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import {
  MARKETPLACE_APP_TABS,
  MarketplaceProposalsTable,
} from "../../../../components/marketplace-ui";
import {
  fetchMyMarketplaceProposals,
  hasMarketplacePermission,
  isApiFailure,
  marketplaceErrorMessage,
  type MarketplaceProposal,
} from "../../../../lib/marketplace";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function AppMarketplaceProposalsPage() {
  const org = useOrgContext();
  const can = hasMarketplacePermission(org.permissions, "proposal.manage");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MarketplaceProposal[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    void fetchMyMarketplaceProposals(org.orgId).then((data) => {
      if (isApiFailure(data)) setError(marketplaceErrorMessage(data));
      else setItems(data.items);
      setLoading(false);
    });
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) return <NoPermission>Sem permissão.</NoPermission>;

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Marketplace", href: "/app/marketplace" }, { label: "Propostas" }]} />
      <PageHeader title="Propostas enviadas" />
      <SectionTabs label="Seções" items={MARKETPLACE_APP_TABS} current="" />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!loading ? <MarketplaceProposalsTable items={items} /> : null}
    </div>
  );
}
