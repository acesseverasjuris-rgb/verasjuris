"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  NoPermission,
  SectionTabs,
  controlTabsForPermissions,
  VENDOR_TABS,
  GenericRecordsTable,
} from "../../../../../components/control-ui";
import {
  fetchControlVendorContracts,
  controlErrorMessage,
  hasControlPermission,
  isApiFailure,
} from "../../../../../lib/control";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function Page() {
  const org = useOrgContext();
  const can =
    hasControlPermission(org.permissions, "vendor.read") ||
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
      const res = await fetchControlVendorContracts(org.orgId!, { limit: 50 });
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
    return <NoPermission>Sem permissão para fornecedores (control.vendor.read).</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Control", href: "/app/control" },
          { label: "Fornecedores", href: "/app/control/fornecedores" },
          { label: "Contratos" },
        ]}
      />
      <PageHeader
        title="Contratos de fornecedores"
        description="Contratos vinculados a vendors (via CLM)."
      />
      <SectionTabs
        label="Control"
        items={controlTabsForPermissions(org.permissions)}
        current="/app/control/fornecedores"
      />
      <SectionTabs
        label="Seções"
        items={VENDOR_TABS}
        current="/app/control/fornecedores/contratos"
      />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        <GenericRecordsTable
          items={items as never}
          emptyTitle="Nenhum contrato"
          emptyDescription="Contratos de fornecedores aparecerão aqui."
          columns={[
            { key: "title", header: "Contrato" },
            { key: "vendorId", header: "Fornecedor" },
            { key: "status", header: "Status" },
          ]}
        />
      ) : null}
    </div>
  );
}
