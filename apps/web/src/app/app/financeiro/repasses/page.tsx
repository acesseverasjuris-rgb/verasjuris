"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import {
  PayoutsTable,
  ProviderUnavailableBanner,
  financeTabsForPermissions,
} from "../../../../components/finance-ui";
import {
  fetchPayoutProviderStatus,
  fetchPayouts,
  financeErrorMessage,
  hasFinancePermission,
  isApiFailure,
  type Payout,
  type ProviderHealth,
} from "../../../../lib/finance";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function Page() {
  const org = useOrgContext();
  const can =
    hasFinancePermission(org.permissions, "payout.read") ||
    hasFinancePermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Payout[]>([]);
  const [provider, setProvider] = useState<ProviderHealth | null>(null);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [res, status] = await Promise.all([
        fetchPayouts(org.orgId!, { limit: 50 }),
        fetchPayoutProviderStatus(org.orgId!),
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
    return <NoPermission>Sem permissão para repasses (finance.payout.read).</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[{ label: "Financeiro", href: "/app/financeiro" }, { label: "Repasses" }]}
      />
      <PageHeader
        title="Repasses"
        description="Repasses a beneficiários. Nunca exibe Pago quando o provedor está NOT_CONFIGURED."
      />
      <SectionTabs
        label="Seções"
        items={financeTabsForPermissions(org.permissions)}
        current="/app/financeiro/repasses"
      />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        <>
          <ProviderUnavailableBanner status={provider} />
          <PayoutsTable items={items} provider={provider} />
        </>
      ) : null}
    </div>
  );
}
