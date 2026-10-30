"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  AUTOMATION_TABS,
  NoPermission,
  SectionTabs,
  WorkflowRunsTable,
  controlTabsForPermissions,
} from "../../../../../components/control-ui";
import { useOrgContext } from "../../../../../lib/use-org-context";
import {
  fetchWorkflowRuns,
  hasWorkflowPermission,
  isApiFailure,
  workflowErrorMessage,
  type WorkflowRun,
} from "../../../../../lib/workflows";

export default function RunsPage() {
  const org = useOrgContext();
  const can = hasWorkflowPermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<WorkflowRun[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchWorkflowRuns(org.orgId!, { limit: 50 });
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
    return <NoPermission>Sem permissão para execuções (workflow.read).</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Control", href: "/app/control" },
          { label: "Automações", href: "/app/control/automacoes" },
          { label: "Execuções" },
        ]}
      />
      <PageHeader
        title="Execuções"
        description="Runs idempotentes — dry-run não aplica efeitos colaterais."
      />
      <SectionTabs
        label="Control"
        items={controlTabsForPermissions(org.permissions)}
        current="/app/control/automacoes"
      />
      <SectionTabs
        label="Automações"
        items={AUTOMATION_TABS}
        current="/app/control/automacoes/runs"
      />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <WorkflowRunsTable items={items} /> : null}
    </div>
  );
}
