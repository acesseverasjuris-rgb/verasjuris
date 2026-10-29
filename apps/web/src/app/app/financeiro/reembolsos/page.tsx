"use client";

import { Alert, Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { RefundsTable, financeTabsForPermissions } from "../../../../components/finance-ui";
import {
  fetchRefunds,
  financeErrorMessage,
  formatMoneyCents,
  hasFinancePermission,
  isApiFailure,
  type PlatformRefund,
} from "../../../../lib/finance";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function Page() {
  const org = useOrgContext();
  const can =
    hasFinancePermission(org.permissions, "refund.read") ||
    hasFinancePermission(org.permissions, "refund") ||
    hasFinancePermission(org.permissions, "payment.read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PlatformRefund[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchRefunds(org.orgId!, { limit: 50 });
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
    return <NoPermission>Sem permissão para reembolsos (finance.refund.read).</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[{ label: "Financeiro", href: "/app/financeiro" }, { label: "Reembolsos" }]}
      />
      <PageHeader
        title="Reembolsos"
        description="Valor reembolsável, tipo e histórico. Crédito comercial ≠ caixa."
      />
      <SectionTabs
        label="Seções"
        items={financeTabsForPermissions(org.permissions)}
        current="/app/financeiro/reembolsos"
      />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        <>
          <Alert tone="info" title="Crédito ≠ caixa">
            Reembolso tipo crédito gera crédito comercial; não movimenta caixa do ledger como
            reembolso integral/parcial em dinheiro. Total listado:{" "}
            {formatMoneyCents(items.reduce((s, r) => s + r.amountCents, 0))}.
          </Alert>
          <RefundsTable items={items} />
        </>
      ) : null}
    </div>
  );
}
