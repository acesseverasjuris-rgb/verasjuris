"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { ForecastVsActual, financeTabsForPermissions } from "../../../../components/finance-ui";
import {
  fetchTreasuryForecasts,
  financeErrorMessage,
  hasFinancePermission,
  isApiFailure,
  type TreasuryForecast,
} from "../../../../lib/finance";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function Page() {
  const org = useOrgContext();
  const can =
    hasFinancePermission(org.permissions, "treasury.read") ||
    hasFinancePermission(org.permissions, "forecast.manage");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TreasuryForecast[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchTreasuryForecasts(org.orgId!, { limit: 50 });
      if (cancelled) return;
      if (isApiFailure(res)) setError(financeErrorMessage(res));
      else setItems(res.items);
      if (cancelled) return;
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para forecast.</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[{ label: "Financeiro", href: "/app/financeiro" }, { label: "Forecast" }]}
      />
      <PageHeader
        title="Forecast"
        description="Projeções de caixa rotuladas FORECAST (≠ ACTUAL)."
      />
      <SectionTabs
        label="Seções"
        items={financeTabsForPermissions(org.permissions)}
        current="/app/financeiro/forecast"
      />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <ForecastVsActual forecasts={items} /> : null}
    </div>
  );
}
