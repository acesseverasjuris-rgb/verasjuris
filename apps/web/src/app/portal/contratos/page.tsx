"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { PortalAccessDenied, PortalContractsTable } from "../../../components/client-portal-ui";
import {
  fetchPortalContracts,
  isApiFailure,
  portalErrorMessage,
  type PortalContract,
} from "../../../lib/client-portal";
import { usePortalContext } from "../../../lib/use-portal-context";

export default function PortalContratosPage() {
  const portal = usePortalContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PortalContract[]>([]);

  useEffect(() => {
    if (!portal.ready || !portal.linked || !portal.orgId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const data = await fetchPortalContracts(portal.orgId!, { limit: 50 });
      if (cancelled) return;
      if (isApiFailure(data))
        setError(portalErrorMessage(data, "Não foi possível listar contratos."));
      else setItems(data.contracts);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [portal.ready, portal.linked, portal.orgId]);

  const breadcrumb = [{ label: "Portal", href: "/portal" }, { label: "Contratos" }];

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
      <PageHeader title="Contratos" description="Contratos em fase visível ao cliente." />
      {loading || !portal.ready ? <LoadingState label="Carregando contratos" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length > 0 ? <PortalContractsTable items={items} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhum contrato">Não há contratos visíveis no momento.</EmptyState>
      ) : null}
    </div>
  );
}
