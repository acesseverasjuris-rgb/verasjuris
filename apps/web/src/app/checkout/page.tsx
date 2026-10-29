"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { PaymentIntentsTable, ProviderUnavailableBanner } from "../../components/finance-ui";
import {
  fetchPaymentIntents,
  fetchPaymentProviderStatus,
  financeErrorMessage,
  hasFinancePermission,
  isApiFailure,
  type PaymentIntent,
  type ProviderHealth,
} from "../../lib/finance";
import { useOrgContext } from "../../lib/use-org-context";

export default function CheckoutIndexPage() {
  const org = useOrgContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PaymentIntent[]>([]);
  const [provider, setProvider] = useState<ProviderHealth | null>(null);

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId) {
      setLoading(false);
      setError("Selecione uma organização ativa para ver checkouts.");
      return;
    }
    if (!hasFinancePermission(org.permissions, "payment.read")) {
      setLoading(false);
      setError("Sem permissão para consultar payment intents (finance.payment.read).");
      return;
    }
    let cancelled = false;
    void (async () => {
      const [res, status] = await Promise.all([
        fetchPaymentIntents(org.orgId!, { limit: 20 }),
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
  }, [org.ready, org.orgId, org.permissions]);

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Checkout" }]} />
      <PageHeader
        title="Checkout"
        description="Abra um payment intent pelo ID. A situação do pagamento sempre vem do backend (polling)."
      />
      <ProviderUnavailableBanner status={provider} />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhum checkout">
          Nenhuma intenção de pagamento encontrada para a organização ativa.
        </EmptyState>
      ) : null}
      {!loading && !error && items.length > 0 ? <PaymentIntentsTable items={items} /> : null}
    </div>
  );
}
