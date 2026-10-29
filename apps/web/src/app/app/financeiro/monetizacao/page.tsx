"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import {
  MonetizationDashboardCards,
  financeTabsForPermissions,
  monetizationTabsForPermissions,
} from "../../../../components/finance-ui";
import {
  fetchMonetizationDashboard,
  financeErrorMessage,
  hasMonetizationPermission,
  isApiFailure,
  type MonetizationDashboard,
} from "../../../../lib/finance";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function MonetizacaoPage() {
  const org = useOrgContext();
  const can = hasMonetizationPermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MonetizationDashboard | null>(null);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchMonetizationDashboard(org.orgId!);
      if (cancelled) return;
      if (isApiFailure(res)) setError(financeErrorMessage(res));
      else setData(res);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para monetização (monetization.read).</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[{ label: "Financeiro", href: "/app/financeiro" }, { label: "Monetização" }]}
      />
      <PageHeader
        title="Monetização"
        description="MRR/ARR com fórmula documentada. Créditos de IA são comerciais — distintos de tokens."
      />
      <SectionTabs
        label="Seções"
        items={financeTabsForPermissions(org.permissions)}
        current="/app/financeiro/monetizacao"
      />
      <SectionTabs
        label="Monetização"
        items={monetizationTabsForPermissions(org.permissions)}
        current="/app/financeiro/monetizacao"
      />
      {loading ? <LoadingState label="Carregando monetização…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && data ? <MonetizationDashboardCards data={data} /> : null}
    </div>
  );
}
