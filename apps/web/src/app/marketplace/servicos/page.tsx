"use client";

import { Breadcrumb, PageHeader } from "@verasjuris/ui";
import { SectionTabs } from "../../../components/ai-ui";
import { MARKETPLACE_PUBLIC_TABS } from "../../../components/marketplace-ui";

export default function MarketplaceServicesBrowsePage() {
  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Marketplace", href: "/marketplace" }, { label: "Serviços" }]} />
      <PageHeader
        title="Catálogo de serviços"
        description="Explore categorias e perfis profissionais com serviços ativos publicados."
      />
      <SectionTabs label="Seções" items={MARKETPLACE_PUBLIC_TABS} current="" />
      <p className="vj-meta">
        Use a busca de{" "}
        <a href="/marketplace/profissionais">profissionais</a> para filtrar por categoria, UF, preço e
        verificação OAB.
      </p>
    </div>
  );
}
