"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import {
  AllocationsTable,
  SplitRulesTable,
  SplitWaterfall,
  financeTabsForPermissions,
} from "../../../../components/finance-ui";
import {
  fetchAllocations,
  fetchSplitRules,
  financeErrorMessage,
  hasFinancePermission,
  isApiFailure,
  type PaymentAllocation,
  type SplitRule,
} from "../../../../lib/finance";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function Page() {
  const org = useOrgContext();
  const can =
    hasFinancePermission(org.permissions, "split.read") ||
    hasFinancePermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rules, setRules] = useState<SplitRule[]>([]);
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [r, a] = await Promise.all([
        fetchSplitRules(org.orgId!, { limit: 50 }),
        fetchAllocations(org.orgId!, { limit: 50 }),
      ]);
      if (cancelled) return;
      if (isApiFailure(r)) setError(financeErrorMessage(r));
      else setRules(r.items);
      if (!isApiFailure(a)) setAllocations(a.items);
      else if (!isApiFailure(r)) setError(financeErrorMessage(a));
      if (cancelled) return;
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para splits (finance.split.read).</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Financeiro", href: "/app/financeiro" }, { label: "Splits" }]} />
      <PageHeader
        title="Splits"
        description="Regras e alocações: bruto → plataforma → parceiro → retenções → líquido."
      />
      <SectionTabs
        label="Seções"
        items={financeTabsForPermissions(org.permissions)}
        current="/app/financeiro/splits"
      />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        <>
          <SplitWaterfall allocations={allocations} />
          <section className="vj-stack">
            <h2 className="vj-subtitle">Regras</h2>
            <SplitRulesTable items={rules} />
          </section>
          <section className="vj-stack">
            <h2 className="vj-subtitle">Alocações</h2>
            <AllocationsTable items={allocations} />
          </section>
        </>
      ) : null}
    </div>
  );
}
