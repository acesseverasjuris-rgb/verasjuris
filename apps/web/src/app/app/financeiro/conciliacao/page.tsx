"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import {
  ReconciliationRunsTable,
  ReconciliationSideBySide,
  financeTabsForPermissions,
} from "../../../../components/finance-ui";
import {
  fetchReconciliationImports,
  fetchReconciliationItems,
  fetchReconciliationRuns,
  financeErrorMessage,
  hasFinancePermission,
  isApiFailure,
  type ExternalFinancialTx,
  type ReconciliationItem,
  type ReconciliationRun,
} from "../../../../lib/finance";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function Page() {
  const org = useOrgContext();
  const can =
    hasFinancePermission(org.permissions, "reconciliation.read") ||
    hasFinancePermission(org.permissions, "reconcile") ||
    hasFinancePermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<ReconciliationRun[]>([]);
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [imports, setImports] = useState<ExternalFinancialTx[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [r, i, imp] = await Promise.all([
        fetchReconciliationRuns(org.orgId!, { limit: 20 }),
        fetchReconciliationItems(org.orgId!, { limit: 50 }),
        fetchReconciliationImports(org.orgId!, { limit: 50 }),
      ]);
      if (cancelled) return;
      if (isApiFailure(r)) setError(financeErrorMessage(r));
      else setRuns(r.items);
      if (!isApiFailure(i)) setItems(i.items);
      if (!isApiFailure(imp)) setImports(imp.items);
      if (cancelled) return;
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para conciliação.</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[{ label: "Financeiro", href: "/app/financeiro" }, { label: "Conciliação" }]}
      />
      <PageHeader
        title="Conciliação"
        description="Gateway × Ledger × Banco — fontes distintas, sem assumir identidade."
      />
      <SectionTabs
        label="Seções"
        items={financeTabsForPermissions(org.permissions)}
        current="/app/financeiro/conciliacao"
      />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        <>
          <ReconciliationSideBySide items={items} imports={imports} />
          <section className="vj-stack">
            <h2 className="vj-subtitle">Execuções</h2>
            <ReconciliationRunsTable items={runs} />
          </section>
        </>
      ) : null}
    </div>
  );
}
