"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { financeTabsForPermissions, LedgerTable } from "../../../../components/finance-ui";
import {
  fetchLedgerBalances,
  fetchLedgerTransactions,
  financeErrorMessage,
  formatMoneyCents,
  hasFinancePermission,
  isApiFailure,
  type LedgerTransaction,
} from "../../../../lib/finance";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function LedgerPage() {
  const org = useOrgContext();
  const can = hasFinancePermission(org.permissions, "ledger.read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<LedgerTransaction[]>([]);
  const [cashLabel, setCashLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [tx, bal] = await Promise.all([
        fetchLedgerTransactions(org.orgId!, { limit: 50 }),
        fetchLedgerBalances(org.orgId!),
      ]);
      if (cancelled) return;
      if (isApiFailure(tx)) setError(financeErrorMessage(tx));
      else setItems(tx.items);
      if (!isApiFailure(bal)) {
        const rows = bal.balances ?? bal.accounts ?? [];
        const cash = rows.find(
          (b) =>
            b.systemKey === "CASH_CLEARING" ||
            b.code === "CASH_CLEARING" ||
            b.name?.toLowerCase().includes("cash"),
        );
        if (cash) setCashLabel(formatMoneyCents(cash.balanceCents));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para o ledger (finance.ledger.read).</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Financeiro", href: "/app/financeiro" }, { label: "Ledger" }]} />
      <PageHeader
        title="Ledger"
        description="Visão imutável: transação, débito, crédito, conta, origem, data e estorno. Saldo derivado dos lançamentos."
      />
      <SectionTabs
        label="Seções"
        items={financeTabsForPermissions(org.permissions)}
        current="/app/financeiro/ledger"
      />
      {cashLabel ? (
        <p className="vj-meta">
          Saldo CASH_CLEARING (referência): <strong>{cashLabel}</strong>
        </p>
      ) : null}
      {loading ? <LoadingState label="Carregando ledger…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <LedgerTable items={items} /> : null}
    </div>
  );
}
