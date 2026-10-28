"use client";

import {
  Alert,
  Breadcrumb,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { PortalAccessDenied, PortalPaymentsTable } from "../../../components/client-portal-ui";
import {
  fetchPortalPayments,
  isApiFailure,
  portalErrorMessage,
  type PortalPayment,
} from "../../../lib/client-portal";
import { usePortalContext } from "../../../lib/use-portal-context";

export default function PortalPagamentosPage() {
  const portal = usePortalContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PortalPayment[]>([]);

  useEffect(() => {
    if (!portal.ready || !portal.linked || !portal.orgId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const data = await fetchPortalPayments(portal.orgId!, { limit: 50 });
      if (cancelled) return;
      if (isApiFailure(data))
        setError(portalErrorMessage(data, "Não foi possível listar pagamentos."));
      else setItems(data.payments);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [portal.ready, portal.linked, portal.orgId]);

  const breadcrumb = [{ label: "Portal", href: "/portal" }, { label: "Pagamentos" }];

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
        title="Pagamentos"
        description="Cobranças e comprovantes registrados pelo escritório."
      />
      <Alert tone="info" title="Pagamento online">
        Não simulamos pagamento bem-sucedido quando o provedor não está configurado. Use os canais
        indicados pelo escritório.
      </Alert>
      {loading || !portal.ready ? <LoadingState label="Carregando pagamentos" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length > 0 ? <PortalPaymentsTable items={items} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhum pagamento">Não há cobranças visíveis no momento.</EmptyState>
      ) : null}
    </div>
  );
}
