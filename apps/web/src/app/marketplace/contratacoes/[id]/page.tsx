"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  MARKETPLACE_ENGAGEMENT_STATUS_LABELS,
  fetchMarketplaceEngagement,
  isApiFailure,
  marketplaceErrorMessage,
  type MarketplaceDelivery,
  type MarketplaceEngagement,
} from "../../../../lib/marketplace";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function MarketplaceEngagementPublicPage() {
  const params = useParams<{ id: string }>();
  const org = useOrgContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [engagement, setEngagement] = useState<MarketplaceEngagement | null>(null);
  const [deliveries, setDeliveries] = useState<MarketplaceDelivery[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId) return;
    let cancelled = false;
    void fetchMarketplaceEngagement(org.orgId, params.id).then((data) => {
      if (cancelled) return;
      if (isApiFailure(data)) setError(marketplaceErrorMessage(data));
      else {
        setEngagement(data.engagement);
        setDeliveries(data.deliveries);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, params.id]);

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Marketplace", href: "/marketplace" }, { label: "Contratação" }]} />
      {loading ? <LoadingState label="Carregando contratação…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {engagement ? (
        <>
          <PageHeader
            title={`Contratação ${engagement.id.slice(0, 8)}`}
            description={MARKETPLACE_ENGAGEMENT_STATUS_LABELS[engagement.status]}
          />
          <h2 className="vj-subtitle">Entregas</h2>
          <ul className="vj-stack">
            {deliveries.map((d) => (
              <li key={d.id} className="vj-card">
                <strong>{d.status}</strong>
                <p>{d.description}</p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
