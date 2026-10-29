"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../../components/ai-ui";
import {
  ApiClientsTable,
  financeTabsForPermissions,
  monetizationTabsForPermissions,
} from "../../../../../components/finance-ui";
import {
  fetchApiClients,
  financeErrorMessage,
  hasMonetizationPermission,
  isApiFailure,
  type ApiClient,
} from "../../../../../lib/finance";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function Page() {
  const org = useOrgContext();
  const can =
    hasMonetizationPermission(org.permissions, "api.manage") ||
    hasMonetizationPermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ApiClient[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchApiClients(org.orgId!, { limit: 50 });
      if (cancelled) return;
      if (isApiFailure(res)) setError(financeErrorMessage(res));
      else setItems(res.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para apis.</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Financeiro", href: "/app/financeiro" },
          { label: "Monetização", href: "/app/financeiro/monetizacao" },
          { label: "APIs" },
        ]}
      />
      <PageHeader title="APIs" description="Clientes de API e uso faturável." />
      <SectionTabs
        label="Seções"
        items={financeTabsForPermissions(org.permissions)}
        current="/app/financeiro/monetizacao"
      />
      <SectionTabs
        label="Monetização"
        items={monetizationTabsForPermissions(org.permissions)}
        current="/app/financeiro/monetizacao/apis"
      />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <ApiClientsTable items={items} /> : null}
    </div>
  );
}
