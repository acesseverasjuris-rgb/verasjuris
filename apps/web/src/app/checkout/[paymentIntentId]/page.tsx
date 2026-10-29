"use client";

import { Alert, Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  CheckoutSummary,
  CONFIRMED_PAYMENT_STATUSES,
  ProviderUnavailableBanner,
  StatusTextBadge,
} from "../../../components/finance-ui";
import {
  PAYMENT_INTENT_STATUS_LABELS,
  fetchBillingInvoices,
  fetchPaymentIntent,
  fetchPaymentProviderStatus,
  financeErrorMessage,
  isApiFailure,
  isProviderUnavailable,
  type BillingInvoice,
  type PaymentIntent,
  type ProviderHealth,
} from "../../../lib/finance";
import { useOrgContext } from "../../../lib/use-org-context";

const POLL_MS = 3000;

function CheckoutDetailInner() {
  const { paymentIntentId } = useParams<{ paymentIntentId: string }>();
  const search = useSearchParams();
  const redirected = search.get("redirect_status") ?? search.get("status");
  const org = useOrgContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [invoice, setInvoice] = useState<BillingInvoice | null>(null);
  const [provider, setProvider] = useState<ProviderHealth | null>(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (!paymentIntentId || !org.ready) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load(isPoll: boolean) {
      if (!isPoll) setLoading(true);
      else setPolling(true);
      const [intentRes, providerRes] = await Promise.all([
        fetchPaymentIntent(paymentIntentId, org.orgId ?? undefined),
        org.orgId ? fetchPaymentProviderStatus(org.orgId) : fetchPaymentProviderStatus(),
      ]);
      if (cancelled) return;
      if (isApiFailure(intentRes)) {
        if (intentRes.httpStatus === 404) setNotFound(true);
        else setError(financeErrorMessage(intentRes));
        setLoading(false);
        setPolling(false);
        return;
      }
      setIntent(intentRes.paymentIntent);
      if (!isApiFailure(providerRes)) setProvider(providerRes.provider);

      if (intentRes.paymentIntent.invoiceId && org.orgId) {
        const invoices = await fetchBillingInvoices(org.orgId, { limit: 50 });
        if (!cancelled && !isApiFailure(invoices)) {
          setInvoice(
            invoices.items.find((i) => i.id === intentRes.paymentIntent.invoiceId) ?? null,
          );
        }
      }

      setLoading(false);
      setPolling(false);

      const status = intentRes.paymentIntent.status;
      const terminal = ["confirmed", "failed", "cancelled", "expired", "not_configured"].includes(
        status,
      );
      if (!terminal) {
        timer = setTimeout(() => void load(true), POLL_MS);
      }
    }

    void load(false);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [paymentIntentId, org.ready, org.orgId]);

  if (notFound) {
    return (
      <ErrorState title="Checkout não encontrado">
        Não encontramos esta intenção de pagamento.
      </ErrorState>
    );
  }

  const confirmed = intent ? CONFIRMED_PAYMENT_STATUSES.has(intent.status) : false;
  const unavailable = isProviderUnavailable(provider) || intent?.status === "not_configured";

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Checkout", href: "/checkout" },
          { label: paymentIntentId?.slice(0, 8) ?? "…" },
        ]}
      />
      <PageHeader
        title="Checkout"
        description="A confirmação depende do status no backend. Redirect do provedor sozinho não fecha o pagamento."
      />
      <ProviderUnavailableBanner status={provider ?? intent?.status} />
      {unavailable ? (
        <Alert tone="warning" title="Pagamento indisponível">
          Provedor NOT_CONFIGURED. Nenhum pagamento foi aprovado. Use registro manual com
          comprovante quando aplicável.
        </Alert>
      ) : null}
      {redirected && !confirmed ? (
        <Alert tone="warning" title="Aguardando confirmação">
          Você voltou do provedor ({redirected}). Ainda não tratamos como pago — consultando o
          status no servidor…
          {polling ? " (atualizando…)" : null}
        </Alert>
      ) : null}
      {confirmed ? (
        <Alert tone="success" title="Pagamento confirmado">
          Status confirmado pelo backend:{" "}
          <StatusTextBadge status={intent!.status} labels={PAYMENT_INTENT_STATUS_LABELS} />
        </Alert>
      ) : null}
      {loading ? <LoadingState label="Carregando checkout…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {intent && !loading ? <CheckoutSummary intent={intent} invoice={invoice} /> : null}
      {intent && !confirmed && !unavailable && !loading ? (
        <p className="vj-meta" aria-live="polite">
          {polling
            ? "Consultando status no servidor…"
            : `Situação atual: ${PAYMENT_INTENT_STATUS_LABELS[intent.status] ?? intent.status}`}
        </p>
      ) : null}
    </div>
  );
}

export default function CheckoutDetailPage() {
  return (
    <Suspense fallback={<LoadingState label="Carregando checkout…" />}>
      <CheckoutDetailInner />
    </Suspense>
  );
}
