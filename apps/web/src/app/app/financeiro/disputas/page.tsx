"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import {
  DisputesTable,
  ProviderUnavailableBanner,
  financeTabsForPermissions,
} from "../../../../components/finance-ui";
import {
  fetchDisputeProviderStatus,
  fetchDisputes,
  financeErrorMessage,
  hasFinancePermission,
  isApiFailure,
  type FinancialDispute,
  type ProviderHealth,
} from "../../../../lib/finance";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function Page() {
  const org = useOrgContext();
  const can =
    hasFinancePermission(org.permissions, "dispute.read") ||
    hasFinancePermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<FinancialDispute[]>([]);
  const [provider, setProvider] = useState<ProviderHealth | null>(null);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [res, status] = await Promise.all([
        fetchDisputes(org.orgId!, { limit: 50 }),
        fetchDisputeProviderStatus(org.orgId!),
      ]);
      if (cancelled) return;
      if (isApiFailure(res)) setError(financeErrorMessage(res));
      else setItems(res.items);
      if (!isApiFailure(status)) setProvider(status.provider);
      if (cancelled) return;
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para disputas (finance.dispute.read).</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[{ label: "Financeiro", href: "/app/financeiro" }, { label: "Disputas" }]}
      />
      <PageHeader
        title="Disputas"
        description="Disputas financeiras, chargebacks, evidências e holds."
      />
      <SectionTabs
        label="Seções"
        items={financeTabsForPermissions(org.permissions)}
        current="/app/financeiro/disputas"
      />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        <>
          <ProviderUnavailableBanner status={provider} />
          <DisputesTable items={items} />
        </>
      ) : null}
    </div>
  );
}
