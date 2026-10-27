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
import { LaborCasesTable, TRABALHISTA_TABS } from "../../../../components/labor-ui";
import {
  LABOR_CASE_STATUS_LABELS,
  LABOR_CLIENT_ROLE_LABELS,
  fetchLaborCases,
  hasLaborPermission,
  isApiFailure,
  laborErrorMessage,
  type LaborCase,
} from "../../../../lib/labor";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function TrabalhistaCasosPage() {
  const org = useOrgContext();
  const canRead = hasLaborPermission(org.permissions, "read");
  const canCreate = hasLaborPermission(org.permissions, "create");

  const [status, setStatus] = useState("");
  const [clientRole, setClientRole] = useState("");
  const [items, setItems] = useState<LaborCase[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (orgId: string, filters: { status: string; clientRole: string }) => {
      setLoading(true);
      setError(null);
      const data = await fetchLaborCases(orgId, {
        status: filters.status || undefined,
        clientRole: filters.clientRole || undefined,
        limit: 50,
      });
      if (isApiFailure(data)) {
        setError(laborErrorMessage(data, "Não foi possível listar os casos."));
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
    void load(org.orgId, { status: "", clientRole: "" });
  }, [org.ready, org.orgId, canRead, load]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Trabalhista", href: "/app/trabalhista" },
    { label: "Casos" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para listar casos trabalhistas.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Casos trabalhistas"
        description="Contrato, jornada, remuneração, FGTS estimado e pedidos — sem inventar saldo oficial."
        actions={
          canCreate ? (
            <ButtonLink href="/app/trabalhista/casos/novo" variant="primary">
              Novo caso
            </ButtonLink>
          ) : null
        }
      />
      <SectionTabs
        label="Seções trabalhistas"
        items={TRABALHISTA_TABS}
        current="/app/trabalhista/casos"
      />

      <form
        className="vj-card vj-stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (org.orgId) void load(org.orgId, { status, clientRole });
        }}
      >
        <div className="vj-split">
          <FormField id="lab-status" label="Situação">
            <Select id="lab-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(LABOR_CASE_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="lab-role" label="Papel do cliente">
            <Select
              id="lab-role"
              value={clientRole}
              onChange={(e) => setClientRole(e.target.value)}
            >
              <option value="">Todos</option>
              {Object.entries(LABOR_CLIENT_ROLE_LABELS).map(([value, label]) => (
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
        <EmptyState title="Nenhum caso">Crie um caso trabalhista para começar.</EmptyState>
      ) : null}
      {!loading && items.length > 0 ? (
        <>
          <p className="vj-meta">{total} caso(s)</p>
          <LaborCasesTable items={items} caption="Lista de casos trabalhistas" />
        </>
      ) : null}
    </div>
  );
}
