"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  NoPermission,
  SectionTabs,
  controlTabsForPermissions,
  PRODUCT_TABS,
  GenericRecordsTable,
} from "../../../../../components/control-ui";
import {
  fetchControlTechIncidents,
  controlErrorMessage,
  hasControlPermission,
  isApiFailure,
} from "../../../../../lib/control";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function Page() {
  const org = useOrgContext();
  const can =
    hasControlPermission(org.permissions, "product.read") ||
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
      const res = await fetchControlTechIncidents(org.orgId!, { limit: 50 });
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
    return <NoPermission>Sem permissão para produto (control.product.read).</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Control", href: "/app/control" },
          { label: "Produto", href: "/app/control/produto" },
          { label: "Incidentes" },
        ]}
      />
      <PageHeader title="Incidentes de tecnologia" description="Incidentes técnicos internos." />
      <SectionTabs
        label="Control"
        items={controlTabsForPermissions(org.permissions)}
        current="/app/control/produto"
      />
      <SectionTabs label="Seções" items={PRODUCT_TABS} current="/app/control/produto/incidentes" />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        <GenericRecordsTable
          items={items as never}
          emptyTitle="Nenhum incidente"
          emptyDescription="Não há incidentes técnicos registrados."
          columns={[
            { key: "title", header: "Incidente" },
            { key: "severity", header: "Severidade" },
            { key: "status", header: "Status" },
          ]}
        />
      ) : null}
    </div>
  );
}
