"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { CostsTable, financeTabsForPermissions } from "../../../../components/finance-ui";
import {
  fetchCosts,
  financeErrorMessage,
  hasFinancePermission,
  isApiFailure,
  type CostRecord,
} from "../../../../lib/finance";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function CustosPage() {
  const org = useOrgContext();
  const can =
    hasFinancePermission(org.permissions, "read") ||
    hasFinancePermission(org.permissions, "cost.manage");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CostRecord[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchCosts(org.orgId!, { limit: 50 });
      if (cancelled) return;
      if (isApiFailure(res)) setError(financeErrorMessage(res));
      else setItems(res.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) return <NoPermission>Sem permissão para custos.</NoPermission>;

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Financeiro", href: "/app/financeiro" }, { label: "Custos" }]} />
      <PageHeader title="Custos" description="Custos operacionais registrados." />
      <SectionTabs
        label="Seções"
        items={financeTabsForPermissions(org.permissions)}
        current="/app/financeiro/custos"
      />
      {loading ? <LoadingState label="Carregando custos…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <CostsTable items={items} /> : null}
    </div>
  );
}
