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
  fetchMonetizationProducts,
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
      const res = await fetchMonetizationProducts(org.orgId!, { limit: 50 });
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
    return <NoPermission>Sem permissão para produtos.</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Financeiro", href: "/app/financeiro" },
          { label: "Monetização", href: "/app/financeiro/monetizacao" },
          { label: "Produtos" },
        ]}
      />
      <PageHeader title="Produtos" description="Catálogo de produtos comercializáveis." />
      <SectionTabs
        label="Seções"
        items={financeTabsForPermissions(org.permissions)}
        current="/app/financeiro/monetizacao"
      />
      <SectionTabs
        label="Monetização"
        items={monetizationTabsForPermissions(org.permissions)}
        current="/app/financeiro/monetizacao/produtos"
      />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <MonetizationProductsTable items={items} /> : null}
    </div>
  );
}
