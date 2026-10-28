"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { PortalAccessDenied, PortalCasesTable } from "../../../components/client-portal-ui";
import {
  fetchPortalCases,
  isApiFailure,
  portalErrorMessage,
  type PortalMatterSummary,
} from "../../../lib/client-portal";
import { usePortalContext } from "../../../lib/use-portal-context";

export default function PortalCasosPage() {
  const portal = usePortalContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PortalMatterSummary[]>([]);

  useEffect(() => {
    if (!portal.ready || !portal.linked || !portal.orgId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const data = await fetchPortalCases(portal.orgId!, { limit: 50 });
      if (cancelled) return;
      if (isApiFailure(data)) setError(portalErrorMessage(data, "Não foi possível listar casos."));
      else setItems(data.cases);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [portal.ready, portal.linked, portal.orgId]);

  const breadcrumb = [{ label: "Portal", href: "/portal" }, { label: "Casos" }];

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
      <PageHeader title="Casos" description="Casos jurídicos vinculados ao seu cadastro." />
      {loading || !portal.ready ? <LoadingState label="Carregando casos" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length > 0 ? <PortalCasesTable items={items} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhum caso">Ainda não há casos visíveis para você.</EmptyState>
      ) : null}
    </div>
  );
}
