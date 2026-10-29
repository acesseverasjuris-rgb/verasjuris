"use client";

import { Breadcrumb, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../components/ai-ui";
import {
  MARKETPLACE_APP_TABS,
  MarketplaceEngagementsTable,
  MarketplacePaymentBanner,
  MarketplaceProposalsTable,
} from "../../../components/marketplace-ui";
import {
  fetchMarketplaceEngagements,
  fetchMarketplaceOpportunities,
  fetchMarketplacePaymentStatus,
  fetchMyMarketplaceProposals,
  hasMarketplacePermission,
  isApiFailure,
  type MarketplaceEngagement,
  type MarketplaceProposal,
  type MarketplaceRequest,
} from "../../../lib/marketplace";
import { useOrgContext } from "../../../lib/use-org-context";

export default function AppMarketplacePage() {
  const org = useOrgContext();
  const canEnter =
    hasMarketplacePermission(org.permissions, "read") ||
    hasMarketplacePermission(org.permissions, "proposal.create") ||
    hasMarketplacePermission(org.permissions, "service.manage");
  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [proposals, setProposals] = useState<MarketplaceProposal[]>([]);
  const [engagements, setEngagements] = useState<MarketplaceEngagement[]>([]);
  const [opportunities, setOpportunities] = useState<MarketplaceRequest[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !canEnter) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const tasks: Promise<void>[] = [];
      tasks.push(
        fetchMarketplacePaymentStatus(org.orgId!).then((s) => {
          if (!isApiFailure(s)) setPaymentStatus(s.payment.status);
        }),
      );
      if (hasMarketplacePermission(org.permissions, "proposal.manage")) {
        tasks.push(
          fetchMyMarketplaceProposals(org.orgId!).then((p) => {
            if (!isApiFailure(p)) setProposals(p.items.slice(0, 5));
          }),
        );
      }
      if (hasMarketplacePermission(org.permissions, "read")) {
        tasks.push(
          fetchMarketplaceEngagements(org.orgId!).then((e) => {
            if (!isApiFailure(e)) setEngagements(e.items.slice(0, 5));
          }),
        );
      }
      if (hasMarketplacePermission(org.permissions, "proposal.create")) {
        tasks.push(
          fetchMarketplaceOpportunities(org.orgId!).then((o) => {
            if (!isApiFailure(o)) setOpportunities(o.items.slice(0, 5));
          }),
        );
      }
      await Promise.all(tasks);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, canEnter, org.permissions]);

  if (org.ready && !canEnter) {
    return <NoPermission>Sem permissão para o marketplace jurídico.</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Painel", href: "/app" }, { label: "Marketplace" }]} />
      <PageHeader
        title="Marketplace jurídico"
        description="Gestão profissional de serviços e propostas."
      />
      <SectionTabs label="Seções" items={MARKETPLACE_APP_TABS} current="" />
      <MarketplacePaymentBanner status={paymentStatus} />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {!loading ? (
        <>
          {opportunities.length > 0 ? (
            <section>
              <h2 className="vj-subtitle">Oportunidades abertas ({opportunities.length})</h2>
            </section>
          ) : null}
          <section>
            <h2 className="vj-subtitle">Propostas recentes</h2>
            <MarketplaceProposalsTable items={proposals} />
          </section>
          <section>
            <h2 className="vj-subtitle">Contratações</h2>
            <MarketplaceEngagementsTable
              items={engagements}
              baseHref="/app/marketplace/contratacoes"
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
