"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission } from "../../../../../components/control-ui";
import {
  canAccessOperation,
  fetchOperationJobs,
  isApiFailure,
  platformErrorMessage,
} from "../../../../../lib/platform";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function OperationJobsPage() {
  const org = useOrgContext();
  const can = canAccessOperation(org.permissions);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<
    Array<{ name: string; status: string; lastRunAt?: string | null }>
  >([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchOperationJobs(org.orgId!);
      if (cancelled) return;
      if (isApiFailure(res)) {
        if (res.httpStatus !== 404) setError(platformErrorMessage(res));
      } else setJobs(res.jobs ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) return <NoPermission>Sem permissão.</NoPermission>;

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Control", href: "/app/control" },
          { label: "Operação", href: "/app/control/operacao" },
          { label: "Jobs" },
        ]}
      />
      <PageHeader title="Jobs" description="Execuções de workers e rotinas." />
      {loading ? <LoadingState label="Carregando jobs…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && jobs.length === 0 ? (
        <EmptyState title="Nenhum job">Lista vazia ou endpoint NOT_CONFIGURED.</EmptyState>
      ) : null}
      {!loading && jobs.length > 0 ? (
        <div className="vj-table-wrap vj-table-cards">
          <table className="vj-table">
            <caption className="vj-visually-hidden">Jobs</caption>
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">Status</th>
                <th scope="col">Última execução</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.name}>
                  <td data-label="Nome">{job.name}</td>
                  <td data-label="Status">{job.status}</td>
                  <td data-label="Última execução">
                    {job.lastRunAt ? new Date(job.lastRunAt).toLocaleString("pt-BR") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
