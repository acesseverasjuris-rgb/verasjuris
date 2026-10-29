"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { FeesTable, financeTabsForPermissions } from "../../../../components/finance-ui";
import {
  fetchPlatformFeeRules,
  financeErrorMessage,
  hasFinancePermission,
  isApiFailure,
  type PlatformFeeRule,
} from "../../../../lib/finance";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function TaxasPage() {
  const org = useOrgContext();
  const can =
    hasFinancePermission(org.permissions, "read") ||
    hasFinancePermission(org.permissions, "fee.manage");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PlatformFeeRule[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchPlatformFeeRules(org.orgId!);
      if (cancelled) return;
      if (isApiFailure(res)) setError(financeErrorMessage(res));
      else setItems(res.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) return <NoPermission>Sem permissão para taxas.</NoPermission>;

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Financeiro", href: "/app/financeiro" }, { label: "Taxas" }]} />
      <PageHeader
        title="Taxas da plataforma"
        description="Regras de taxa (BPS) por base de negócio."
      />
      <SectionTabs
        label="Seções"
        items={financeTabsForPermissions(org.permissions)}
        current="/app/financeiro/taxas"
      />
      {loading ? <LoadingState label="Carregando taxas…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <FeesTable items={items} /> : null}
    </div>
  );
}
