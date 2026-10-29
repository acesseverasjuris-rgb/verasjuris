"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { financeTabsForPermissions, SubscriptionsTable } from "../../../../components/finance-ui";
import {
  fetchBillingSubscriptions,
  financeErrorMessage,
  hasFinancePermission,
  isApiFailure,
  type BillingSubscription,
} from "../../../../lib/finance";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function AssinaturasPage() {
  const org = useOrgContext();
  const can = hasFinancePermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<BillingSubscription[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchBillingSubscriptions(org.orgId!, { limit: 50 });
      if (cancelled) return;
      if (isApiFailure(res)) setError(financeErrorMessage(res));
      else setItems(res.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) return <NoPermission>Sem permissão para assinaturas.</NoPermission>;

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[{ label: "Financeiro", href: "/app/financeiro" }, { label: "Assinaturas" }]}
      />
      <PageHeader title="Assinaturas" description="Assinaturas da organização." />
      <SectionTabs
        label="Seções"
        items={financeTabsForPermissions(org.permissions)}
        current="/app/financeiro/assinaturas"
      />
      {loading ? <LoadingState label="Carregando assinaturas…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <SubscriptionsTable items={items} /> : null}
    </div>
  );
}
