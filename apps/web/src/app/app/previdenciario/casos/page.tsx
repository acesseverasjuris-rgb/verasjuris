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
import { useCallback, useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import {
  PREVIDENCIARIO_TABS,
  PrevidentiaryCasesTable,
} from "../../../../components/previdentiary-ui";
import {
  PREVIDENTIARY_REGIME_LABELS,
  fetchPrevidentiaryCases,
  hasPrevidentiaryPermission,
  isApiFailure,
  previdentiaryErrorMessage,
  type PrevidentiaryCase,
} from "../../../../lib/previdentiary";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function PrevidenciarioCasosPage() {
  const org = useOrgContext();
  const canRead = hasPrevidentiaryPermission(org.permissions, "read");
  const canCreate = hasPrevidentiaryPermission(org.permissions, "create");

  const [regime, setRegime] = useState("");
  const [items, setItems] = useState<PrevidentiaryCase[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (orgId: string, filters: { regime: string }) => {
    setLoading(true);
    setError(null);
    const data = await fetchPrevidentiaryCases(orgId, {
      regime: filters.regime || undefined,
      limit: 50,
      maskSensitive: true,
    });
    if (isApiFailure(data)) {
      setError(previdentiaryErrorMessage(data, "Não foi possível listar os casos."));
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
    void load(org.orgId, { regime: "" });
  }, [org.ready, org.orgId, canRead, load]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Previdenciário", href: "/app/previdenciario" },
    { label: "Casos" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para listar casos previdenciários.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Casos previdenciários"
        description="Cadastro interno de casos. Benefícios e protocolos não afirmam existência oficial no INSS."
        actions={
          canCreate ? (
            <ButtonLink href="/app/previdenciario/casos/novo" variant="primary">
              Novo caso
            </ButtonLink>
          ) : null
        }
      />
      <SectionTabs
        label="Seções previdenciárias"
        items={PREVIDENCIARIO_TABS}
        current="/app/previdenciario/casos"
      />

      <form
        className="vj-card vj-stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (org.orgId) void load(org.orgId, { regime });
        }}
      >
        <FormField id="prev-regime" label="Regime">
          <Select id="prev-regime" value={regime} onChange={(e) => setRegime(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(PREVIDENTIARY_REGIME_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
        <button type="submit" className="vj-button vj-button-secondary">
          Filtrar
        </button>
      </form>

      {loading || !org.ready ? <LoadingState label="Carregando casos" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhum caso">Crie um caso previdenciário para começar.</EmptyState>
      ) : null}
      {!loading && items.length > 0 ? (
        <>
          <p className="vj-meta">{total} caso(s)</p>
          <PrevidentiaryCasesTable items={items} caption="Lista de casos previdenciários" />
        </>
      ) : null}
    </div>
  );
}
