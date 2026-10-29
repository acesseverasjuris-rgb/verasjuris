"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../../components/ai-ui";
import {
  MonetizationProductsTable,
  financeTabsForPermissions,
  monetizationTabsForPermissions,
} from "../../../../../components/finance-ui";
import {
  fetchMonetizationPlans,
  financeErrorMessage,
  hasMonetizationPermission,
  isApiFailure,
  type MonetizationProduct,
} from "../../../../../lib/finance";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function Page() {
  const org = useOrgContext();
  const can =
    hasMonetizationPermission(org.permissions, "read") ||
    hasMonetizationPermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<MonetizationProduct[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchMonetizationPlans(org.orgId!);
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
    return <NoPermission>Sem permissão para planos.</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Financeiro", href: "/app/financeiro" },
          { label: "Monetização", href: "/app/financeiro/monetizacao" },
          { label: "Planos" },
        ]}
      />
      <PageHeader
        title="Planos de monetização"
        description="Produtos do tipo assinatura (catálogo de monetização)."
      />
      <SectionTabs
        label="Seções"
        items={financeTabsForPermissions(org.permissions)}
        current="/app/financeiro/monetizacao"
      />
      <SectionTabs
        label="Monetização"
        items={monetizationTabsForPermissions(org.permissions)}
        current="/app/financeiro/monetizacao/planos"
      />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <MonetizationProductsTable items={items} /> : null}
    </div>
  );
}
