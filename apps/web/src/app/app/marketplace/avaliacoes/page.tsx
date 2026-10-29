"use client";

import { Breadcrumb, PageHeader } from "@verasjuris/ui";
import { SectionTabs } from "../../../../components/ai-ui";
import { MARKETPLACE_APP_TABS } from "../../../../components/marketplace-ui";

export default function AppMarketplaceReviewsPage() {
  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[{ label: "Marketplace", href: "/app/marketplace" }, { label: "Avaliações" }]}
      />
      <PageHeader
        title="Avaliações"
        description="Avaliações são criadas após contratações concluídas (origem marketplace)."
      />
      <SectionTabs label="Seções" items={MARKETPLACE_APP_TABS} current="" />
      <p className="vj-meta">
        Moderadores podem usar permissão marketplace.review.moderate na API.
      </p>
    </div>
  );
}
