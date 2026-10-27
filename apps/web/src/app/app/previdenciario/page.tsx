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
import { PREVIDENCIARIO_TABS } from "../../../components/previdentiary-ui";
import {
  PREVIDENTIARY_PROVIDER_NOT_CONFIGURED_MESSAGE,
  fetchPrevidentiaryCalculations,
  fetchPrevidentiaryCases,
  fetchPrevidentiaryProviderHealth,
  fetchPrevidentiaryRequests,
  hasPrevidentiaryPermission,
  isApiFailure,
  isProviderNotConfigured,
  previdentiaryErrorMessage,
} from "../../../lib/previdentiary";
import { useOrgContext } from "../../../lib/use-org-context";

export default function PrevidenciarioDashboardPage() {
  const org = useOrgContext();
  const canRead = hasPrevidentiaryPermission(org.permissions, "read");
  const canCreate = hasPrevidentiaryPermission(org.permissions, "create");

  const [casesCount, setCasesCount] = useState(0);
  const [requestsCount, setRequestsCount] = useState(0);
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
      const [health, cases, requests, calcs] = await Promise.all([
        fetchPrevidentiaryProviderHealth(orgId),
        fetchPrevidentiaryCases(orgId, { limit: 1 }),
        fetchPrevidentiaryRequests(orgId, { limit: 1 }),
        fetchPrevidentiaryCalculations(orgId, { status: "review_required", limit: 1 }),
      ]);
      if (cancelled) return;
      if (!isApiFailure(health)) {
        setNotConfigured(
          isProviderNotConfigured(health.cnisProvider?.status) ||
            isProviderNotConfigured(health.socialSecurityProvider?.status),
        );
      }
      if (isApiFailure(cases)) {
        setError(previdentiaryErrorMessage(cases, "Não foi possível carregar o painel."));
      } else if (isApiFailure(requests)) {
        setError(previdentiaryErrorMessage(requests, "Não foi possível carregar o painel."));
      } else if (isApiFailure(calcs)) {
        setError(previdentiaryErrorMessage(calcs, "Não foi possível carregar o painel."));
      } else {
        setCasesCount(cases.total);
        setRequestsCount(requests.total);
        setReviewCalcsCount(calcs.total);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, canRead]);

  const breadcrumb = [{ label: "Painel", href: "/app" }, { label: "Previdenciário" }];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar o módulo previdenciário.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Previdenciário"
        description="Casos, requerimentos e cálculos com memória FONTE → DADO → REGRA → CÁLCULO → RESULTADO → REVISÃO. Sem dados oficiais do INSS inventados."
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
        current="/app/previdenciario"
      />
      {notConfigured ? (
        <NotConfiguredNotice message={PREVIDENTIARY_PROVIDER_NOT_CONFIGURED_MESSAGE}>
          Cadastro manual, importação revisada e cálculos determinísticos permanecem disponíveis.
        </NotConfiguredNotice>
      ) : null}

      {loading || !org.ready ? <LoadingState label="Carregando painel previdenciário" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}

      {!loading && !error ? (
        <div className="vj-split">
          <a className="vj-card vj-stack" href="/app/previdenciario/casos">
            <h2 className="vj-section-title">Casos</h2>
            <p className="vj-title">{casesCount}</p>
            <p className="vj-meta">Casos previdenciários na organização</p>
          </a>
          <a className="vj-card vj-stack" href="/app/previdenciario/casos">
            <h2 className="vj-section-title">Requerimentos</h2>
            <p className="vj-title">{requestsCount}</p>
            <p className="vj-meta">Protocolo manual ≠ protocolo INSS</p>
          </a>
          <a
            className="vj-card vj-stack"
            href="/app/previdenciario/calculos?status=review_required"
          >
            <h2 className="vj-section-title">Cálculos em revisão</h2>
            <p className="vj-title">{reviewCalcsCount}</p>
            <p className="vj-meta">Aguardam revisão humana</p>
          </a>
        </div>
      ) : null}

      {!loading && !error && casesCount === 0 ? (
        <EmptyState title="Nenhum caso previdenciário">
          Crie um caso vinculado a cliente e matéria jurídica para começar.
        </EmptyState>
      ) : null}
    </div>
  );
}
