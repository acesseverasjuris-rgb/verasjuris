"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  NoPermission,
  SectionTabs,
  controlTabsForPermissions,
} from "../../../../components/control-ui";
import {
  canAccessIntegrations,
  fetchIntegrations,
  isApiFailure,
  platformErrorMessage,
  type IntegrationRow,
} from "../../../../lib/platform";
import { useOrgContext } from "../../../../lib/use-org-context";

const FALLBACK_PROVIDERS: IntegrationRow[] = [
  { key: "court", type: "court", status: "NOT_CONFIGURED" },
  { key: "signature", type: "signature", status: "NOT_CONFIGURED" },
  { key: "payment", type: "payment", status: "NOT_CONFIGURED" },
  { key: "email", type: "email", status: "NOT_CONFIGURED" },
  { key: "whatsapp", type: "whatsapp", status: "NOT_CONFIGURED" },
  { key: "siem", type: "siem", status: "NOT_CONFIGURED" },
  { key: "sso", type: "sso", status: "NOT_CONFIGURED" },
  { key: "scim", type: "scim", status: "NOT_CONFIGURED" },
  { key: "translation", type: "translation", status: "NOT_CONFIGURED" },
  { key: "sign_language", type: "sign_language", status: "NOT_CONFIGURED" },
];

export default function IntegrationsPage() {
  const org = useOrgContext();
  const can = canAccessIntegrations(org.permissions);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<IntegrationRow[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchIntegrations(org.orgId!);
      if (cancelled) return;
      if (isApiFailure(res)) {
        if (res.httpStatus === 404) setRows(FALLBACK_PROVIDERS);
        else setError(platformErrorMessage(res));
      } else setRows(res.integrations?.length ? res.integrations : FALLBACK_PROVIDERS);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para integrações.</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Painel", href: "/app" },
          { label: "Control", href: "/app/control" },
          { label: "Integrações" },
        ]}
      />
      <PageHeader
        title="Integrações"
        description="Status honesto via Provider Registry. Ausente = NOT_CONFIGURED."
      />
      <SectionTabs
        label="Control"
        items={controlTabsForPermissions(org.permissions)}
        current="/app/control/integracoes"
      />
      {loading ? <LoadingState label="Carregando integrações…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState title="Sem providers">Nenhum provider registrado.</EmptyState>
      ) : null}
      {!loading && rows.length > 0 ? (
        <div className="vj-table-wrap vj-table-cards">
          <table className="vj-table">
            <caption className="vj-visually-hidden">Providers de integração</caption>
            <thead>
              <tr>
                <th scope="col">Provider</th>
                <th scope="col">Tipo</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td data-label="Provider">{row.key}</td>
                  <td data-label="Tipo">{row.type}</td>
                  <td data-label="Status">
                    <span className="vj-status-dot" data-status={row.status} />
                    <span className="vj-provider-status">{row.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
