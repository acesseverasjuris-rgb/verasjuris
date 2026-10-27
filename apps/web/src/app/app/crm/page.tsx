"use client";

import {
  Breadcrumb,
  ButtonLink,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  apiErrorMessage,
  fetchCrmOverview,
  getActiveOrgId,
  isApiFailure,
  type CrmOverview,
} from "../../../lib/crm";

export default function CrmOverviewPage() {
  const [overview, setOverview] = useState<CrmOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const activeId = await getActiveOrgId();
      if (cancelled) return;
      if (!activeId) {
        setError("Nenhuma organização ativa. Selecione ou crie uma organização para usar o CRM.");
        setLoading(false);
        return;
      }
      const data = await fetchCrmOverview(activeId);
      if (cancelled) return;
      if (isApiFailure(data)) {
        setError(apiErrorMessage(data, "Não foi possível carregar a visão geral do CRM."));
        setLoading(false);
        return;
      }
      setOverview(data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const empty =
    overview && overview.leads === 0 && overview.openLeads === 0 && overview.clients === 0;

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Painel", href: "/app" },
          { label: "CRM", href: "/app/crm" },
          { label: "Visão geral" },
        ]}
      />
      <PageHeader
        title="CRM"
        description="Indicadores reais da organização ativa. Nenhum número é estimado ou simulado."
        eyebrow="Visão geral"
      />
      {loading ? <LoadingState label="Carregando indicadores do CRM" /> : null}
      {error ? <ErrorState title="Não foi possível carregar o CRM.">{error}</ErrorState> : null}
      {!loading && !error && overview ? (
        empty ? (
          <EmptyState
            title="Nenhum registro no CRM ainda"
            action={
              <ButtonLink href="/app/crm/leads/novo" variant="primary">
                Registrar primeiro lead
              </ButtonLink>
            }
          >
            Ainda não há leads nem clientes nesta organização. Comece registrando um lead ou aguarde
            a equipe incluir registros.
          </EmptyState>
        ) : (
          <>
            <div className="vj-split vj-metrics">
              <section className="vj-card" aria-labelledby="metric-leads">
                <h2 id="metric-leads" className="vj-section-title">
                  Leads
                </h2>
                <p className="vj-display" style={{ fontSize: "2rem", margin: 0 }}>
                  {overview.leads}
                </p>
                <p className="vj-meta">Total registrado</p>
              </section>
              <section className="vj-card" aria-labelledby="metric-open">
                <h2 id="metric-open" className="vj-section-title">
                  Leads em aberto
                </h2>
                <p className="vj-display" style={{ fontSize: "2rem", margin: 0 }}>
                  {overview.openLeads}
                </p>
                <p className="vj-meta">Exclui convertidos, arquivados e não qualificados</p>
              </section>
              <section className="vj-card" aria-labelledby="metric-clients">
                <h2 id="metric-clients" className="vj-section-title">
                  Clientes
                </h2>
                <p className="vj-display" style={{ fontSize: "2rem", margin: 0 }}>
                  {overview.clients}
                </p>
                <p className="vj-meta">Total registrado</p>
              </section>
            </div>
            <div className="vj-inline-actions">
              <ButtonLink href="/app/crm/leads">Ver leads</ButtonLink>
              <ButtonLink href="/app/crm/clientes" variant="secondary">
                Ver clientes
              </ButtonLink>
            </div>
          </>
        )
      ) : null}
    </div>
  );
}
