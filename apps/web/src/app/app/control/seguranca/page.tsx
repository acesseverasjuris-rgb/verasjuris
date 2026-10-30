"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  NoPermission,
  SectionTabs,
  controlTabsForPermissions,
} from "../../../../components/control-ui";
import {
  canAccessSecurityAdmin,
  fetchSecurityDashboard,
  isApiFailure,
  platformErrorMessage,
  type SecurityDashboard,
} from "../../../../lib/platform";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function ControlSecurityPage() {
  const org = useOrgContext();
  const can = canAccessSecurityAdmin(org.permissions);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SecurityDashboard | null>(null);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchSecurityDashboard(org.orgId!);
      if (cancelled) return;
      if (isApiFailure(res)) {
        if (res.httpStatus === 404) setData({});
        else setError(platformErrorMessage(res));
      } else setData(res);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return (
      <NoPermission>Sem permissão para segurança (security.read / security.admin).</NoPermission>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Painel", href: "/app" },
          { label: "Control", href: "/app/control" },
          { label: "Segurança" },
        ]}
      />
      <PageHeader
        title="Segurança (Control)"
        description="Adoção MFA, sessões, eventos, vulnerabilidades, alertas e pentest."
      />
      <SectionTabs
        label="Control"
        items={controlTabsForPermissions(org.permissions)}
        current="/app/control/seguranca"
      />
      {loading ? <LoadingState label="Carregando dashboard de segurança…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        <div className="vj-metrics vj-split">
          <div className="vj-card">
            <h2 className="vj-section-title">MFA</h2>
            <p>{data?.mfaAdoptionPercent != null ? `${data.mfaAdoptionPercent}%` : "—"}</p>
          </div>
          <div className="vj-card">
            <h2 className="vj-section-title">Sessões ativas</h2>
            <p>{data?.activeSessions ?? "—"}</p>
          </div>
          <div className="vj-card">
            <h2 className="vj-section-title">Alertas abertos</h2>
            <p>{data?.openAlerts ?? "—"}</p>
          </div>
          <div className="vj-card">
            <h2 className="vj-section-title">Vulnerabilidades</h2>
            <p>{data?.openVulnerabilities ?? "—"}</p>
          </div>
          <div className="vj-card">
            <h2 className="vj-section-title">Pentest</h2>
            <p>{data?.pentestStatus ?? "NÃO HOMOLOGADO / sem relatório"}</p>
          </div>
        </div>
      ) : null}
      {!loading && data?.providers?.length ? (
        <section className="vj-card">
          <h2 className="vj-section-title">Providers de segurança</h2>
          <ul>
            {data.providers.map((p) => (
              <li key={p.key}>
                <span className="vj-status-dot" data-status={p.status} />
                {p.key}: <span className="vj-provider-status">{p.status}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : !loading ? (
        <EmptyState title="Sem métricas detalhadas">
          Backend /organizations/:id/security ainda pode estar NOT_CONFIGURED.
        </EmptyState>
      ) : null}
    </div>
  );
}
