"use client";

import {
  Breadcrumb,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
} from "@verasjuris/ui";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import {
  LaborCalculationReviewNotice,
  LaborCalculationsTable,
  TRABALHISTA_TABS,
} from "../../../../components/labor-ui";
import {
  fetchLaborCalculations,
  hasLaborPermission,
  isApiFailure,
  laborErrorMessage,
  type LaborCalculation,
} from "../../../../lib/labor";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function TrabalhistaCalculosPage() {
  const org = useOrgContext();
  const searchParams = useSearchParams();
  const initialCaseId = searchParams.get("laborCaseId") ?? "";
  const canRead = hasLaborPermission(org.permissions, "read");

  const [laborCaseId, setLaborCaseId] = useState(initialCaseId);
  const [items, setItems] = useState<LaborCalculation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (orgId: string, filters: { laborCaseId: string }) => {
    setLoading(true);
    setError(null);
    const data = await fetchLaborCalculations(orgId, {
      laborCaseId: filters.laborCaseId || undefined,
      limit: 50,
    });
    if (isApiFailure(data)) {
      setError(laborErrorMessage(data, "Não foi possível listar os cálculos."));
      setItems([]);
    } else {
      setItems(data.items);
      setTotal(data.total);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    void load(org.orgId, { laborCaseId: initialCaseId });
  }, [org.ready, org.orgId, canRead, load, initialCaseId]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Trabalhista", href: "/app/trabalhista" },
    { label: "Cálculos" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar cálculos trabalhistas.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Cálculos trabalhistas"
        description="Jornada, remuneração, férias, FGTS estimado, rescisão e liquidação — com revisão humana."
      />
      <SectionTabs
        label="Seções trabalhistas"
        items={TRABALHISTA_TABS}
        current="/app/trabalhista/calculos"
      />
      <LaborCalculationReviewNotice />

      <form
        className="vj-card vj-stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (org.orgId) void load(org.orgId, { laborCaseId });
        }}
      >
        <FormField id="lab-calc-case" label="Filtrar por ID do caso trabalhista">
          <Input
            id="lab-calc-case"
            value={laborCaseId}
            onChange={(e) => setLaborCaseId(e.target.value)}
            className="vj-technical"
          />
        </FormField>
        <button type="submit" className="vj-button vj-button-secondary">
          Filtrar
        </button>
      </form>

      {loading || !org.ready ? <LoadingState label="Carregando cálculos" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhum cálculo">Execute um cálculo a partir do caso.</EmptyState>
      ) : null}
      {!loading && items.length > 0 ? (
        <>
          <p className="vj-meta">{total} cálculo(s)</p>
          <LaborCalculationsTable items={items} caption="Lista de cálculos trabalhistas" />
        </>
      ) : null}
    </div>
  );
}
