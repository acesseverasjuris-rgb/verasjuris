"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  AUTOMATION_TABS,
  NoPermission,
  SectionTabs,
  WorkflowTemplatesTable,
  controlTabsForPermissions,
} from "../../../../../components/control-ui";
import { useOrgContext } from "../../../../../lib/use-org-context";
import {
  fetchWorkflowTemplates,
  hasWorkflowPermission,
  isApiFailure,
  workflowErrorMessage,
  type WorkflowTemplate,
} from "../../../../../lib/workflows";

export default function TemplatesPage() {
  const org = useOrgContext();
  const can = hasWorkflowPermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<WorkflowTemplate[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchWorkflowTemplates(org.orgId!, { limit: 50 });
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
    return <NoPermission>Sem permissão para templates (workflow.read).</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Control", href: "/app/control" },
          { label: "Automações", href: "/app/control/automacoes" },
          { label: "Templates" },
        ]}
      />
      <PageHeader
        title="Templates de workflow"
        description="Modelos reutilizáveis com gatilho, condições e ações registradas."
      />
      <SectionTabs
        label="Control"
        items={controlTabsForPermissions(org.permissions)}
        current="/app/control/automacoes"
      />
      <SectionTabs
        label="Automações"
        items={AUTOMATION_TABS}
        current="/app/control/automacoes/templates"
      />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <WorkflowTemplatesTable items={items} /> : null}
    </div>
  );
}
