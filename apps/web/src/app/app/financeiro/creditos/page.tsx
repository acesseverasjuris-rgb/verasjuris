"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { CreditsTable, financeTabsForPermissions } from "../../../../components/finance-ui";
import {
  fetchBillingCredits,
  financeErrorMessage,
  hasFinancePermission,
  isApiFailure,
  type BillingCredit,
} from "../../../../lib/finance";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function CreditosPage() {
  const org = useOrgContext();
  const can = hasFinancePermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<BillingCredit[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchBillingCredits(org.orgId!, { limit: 50 });
      if (cancelled) return;
      if (isApiFailure(res)) setError(financeErrorMessage(res));
      else setItems(res.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) return <NoPermission>Sem permissão para créditos.</NoPermission>;

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[{ label: "Financeiro", href: "/app/financeiro" }, { label: "Créditos" }]}
      />
      <PageHeader title="Créditos" description="Créditos de billing disponíveis e aplicados." />
      <SectionTabs
        label="Seções"
        items={financeTabsForPermissions(org.permissions)}
        current="/app/financeiro/creditos"
      />
      {loading ? <LoadingState label="Carregando créditos…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <CreditsTable items={items} /> : null}
    </div>
  );
}
