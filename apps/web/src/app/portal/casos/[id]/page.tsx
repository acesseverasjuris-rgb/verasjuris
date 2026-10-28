"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PortalAccessDenied } from "../../../../components/client-portal-ui";
import {
  fetchPortalCase,
  fetchPortalCaseProcesses,
  formatDateTime,
  isApiFailure,
  portalErrorMessage,
} from "../../../../lib/client-portal";
import { usePortalContext } from "../../../../lib/use-portal-context";

export default function PortalCasoDetailPage() {
  const params = useParams<{ id: string }>();
  const portal = usePortalContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [timeline, setTimeline] = useState<
    Array<{ id: string; title?: string; body?: string | null; occurredAt?: string | null }>
  >([]);
  const [processes, setProcesses] = useState<{
    judicial: unknown[];
    administrative: unknown[];
  } | null>(null);

  useEffect(() => {
    if (!portal.ready || !portal.linked || !portal.orgId || !params.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [detail, procs] = await Promise.all([
        fetchPortalCase(portal.orgId!, params.id),
        fetchPortalCaseProcesses(portal.orgId!, params.id),
      ]);
      if (cancelled) return;
      if (isApiFailure(detail)) {
        setError(portalErrorMessage(detail, "Não foi possível carregar o caso."));
      } else {
        setTitle(detail.case.title);
        setTimeline(detail.timeline);
      }
      if (!isApiFailure(procs)) setProcesses(procs);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [portal.ready, portal.linked, portal.orgId, params.id]);

  const breadcrumb = [
    { label: "Portal", href: "/portal" },
    { label: "Casos", href: "/portal/casos" },
    { label: title || "Caso" },
  ];

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
        title={title || "Caso"}
        description="Linha do tempo visível e processos não sigilosos."
      />
      {loading ? <LoadingState label="Carregando caso" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        <>
          <section aria-labelledby="timeline-heading">
            <h2 id="timeline-heading" className="vj-section-title">
              Linha do tempo
            </h2>
            <ol className="vj-stack">
              {timeline.map((event) => (
                <li key={event.id} className="vj-card">
                  <strong>{event.title ?? "Evento"}</strong>
                  {event.occurredAt ? (
                    <time className="vj-meta" dateTime={event.occurredAt}>
                      {formatDateTime(event.occurredAt)}
                    </time>
                  ) : null}
                  {event.body ? <p>{event.body}</p> : null}
                </li>
              ))}
            </ol>
          </section>
          {processes ? (
            <section aria-labelledby="processos-heading">
              <h2 id="processos-heading" className="vj-section-title">
                Processos
              </h2>
              <p className="vj-meta">
                Judiciais: {processes.judicial.length} · Administrativos:{" "}
                {processes.administrative.length}
              </p>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
