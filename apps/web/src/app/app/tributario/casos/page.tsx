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
import { TaxCasesTable, TRIBUTARIO_TABS } from "../../../../components/tax-ui";
import {
  TAX_CASE_STATUS_LABELS,
  TAX_JURISDICTION_SCOPE_LABELS,
  fetchTaxCases,
  hasTaxPermission,
  isApiFailure,
  taxErrorMessage,
  type TaxCase,
} from "../../../../lib/tax";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function TributarioCasosPage() {
  const org = useOrgContext();
  const canRead = hasTaxPermission(org.permissions, "read");
  const canCreate = hasTaxPermission(org.permissions, "create");

  const [status, setStatus] = useState("");
  const [jurisdictionScope, setJurisdictionScope] = useState("");
  const [items, setItems] = useState<TaxCase[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (orgId: string, filters: { status: string; jurisdictionScope: string }) => {
      setLoading(true);
      setError(null);
      const data = await fetchTaxCases(orgId, {
        status: filters.status || undefined,
        jurisdictionScope: filters.jurisdictionScope || undefined,
        limit: 50,
      });
      if (isApiFailure(data)) {
        setError(taxErrorMessage(data, "Não foi possível listar os casos."));
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
    void load(org.orgId, { status: "", jurisdictionScope: "" });
  }, [org.ready, org.orgId, canRead, load]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Tributário", href: "/app/tributario" },
    { label: "Casos" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para listar casos tributários.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Casos tributários"
        description="Contribuinte, esfera e obrigações — cadastro manual quando provedor não configurado."
        actions={
          canCreate ? (
            <ButtonLink href="/app/tributario/casos/novo" variant="primary">
              Novo caso
            </ButtonLink>
          ) : null
        }
      />
      <SectionTabs
        label="Seções tributárias"
        items={TRIBUTARIO_TABS}
        current="/app/tributario/casos"
      />

      <form
        className="vj-card vj-stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (org.orgId) void load(org.orgId, { status, jurisdictionScope });
        }}
      >
        <div className="vj-split">
          <FormField id="tax-status" label="Situação">
            <Select id="tax-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(TAX_CASE_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="tax-scope" label="Esfera">
            <Select
              id="tax-scope"
              value={jurisdictionScope}
              onChange={(e) => setJurisdictionScope(e.target.value)}
            >
              <option value="">Todas</option>
              {Object.entries(TAX_JURISDICTION_SCOPE_LABELS).map(([value, label]) => (
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

      {loading || !org.ready ? <LoadingState label="Carregando casos" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhum caso">Crie um caso tributário para começar.</EmptyState>
      ) : null}
      {!loading && items.length > 0 ? (
        <>
          <p className="vj-meta">{total} caso(s)</p>
          <TaxCasesTable items={items} caption="Lista de casos tributários" />
        </>
      ) : null}
    </div>
  );
}
