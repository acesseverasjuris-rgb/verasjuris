"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  NoPermission,
  SectionTabs,
  VENDOR_TABS,
  VendorsTable,
  controlTabsForPermissions,
} from "../../../../components/control-ui";
import {
  controlErrorMessage,
  fetchControlVendors,
  hasControlPermission,
  isApiFailure,
  type ControlVendor,
} from "../../../../lib/control";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function FornecedoresPage() {
  const org = useOrgContext();
  const can =
    hasControlPermission(org.permissions, "vendor.read") ||
    hasControlPermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ControlVendor[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchControlVendors(org.orgId!, { limit: 50 });
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
    return <NoPermission>Sem permissão para fornecedores (control.vendor.read).</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Control", href: "/app/control" }, { label: "Fornecedores" }]} />
      <PageHeader
        title="Fornecedores"
        description="Ciclo de vida: prospecto → análise → aprovação → ativo → suspensão/encerramento."
      />
      <SectionTabs
        label="Control"
        items={controlTabsForPermissions(org.permissions)}
        current="/app/control/fornecedores"
      />
      <SectionTabs label="Fornecedores" items={VENDOR_TABS} current="/app/control/fornecedores" />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <VendorsTable items={items} /> : null}
    </div>
  );
}
