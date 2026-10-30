"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  NoPermission,
  SectionTabs,
  controlTabsForPermissions,
} from "../../../../components/control-ui";
import {
  canAccessOperation,
  fetchOperationJobs,
  fetchOperationOverview,
  fetchOperationQueues,
  isApiFailure,
  platformErrorMessage,
  type OperationOverview,
} from "../../../../lib/platform";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function OperationPage() {
  const org = useOrgContext();
  const can = canAccessOperation(org.permissions);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OperationOverview | null>(null);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [overview, jobs, queues] = await Promise.all([
        fetchOperationOverview(org.orgId!),
        fetchOperationJobs(org.orgId!),
        fetchOperationQueues(org.orgId!),
      ]);
      if (cancelled) return;
      const merged: OperationOverview = {};
      if (!isApiFailure(overview)) Object.assign(merged, overview);
      else if (overview.httpStatus !== 404) {
        setError(platformErrorMessage(overview));
        setLoading(false);
        return;
      }
      if (!isApiFailure(jobs)) merged.jobs = jobs.jobs;
      if (!isApiFailure(queues)) merged.queues = queues.queues;
      setData(merged);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para operação/observabilidade.</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Painel", href: "/app" },
          { label: "Control", href: "/app/control" },
          { label: "Operação" },
        ]}
      />
      <PageHeader
        title="Operação"
        description="Health, jobs, filas e SLOs. Status público em /status."
      />
      <SectionTabs
        label="Control"
        items={controlTabsForPermissions(org.permissions)}
        current="/app/control/operacao"
      />
      <p className="vj-meta">
        <a href="/app/control/operacao/jobs">Jobs</a> ·{" "}
        <a href="/app/control/operacao/queues">Filas</a> · <a href="/status">Status público</a>
      </p>
      {loading ? <LoadingState label="Carregando operação…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        <>
          <div className="vj-card">
            <h2 className="vj-section-title">Health</h2>
            <p>
              <span className="vj-status-dot" data-status={data?.health ?? "unknown"} />
              {data?.health ?? "unknown"}
            </p>
          </div>
          <section className="vj-card">
            <h2 className="vj-section-title">Jobs</h2>
            {data?.jobs?.length ? (
              <ul>
                {data.jobs.map((job) => (
                  <li key={job.name}>
                    {job.name}: {job.status}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Sem jobs">API /operation/jobs ausente ou vazia.</EmptyState>
            )}
          </section>
          <section className="vj-card">
            <h2 className="vj-section-title">Filas</h2>
            {data?.queues?.length ? (
              <ul>
                {data.queues.map((queue) => (
                  <li key={queue.name}>
                    {queue.name}: {queue.status}
                    {queue.depth != null ? ` (depth ${queue.depth})` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Sem filas">API /operation/queues ausente ou vazia.</EmptyState>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
