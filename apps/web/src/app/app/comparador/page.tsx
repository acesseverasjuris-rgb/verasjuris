"use client";

import {
  Alert,
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
import {
  AssistedNotice,
  NoPermission,
  NotConfiguredNotice,
  SectionTabs,
} from "../../../components/ai-ui";
import { COMPARADOR_TABS, ComparisonListTable } from "../../../components/comparison-ui";
import { aiErrorMessage, isNotConfigured } from "../../../lib/ai";
import {
  LEGAL_COMPARISON_STATUS_LABELS,
  LEGAL_COMPARISON_TYPE_LABELS,
  fetchLegalComparisons,
  hasLegalComparisonPermission,
  isApiFailure,
  type LegalComparisonSummary,
} from "../../../lib/legal-comparisons";
import { useOrgContext } from "../../../lib/use-org-context";

export default function ComparadorListPage() {
  const org = useOrgContext();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") ?? "";
  const canRead = hasLegalComparisonPermission(org.permissions, "read");
  const canCreate = hasLegalComparisonPermission(org.permissions, "create");

  const [status, setStatus] = useState(initialStatus);
  const [comparisonType, setComparisonType] = useState("");
  const [items, setItems] = useState<LegalComparisonSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const load = useCallback(
    async (orgId: string, filters: { status: string; comparisonType: string }) => {
      setLoading(true);
      setError(null);
      setNotConfigured(false);
      const data = await fetchLegalComparisons(orgId, {
        status: filters.status || undefined,
        comparisonType: filters.comparisonType || undefined,
        limit: 50,
      });
      if (isApiFailure(data)) {
        if (isNotConfigured(data)) setNotConfigured(true);
        else setError(aiErrorMessage(data, "Não foi possível listar as comparações."));
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
    void load(org.orgId, { status: initialStatus, comparisonType: "" });
  }, [org.ready, org.orgId, canRead, load, initialStatus]);

  const breadcrumb = [{ label: "Painel", href: "/app" }, { label: "Comparador" }];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar comparações.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Comparador de peças"
        description="Compare documentos lado a lado. Achados da IA exigem revisão humana antes de qualquer decisão."
        actions={
          canCreate ? (
            <ButtonLink href="/app/comparador/novo" variant="primary">
              Nova comparação
            </ButtonLink>
          ) : null
        }
      />
      <SectionTabs label="Seções do comparador" items={COMPARADOR_TABS} current="/app/comparador" />
      <AssistedNotice />
      {notConfigured ? <NotConfiguredNotice /> : null}

      <form
        className="vj-card vj-stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (org.orgId) void load(org.orgId, { status, comparisonType });
        }}
      >
        <div className="vj-split">
          <FormField id="cmp-status" label="Situação">
            <Select id="cmp-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(LEGAL_COMPARISON_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="cmp-type" label="Tipo">
            <Select
              id="cmp-type"
              value={comparisonType}
              onChange={(e) => setComparisonType(e.target.value)}
            >
              <option value="">Todos</option>
              {Object.entries(LEGAL_COMPARISON_TYPE_LABELS).map(([value, label]) => (
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

      {loading || !org.ready ? <LoadingState label="Carregando comparações" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhuma comparação">
          Crie uma comparação com pelo menos dois documentos.
        </EmptyState>
      ) : null}
      {!loading && items.length > 0 ? (
        <>
          <p className="vj-meta">{total} comparação(ões)</p>
          <Alert tone="info" title="ANÁLISE · Apoio assistivo">
            Confirme ou rejeite cada achado. A decisão é sempre humana.
          </Alert>
          <ComparisonListTable items={items} caption="Lista de comparações" />
        </>
      ) : null}
    </div>
  );
}
