"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AUTOMATION_TABS,
  NoPermission,
  SectionTabs,
  WorkflowBuilderPanels,
  controlTabsForPermissions,
} from "../../../../../../components/control-ui";
import { useOrgContext } from "../../../../../../lib/use-org-context";
import {
  WORKFLOW_STATUS_LABELS,
  fetchWorkflowDefinition,
  hasWorkflowPermission,
  isApiFailure,
  runWorkflow,
  workflowErrorMessage,
  type WorkflowDefinition,
} from "../../../../../../lib/workflows";

export default function WorkflowBuilderPage() {
  const org = useOrgContext();
  const params = useParams<{ id: string }>();
  const workflowId = params?.id;
  const can = hasWorkflowPermission(org.permissions, "read");
  const canRun = hasWorkflowPermission(org.permissions, "run");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can || !workflowId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchWorkflowDefinition(org.orgId!, workflowId);
      if (cancelled) return;
      if (isApiFailure(res)) setError(workflowErrorMessage(res));
      else setWorkflow(res.workflow);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can, workflowId]);

  async function handleDryRun() {
    if (!org.orgId || !workflowId || !canRun) return;
    setBusy(true);
    setActionMessage(null);
    const res = await runWorkflow(org.orgId, workflowId, { dryRun: true });
    setBusy(false);
    if (isApiFailure(res)) setActionMessage(workflowErrorMessage(res));
    else setActionMessage(`Simulação enfileirada (run ${res.run.id.slice(0, 8)}).`);
  }

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para workflows (workflow.read).</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Control", href: "/app/control" },
          { label: "Automações", href: "/app/control/automacoes" },
          { label: "Workflows", href: "/app/control/automacoes/workflows" },
          { label: workflow?.name ?? "Builder" },
        ]}
      />
      <PageHeader
        title={workflow?.name ?? "Builder de workflow"}
        description="QUANDO / SE / ENTÃO / APROVAÇÃO / EM FALHA — DSL segura, ações registradas."
      />
      <SectionTabs
        label="Control"
        items={controlTabsForPermissions(org.permissions)}
        current="/app/control/automacoes"
      />
      <SectionTabs
        label="Automações"
        items={AUTOMATION_TABS}
        current="/app/control/automacoes/workflows"
      />
      {loading ? <LoadingState label="Carregando workflow…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && !workflow ? (
        <EmptyState title="Workflow não encontrado">Verifique o identificador.</EmptyState>
      ) : null}
      {!loading && !error && workflow ? (
        <>
          <p className="vj-muted">
            Status: {WORKFLOW_STATUS_LABELS[workflow.status] ?? workflow.status} · chave{" "}
            <code>{workflow.key}</code>
          </p>
          <WorkflowBuilderPanels workflow={workflow} />
          <div className="vj-inline-actions">
            <button
              type="button"
              className="vj-button vj-button-secondary"
              disabled={!canRun || busy}
              onClick={() => void handleDryRun()}
            >
              Simular (dry-run)
            </button>
          </div>
          {actionMessage ? <p role="status">{actionMessage}</p> : null}
        </>
      ) : null}
    </div>
  );
}
