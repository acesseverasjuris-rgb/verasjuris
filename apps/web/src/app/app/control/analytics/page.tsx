"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  AnalyticsMetricCards,
  AnalyticsTabNav,
  ChartWithTableAlternative,
  NoPermission,
  SectionTabs,
  controlTabsForPermissions,
} from "../../../../components/control-ui";
import {
  ANALYTICS_TAB_LABELS,
  analyticsErrorMessage,
  defaultAnalyticsPeriod,
  fetchAnalyticsDashboard,
  hasAnalyticsPermission,
  isApiFailure,
  type AnalyticsDashboard,
  type AnalyticsTabKey,
} from "../../../../lib/analytics";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function AnalyticsPage() {
  const org = useOrgContext();
  const can =
    hasAnalyticsPermission(org.permissions, "read") || org.permissions.includes("control.read");
  const period = defaultAnalyticsPeriod();
  const [tab, setTab] = useState<AnalyticsTabKey>("executive");
  const [periodStart, setPeriodStart] = useState(period.periodStart.slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(period.periodEnd.slice(0, 10));
  const [product, setProduct] = useState("");
  const [area, setArea] = useState("");
  const [region, setRegion] = useState("");
  const [plan, setPlan] = useState("");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      const res = await fetchAnalyticsDashboard(org.orgId!, {
        tab,
        periodStart: new Date(`${periodStart}T00:00:00.000Z`).toISOString(),
        periodEnd: new Date(`${periodEnd}T23:59:59.999Z`).toISOString(),
        product: product || undefined,
        area: area || undefined,
        region: region || undefined,
        plan: plan || undefined,
        department: department || undefined,
      });
      if (cancelled) return;
      if (isApiFailure(res)) setError(analyticsErrorMessage(res));
      else setDashboard(res);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    org.ready,
    org.orgId,
    can,
    tab,
    periodStart,
    periodEnd,
    product,
    area,
    region,
    plan,
    department,
  ]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para Analytics (analytics.read).</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Control", href: "/app/control" }, { label: "Analytics" }]} />
      <PageHeader
        title="Analytics"
        description={`Read model agregado — ${ANALYTICS_TAB_LABELS[tab]}. Domínios-fonte permanecem a fonte de verdade.`}
      />
      <SectionTabs
        label="Control"
        items={controlTabsForPermissions(org.permissions)}
        current="/app/control/analytics"
      />
      <AnalyticsTabNav current={tab} onChange={setTab} />

      <form
        className="vj-stack"
        aria-label="Filtros de analytics"
        onSubmit={(event) => event.preventDefault()}
        style={{
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))",
        }}
      >
        <label>
          Período (início)
          <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        </label>
        <label>
          Período (fim)
          <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </label>
        <label>
          Produto
          <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Todos" />
        </label>
        <label>
          Área
          <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Todas" />
        </label>
        <label>
          Região
          <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Todas" />
        </label>
        <label>
          Plano
          <input value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="Todos" />
        </label>
        <label>
          Departamento
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="Todos"
          />
        </label>
      </form>

      {loading ? <LoadingState label="Carregando analytics…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && dashboard ? (
        <>
          <AnalyticsMetricCards metrics={dashboard.metrics ?? []} />
          {(dashboard.series ?? []).map((series) => (
            <ChartWithTableAlternative
              key={series.key}
              title={series.name}
              points={series.points}
            />
          ))}
        </>
      ) : null}
    </div>
  );
}
