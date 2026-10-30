"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  NoPermission,
  SectionTabs,
  controlTabsForPermissions,
  FINANCE_INTERNAL_TABS,
  GenericRecordsTable,
} from "../../../../../components/control-ui";
import {
  fetchControlInternalForecast,
  controlErrorMessage,
  hasControlPermission,
  isApiFailure,
} from "../../../../../lib/control";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function Page() {
  const org = useOrgContext();
  const can =
    hasControlPermission(org.permissions, "finance.read") ||
    hasControlPermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Array<Record<string, unknown> & { id: string }>>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchControlInternalForecast(org.orgId!, { limit: 50 });
      if (cancelled) return;
      if (isApiFailure(res)) setError(controlErrorMessage(res));
      else {
        const payload = res as { items?: Array<Record<string, unknown> & { id: string }> };
        setItems(payload.items ?? []);
      }
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
          { label: "Forecast" },
        ]}
      />
      <PageHeader
        title="Forecast interno"
        description="Projeções internas — distinct de actual do ledger."
      />
      <SectionTabs
        label="Control"
        items={controlTabsForPermissions(org.permissions)}
        current="/app/control/financeiro"
      />
      <SectionTabs
        label="Seções"
        items={FINANCE_INTERNAL_TABS}
        current="/app/control/financeiro/forecast"
      />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        <GenericRecordsTable
          items={items as never}
          emptyTitle="Nenhum forecast"
          emptyDescription="Não há forecasts internos cadastrados."
          columns={[
            { key: "name", header: "Nome" },
            { key: "scenario", header: "Cenário" },
            { key: "periodStart", header: "Início" },
            { key: "periodEnd", header: "Fim" },
          ]}
        />
      ) : null}
    </div>
  );
}
