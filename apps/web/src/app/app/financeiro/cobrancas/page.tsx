"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import {
  financeTabsForPermissions,
  PaymentIntentsTable,
  ProviderUnavailableBanner,
} from "../../../../components/finance-ui";
import {
  fetchPaymentIntents,
  fetchPaymentProviderStatus,
  financeErrorMessage,
  hasFinancePermission,
  isApiFailure,
  type PaymentIntent,
  type ProviderHealth,
} from "../../../../lib/finance";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function CobrancasPage() {
  const org = useOrgContext();
  const can =
    hasFinancePermission(org.permissions, "read") ||
    hasFinancePermission(org.permissions, "payment.read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PaymentIntent[]>([]);
  const [provider, setProvider] = useState<ProviderHealth | null>(null);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [res, status] = await Promise.all([
        fetchPaymentIntents(org.orgId!, { limit: 50 }),
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

  if (org.ready && !can) return <NoPermission>Sem permissão para cobranças.</NoPermission>;

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[{ label: "Financeiro", href: "/app/financeiro" }, { label: "Cobranças" }]}
      />
      <PageHeader
        title="Cobranças"
        description="Payment intents — tentativas de cobrança. Situação vem do backend, não do redirect."
      />
      <SectionTabs
        label="Seções"
        items={financeTabsForPermissions(org.permissions)}
        current="/app/financeiro/cobrancas"
      />
      <ProviderUnavailableBanner status={provider} />
      {loading ? <LoadingState label="Carregando cobranças…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <PaymentIntentsTable items={items} /> : null}
    </div>
  );
}
