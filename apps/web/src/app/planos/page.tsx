"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { PublicPlansComparison } from "../../components/finance-ui";
import {
  fetchPublicPlans,
  financeErrorMessage,
  isApiFailure,
  type MonetizationProduct,
} from "../../lib/finance";

export default function PublicPlanosPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<MonetizationProduct[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchPublicPlans({ limit: 50 });
      if (cancelled) return;
      if (isApiFailure(res)) setError(financeErrorMessage(res));
      else setItems(res.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="vj-page" id="conteudo">
      <div className="vj-stack">
        <Breadcrumb items={[{ label: "Início", href: "/" }, { label: "Planos" }]} />
        <PageHeader
          title="Planos"
          description="Comparação pública de planos. Features só quando realmente configuradas — sem inventar benefícios."
        />
        {loading ? <LoadingState label="Carregando planos…" /> : null}
        {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
        {!loading && !error ? <PublicPlansComparison items={items} /> : null}
      </div>
    </main>
  );
}
