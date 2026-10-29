"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { FinancePayablesTable, financeTabsForPermissions } from "../../../../components/finance-ui";
import {
  fetchFinancePayables,
  financeErrorMessage,
  hasFinancePermission,
  isApiFailure,
  type FinancePayable,
} from "../../../../lib/finance";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function Page() {
  const org = useOrgContext();
  const can =
    hasFinancePermission(org.permissions, "payout.read") ||
    hasFinancePermission(org.permissions, "split.read") ||
    hasFinancePermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<FinancePayable[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchFinancePayables(org.orgId!, { limit: 50 });
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
    return <NoPermission>Sem permissão para beneficiários.</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[{ label: "Financeiro", href: "/app/financeiro" }, { label: "Beneficiários" }]}
      />
      <PageHeader
        title="Beneficiários"
        description="Payables por beneficiário — payable antes do repasse."
      />
      <SectionTabs
        label="Seções"
        items={financeTabsForPermissions(org.permissions)}
        current="/app/financeiro/beneficiarios"
      />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <FinancePayablesTable items={items} /> : null}
    </div>
  );
}
