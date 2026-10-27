"use client";

import {
  Breadcrumb,
  Button,
  EmptyState,
  ErrorState,
  FormField,
  LoadingState,
  PageHeader,
  Select,
} from "@verasjuris/ui";
import { useCallback, useEffect, useState } from "react";
import { NoPermission, OPPORTUNITY_TABS, SectionTabs } from "../../../../components/ai-ui";
import { OpportunityTable } from "../../../../components/opportunity-ui";
import { aiErrorMessage } from "../../../../lib/ai";
import {
  fetchSavedInterests,
  hasOpportunityPermission,
  INTEREST_STATUS_LABELS,
  isApiFailure,
  type OpportunityInterest,
  type PublicOpportunitySummary,
} from "../../../../lib/public-opportunities";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function OportunidadesSalvasPage() {
  const org = useOrgContext();
  const canRead = hasOpportunityPermission(org.permissions, "read");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<OpportunityInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (orgId: string, filters: { status: string }) => {
    setLoading(true);
    setError(null);
    const data = await fetchSavedInterests(orgId, { status: filters.status || undefined });
    if (isApiFailure(data)) {
      setError(aiErrorMessage(data, "Não foi possível listar as oportunidades salvas."));
      setItems([]);
    } else {
      setItems(data.items);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    void load(org.orgId, { status: "" });
  }, [org.ready, org.orgId, canRead, load]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Oportunidades públicas", href: "/app/oportunidades-publicas" },
    { label: "Salvas" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar oportunidades públicas.</NoPermission>
      </div>
    );
  }

  const rows: PublicOpportunitySummary[] = items
    .filter((item) => item.opportunity)
    .map((item) => ({
      ...(item.opportunity as PublicOpportunitySummary),
      interestStatus: item.status,
    }));

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Oportunidades salvas"
        description="Interesses internos da organização. A situação de interesse é uma anotação da equipe e não altera o registro da oportunidade."
      />
      <SectionTabs
        label="Seções de oportunidades"
        items={OPPORTUNITY_TABS}
        current="/app/oportunidades-publicas/salvas"
      />

      <form
        className="vj-card vj-stack"
        aria-label="Filtros de oportunidades salvas"
        onSubmit={(event) => {
          event.preventDefault();
          if (org.orgId) void load(org.orgId, { status });
        }}
      >
        <FormField id="sv-status" label="Situação do interesse">
          <Select id="sv-status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todas</option>
            {Object.entries(INTEREST_STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="vj-form-actions">
          <Button type="submit" disabled={loading}>
            Filtrar
          </Button>
        </div>
      </form>

      {loading ? <LoadingState label="Carregando oportunidades salvas" /> : null}
      {error ? (
        <ErrorState title="Erro ao carregar oportunidades salvas">{error}</ErrorState>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <EmptyState title="Nenhuma oportunidade salva.">
          Abra uma oportunidade e use “Salvar interesse” para acompanhá-la aqui.
        </EmptyState>
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <>
          <p className="vj-meta" aria-live="polite">
            {rows.length} oportunidade{rows.length === 1 ? "" : "s"} salva
            {rows.length === 1 ? "" : "s"}
          </p>
          <OpportunityTable items={rows} caption="Oportunidades salvas" />
        </>
      ) : null}
    </div>
  );
}
