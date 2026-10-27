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
import { NoPermission, NotConfiguredNotice, SectionTabs } from "../../../components/ai-ui";
import { FgtsEstimateNotice, TRABALHISTA_TABS } from "../../../components/labor-ui";
import {
  LABOR_PROVIDER_NOT_CONFIGURED_MESSAGE,
  fetchLaborCalculations,
  fetchLaborCases,
  fetchLaborProvidersStatus,
  hasLaborPermission,
  isApiFailure,
  isProviderNotConfigured,
  laborErrorMessage,
} from "../../../lib/labor";
import { useOrgContext } from "../../../lib/use-org-context";

export default function TrabalhistaDashboardPage() {
  const org = useOrgContext();
  const canRead = hasLaborPermission(org.permissions, "read");
  const canCreate = hasLaborPermission(org.permissions, "create");

  const [casesCount, setCasesCount] = useState(0);
  const [reviewCalcsCount, setReviewCalcsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

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
      const [status, cases, calcs] = await Promise.all([
        fetchLaborProvidersStatus(orgId),
        fetchLaborCases(orgId, { limit: 1 }),
        fetchLaborCalculations(orgId, { limit: 50 }),
      ]);
      if (cancelled) return;
      if (!isApiFailure(status)) {
        setNotConfigured(
          isProviderNotConfigured(status.eSocial?.status) ||
            isProviderNotConfigured(status.fgts?.status) ||
            isProviderNotConfigured(status.laborCourt?.status) ||
            isProviderNotConfigured(status.timeTrackingImport?.status),
        );
      }
      if (isApiFailure(cases)) {
        setError(laborErrorMessage(cases, "Não foi possível carregar o painel trabalhista."));
      } else if (isApiFailure(calcs)) {
        setError(laborErrorMessage(calcs, "Não foi possível carregar o painel trabalhista."));
      } else {
        setCasesCount(cases.total);
        setReviewCalcsCount(calcs.items.filter((c) => c.status === "review_required").length);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, canRead]);

  const breadcrumb = [{ label: "Painel", href: "/app" }, { label: "Trabalhista" }];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar o módulo trabalhista.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Trabalhista"
        description="Contratos, jornada, FGTS estimado, pedidos e cálculos com memória. Sem saldo oficial de FGTS inventado."
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
        current="/app/trabalhista"
      />
      {notConfigured ? (
        <NotConfiguredNotice message={LABOR_PROVIDER_NOT_CONFIGURED_MESSAGE}>
          Cadastro manual e cálculos determinísticos permanecem disponíveis.
        </NotConfiguredNotice>
      ) : null}
      <FgtsEstimateNotice />

      {loading || !org.ready ? <LoadingState label="Carregando painel trabalhista" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}

      {!loading && !error ? (
        <div className="vj-split">
          <a className="vj-card vj-stack" href="/app/trabalhista/casos">
            <h2 className="vj-section-title">Casos</h2>
            <p className="vj-title">{casesCount}</p>
            <p className="vj-meta">Casos trabalhistas na organização</p>
          </a>
          <a className="vj-card vj-stack" href="/app/trabalhista/calculos">
            <h2 className="vj-section-title">Cálculos em revisão</h2>
            <p className="vj-title">{reviewCalcsCount}</p>
            <p className="vj-meta">Aguardam revisão humana</p>
          </a>
        </div>
      ) : null}

      {!loading && !error && casesCount === 0 ? (
        <EmptyState title="Nenhum caso trabalhista">
          Crie um caso vinculado a cliente e matéria jurídica para começar.
        </EmptyState>
      ) : null}
    </div>
  );
}
