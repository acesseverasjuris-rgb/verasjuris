"use client";

import {
  Breadcrumb,
  ButtonLink,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../../components/ai-ui";
import {
  TaxAssessmentsTable,
  TaxCalculationReviewBanner,
  TaxCalculationsTable,
  TaxCaseSectionNav,
  TaxCaseStatusBadge,
  TaxCompensationsTable,
  TaxCreditsTable,
  TaxObligationsTable,
  TaxRefundsTable,
  TRIBUTARIO_TABS,
} from "../../../../../components/tax-ui";
import {
  TAX_JURISDICTION_SCOPE_LABELS,
  TAX_TAXPAYER_TYPE_LABELS,
  fetchTaxAdministrativeCases,
  fetchTaxAssessments,
  fetchTaxCalculations,
  fetchTaxCase,
  fetchTaxCaseThesisLinks,
  fetchTaxCaseTimeline,
  fetchTaxCompensations,
  fetchTaxCredits,
  fetchTaxEnforcements,
  fetchTaxObligations,
  fetchTaxRefunds,
  fetchTaxTheses,
  formatDateTime,
  hasTaxPermission,
  isApiFailure,
  taxErrorMessage,
  type TaxAdministrativeCase,
  type TaxAssessment,
  type TaxCalculation,
  type TaxCase,
  type TaxCompensation,
  type TaxCredit,
  type TaxEnforcement,
  type TaxLegalThesis,
  type TaxObligation,
  type TaxRefund,
  type TaxTimelineItem,
} from "../../../../../lib/tax";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function CasoTributarioDetailPage() {
  const params = useParams<{ id: string }>();
  const taxCaseId = params.id;
  const org = useOrgContext();
  const canRead = hasTaxPermission(org.permissions, "read");

  const [item, setItem] = useState<TaxCase | null>(null);
  const [obligations, setObligations] = useState<TaxObligation[]>([]);
  const [credits, setCredits] = useState<TaxCredit[]>([]);
  const [refunds, setRefunds] = useState<TaxRefund[]>([]);
  const [compensations, setCompensations] = useState<TaxCompensation[]>([]);
  const [assessments, setAssessments] = useState<TaxAssessment[]>([]);
  const [adminCases, setAdminCases] = useState<TaxAdministrativeCase[]>([]);
  const [enforcements, setEnforcements] = useState<TaxEnforcement[]>([]);
  const [theses, setTheses] = useState<TaxLegalThesis[]>([]);
  const [calculations, setCalculations] = useState<TaxCalculation[]>([]);
  const [timeline, setTimeline] = useState<TaxTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (orgId: string) => {
      setLoading(true);
      setError(null);
      const results = await Promise.all([
        fetchTaxCase(orgId, taxCaseId),
        fetchTaxObligations(orgId, taxCaseId, { limit: 50 }),
        fetchTaxCredits(orgId, taxCaseId, { limit: 50 }),
        fetchTaxRefunds(orgId, taxCaseId, { limit: 50 }),
        fetchTaxCompensations(orgId, taxCaseId, { limit: 50 }),
        fetchTaxAssessments(orgId, taxCaseId, { limit: 50 }),
        fetchTaxAdministrativeCases(orgId, taxCaseId),
        fetchTaxEnforcements(orgId, taxCaseId),
        fetchTaxCaseThesisLinks(orgId, taxCaseId),
        fetchTaxCalculations(orgId, { taxCaseId, limit: 50 }),
        fetchTaxCaseTimeline(orgId, taxCaseId),
        fetchTaxTheses(orgId, { limit: 50 }),
      ]);

      const [caseData, obl, cred, ref, comp, assess, admin, enf, links, calcs, tl, thesisCatalog] =
        results;

      if (isApiFailure(caseData)) {
        setError(taxErrorMessage(caseData, "Não foi possível carregar o caso."));
        setItem(null);
      } else {
        setItem(caseData.case);
      }
      setObligations(isApiFailure(obl) ? [] : obl.items);
      setCredits(isApiFailure(cred) ? [] : cred.items);
      setRefunds(isApiFailure(ref) ? [] : ref.items);
      setCompensations(isApiFailure(comp) ? [] : comp.items);
      setAssessments(isApiFailure(assess) ? [] : assess.items);
      setAdminCases(isApiFailure(admin) ? [] : admin.items);
      setEnforcements(isApiFailure(enf) ? [] : enf.items);
      setCalculations(isApiFailure(calcs) ? [] : calcs.items);
      setTimeline(isApiFailure(tl) ? [] : tl.items);

      if (!isApiFailure(links) && !isApiFailure(thesisCatalog)) {
        const linked = new Set(links.items.map((l) => l.taxLegalThesisId));
        setTheses(thesisCatalog.items.filter((t) => linked.has(t.id)));
      } else {
        setTheses([]);
      }
      setLoading(false);
    },
    [taxCaseId],
  );

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    void load(org.orgId);
  }, [org.ready, org.orgId, canRead, load]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Tributário", href: "/app/tributario" },
    { label: "Casos", href: "/app/tributario/casos" },
    { label: "Detalhe" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar este caso.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title={item ? `Caso tributário` : "Caso tributário"}
        description="Seções por âncora — use Tab para navegar entre links."
        actions={
          item ? (
            <ButtonLink href={`/app/casos/${item.legalMatterId}`} variant="secondary">
              Caso jurídico
            </ButtonLink>
          ) : null
        }
      />
      <SectionTabs
        label="Seções tributárias"
        items={TRIBUTARIO_TABS}
        current="/app/tributario/casos"
      />
      <TaxCaseSectionNav />

      {loading || !org.ready ? <LoadingState label="Carregando caso tributário" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}

      {!loading && item ? (
        <>
          <section id="resumo" className="vj-card vj-stack" aria-labelledby="tax-resumo">
            <h2 id="tax-resumo" className="vj-section-title">
              Resumo
            </h2>
            <TaxCaseStatusBadge status={item.status} />
            <p className="vj-meta">
              {TAX_TAXPAYER_TYPE_LABELS[item.taxpayerType]} ·{" "}
              {TAX_JURISDICTION_SCOPE_LABELS[item.jurisdictionScope]}
            </p>
            <p className="vj-meta">Atualizado {formatDateTime(item.updatedAt)}</p>
            {item.notes ? <p>{item.notes}</p> : null}
          </section>

          <section id="tributos" className="vj-card vj-stack" aria-labelledby="tax-tributos">
            <h2 id="tax-tributos" className="vj-section-title">
              Tributos
            </h2>
            <p className="vj-meta">Tipos vinculados via obrigações, créditos e autos neste caso.</p>
          </section>

          <section id="obrigacoes" className="vj-stack" aria-labelledby="tax-obrig">
            <h2 id="tax-obrig" className="vj-section-title">
              Obrigações
            </h2>
            {obligations.length === 0 ? (
              <EmptyState title="Sem obrigações">
                Registre obrigações manualmente ou via importação revisada.
              </EmptyState>
            ) : (
              <TaxObligationsTable items={obligations} />
            )}
          </section>

          <section id="creditos" className="vj-stack" aria-labelledby="tax-cred">
            <h2 id="tax-cred" className="vj-section-title">
              Créditos
            </h2>
            {credits.length === 0 ? (
              <EmptyState title="Sem créditos">Nenhum crédito registrado.</EmptyState>
            ) : null}
            <TaxCreditsTable items={credits} />
          </section>

          <section id="restituicoes" className="vj-stack" aria-labelledby="tax-rest">
            <h2 id="tax-rest" className="vj-section-title">
              Restituições
            </h2>
            {refunds.length === 0 ? (
              <EmptyState title="Sem restituições">Nenhum pedido registrado.</EmptyState>
            ) : null}
            <TaxRefundsTable items={refunds} />
          </section>

          <section id="compensacoes" className="vj-stack" aria-labelledby="tax-comp">
            <h2 id="tax-comp" className="vj-section-title">
              Compensações
            </h2>
            {compensations.length === 0 ? (
              <EmptyState title="Sem compensações">Nenhuma compensação registrada.</EmptyState>
            ) : null}
            <TaxCompensationsTable items={compensations} />
          </section>

          <section id="autos" className="vj-stack" aria-labelledby="tax-autos">
            <h2 id="tax-autos" className="vj-section-title">
              Autos
            </h2>
            {assessments.length === 0 ? (
              <EmptyState title="Sem autos">Nenhum auto de infração registrado.</EmptyState>
            ) : null}
            <TaxAssessmentsTable items={assessments} />
          </section>

          <section id="administrativo" className="vj-stack" aria-labelledby="tax-adm">
            <h2 id="tax-adm" className="vj-section-title">
              Administrativo
            </h2>
            {adminCases.length === 0 ? (
              <EmptyState title="Sem processos">
                Nenhum processo administrativo vinculado.
              </EmptyState>
            ) : (
              <ul className="vj-stack">
                {adminCases.map((row) => (
                  <li key={row.id} className="vj-card vj-technical">
                    {row.administrativeProcessId ?? row.id}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="execucao" className="vj-stack" aria-labelledby="tax-exec">
            <h2 id="tax-exec" className="vj-section-title">
              Execução fiscal
            </h2>
            {enforcements.length === 0 ? (
              <EmptyState title="Sem execuções">Nenhuma execução fiscal registrada.</EmptyState>
            ) : (
              <ul className="vj-stack">
                {enforcements.map((row) => (
                  <li key={row.id} className="vj-card">
                    {row.judicialProcessId ? (
                      <a href={`/app/casos`} className="vj-meta">
                        Processo {row.judicialProcessId}
                      </a>
                    ) : (
                      <span className="vj-meta">{row.status ?? "—"}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="teses" className="vj-stack" aria-labelledby="tax-teses">
            <h2 id="tax-teses" className="vj-section-title">
              Teses
            </h2>
            {theses.length === 0 ? (
              <EmptyState title="Sem teses">Nenhuma tese vinculada.</EmptyState>
            ) : null}
            <ul className="vj-stack">
              {theses.map((t) => (
                <li key={t.id} className="vj-card">
                  <strong>{t.title}</strong>
                  {t.summary ? <p className="vj-meta">{t.summary}</p> : null}
                </li>
              ))}
            </ul>
          </section>

          <section id="calculos" className="vj-stack" aria-labelledby="tax-calcs">
            <h2 id="tax-calcs" className="vj-section-title">
              Cálculos
            </h2>
            <TaxCalculationReviewBanner />
            {calculations.length === 0 ? (
              <EmptyState title="Sem cálculos">Nenhum cálculo tributário neste caso.</EmptyState>
            ) : (
              <TaxCalculationsTable items={calculations} />
            )}
          </section>

          <section id="documentos" className="vj-card vj-stack" aria-labelledby="tax-docs">
            <h2 id="tax-docs" className="vj-section-title">
              Documentos
            </h2>
            <p className="vj-meta">
              Vincule documentos pelo módulo <a href="/app/documentos">Documentos</a> e pelo caso
              jurídico.
            </p>
          </section>

          <section id="prazos" className="vj-card vj-stack" aria-labelledby="tax-prazos">
            <h2 id="tax-prazos" className="vj-section-title">
              Prazos
            </h2>
            <ButtonLink href="/app/prazos" variant="secondary">
              Abrir prazos
            </ButtonLink>
          </section>

          <section id="tarefas" className="vj-card vj-stack" aria-labelledby="tax-tarefas">
            <h2 id="tax-tarefas" className="vj-section-title">
              Tarefas
            </h2>
            <ButtonLink href="/app/tarefas" variant="secondary">
              Abrir tarefas
            </ButtonLink>
          </section>

          <section id="historico" className="vj-stack" aria-labelledby="tax-hist">
            <h2 id="tax-hist" className="vj-section-title">
              Histórico
            </h2>
            {timeline.length === 0 ? (
              <EmptyState title="Sem eventos">Nenhum evento de auditoria.</EmptyState>
            ) : null}
            <ul className="vj-stack">
              {timeline.map((ev) => (
                <li key={ev.id} className="vj-card">
                  <span className="vj-meta">{ev.action}</span>
                  {ev.occurredAt ? <span> · {formatDateTime(ev.occurredAt)}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
