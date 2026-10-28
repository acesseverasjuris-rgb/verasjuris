"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  fetchMarketplaceDispute,
  isApiFailure,
  marketplaceErrorMessage,
  type MarketplaceDispute,
} from "../../../../lib/marketplace";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function MarketplaceDisputePage() {
  const params = useParams<{ id: string }>();
  const org = useOrgContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dispute, setDispute] = useState<MarketplaceDispute | null>(null);

  useEffect(() => {
    if (!org.ready || !org.orgId) return;
    let cancelled = false;
    void fetchMarketplaceDispute(org.orgId, params.id).then((data) => {
      if (cancelled) return;
      if (isApiFailure(data)) setError(marketplaceErrorMessage(data));
      else setDispute(data.dispute);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, params.id]);

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Marketplace", href: "/marketplace" }, { label: "Disputa" }]} />
      {loading ? <LoadingState label="Carregando disputa…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {dispute ? (
        <>
          <PageHeader title={`Disputa — ${dispute.reasonCode}`} description={dispute.status} />
          <p>{dispute.description}</p>
          {dispute.resolution ? <p className="vj-meta">Resolução: {dispute.resolution}</p> : null}
        </>
      ) : null}
    </div>
  );
}
