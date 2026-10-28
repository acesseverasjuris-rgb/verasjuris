"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { PortalAccessDenied, PortalDashboardCards } from "../../components/client-portal-ui";
import { fetchPortalCases, isApiFailure, portalErrorMessage } from "../../lib/client-portal";
import { usePortalContext } from "../../lib/use-portal-context";

export default function PortalDashboardPage() {
  const portal = usePortalContext();
  const [error, setError] = useState<string | null>(null);
  const [recentCount, setRecentCount] = useState(0);

  useEffect(() => {
    if (!portal.ready || !portal.linked || !portal.orgId) return;
    let cancelled = false;
    void (async () => {
      const cases = await fetchPortalCases(portal.orgId!, { limit: 1 });
      if (cancelled) return;
      if (isApiFailure(cases)) {
        setError(portalErrorMessage(cases, "Não foi possível carregar o painel."));
      } else {
        setRecentCount(cases.total);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [portal.ready, portal.linked, portal.orgId]);

  const breadcrumb = [{ label: "Portal", href: "/portal" }, { label: "Painel" }];

  if (portal.ready && !portal.linked) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <PortalAccessDenied message={portal.deniedMessage ?? undefined} />
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Portal do Cliente"
        description="Acompanhe casos, documentos, mensagens e pagamentos do escritório."
      />
      {!portal.ready ? <LoadingState label="Carregando portal" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {portal.dashboard ? <PortalDashboardCards counts={portal.dashboard} /> : null}
      {portal.ready && portal.linked && recentCount === 0 && !error ? (
        <EmptyState title="Sem casos visíveis">
          Quando houver casos vinculados, eles aparecerão aqui.
        </EmptyState>
      ) : null}
    </div>
  );
}
