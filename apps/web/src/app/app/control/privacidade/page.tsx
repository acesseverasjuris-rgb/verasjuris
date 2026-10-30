"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  NoPermission,
  SectionTabs,
  controlTabsForPermissions,
} from "../../../../components/control-ui";
import {
  canAccessPrivacy,
  fetchPrivacyOverview,
  isApiFailure,
  platformErrorMessage,
  type PrivacyOverview,
} from "../../../../lib/platform";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function PrivacyControlPage() {
  const org = useOrgContext();
  const can = canAccessPrivacy(org.permissions);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PrivacyOverview | null>(null);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchPrivacyOverview(org.orgId!);
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
    return <NoPermission>Sem permissão para privacidade (privacy.read).</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Painel", href: "/app" },
          { label: "Control", href: "/app/control" },
          { label: "Privacidade" },
        ]}
      />
      <PageHeader
        title="Privacidade e LGPD"
        description="Consentimentos, inventário, retenção, DSR e DPO — sem inventar conformidade."
      />
      <SectionTabs
        label="Control"
        items={controlTabsForPermissions(org.permissions)}
        current="/app/control/privacidade"
      />
      {loading ? <LoadingState label="Carregando privacidade…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        <div className="vj-metrics vj-split">
          <div className="vj-card">
            <h2 className="vj-section-title">Consentimentos</h2>
            <p>{data?.consents ?? "—"}</p>
          </div>
          <div className="vj-card">
            <h2 className="vj-section-title">DSRs abertos</h2>
            <p>{data?.openDsrs ?? "—"}</p>
          </div>
          <div className="vj-card">
            <h2 className="vj-section-title">Ativos de dados</h2>
            <p>{data?.dataAssets ?? "—"}</p>
          </div>
          <div className="vj-card">
            <h2 className="vj-section-title">Operadores</h2>
            <p>{data?.processors ?? "—"}</p>
          </div>
          <div className="vj-card">
            <h2 className="vj-section-title">Incidentes</h2>
            <p>{data?.incidents ?? "—"}</p>
          </div>
          <div className="vj-card">
            <h2 className="vj-section-title">DPO</h2>
            <p>{data?.dpoConfigured ? "Configurado" : "Não configurado"}</p>
          </div>
        </div>
      ) : null}
      {!loading && !data?.consents && !data?.openDsrs ? (
        <EmptyState title="Painel aguardando API">
          Endpoints /organizations/:id/privacy podem retornar 404 até o backend publicar.
        </EmptyState>
      ) : null}
    </div>
  );
}
