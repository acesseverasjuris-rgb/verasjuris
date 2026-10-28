"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { PortalAccessDenied } from "../../../components/client-portal-ui";
import {
  fetchPortalNotifications,
  formatDateTime,
  isApiFailure,
  portalErrorMessage,
  type PortalNotification,
} from "../../../lib/client-portal";
import { usePortalContext } from "../../../lib/use-portal-context";

export default function PortalNotificacoesPage() {
  const portal = usePortalContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PortalNotification[]>([]);

  useEffect(() => {
    if (!portal.ready || !portal.linked || !portal.orgId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const data = await fetchPortalNotifications(portal.orgId!, { limit: 50 });
      if (cancelled) return;
      if (isApiFailure(data))
        setError(portalErrorMessage(data, "Não foi possível listar notificações."));
      else setItems(data.notifications);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [portal.ready, portal.linked, portal.orgId]);

  const breadcrumb = [{ label: "Portal", href: "/portal" }, { label: "Notificações" }];

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
      <PageHeader title="Notificações" description="Avisos da organização para você." />
      {loading || !portal.ready ? <LoadingState label="Carregando notificações" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length > 0 ? (
        <ul className="vj-stack" aria-label="Lista de notificações">
          {items.map((n) => (
            <li key={n.id} className="vj-card">
              <strong>{n.title}</strong>
              {n.body ? <p>{n.body}</p> : null}
              {n.createdAt ? (
                <time className="vj-meta" dateTime={n.createdAt}>
                  {formatDateTime(n.createdAt)}
                </time>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Sem notificações">Você está em dia.</EmptyState>
      ) : null}
    </div>
  );
}
