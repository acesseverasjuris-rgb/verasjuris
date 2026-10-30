"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  BudgetsTable,
  ExpensesTable,
  FINANCE_INTERNAL_TABS,
  NoPermission,
  SectionTabs,
  controlTabsForPermissions,
} from "../../../../components/control-ui";
import {
  controlErrorMessage,
  fetchControlBudgets,
  fetchControlExpenseReports,
  hasControlPermission,
  isApiFailure,
  type ControlBudget,
  type ControlExpenseReport,
} from "../../../../lib/control";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function FinanceiroInternoPage() {
  const org = useOrgContext();
  const can =
    hasControlPermission(org.permissions, "finance.read") ||
    hasControlPermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [budgets, setBudgets] = useState<ControlBudget[]>([]);
  const [expenses, setExpenses] = useState<ControlExpenseReport[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [b, e] = await Promise.all([
        fetchControlBudgets(org.orgId!, { limit: 20 }),
        fetchControlExpenseReports(org.orgId!, { limit: 20 }),
      ]);
      if (cancelled) return;
      if (isApiFailure(b)) setError(controlErrorMessage(b));
      else setBudgets(b.items);
      if (!isApiFailure(e)) setExpenses(e.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return (
      <NoPermission>Sem permissão para financeiro interno (control.finance.read).</NoPermission>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[{ label: "Control", href: "/app/control" }, { label: "Financeiro interno" }]}
      />
      <PageHeader
        title="Financeiro interno"
        description="Orçamento e despesas internas reutilizam Ledger/Treasury — sem ledger paralelo."
      />
      <SectionTabs
        label="Control"
        items={controlTabsForPermissions(org.permissions)}
        current="/app/control/financeiro"
      />
      <SectionTabs
        label="Financeiro interno"
        items={FINANCE_INTERNAL_TABS}
        current="/app/control/financeiro"
      />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        <>
          <section className="vj-stack">
            <h2 className="vj-subtitle">Orçamentos</h2>
            <BudgetsTable items={budgets} />
          </section>
          <section className="vj-stack">
            <h2 className="vj-subtitle">Prestações recentes</h2>
            <ExpensesTable items={expenses} />
          </section>
        </>
      ) : null}
    </div>
  );
}
