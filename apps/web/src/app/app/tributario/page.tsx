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
import { NoPermission, SectionTabs } from "../../../components/ai-ui";
import {
  TaxDashboardWidgets,
  TaxProviderBanner,
  TRIBUTARIO_TABS,
} from "../../../components/tax-ui";
import {
  fetchTaxAssessments,
  fetchTaxCalculationsAcrossCases,
  fetchTaxCases,
  fetchTaxCompensations,
  fetchTaxCredits,
  fetchTaxEnforcements,
  fetchTaxObligations,
  fetchTaxProvidersStatus,
  fetchTaxRefunds,
  hasTaxPermission,
  isApiFailure,
  taxErrorMessage,
  taxProvidersNotConfigured,
} from "../../../lib/tax";
import { useOrgContext } from "../../../lib/use-org-context";

export default function TributarioDashboardPage() {
  const org = useOrgContext();
  const canRead = hasTaxPermission(org.permissions, "read");
  const canCreate = hasTaxPermission(org.permissions, "create");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [metrics, setMetrics] = useState({
    cases: 0,
    obligationsDue: 0,
    assessments: 0,
    credits: 0,
    refunds: 0,
    compensations: 0,
    enforcements: 0,
    calculationsReview: 0,
    deadlinesLinked: 0,
  });

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
      const [providers, casesData] = await Promise.all([
        fetchTaxProvidersStatus(orgId),
        fetchTaxCases(orgId, { limit: 25 }),
      ]);
      if (cancelled) return;
      if (!isApiFailure(providers)) setNotConfigured(taxProvidersNotConfigured(providers));
      if (isApiFailure(casesData)) {
        setError(taxErrorMessage(casesData, "Não foi possível carregar o painel tributário."));
        setLoading(false);
        return;
      }
      const caseIds = casesData.items.map((c) => c.id);
      const [obligations, assessments, credits, refunds, compensations, enforcements, calcs] =
        await Promise.all([
          Promise.all(caseIds.map((id) => fetchTaxObligations(orgId, id, { limit: 20 }))),
          Promise.all(caseIds.map((id) => fetchTaxAssessments(orgId, id, { limit: 20 }))),
          Promise.all(caseIds.map((id) => fetchTaxCredits(orgId, id, { limit: 20 }))),
          Promise.all(caseIds.map((id) => fetchTaxRefunds(orgId, id, { limit: 20 }))),
          Promise.all(caseIds.map((id) => fetchTaxCompensations(orgId, id, { limit: 20 }))),
          Promise.all(caseIds.map((id) => fetchTaxEnforcements(orgId, id))),
          fetchTaxCalculationsAcrossCases(orgId, caseIds, { status: "review_required" }),
        ]);
      if (cancelled) return;

      let obligationsDue = 0;
      let deadlinesLinked = 0;
      for (const group of obligations) {
        if (isApiFailure(group)) continue;
        for (const o of group.items) {
          if (o.status === "open" || o.status === "overdue" || o.status === "pending")
            obligationsDue += 1;
          if (o.deadlineId) deadlinesLinked += 1;
        }
      }
      const countGroups = (
        groups: Array<{ items: unknown[] } | import("../../../lib/ai").AiApiFailure>,
      ) => {
        let n = 0;
        for (const g of groups) if (!isApiFailure(g)) n += g.items.length;
        return n;
      };
      setMetrics({
        cases: casesData.total,
        obligationsDue,
        assessments: countGroups(assessments),
        credits: countGroups(credits),
        refunds: countGroups(refunds),
        compensations: countGroups(compensations),
        enforcements: countGroups(enforcements),
        calculationsReview: calcs.items.length,
        deadlinesLinked,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, canRead]);

  const breadcrumb = [{ label: "Painel", href: "/app" }, { label: "Tributário" }];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar o módulo tributário.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Tributário"
        description="Obrigações, créditos, autos, execução fiscal e cálculos com memória. Sem dados oficiais de receita inventados."
        actions={
          canCreate ? (
            <ButtonLink href="/app/tributario/casos/novo" variant="primary">
              Novo caso
            </ButtonLink>
          ) : null
        }
      />
      <SectionTabs label="Seções tributárias" items={TRIBUTARIO_TABS} current="/app/tributario" />
      <TaxProviderBanner notConfigured={notConfigured} />

      {loading || !org.ready ? <LoadingState label="Carregando painel tributário" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}

      {!loading && !error ? <TaxDashboardWidgets metrics={metrics} /> : null}

      {!loading && !error && metrics.cases === 0 ? (
        <EmptyState title="Nenhum caso tributário">
          Crie um caso vinculado a cliente e matéria jurídica para começar.
        </EmptyState>
      ) : null}
    </div>
  );
}
