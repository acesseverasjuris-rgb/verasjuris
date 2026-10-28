"use client";

import { Breadcrumb, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import {
  MARKETPLACE_APP_TABS,
  MarketplaceEngagementsTable,
} from "../../../../components/marketplace-ui";
import {
  fetchMarketplaceEngagements,
  hasMarketplacePermission,
  isApiFailure,
  marketplaceErrorMessage,
  type MarketplaceEngagement,
} from "../../../../lib/marketplace";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function AppMarketplaceEngagementsPage() {
  const org = useOrgContext();
  const can = hasMarketplacePermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MarketplaceEngagement[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    void fetchMarketplaceEngagements(org.orgId).then((data) => {
      if (isApiFailure(data)) setError(marketplaceErrorMessage(data));
      else setItems(data.items);
      setLoading(false);
    });
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) return <NoPermission>Sem permissão.</NoPermission>;

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Marketplace", href: "/app/marketplace" }, { label: "Contratações" }]} />
      <PageHeader title="Contratações" />
      <SectionTabs label="Seções" items={MARKETPLACE_APP_TABS} current="" />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!loading ? (
        <MarketplaceEngagementsTable items={items} baseHref="/app/marketplace/contratacoes" />
      ) : null}
    </div>
  );
}
