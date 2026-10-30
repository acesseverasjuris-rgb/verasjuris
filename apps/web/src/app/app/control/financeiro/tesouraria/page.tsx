"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  FINANCE_INTERNAL_TABS,
  NoPermission,
  SectionTabs,
  controlTabsForPermissions,
} from "../../../../../components/control-ui";
import {
  controlErrorMessage,
  fetchControlInternalTreasury,
  hasControlPermission,
  isApiFailure,
} from "../../../../../lib/control";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function TesourariaInternaPage() {
  const org = useOrgContext();
  const can =
    hasControlPermission(org.permissions, "finance.read") ||
    hasControlPermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchControlInternalTreasury(org.orgId!);
      if (cancelled) return;
      if (isApiFailure(res)) setError(controlErrorMessage(res));
      else setData(res);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return (
      <NoPermission>Sem permissão para financeiro interno (control.finance.read).</NoPermission>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Control", href: "/app/control" },
          { label: "Financeiro", href: "/app/control/financeiro" },
          { label: "Tesouraria" },
        ]}
      />
      <PageHeader
        title="Tesouraria interna"
        description="Visão Control sobre Treasury — caixa actual vem do ledger, não de saldo inventado."
      />
      <SectionTabs
        label="Control"
        items={controlTabsForPermissions(org.permissions)}
        current="/app/control/financeiro"
      />
      <SectionTabs
        label="Financeiro interno"
        items={FINANCE_INTERNAL_TABS}
        current="/app/control/financeiro/tesouraria"
      />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        data ? (
          <pre className="vj-card" style={{ padding: "1rem", whiteSpace: "pre-wrap" }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        ) : (
          <EmptyState title="Sem posição de caixa">
            A API de tesouraria interna ainda não retornou dados.
          </EmptyState>
        )
      ) : null}
      <p className="vj-muted">
        Detalhe operacional de plataforma:{" "}
        <a href="/app/financeiro/tesouraria">/app/financeiro/tesouraria</a>.
      </p>
    </div>
  );
}
