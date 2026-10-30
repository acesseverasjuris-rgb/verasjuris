"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  AUTOMATION_TABS,
  NoPermission,
  SectionTabs,
  WorkflowRunsTable,
  WorkflowsTable,
  controlTabsForPermissions,
} from "../../../../components/control-ui";
import { useOrgContext } from "../../../../lib/use-org-context";
import {
  fetchWorkflowDefinitions,
  fetchWorkflowRuns,
  hasWorkflowPermission,
  isApiFailure,
  workflowErrorMessage,
  type WorkflowDefinition,
  type WorkflowRun,
} from "../../../../lib/workflows";

export default function AutomacoesPage() {
  const org = useOrgContext();
  const can =
    hasWorkflowPermission(org.permissions, "read") || org.permissions.includes("control.read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [w, r] = await Promise.all([
        fetchWorkflowDefinitions(org.orgId!, { limit: 20 }),
        fetchWorkflowRuns(org.orgId!, { limit: 20 }),
      ]);
      if (cancelled) return;
      if (isApiFailure(w)) setError(workflowErrorMessage(w));
      else setWorkflows(w.items);
      if (!isApiFailure(r)) setRuns(r.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para automações (workflow.read).</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Control", href: "/app/control" }, { label: "Automações" }]} />
      <PageHeader
        title="Automações"
        description="WorkflowEngine central — ações registradas, sem execução arbitrária de código."
      />
      <SectionTabs
        label="Control"
        items={controlTabsForPermissions(org.permissions)}
        current="/app/control/automacoes"
      />
      <SectionTabs label="Automações" items={AUTOMATION_TABS} current="/app/control/automacoes" />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        <>
          <section className="vj-stack">
            <h2 className="vj-subtitle">Workflows</h2>
            <WorkflowsTable items={workflows} />
          </section>
          <section className="vj-stack">
            <h2 className="vj-subtitle">Execuções recentes</h2>
            <WorkflowRunsTable items={runs} />
          </section>
        </>
      ) : null}
    </div>
  );
}
