"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  ControlHubCards,
  ControlStatCards,
  NoPermission,
  SectionTabs,
  controlTabsForPermissions,
} from "../../../components/control-ui";
import {
  canAccessControlNav,
  controlErrorMessage,
  fetchControlDashboard,
  isApiFailure,
  type ControlDashboard,
} from "../../../lib/control";
import { useOrgContext } from "../../../lib/use-org-context";

export default function ControlHubPage() {
  const org = useOrgContext();
  const can = canAccessControlNav(org.permissions);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<ControlDashboard | null>(null);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchControlDashboard(org.orgId!);
      if (cancelled) return;
      if (isApiFailure(res)) {
        // Backend pode ainda não existir: hub permanece útil sem stats.
        if (res.httpStatus === 404) setDashboard(null);
        else setError(controlErrorMessage(res));
      } else setDashboard(res);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return (
      <NoPermission>
        Sem permissão para VerasJuris Control (control.read, analytics.read ou workflow.read).
      </NoPermission>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Painel", href: "/app" }, { label: "VerasJuris Control" }]} />
      <PageHeader
        title="VerasJuris Control"
        description="Operação interna da organização — distinto dos produtos oferecidos a clientes."
      />
      <SectionTabs
        label="Control"
        items={controlTabsForPermissions(org.permissions)}
        current="/app/control"
      />
      {loading ? <LoadingState label="Carregando Control…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && dashboard ? <ControlStatCards data={dashboard} /> : null}
      {!loading ? <ControlHubCards permissions={org.permissions} /> : null}
    </div>
  );
}
