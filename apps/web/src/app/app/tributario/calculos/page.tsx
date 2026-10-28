"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import {
  TaxCalculationReviewBanner,
  TaxCalculationsTable,
  TRIBUTARIO_TABS,
} from "../../../../components/tax-ui";
import {
  fetchTaxCalculationsAcrossCases,
  fetchTaxCases,
  hasTaxPermission,
  isApiFailure,
  taxErrorMessage,
  type TaxCalculation,
} from "../../../../lib/tax";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function TributarioCalculosPage() {
  const org = useOrgContext();
  const canRead = hasTaxPermission(org.permissions, "read");
  const [items, setItems] = useState<TaxCalculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    const orgId = org.orgId;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      const cases = await fetchTaxCases(orgId, { limit: 40 });
      if (cancelled) return;
      if (isApiFailure(cases)) {
        setError(taxErrorMessage(cases, "Não foi possível carregar cálculos."));
        setLoading(false);
        return;
      }
      const calcs = await fetchTaxCalculationsAcrossCases(
        orgId,
        cases.items.map((c) => c.id),
        { limitPerCase: 30 },
      );
      if (cancelled) return;
      setItems(calcs.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, canRead]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Tributário", href: "/app/tributario" },
    { label: "Cálculos" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar cálculos tributários.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Cálculos tributários"
        description="Memória determinística com revisão humana obrigatória."
      />
      <SectionTabs
        label="Seções tributárias"
        items={TRIBUTARIO_TABS}
        current="/app/tributario/calculos"
      />
      <TaxCalculationReviewBanner />
      {loading || !org.ready ? <LoadingState label="Carregando cálculos" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhum cálculo">
          Crie cálculos a partir de um caso tributário.
        </EmptyState>
      ) : null}
      {!loading && items.length > 0 ? <TaxCalculationsTable items={items} /> : null}
    </div>
  );
}
