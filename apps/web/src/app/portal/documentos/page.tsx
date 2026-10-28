"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { PortalAccessDenied, PortalDocumentsList } from "../../../components/client-portal-ui";
import {
  fetchPortalDocuments,
  isApiFailure,
  portalErrorMessage,
  type PortalDocument,
} from "../../../lib/client-portal";
import { usePortalContext } from "../../../lib/use-portal-context";

export default function PortalDocumentosPage() {
  const portal = usePortalContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PortalDocument[]>([]);

  useEffect(() => {
    if (!portal.ready || !portal.linked || !portal.orgId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const data = await fetchPortalDocuments(portal.orgId!, { limit: 50 });
      if (cancelled) return;
      if (isApiFailure(data))
        setError(portalErrorMessage(data, "Não foi possível listar documentos."));
      else setItems(data.documents);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [portal.ready, portal.linked, portal.orgId]);

  const breadcrumb = [{ label: "Portal", href: "/portal" }, { label: "Documentos" }];

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
        title="Documentos"
        description="Arquivos compartilhados com você pelo escritório."
      />
      {loading || !portal.ready ? <LoadingState label="Carregando documentos" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length > 0 ? <PortalDocumentsList items={items} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhum documento">Não há documentos visíveis no momento.</EmptyState>
      ) : null}
    </div>
  );
}
