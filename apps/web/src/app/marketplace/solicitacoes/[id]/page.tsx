"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  MARKETPLACE_REQUEST_STATUS_LABELS,
  fetchMarketplaceRequest,
  isApiFailure,
  marketplaceErrorMessage,
  type MarketplaceRequest,
} from "../../../../lib/marketplace";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function MarketplaceRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const org = useOrgContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<MarketplaceRequest | null>(null);

  useEffect(() => {
    if (!org.ready || !org.orgId) return;
    let cancelled = false;
    void fetchMarketplaceRequest(org.orgId, params.id).then((data) => {
      if (cancelled) return;
      if (isApiFailure(data)) setError(marketplaceErrorMessage(data));
      else setRequest(data.request);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, params.id]);

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Marketplace", href: "/marketplace" },
          { label: "Solicitações", href: "/marketplace/solicitacoes" },
          { label: request?.title ?? "Detalhe" },
        ]}
      />
      {loading ? <LoadingState label="Carregando solicitação…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {request ? (
        <>
          <PageHeader
            title={request.title}
            description={MARKETPLACE_REQUEST_STATUS_LABELS[request.status]}
          />
          <p>{request.description}</p>
        </>
      ) : null}
    </div>
  );
}
