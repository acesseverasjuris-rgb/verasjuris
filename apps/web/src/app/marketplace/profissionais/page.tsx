"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { SectionTabs } from "../../../components/ai-ui";
import {
  MARKETPLACE_PUBLIC_TABS,
  MarketplaceProfessionalsGrid,
} from "../../../components/marketplace-ui";
import {
  fetchMarketplaceProfessionals,
  isApiFailure,
  marketplaceErrorMessage,
  type MarketplaceProfessional,
} from "../../../lib/marketplace";

export default function MarketplaceProfessionalsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<MarketplaceProfessional[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetchMarketplaceProfessionals({ limit: 50 }).then((data) => {
      if (cancelled) return;
      if (isApiFailure(data)) setError(marketplaceErrorMessage(data));
      else setItems(data.items);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Marketplace", href: "/marketplace" }, { label: "Profissionais" }]} />
      <PageHeader title="Profissionais" description="Busca ranqueada de advogados no marketplace." />
      <SectionTabs label="Seções" items={MARKETPLACE_PUBLIC_TABS} current="" />
      {loading ? <LoadingState label="Carregando profissionais…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhum profissional">Ajuste filtros ou volte mais tarde.</EmptyState>
      ) : null}
      {!loading && !error ? <MarketplaceProfessionalsGrid items={items} /> : null}
    </div>
  );
}
