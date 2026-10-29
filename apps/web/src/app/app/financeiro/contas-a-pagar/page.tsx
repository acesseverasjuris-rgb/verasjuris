"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { AccountsPayableTable, financeTabsForPermissions } from "../../../../components/finance-ui";
import {
  fetchTreasuryPayables,
  financeErrorMessage,
  hasFinancePermission,
  isApiFailure,
  type TreasuryAccountsPayable,
} from "../../../../lib/finance";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function Page() {
  const org = useOrgContext();
  const can =
    hasFinancePermission(org.permissions, "treasury.read") ||
    hasFinancePermission(org.permissions, "accounts_payable.manage");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TreasuryAccountsPayable[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchTreasuryPayables(org.orgId!, { limit: 50 });
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
    return <NoPermission>Sem permissão para contas a pagar.</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[{ label: "Financeiro", href: "/app/financeiro" }, { label: "Contas a pagar" }]}
      />
      <PageHeader title="Contas a pagar" description="Obrigações da tesouraria (AP operacional)." />
      <SectionTabs
        label="Seções"
        items={financeTabsForPermissions(org.permissions)}
        current="/app/financeiro/contas-a-pagar"
      />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <AccountsPayableTable items={items} /> : null}
    </div>
  );
}
