"use client";

import { Alert, Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../../components/ai-ui";
import {
  financeTabsForPermissions,
  monetizationTabsForPermissions,
} from "../../../../../components/finance-ui";
import {
  fetchAiCreditsWallet,
  financeErrorMessage,
  hasMonetizationPermission,
  isApiFailure,
  type AiCreditWallet,
} from "../../../../../lib/finance";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function MonetizacaoIaPage() {
  const org = useOrgContext();
  const can = hasMonetizationPermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<AiCreditWallet | null>(null);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchAiCreditsWallet(org.orgId!);
      if (cancelled) return;
      if (isApiFailure(res)) setError(financeErrorMessage(res));
      else {
        const w = "wallet" in res ? res.wallet : res;
        setWallet(w);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para créditos de IA.</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Financeiro", href: "/app/financeiro" },
          { label: "Monetização", href: "/app/financeiro/monetizacao" },
          { label: "IA / créditos" },
        ]}
      />
      <PageHeader
        title="Créditos de IA"
        description="Créditos comerciais da carteira. Distintos de providerTokens nas transações."
      />
      <SectionTabs
        label="Seções"
        items={financeTabsForPermissions(org.permissions)}
        current="/app/financeiro/monetizacao"
      />
      <SectionTabs
        label="Monetização"
        items={monetizationTabsForPermissions(org.permissions)}
        current="/app/financeiro/monetizacao/ia"
      />
      <Alert tone="info" title="Créditos ≠ tokens">
        O saldo abaixo é crédito comercial. Tokens do provedor e custo em micros aparecem só no
        histórico de consumo (providerTokens / providerCostMicros), não como saldo de carteira.
      </Alert>
      {loading ? <LoadingState label="Carregando carteira…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && wallet ? (
        <section className="vj-card" aria-labelledby="ai-wallet">
          <h2 id="ai-wallet" className="vj-card-title">
            Carteira
          </h2>
          <p className="vj-title">{wallet.balanceCredits}</p>
          <p className="vj-meta">
            Unidade: {wallet.currencyLabel ?? "credit"} · id {wallet.id.slice(0, 8)}…
          </p>
        </section>
      ) : null}
    </div>
  );
}
