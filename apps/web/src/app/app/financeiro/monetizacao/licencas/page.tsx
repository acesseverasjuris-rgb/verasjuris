"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../../components/ai-ui";
import {
  LicensesTable,
  financeTabsForPermissions,
  monetizationTabsForPermissions,
} from "../../../../../components/finance-ui";
import {
  fetchSoftwareLicenses,
  financeErrorMessage,
  hasMonetizationPermission,
  isApiFailure,
  type SoftwareLicense,
} from "../../../../../lib/finance";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function Page() {
  const org = useOrgContext();
  const can =
    hasMonetizationPermission(org.permissions, "license.manage") ||
    hasMonetizationPermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<SoftwareLicense[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchSoftwareLicenses(org.orgId!, { limit: 50 });
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
    return <NoPermission>Sem permissão para licenças.</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Financeiro", href: "/app/financeiro" },
          { label: "Monetização", href: "/app/financeiro/monetizacao" },
          { label: "Licenças" },
        ]}
      />
      <PageHeader title="Licenças" description="Licenças de software da organização." />
      <SectionTabs
        label="Seções"
        items={financeTabsForPermissions(org.permissions)}
        current="/app/financeiro/monetizacao"
      />
      <SectionTabs
        label="Monetização"
        items={monetizationTabsForPermissions(org.permissions)}
        current="/app/financeiro/monetizacao/licencas"
      />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <LicensesTable items={items} /> : null}
    </div>
  );
}
