"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { financeTabsForPermissions, PlansTable } from "../../../../components/finance-ui";
import {
  fetchBillingPlans,
  financeErrorMessage,
  hasFinancePermission,
  isApiFailure,
  type BillingPlan,
} from "../../../../lib/finance";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function PlanosPage() {
  const org = useOrgContext();
  const can = hasFinancePermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<BillingPlan[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchBillingPlans(org.orgId!);
      if (cancelled) return;
      if (isApiFailure(res)) setError(financeErrorMessage(res));
      else setItems(res.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) return <NoPermission>Sem permissão para planos.</NoPermission>;

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Financeiro", href: "/app/financeiro" }, { label: "Planos" }]} />
      <PageHeader title="Planos" description="Catálogo de planos de billing da organização." />
      <SectionTabs
        label="Seções"
        items={financeTabsForPermissions(org.permissions)}
        current="/app/financeiro/planos"
      />
      {loading ? <LoadingState label="Carregando planos…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <PlansTable items={items} /> : null}
    </div>
  );
}
