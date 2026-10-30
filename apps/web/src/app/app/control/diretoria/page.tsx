"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  ApprovalsTable,
  GoalsTable,
  NoPermission,
  SectionTabs,
  controlTabsForPermissions,
} from "../../../../components/control-ui";
import {
  controlErrorMessage,
  fetchControlApprovals,
  fetchControlGoals,
  fetchControlKpis,
  hasControlPermission,
  isApiFailure,
  type ControlApproval,
  type ControlGoal,
  type ControlKpi,
} from "../../../../lib/control";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function DiretoriaPage() {
  const org = useOrgContext();
  const can = hasControlPermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [goals, setGoals] = useState<ControlGoal[]>([]);
  const [approvals, setApprovals] = useState<ControlApproval[]>([]);
  const [kpis, setKpis] = useState<ControlKpi[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [g, a, k] = await Promise.all([
        fetchControlGoals(org.orgId!, { limit: 20 }),
        fetchControlApprovals(org.orgId!, { limit: 20 }),
        fetchControlKpis(org.orgId!, { limit: 20 }),
      ]);
      if (cancelled) return;
      if (isApiFailure(g)) setError(controlErrorMessage(g));
      else setGoals(g.items);
      if (!isApiFailure(a)) setApprovals(a.items);
      if (!isApiFailure(k)) setKpis(k.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para diretoria (control.read).</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Control", href: "/app/control" }, { label: "Diretoria" }]} />
      <PageHeader title="Diretoria" description="Metas, KPIs e aprovações da operação interna." />
      <SectionTabs
        label="Control"
        items={controlTabsForPermissions(org.permissions)}
        current="/app/control/diretoria"
      />
      {loading ? <LoadingState label="Carregando diretoria…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        <>
          <section className="vj-stack">
            <h2 className="vj-subtitle">Metas</h2>
            <GoalsTable items={goals} />
          </section>
          <section className="vj-stack">
            <h2 className="vj-subtitle">KPIs</h2>
            {kpis.length === 0 ? (
              <EmptyState title="Nenhum KPI">Cadastre indicadores da diretoria.</EmptyState>
            ) : (
              <ul>
                {kpis.map((kpi) => (
                  <li key={kpi.id}>
                    {kpi.name} ({kpi.key}) — {kpi.direction}
                    {kpi.targetValue ? ` · meta ${kpi.targetValue}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="vj-stack">
            <h2 className="vj-subtitle">Aprovações</h2>
            <ApprovalsTable items={approvals} />
          </section>
        </>
      ) : null}
    </div>
  );
}
