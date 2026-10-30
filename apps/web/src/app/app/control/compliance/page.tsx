"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  COMPLIANCE_TABS,
  NoPermission,
  RisksTable,
  SectionTabs,
  controlTabsForPermissions,
} from "../../../../components/control-ui";
import {
  controlErrorMessage,
  fetchControlRisks,
  hasControlPermission,
  isApiFailure,
  type ControlRisk,
} from "../../../../lib/control";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function CompliancePage() {
  const org = useOrgContext();
  const can =
    hasControlPermission(org.permissions, "compliance.read") ||
    hasControlPermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ControlRisk[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchControlRisks(org.orgId!, { limit: 20 });
      if (cancelled) return;
      if (isApiFailure(res)) setError(controlErrorMessage(res));
      else setItems(res.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para compliance (control.compliance.read).</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Control", href: "/app/control" }, { label: "Compliance" }]} />
      <PageHeader
        title="Compliance"
        description="Modelo risco → controle → teste → incidente → auditoria → obrigação."
      />
      <SectionTabs
        label="Control"
        items={controlTabsForPermissions(org.permissions)}
        current="/app/control/compliance"
      />
      <SectionTabs label="Compliance" items={COMPLIANCE_TABS} current="/app/control/compliance" />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <RisksTable items={items} /> : null}
    </div>
  );
}
