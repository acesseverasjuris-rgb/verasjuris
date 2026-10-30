"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission } from "../../../../../components/control-ui";
import {
  canAccessOperation,
  fetchOperationQueues,
  isApiFailure,
  platformErrorMessage,
} from "../../../../../lib/platform";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function OperationQueuesPage() {
  const org = useOrgContext();
  const can = canAccessOperation(org.permissions);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queues, setQueues] = useState<
    Array<{ name: string; depth?: number | null; status: string }>
  >([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchOperationQueues(org.orgId!);
      if (cancelled) return;
      if (isApiFailure(res)) {
        if (res.httpStatus !== 404) setError(platformErrorMessage(res));
      } else setQueues(res.queues ?? []);
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
          { label: "Filas" },
        ]}
      />
      <PageHeader title="Filas" description="Profundidade e profundidade das filas de jobs." />
      {loading ? <LoadingState label="Carregando filas…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && queues.length === 0 ? (
        <EmptyState title="Nenhuma fila">Lista vazia ou endpoint NOT_CONFIGURED.</EmptyState>
      ) : null}
      {!loading && queues.length > 0 ? (
        <ul>
          {queues.map((queue) => (
            <li key={queue.name}>
              <span className="vj-status-dot" data-status={queue.status} />
              {queue.name}: {queue.status}
              {queue.depth != null ? ` · depth ${queue.depth}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
