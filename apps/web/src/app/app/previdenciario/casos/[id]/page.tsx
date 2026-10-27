"use client";

import {
  Alert,
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
  BenefitsTable,
  CalculationsTable,
  CnisDisclaimer,
  CnisStatusBadge,
  ManualProtocolNotice,
  PREVIDENCIARIO_TABS,
  PrevidentiaryCaseSectionNav,
  RequestsTable,
} from "../../../../../components/previdentiary-ui";
import {
  PREVIDENTIARY_REGIME_LABELS,
  CNIS_NOT_OFFICIAL_DISCLAIMER,
  fetchCaseBenefits,
  fetchCaseContributions,
  fetchCaseDocuments,
  fetchCasePeriods,
  fetchCnisImports,
  fetchPrevidentiaryCalculations,
  fetchPrevidentiaryCase,
  fetchPrevidentiaryRequests,
  formatDateTime,
  formatMoneyCents,
  hasPrevidentiaryPermission,
  isApiFailure,
  previdentiaryErrorMessage,
  type CnisImport,
  type PrevidentiaryCalculation,
  type PrevidentiaryCase,
  type PrevidentiaryDocumentLink,
  type PrevidentiaryRequest,
  type SocialSecurityBenefit,
  type SocialSecurityContribution,
  type SocialSecurityPeriod,
} from "../../../../../lib/previdentiary";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function CasoPrevidenciarioDetailPage() {
  const params = useParams<{ id: string }>();
  const caseId = params.id;
  const org = useOrgContext();
  const canRead = hasPrevidentiaryPermission(org.permissions, "read");
  const canCalculate = hasPrevidentiaryPermission(org.permissions, "calculate");

  const [item, setItem] = useState<PrevidentiaryCase | null>(null);
  const [benefits, setBenefits] = useState<SocialSecurityBenefit[]>([]);
  const [requests, setRequests] = useState<PrevidentiaryRequest[]>([]);
  const [cnisImports, setCnisImports] = useState<CnisImport[]>([]);
  const [contributions, setContributions] = useState<SocialSecurityContribution[]>([]);
  const [periods, setPeriods] = useState<SocialSecurityPeriod[]>([]);
  const [calculations, setCalculations] = useState<PrevidentiaryCalculation[]>([]);
  const [documents, setDocuments] = useState<PrevidentiaryDocumentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (orgId: string) => {
      setLoading(true);
      setError(null);
      const [
        caseData,
        benefitsData,
        requestsData,
        cnisData,
        contributionsData,
        periodsData,
        calcsData,
        docsData,
      ] = await Promise.all([
        fetchPrevidentiaryCase(orgId, caseId),
        fetchCaseBenefits(orgId, caseId),
        fetchPrevidentiaryRequests(orgId, { previdentiaryCaseId: caseId, limit: 50 }),
        fetchCnisImports(orgId, { previdentiaryCaseId: caseId, limit: 50 }),
        fetchCaseContributions(orgId, caseId),
        fetchCasePeriods(orgId, caseId),
        fetchPrevidentiaryCalculations(orgId, { previdentiaryCaseId: caseId, limit: 50 }),
        fetchCaseDocuments(orgId, caseId),
      ]);

      if (isApiFailure(caseData)) {
        setError(previdentiaryErrorMessage(caseData, "Não foi possível carregar o caso."));
        setItem(null);
      } else {
        setItem(caseData.case);
      }
      setBenefits(isApiFailure(benefitsData) ? [] : benefitsData.items);
      setRequests(isApiFailure(requestsData) ? [] : requestsData.items);
      setCnisImports(isApiFailure(cnisData) ? [] : cnisData.items);
      setContributions(isApiFailure(contributionsData) ? [] : contributionsData.items);
      setPeriods(isApiFailure(periodsData) ? [] : periodsData.items);
      setCalculations(isApiFailure(calcsData) ? [] : calcsData.items);
      setDocuments(isApiFailure(docsData) ? [] : docsData.items);
      setLoading(false);
    },
    [caseId],
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
    { label: "Previdenciário", href: "/app/previdenciario" },
    { label: "Casos", href: "/app/previdenciario/casos" },
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
        title={item ? `Caso ${item.id.slice(0, 8)}…` : "Caso previdenciário"}
        description={
          item
            ? `${PREVIDENTIARY_REGIME_LABELS[item.regime] ?? item.regime} · cliente ${item.clientId.slice(0, 8)}…`
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
                href={`/app/previdenciario/calculos/novo?caseId=${item.id}`}
                variant="primary"
              >
                Novo cálculo
              </ButtonLink>
            ) : null}
          </>
        }
      />
      <SectionTabs
        label="Seções previdenciárias"
        items={PREVIDENCIARIO_TABS}
        current="/app/previdenciario/casos"
      />
      <PrevidentiaryCaseSectionNav />

      {loading || !org.ready ? <LoadingState label="Carregando caso" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}

      {item ? (
        <>
          <section id="resumo" className="vj-card vj-stack">
            <h2 className="vj-section-title">Resumo</h2>
            <dl className="vj-stack">
              <div>
                <dt className="vj-meta">Regime</dt>
                <dd>{PREVIDENTIARY_REGIME_LABELS[item.regime] ?? item.regime}</dd>
              </div>
              <div>
                <dt className="vj-meta">Categoria</dt>
                <dd>{item.insuredCategory || "—"}</dd>
              </div>
              <div>
                <dt className="vj-meta">Situação</dt>
                <dd>{item.currentSituation || "—"}</dd>
              </div>
              <div>
                <dt className="vj-meta">Atualizado</dt>
                <dd>{formatDateTime(item.updatedAt)}</dd>
              </div>
            </dl>
            {item.notes ? <p className="vj-prose">{item.notes}</p> : null}
            <p className="vj-meta">
              Perfil do cliente:{" "}
              <a href={`/app/previdenciario/clientes/${item.clientId}`}>ver NIT mascarado</a>
            </p>
          </section>

          <section id="beneficios" className="vj-card vj-stack">
            <h2 className="vj-section-title">Benefícios</h2>
            <Alert tone="info" title="Cadastro interno">
              Benefícios aqui não afirmam concessão oficial no INSS.
            </Alert>
            {benefits.length === 0 ? (
              <EmptyState title="Sem benefícios">Nenhum benefício vinculado.</EmptyState>
            ) : (
              <BenefitsTable items={benefits} caption="Benefícios do caso" />
            )}
          </section>

          <section id="requerimentos" className="vj-card vj-stack">
            <h2 className="vj-section-title">Requerimentos</h2>
            <ManualProtocolNotice />
            {requests.length === 0 ? (
              <p className="vj-meta">Nenhum requerimento.</p>
            ) : (
              <RequestsTable items={requests} caption="Requerimentos do caso" />
            )}
          </section>

          <section id="cnis" className="vj-card vj-stack">
            <h2 className="vj-section-title">CNIS</h2>
            <CnisDisclaimer />
            {cnisImports.length === 0 ? (
              <p className="vj-meta">Nenhuma importação de CNIS.</p>
            ) : (
              <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {cnisImports.map((imp) => (
                  <li key={imp.id}>
                    <div className="vj-inline-actions">
                      <CnisStatusBadge status={imp.status} />
                      <span className="vj-technical">{imp.id.slice(0, 8)}…</span>
                    </div>
                    <div className="vj-meta">
                      {imp.importFormat ?? "manual"} · {formatDateTime(imp.createdAt)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="vj-meta">{CNIS_NOT_OFFICIAL_DISCLAIMER}</p>
          </section>

          <section id="contribuicoes" className="vj-card vj-stack">
            <h2 className="vj-section-title">Contribuições e períodos</h2>
            <p className="vj-meta">
              {contributions.length} contribuição(ões) · {periods.length} período(s)
            </p>
            {contributions.length === 0 && periods.length === 0 ? (
              <p className="vj-meta">Sem contribuições ou períodos cadastrados.</p>
            ) : (
              <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {contributions.slice(0, 20).map((c) => (
                  <li key={c.id}>
                    <strong>{c.competence || "—"}</strong>
                    <span className="vj-meta">
                      {" "}
                      · rem. {formatMoneyCents(c.remunerationCents)} · contrib.{" "}
                      {formatMoneyCents(c.contributionCents)}
                    </span>
                  </li>
                ))}
                {periods.slice(0, 20).map((p) => (
                  <li key={String(p.id)}>
                    <strong>{String(p.kind ?? "período")}</strong>
                    <span className="vj-meta">
                      {" "}
                      · {String(p.startDate ?? "—")} → {String(p.endDate ?? "—")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="calculos" className="vj-card vj-stack">
            <h2 className="vj-section-title">Cálculos</h2>
            {calculations.length === 0 ? (
              <p className="vj-meta">Nenhum cálculo neste caso.</p>
            ) : (
              <CalculationsTable items={calculations} caption="Cálculos do caso" />
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

          <section id="pericias" className="vj-card vj-stack">
            <h2 className="vj-section-title">Perícias</h2>
            <p className="vj-meta">
              Perícias e avaliações sociais ficam vinculadas aos requerimentos. Abra um requerimento
              na API ou cadastre via fluxo de perícia médica.
            </p>
          </section>

          <section id="prazos" className="vj-card vj-stack">
            <h2 className="vj-section-title">Prazos</h2>
            <p className="vj-meta">
              Prazos do caso jurídico:{" "}
              <a href={`/app/prazos?legalMatterId=${item.legalMatterId}`}>ver agenda de prazos</a>
            </p>
          </section>

          <section id="tarefas" className="vj-card vj-stack">
            <h2 className="vj-section-title">Tarefas</h2>
            <p className="vj-meta">
              Tarefas do caso jurídico:{" "}
              <a href={`/app/tarefas?legalMatterId=${item.legalMatterId}`}>ver tarefas</a>
            </p>
          </section>

          <section id="historico" className="vj-card vj-stack">
            <h2 className="vj-section-title">Histórico</h2>
            <p className="vj-meta">
              Criado {formatDateTime(item.createdAt)} · Atualizado {formatDateTime(item.updatedAt)}
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
