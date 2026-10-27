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
  ClaimsList,
  ContractsList,
  FgtsList,
  LaborCalculationsTable,
  LaborCaseSectionNav,
  LaborCaseStatusBadge,
  TRABALHISTA_TABS,
} from "../../../../../components/labor-ui";
import {
  LABOR_CLIENT_ROLE_LABELS,
  fetchEmploymentContracts,
  fetchEmploymentTerminations,
  fetchFgtsRecords,
  fetchLaborCalculations,
  fetchLaborCase,
  fetchLaborCaseDocuments,
  fetchLaborCaseTimeline,
  fetchLaborClaims,
  fetchLaborLiquidations,
  fetchLaborRemuneration,
  fetchVacations,
  fetchWorkSchedules,
  fetchWorkTimeRecords,
  formatDateTime,
  formatMoneyCents,
  hasLaborPermission,
  isApiFailure,
  laborErrorMessage,
  type EmploymentContract,
  type EmploymentTermination,
  type FgtsRecord,
  type LaborCalculation,
  type LaborCase,
  type LaborClaimItem,
  type LaborDocumentLink,
  type LaborLiquidation,
  type LaborRemunerationItem,
  type LaborTimelineItem,
  type VacationPeriod,
  type WorkSchedule,
  type WorkTimeRecord,
} from "../../../../../lib/labor";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function CasoTrabalhistaDetailPage() {
  const params = useParams<{ id: string }>();
  const laborCaseId = params.id;
  const org = useOrgContext();
  const canRead = hasLaborPermission(org.permissions, "read");
  const canCalculate = hasLaborPermission(org.permissions, "calculate");

  const [item, setItem] = useState<LaborCase | null>(null);
  const [contracts, setContracts] = useState<EmploymentContract[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [timeRecords, setTimeRecords] = useState<WorkTimeRecord[]>([]);
  const [remuneration, setRemuneration] = useState<LaborRemunerationItem[]>([]);
  const [vacations, setVacations] = useState<VacationPeriod[]>([]);
  const [fgts, setFgts] = useState<FgtsRecord[]>([]);
  const [terminations, setTerminations] = useState<EmploymentTermination[]>([]);
  const [claims, setClaims] = useState<LaborClaimItem[]>([]);
  const [calculations, setCalculations] = useState<LaborCalculation[]>([]);
  const [liquidations, setLiquidations] = useState<LaborLiquidation[]>([]);
  const [documents, setDocuments] = useState<LaborDocumentLink[]>([]);
  const [timeline, setTimeline] = useState<LaborTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (orgId: string) => {
      setLoading(true);
      setError(null);
      const scoped = { laborCaseId, limit: 50 };
      const results = await Promise.all([
        fetchLaborCase(orgId, laborCaseId),
        fetchEmploymentContracts(orgId, scoped),
        fetchWorkSchedules(orgId, scoped),
        fetchWorkTimeRecords(orgId, scoped),
        fetchLaborRemuneration(orgId, scoped),
        fetchVacations(orgId, scoped),
        fetchFgtsRecords(orgId, scoped),
        fetchEmploymentTerminations(orgId, scoped),
        fetchLaborClaims(orgId, scoped),
        fetchLaborCalculations(orgId, scoped),
        fetchLaborLiquidations(orgId, scoped),
        fetchLaborCaseDocuments(orgId, laborCaseId),
        fetchLaborCaseTimeline(orgId, laborCaseId),
      ]);

      const [
        caseData,
        contractsData,
        schedulesData,
        timeData,
        remData,
        vacData,
        fgtsData,
        termData,
        claimsData,
        calcsData,
        liqData,
        docsData,
        timelineData,
      ] = results;

      if (isApiFailure(caseData)) {
        setError(laborErrorMessage(caseData, "Não foi possível carregar o caso."));
        setItem(null);
      } else {
        setItem(caseData.laborCase);
      }

      setContracts(isApiFailure(contractsData) ? [] : contractsData.items);
      setSchedules(isApiFailure(schedulesData) ? [] : schedulesData.items);
      setTimeRecords(isApiFailure(timeData) ? [] : timeData.items);
      setRemuneration(isApiFailure(remData) ? [] : remData.items);
      setVacations(isApiFailure(vacData) ? [] : vacData.items);
      setFgts(isApiFailure(fgtsData) ? [] : fgtsData.items);
      setTerminations(isApiFailure(termData) ? [] : termData.items);
      setClaims(isApiFailure(claimsData) ? [] : claimsData.items);
      setCalculations(isApiFailure(calcsData) ? [] : calcsData.items);
      setLiquidations(isApiFailure(liqData) ? [] : liqData.items);
      setDocuments(isApiFailure(docsData) ? [] : docsData.items);
      setTimeline(isApiFailure(timelineData) ? [] : timelineData.items);
      setLoading(false);
    },
    [laborCaseId],
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
    { label: "Trabalhista", href: "/app/trabalhista" },
    { label: "Casos", href: "/app/trabalhista/casos" },
    { label: item?.id.slice(0, 8) ?? "Caso" },
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
        title={item ? `Caso ${item.id.slice(0, 8)}…` : "Caso trabalhista"}
        description={
          item
            ? `${LABOR_CLIENT_ROLE_LABELS[item.clientRole] ?? item.clientRole} · cliente ${item.clientId.slice(0, 8)}…`
            : "Detalhe do caso"
        }
        actions={
          <>
            {item ? (
              <ButtonLink href={`/app/casos/${item.legalMatterId}`} variant="secondary">
                Abrir caso jurídico
              </ButtonLink>
            ) : null}
            {item && canCalculate ? (
              <ButtonLink
                href={`/app/trabalhista/calculos?laborCaseId=${item.id}`}
                variant="primary"
              >
                Ver cálculos
              </ButtonLink>
            ) : null}
          </>
        }
      />
      <SectionTabs
        label="Seções trabalhistas"
        items={TRABALHISTA_TABS}
        current="/app/trabalhista/casos"
      />
      <LaborCaseSectionNav />

      {loading || !org.ready ? <LoadingState label="Carregando caso" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}

      {item ? (
        <>
          <section id="resumo" className="vj-card vj-stack">
            <h2 className="vj-section-title">Resumo</h2>
            <div className="vj-inline-actions">
              <LaborCaseStatusBadge status={item.status} />
            </div>
            <dl className="vj-stack">
              <div>
                <dt className="vj-meta">Papel</dt>
                <dd>{LABOR_CLIENT_ROLE_LABELS[item.clientRole] ?? item.clientRole}</dd>
              </div>
              <div>
                <dt className="vj-meta">Processo judicial</dt>
                <dd className="vj-technical">{item.judicialProcessId || "—"}</dd>
              </div>
              <div>
                <dt className="vj-meta">Atualizado</dt>
                <dd>{formatDateTime(item.updatedAt)}</dd>
              </div>
            </dl>
            {item.notes ? <p className="vj-prose">{item.notes}</p> : null}
          </section>

          <section id="contrato" className="vj-card vj-stack">
            <h2 className="vj-section-title">Contrato</h2>
            <ContractsList items={contracts} />
          </section>

          <section id="jornada" className="vj-card vj-stack">
            <h2 className="vj-section-title">Jornada</h2>
            <p className="vj-meta">
              {schedules.length} escala(s) · {timeRecords.length} registro(s) de ponto
            </p>
            {schedules.length === 0 && timeRecords.length === 0 ? (
              <EmptyState title="Sem jornada">Cadastre escalas ou registros de ponto.</EmptyState>
            ) : (
              <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {schedules.map((s) => (
                  <li key={s.id}>
                    <strong>{s.name}</strong>
                    <span className="vj-meta">
                      {s.weeklyHours != null ? ` · ${s.weeklyHours}h/sem` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="remuneracao" className="vj-card vj-stack">
            <h2 className="vj-section-title">Remuneração</h2>
            {remuneration.length === 0 ? (
              <p className="vj-meta">Nenhum item de remuneração.</p>
            ) : (
              <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {remuneration.map((r) => (
                  <li key={r.id}>
                    <strong>{r.label || r.itemType || r.id.slice(0, 8)}</strong>
                    <span className="vj-meta"> · {formatMoneyCents(r.amountCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="ferias" className="vj-card vj-stack">
            <h2 className="vj-section-title">Férias</h2>
            {vacations.length === 0 ? (
              <p className="vj-meta">Nenhum período de férias.</p>
            ) : (
              <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {vacations.map((v) => (
                  <li key={v.id}>
                    {String(v.startDate ?? "—")} → {String(v.endDate ?? "—")}
                    {v.days != null ? ` · ${v.days} dia(s)` : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="fgts" className="vj-card vj-stack">
            <h2 className="vj-section-title">FGTS</h2>
            <FgtsList items={fgts} />
          </section>

          <section id="rescisao" className="vj-card vj-stack">
            <h2 className="vj-section-title">Rescisão</h2>
            {terminations.length === 0 ? (
              <p className="vj-meta">Nenhuma rescisão cadastrada.</p>
            ) : (
              <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {terminations.map((t) => (
                  <li key={t.id}>
                    <strong>{t.verb || "Rescisão"}</strong>
                    <span className="vj-meta">
                      {t.terminationDate ? ` · ${formatDateTime(t.terminationDate)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="pedidos" className="vj-card vj-stack">
            <h2 className="vj-section-title">Pedidos</h2>
            <ClaimsList items={claims} />
          </section>

          <section id="calculos" className="vj-card vj-stack">
            <h2 className="vj-section-title">Cálculos</h2>
            {calculations.length === 0 ? (
              <p className="vj-meta">Nenhum cálculo neste caso.</p>
            ) : (
              <LaborCalculationsTable items={calculations} caption="Cálculos do caso" />
            )}
          </section>

          <section id="liquidacao" className="vj-card vj-stack">
            <h2 className="vj-section-title">Liquidação</h2>
            {liquidations.length === 0 ? (
              <p className="vj-meta">Nenhuma liquidação.</p>
            ) : (
              <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {liquidations.map((l) => (
                  <li key={l.id}>
                    <strong>{formatMoneyCents(l.totalCents)}</strong>
                    <span className="vj-meta">
                      {" "}
                      · {l.status} · {formatDateTime(l.referenceDate)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="documentos" className="vj-card vj-stack">
            <h2 className="vj-section-title">Documentos</h2>
            {documents.length === 0 ? (
              <p className="vj-meta">Nenhum documento vinculado.</p>
            ) : (
              <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {documents.map((doc, index) => (
                  <li key={doc.id ?? `${doc.documentId}-${index}`} className="vj-technical">
                    {doc.documentId} · {doc.linkType ?? "documento"}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="audiencias" className="vj-card vj-stack">
            <h2 className="vj-section-title">Audiências</h2>
            <p className="vj-meta">
              Audiências via agenda do caso jurídico:{" "}
              <a href={`/app/agenda?legalMatterId=${item.legalMatterId}`}>abrir agenda</a>
            </p>
          </section>

          <section id="processo" className="vj-card vj-stack">
            <h2 className="vj-section-title">Processo</h2>
            {item.judicialProcessId ? (
              <p className="vj-technical">Processo judicial {item.judicialProcessId}</p>
            ) : (
              <p className="vj-meta">Nenhum processo judicial vinculado.</p>
            )}
            <ButtonLink href={`/app/casos/${item.legalMatterId}/processos`} variant="secondary">
              Processos do caso jurídico
            </ButtonLink>
          </section>

          <section id="prazos" className="vj-card vj-stack">
            <h2 className="vj-section-title">Prazos</h2>
            <p className="vj-meta">
              <a href={`/app/prazos?legalMatterId=${item.legalMatterId}`}>Ver prazos</a>
            </p>
          </section>

          <section id="tarefas" className="vj-card vj-stack">
            <h2 className="vj-section-title">Tarefas</h2>
            <p className="vj-meta">
              <a href={`/app/tarefas?legalMatterId=${item.legalMatterId}`}>Ver tarefas</a>
            </p>
          </section>

          <section id="historico" className="vj-card vj-stack">
            <h2 className="vj-section-title">Histórico</h2>
            <p className="vj-meta">
              Criado {formatDateTime(item.createdAt)} · Atualizado {formatDateTime(item.updatedAt)}
            </p>
            {timeline.length === 0 ? (
              <p className="vj-meta">Sem eventos de linha do tempo.</p>
            ) : (
              <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {timeline.map((event, index) => (
                  <li key={event.id ?? `${event.title}-${index}`}>
                    <strong>{event.title || event.kind || "Evento"}</strong>
                    <div className="vj-meta">
                      {event.occurredAt ? formatDateTime(event.occurredAt) : ""}
                    </div>
                    {event.body ? <p className="vj-prose">{event.body}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
