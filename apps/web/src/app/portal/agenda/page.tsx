"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { PortalAccessDenied } from "../../../components/client-portal-ui";
import {
  fetchPortalCalendar,
  formatDateTime,
  isApiFailure,
  portalErrorMessage,
  type PortalCalendarEvent,
} from "../../../lib/client-portal";
import { usePortalContext } from "../../../lib/use-portal-context";

export default function PortalAgendaPage() {
  const portal = usePortalContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PortalCalendarEvent[]>([]);

  useEffect(() => {
    if (!portal.ready || !portal.linked || !portal.orgId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const data = await fetchPortalCalendar(portal.orgId!, { limit: 50 });
      if (cancelled) return;
      if (isApiFailure(data))
        setError(portalErrorMessage(data, "Não foi possível listar a agenda."));
      else setItems(data.events);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [portal.ready, portal.linked, portal.orgId]);

  const breadcrumb = [{ label: "Portal", href: "/portal" }, { label: "Agenda" }];

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
      <PageHeader title="Agenda" description="Compromissos visíveis nos seus casos." />
      {loading || !portal.ready ? <LoadingState label="Carregando agenda" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length > 0 ? (
        <ul className="vj-stack">
          {items.map((event) => (
            <li key={event.id} className="vj-card">
              <strong>{event.title}</strong>
              {event.startsAt ? (
                <time className="vj-meta" dateTime={event.startsAt}>
                  {formatDateTime(event.startsAt)}
                </time>
              ) : null}
              {event.locationText ? <p className="vj-meta">{event.locationText}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Agenda vazia">Não há eventos visíveis no momento.</EmptyState>
      ) : null}
    </div>
  );
}
