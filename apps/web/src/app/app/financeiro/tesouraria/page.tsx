"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import {
  CashActualCard,
  ForecastVsActual,
  financeTabsForPermissions,
} from "../../../../components/finance-ui";
import {
  fetchCashPosition,
  fetchTreasuryForecasts,
  financeErrorMessage,
  hasFinancePermission,
  isApiFailure,
  type CashPosition,
  type TreasuryForecast,
} from "../../../../lib/finance";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function Page() {
  const org = useOrgContext();
  const can = hasFinancePermission(org.permissions, "treasury.read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cash, setCash] = useState<CashPosition | null>(null);
  const [forecasts, setForecasts] = useState<TreasuryForecast[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [c, f] = await Promise.all([
        fetchCashPosition(org.orgId!),
        fetchTreasuryForecasts(org.orgId!, { limit: 20 }),
      ]);
      if (cancelled) return;
      if (isApiFailure(c)) setError(financeErrorMessage(c));
      else setCash(c);
      if (!isApiFailure(f)) setForecasts(f.items);
      if (cancelled) return;
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para tesouraria (finance.treasury.read).</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[{ label: "Financeiro", href: "/app/financeiro" }, { label: "Tesouraria" }]}
      />
      <PageHeader
        title="Tesouraria"
        description="Caixa ACTUAL (ledger) versus FORECAST — rótulos explícitos."
      />
      <SectionTabs
        label="Seções"
        items={financeTabsForPermissions(org.permissions)}
        current="/app/financeiro/tesouraria"
      />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        <>
          {cash ? <CashActualCard cash={cash} /> : null}
          <section className="vj-stack">
            <h2 className="vj-subtitle">Forecasts</h2>
            <ForecastVsActual forecasts={forecasts} />
          </section>
        </>
      ) : null}
    </div>
  );
}
