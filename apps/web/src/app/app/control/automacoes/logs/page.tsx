"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  AUTOMATION_TABS,
  NoPermission,
  SectionTabs,
  controlTabsForPermissions,
} from "../../../../../components/control-ui";
import { useOrgContext } from "../../../../../lib/use-org-context";
import {
  fetchWorkflowLogs,
  formatDateTime,
  hasWorkflowPermission,
  isApiFailure,
  workflowErrorMessage,
  type WorkflowLogEntry,
} from "../../../../../lib/workflows";

export default function LogsPage() {
  const org = useOrgContext();
  const can =
    hasWorkflowPermission(org.permissions, "view_logs") ||
    hasWorkflowPermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<WorkflowLogEntry[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchWorkflowLogs(org.orgId!, { limit: 100 });
      if (cancelled) return;
      if (isApiFailure(res)) setError(workflowErrorMessage(res));
      else setItems(res.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para logs (workflow.view_logs).</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Control", href: "/app/control" },
          { label: "Automações", href: "/app/control/automacoes" },
          { label: "Logs" },
        ]}
      />
      <PageHeader
        title="Logs de workflow"
        description="Histórico operacional das execuções — sem payload sensível em claro."
      />
      <SectionTabs
        label="Control"
        items={controlTabsForPermissions(org.permissions)}
        current="/app/control/automacoes"
      />
      <SectionTabs
        label="Automações"
        items={AUTOMATION_TABS}
        current="/app/control/automacoes/logs"
      />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Sem logs">Ainda não há entradas de log neste filtro.</EmptyState>
      ) : null}
      {!loading && !error && items.length > 0 ? (
        <table className="vj-table">
          <thead>
            <tr>
              <th scope="col">Quando</th>
              <th scope="col">Nível</th>
              <th scope="col">Run</th>
              <th scope="col">Mensagem</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id}>
                <td>{formatDateTime(row.createdAt)}</td>
                <td>{row.level ?? "info"}</td>
                <td>{row.runId ? row.runId.slice(0, 8) : "—"}</td>
                <td>{row.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
