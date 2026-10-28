"use client";

import { Breadcrumb, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { SectionTabs } from "../../components/ai-ui";
import {
  MARKETPLACE_PUBLIC_TABS,
  MarketplacePaymentBanner,
  MarketplaceProfessionalsGrid,
  MarketplaceRequestsTable,
} from "../../components/marketplace-ui";
import {
  fetchMarketplaceCategories,
  fetchMarketplacePaymentStatus,
  fetchMarketplaceProfessionals,
  fetchMarketplaceRequests,
  getActiveOrgId,
  hasMarketplacePermission,
  isApiFailure,
  marketplaceErrorMessage,
  type MarketplaceProfessional,
  type MarketplaceRequest,
} from "../../lib/marketplace";
import { useOrgContext } from "../../lib/use-org-context";

export default function MarketplaceHomePage() {
  const org = useOrgContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [professionals, setProfessionals] = useState<MarketplaceProfessional[]>([]);
  const [requests, setRequests] = useState<MarketplaceRequest[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!org.ready) return;
      const orgId = org.orgId ?? (await getActiveOrgId());
      if (!orgId) {
        setLoading(false);
        return;
      }
      const [professionalsRes, requestsRes, payment] = await Promise.all([
        fetchMarketplaceProfessionals({ limit: 6 }),
        hasMarketplacePermission(org.permissions, "read")
          ? fetchMarketplaceRequests(orgId, { limit: 6 })
          : Promise.resolve({ items: [] as MarketplaceRequest[] }),
        fetchMarketplacePaymentStatus(orgId),
      ]);
      if (cancelled) return;
      if (isApiFailure(professionalsRes)) setError(marketplaceErrorMessage(professionalsRes));
      else {
        setProfessionals(professionalsRes.items);
        if (!isApiFailure(requestsRes)) setRequests(requestsRes.items);
      }
      if (!isApiFailure(payment)) setPaymentStatus(payment.payment.status);
      await fetchMarketplaceCategories(orgId);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, org.permissions]);

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Marketplace jurídico" }]} />
      <PageHeader
        title="Marketplace jurídico"
        description="Contrate serviços jurídicos especializados com propostas, entregas e avaliações."
      />
      <SectionTabs label="Seções" items={MARKETPLACE_PUBLIC_TABS} current="" />
      <MarketplacePaymentBanner status={paymentStatus} />
      {loading ? <LoadingState label="Carregando marketplace…" /> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!loading && !error ? (
        <>
          <section className="vj-stack">
            <h2 className="vj-subtitle">Profissionais em destaque</h2>
            <MarketplaceProfessionalsGrid items={professionals} />
          </section>
          <section className="vj-stack">
            <h2 className="vj-subtitle">Solicitações recentes</h2>
            <MarketplaceRequestsTable items={requests} />
          </section>
        </>
      ) : null}
    </div>
  );
}
