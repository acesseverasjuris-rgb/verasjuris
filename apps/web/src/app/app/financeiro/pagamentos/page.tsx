"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import {
  financeTabsForPermissions,
  PaymentsTable,
  ProviderUnavailableBanner,
} from "../../../../components/finance-ui";
import {
  fetchPaymentProviderStatus,
  fetchPayments,
  financeErrorMessage,
  hasFinancePermission,
  isApiFailure,
  type PlatformPayment,
  type ProviderHealth,
} from "../../../../lib/finance";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function PagamentosPage() {
  const org = useOrgContext();
  const can = hasFinancePermission(org.permissions, "payment.read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PlatformPayment[]>([]);
  const [provider, setProvider] = useState<ProviderHealth | null>(null);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [res, status] = await Promise.all([
        fetchPayments(org.orgId!, { limit: 50 }),
        fetchPaymentProviderStatus(org.orgId!),
      ]);
      if (cancelled) return;
      if (isApiFailure(res)) setError(financeErrorMessage(res));
      else setItems(res.items);
      if (!isApiFailure(status)) setProvider(status.provider);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para pagamentos (finance.payment.read).</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[{ label: "Financeiro", href: "/app/financeiro" }, { label: "Pagamentos" }]}
      />
      <PageHeader
        title="Pagamentos"
        description="Pagamentos confirmados ou registrados. Nunca confie só no redirect do provedor."
      />
      <SectionTabs
        label="Seções"
        items={financeTabsForPermissions(org.permissions)}
        current="/app/financeiro/pagamentos"
      />
      <ProviderUnavailableBanner status={provider} />
      {loading ? <LoadingState label="Carregando pagamentos…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <PaymentsTable items={items} /> : null}
    </div>
  );
}
