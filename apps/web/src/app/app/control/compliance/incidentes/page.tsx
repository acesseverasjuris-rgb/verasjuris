"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  NoPermission,
  SectionTabs,
  controlTabsForPermissions,
  COMPLIANCE_TABS,
  GenericRecordsTable,
} from "../../../../../components/control-ui";
import {
  fetchControlComplianceIncidents,
  controlErrorMessage,
  hasControlPermission,
  isApiFailure,
} from "../../../../../lib/control";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function Page() {
  const org = useOrgContext();
  const can =
    hasControlPermission(org.permissions, "compliance.read") ||
    hasControlPermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Array<Record<string, unknown> & { id: string }>>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchControlComplianceIncidents(org.orgId!, { limit: 50 });
      if (cancelled) return;
      if (isApiFailure(res)) setError(controlErrorMessage(res));
      else {
        const payload = res as { items?: Array<Record<string, unknown> & { id: string }> };
        setItems(payload.items ?? []);
      }
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
      <Breadcrumb
        items={[
          { label: "Control", href: "/app/control" },
          { label: "Compliance", href: "/app/control/compliance" },
          { label: "Incidentes" },
        ]}
      />
      <PageHeader
        title="Incidentes de compliance"
        description="Incidentes privacy/security/fraud/etc."
      />
      <SectionTabs
        label="Control"
        items={controlTabsForPermissions(org.permissions)}
        current="/app/control/compliance"
      />
      <SectionTabs
        label="Seções"
        items={COMPLIANCE_TABS}
        current="/app/control/compliance/incidentes"
      />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        <GenericRecordsTable
          items={items as never}
          emptyTitle="Nenhum incidente"
          emptyDescription="Não há incidentes de compliance abertos."
          columns={[
            { key: "title", header: "Incidente" },
            { key: "incidentType", header: "Tipo" },
            { key: "severity", header: "Severidade" },
            { key: "status", header: "Status" },
          ]}
        />
      ) : null}
    </div>
  );
}
