"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/control-ui";
import {
  canAccessEnterprise,
  fetchEnterpriseOverview,
  isApiFailure,
  platformErrorMessage,
  type EnterpriseOverview,
} from "../../../../lib/platform";
import { useOrgContext } from "../../../../lib/use-org-context";

const TABS = [
  { href: "/app/configuracoes/enterprise", label: "Visão geral" },
  { href: "/app/configuracoes/enterprise/sso", label: "SSO" },
  { href: "/app/configuracoes/enterprise/scim", label: "SCIM" },
  { href: "/app/configuracoes/enterprise/dominio", label: "Domínio" },
  { href: "/app/configuracoes/enterprise/branding", label: "Branding" },
  { href: "/app/configuracoes/enterprise/politicas", label: "Políticas" },
  { href: "/app/configuracoes/enterprise/api", label: "API" },
  { href: "/app/configuracoes/enterprise/sla", label: "SLA" },
];

export default function EnterprisePage() {
  const org = useOrgContext();
  const can = canAccessEnterprise(org.permissions);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EnterpriseOverview | null>(null);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchEnterpriseOverview(org.orgId!);
      if (cancelled) return;
      if (isApiFailure(res)) {
        if (res.httpStatus === 404) {
          setData({
            sso: { status: "NOT_CONFIGURED" },
            scim: { status: "NOT_CONFIGURED" },
            branding: { status: "NOT_CONFIGURED" },
            domains: [],
            policies: 0,
            apiCredentials: 0,
            slas: [],
          });
        } else setError(platformErrorMessage(res));
      } else setData(res);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão enterprise.</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Painel", href: "/app" },
          { label: "Configurações" },
          { label: "Enterprise" },
        ]}
      />
      <PageHeader
        title="Enterprise"
        description="SSO, SCIM, domínio, branding, políticas, API e SLA — sem providers fake."
      />
      <SectionTabs label="Enterprise" items={TABS} current="/app/configuracoes/enterprise" />
      {loading ? <LoadingState label="Carregando enterprise…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && data ? (
        <div className="vj-split vj-metrics">
          <div className="vj-card">
            <h2 className="vj-section-title">SSO</h2>
            <p className="vj-provider-status">{data.sso?.status ?? "NOT_CONFIGURED"}</p>
          </div>
          <div className="vj-card">
            <h2 className="vj-section-title">SCIM</h2>
            <p className="vj-provider-status">{data.scim?.status ?? "NOT_CONFIGURED"}</p>
          </div>
          <div className="vj-card">
            <h2 className="vj-section-title">Branding</h2>
            <p>{data.branding?.status ?? "NOT_CONFIGURED"}</p>
          </div>
          <div className="vj-card">
            <h2 className="vj-section-title">Credenciais API</h2>
            <p>{data.apiCredentials ?? 0}</p>
          </div>
        </div>
      ) : null}
      {!loading && !data ? (
        <EmptyState title="Sem dados">API enterprise ainda não publicada.</EmptyState>
      ) : null}
    </div>
  );
}
