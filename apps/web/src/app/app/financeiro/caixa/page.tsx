"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { CashActualCard, financeTabsForPermissions } from "../../../../components/finance-ui";
import {
  fetchCashPosition,
  financeErrorMessage,
  hasFinancePermission,
  isApiFailure,
  type CashPosition,
} from "../../../../lib/finance";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function Page() {
  const org = useOrgContext();
  const can = hasFinancePermission(org.permissions, "treasury.read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cash, setCash] = useState<CashPosition | null>(null);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchCashPosition(org.orgId!);
      if (cancelled) return;
      if (isApiFailure(res)) setError(financeErrorMessage(res));
      else setCash(res);
      if (cancelled) return;
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para caixa.</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Financeiro", href: "/app/financeiro" }, { label: "Caixa" }]} />
      <PageHeader
        title="Caixa"
        description="Posição de caixa ACTUAL derivada do ledger CASH_CLEARING."
      />
      <SectionTabs
        label="Seções"
        items={financeTabsForPermissions(org.permissions)}
        current="/app/financeiro/caixa"
      />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? cash ? <CashActualCard cash={cash} /> : null : null}
    </div>
  );
}
