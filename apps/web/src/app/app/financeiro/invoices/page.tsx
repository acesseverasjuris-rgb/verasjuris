"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { financeTabsForPermissions, InvoicesTable } from "../../../../components/finance-ui";
import {
  fetchBillingInvoices,
  financeErrorMessage,
  hasFinancePermission,
  isApiFailure,
  type BillingInvoice,
} from "../../../../lib/finance";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function InvoicesPage() {
  const org = useOrgContext();
  const can = hasFinancePermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<BillingInvoice[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchBillingInvoices(org.orgId!, { limit: 50 });
      if (cancelled) return;
      if (isApiFailure(res)) setError(financeErrorMessage(res));
      else setItems(res.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) return <NoPermission>Sem permissão para faturas.</NoPermission>;

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[{ label: "Financeiro", href: "/app/financeiro" }, { label: "Faturas" }]}
      />
      <PageHeader title="Faturas" description="Invoices — volume contratado, não caixa." />
      <SectionTabs
        label="Seções"
        items={financeTabsForPermissions(org.permissions)}
        current="/app/financeiro/invoices"
      />
      {loading ? <LoadingState label="Carregando faturas…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <InvoicesTable items={items} /> : null}
    </div>
  );
}
