"use client";

import {
  Breadcrumb,
  ButtonLink,
  EmptyState,
  ErrorState,
  FormField,
  LoadingState,
  PageHeader,
  Select,
} from "@verasjuris/ui";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import {
  CalculationsTable,
  CalculationReviewNotice,
  PREVIDENCIARIO_TABS,
} from "../../../../components/previdentiary-ui";
import {
  CALCULATION_STATUS_LABELS,
  CALCULATION_TYPE_LABELS,
  fetchPrevidentiaryCalculations,
  hasPrevidentiaryPermission,
  isApiFailure,
  previdentiaryErrorMessage,
  type PrevidentiaryCalculation,
} from "../../../../lib/previdentiary";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function PrevidenciarioCalculosPage() {
  const org = useOrgContext();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") ?? "";
  const canRead = hasPrevidentiaryPermission(org.permissions, "read");
  const canCalculate = hasPrevidentiaryPermission(org.permissions, "calculate");

  const [status, setStatus] = useState(initialStatus);
  const [calculationType, setCalculationType] = useState("");
  const [items, setItems] = useState<PrevidentiaryCalculation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (orgId: string, filters: { status: string; calculationType: string }) => {
      setLoading(true);
      setError(null);
      const data = await fetchPrevidentiaryCalculations(orgId, {
        status: filters.status || undefined,
        calculationType: filters.calculationType || undefined,
        limit: 50,
      });
      if (isApiFailure(data)) {
        setError(previdentiaryErrorMessage(data, "Não foi possível listar os cálculos."));
        setItems([]);
      } else {
        setItems(data.items);
        setTotal(data.total);
      }
      setLoading(false);
    },
    [],
  );

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    void load(org.orgId, { status: initialStatus, calculationType: "" });
  }, [org.ready, org.orgId, canRead, load, initialStatus]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Previdenciário", href: "/app/previdenciario" },
    { label: "Cálculos" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar cálculos previdenciários.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Cálculos previdenciários"
        description="Motores determinísticos com memória de cálculo e revisão humana obrigatória."
        actions={
          canCalculate ? (
            <ButtonLink href="/app/previdenciario/calculos/novo" variant="primary">
              Novo cálculo
            </ButtonLink>
          ) : null
        }
      />
      <SectionTabs
        label="Seções previdenciárias"
        items={PREVIDENCIARIO_TABS}
        current="/app/previdenciario/calculos"
      />
      <CalculationReviewNotice />

      <form
        className="vj-card vj-stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (org.orgId) void load(org.orgId, { status, calculationType });
        }}
      >
        <div className="vj-split">
          <FormField id="calc-status" label="Situação">
            <Select id="calc-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(CALCULATION_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="calc-type" label="Tipo">
            <Select
              id="calc-type"
              value={calculationType}
              onChange={(e) => setCalculationType(e.target.value)}
            >
              <option value="">Todos</option>
              {Object.entries(CALCULATION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <button type="submit" className="vj-button vj-button-secondary">
          Filtrar
        </button>
      </form>

      {loading || !org.ready ? <LoadingState label="Carregando cálculos" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhum cálculo">
          Crie e execute um cálculo para ver a memória.
        </EmptyState>
      ) : null}
      {!loading && items.length > 0 ? (
        <>
          <p className="vj-meta">{total} cálculo(s)</p>
          <CalculationsTable items={items} caption="Lista de cálculos previdenciários" />
        </>
      ) : null}
    </div>
  );
}
