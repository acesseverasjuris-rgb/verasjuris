"use client";

import {
  Alert,
  Breadcrumb,
  Button,
  ButtonLink,
  ErrorState,
  FormField,
  LoadingState,
  PageHeader,
  Select,
  Textarea,
} from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { NoPermission, StatePill } from "../../../../components/ai-ui";
import { AssistedAnalysisPanel } from "../../../../components/assisted-analysis-panel";
import { InterestBadge, SourceBadge } from "../../../../components/opportunity-ui";
import { aiErrorMessage, formatDateTime, hasPermission } from "../../../../lib/ai";
import {
  addRequirement,
  fetchOpportunity,
  formatOpportunityValue,
  hasOpportunityPermission,
  INTEREST_STATUS_LABELS,
  isApiFailure,
  OPPORTUNITY_STATUS_LABELS,
  OPPORTUNITY_TYPE_LABELS,
  opportunityStatusTone,
  REQUIREMENT_STATUS_LABELS,
  runOpportunityAnalysis,
  saveInterest,
  updateRequirement,
  type InterestStatus,
  type OpportunityDocument,
  type OpportunityInterest,
  type OpportunityLink,
  type OpportunityRequirement,
  type PublicOpportunityDetail,
  type RequirementStatus,
} from "../../../../lib/public-opportunities";
import type { LegalAnalysisSummary } from "../../../../lib/ai";
import { useOrgContext } from "../../../../lib/use-org-context";

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <p>
      <strong>{label}:</strong> {value}
    </p>
  );
}

export default function OportunidadeDetailPage() {
  const params = useParams<{ id: string }>();
  const opportunityId = params.id;
  const org = useOrgContext();
  const permissions = org.permissions;
  const canRead = hasOpportunityPermission(permissions, "read");
  const canSave = hasOpportunityPermission(permissions, "save");
  const canRequirements = hasOpportunityPermission(permissions, "manage_requirements");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opportunity, setOpportunity] = useState<PublicOpportunityDetail | null>(null);
  const [requirements, setRequirements] = useState<OpportunityRequirement[]>([]);
  const [documents, setDocuments] = useState<OpportunityDocument[]>([]);
  const [interest, setInterest] = useState<OpportunityInterest | null>(null);
  const [tasks, setTasks] = useState<OpportunityLink[]>([]);
  const [deadlines, setDeadlines] = useState<OpportunityLink[]>([]);

  const [interestStatus, setInterestStatus] = useState<InterestStatus>("saved");
  const [interestNotes, setInterestNotes] = useState("");
  const [interestPending, setInterestPending] = useState(false);
  const [interestMessage, setInterestMessage] = useState<string | null>(null);
  const [interestError, setInterestError] = useState<string | null>(null);

  const [reqText, setReqText] = useState("");
  const [reqMandatory, setReqMandatory] = useState(true);
  const [reqError, setReqError] = useState<string | null>(null);
  const [reqPending, setReqPending] = useState(false);

  const load = useCallback(async () => {
    if (!org.orgId) return;
    const data = await fetchOpportunity(org.orgId, opportunityId);
    if (isApiFailure(data)) {
      setError(aiErrorMessage(data, "Não foi possível carregar a oportunidade."));
      setLoading(false);
      return;
    }
    setOpportunity(data.opportunity);
    setRequirements(data.requirements);
    setDocuments(data.documents);
    setInterest(data.interest);
    setTasks(data.tasks);
    setDeadlines(data.deadlines);
    if (data.interest) {
      setInterestStatus(data.interest.status);
      setInterestNotes(data.interest.notes ?? "");
    }
    setLoading(false);
  }, [org.orgId, opportunityId]);

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    void load();
  }, [org.ready, org.orgId, canRead, load]);

  const loadAnalyses = useCallback(async () => {
    if (!org.orgId) return { items: [] as LegalAnalysisSummary[] };
    const data = await fetchOpportunity(org.orgId, opportunityId);
    if (isApiFailure(data)) return data;
    return { items: data.analyses };
  }, [org.orgId, opportunityId]);

  const runAnalysis = useCallback(
    async (analysisType: string) => {
      if (!org.orgId) {
        return { error: { code: "NOT_FOUND", message: "Nenhuma organização ativa." } };
      }
      return runOpportunityAnalysis(org.orgId, opportunityId, { analysisType });
    },
    [org.orgId, opportunityId],
  );

  async function onSaveInterest(event: React.FormEvent) {
    event.preventDefault();
    if (!org.orgId) return;
    setInterestPending(true);
    setInterestError(null);
    setInterestMessage(null);
    const result = await saveInterest(org.orgId, opportunityId, {
      status: interestStatus,
      notes: interestNotes.trim() || undefined,
    });
    setInterestPending(false);
    if (isApiFailure(result)) {
      setInterestError(aiErrorMessage(result, "Não foi possível salvar o interesse."));
      return;
    }
    setInterest(result.interest);
    setInterestMessage("Interesse salvo.");
  }

  async function onAddRequirement(event: React.FormEvent) {
    event.preventDefault();
    if (!org.orgId) return;
    if (!reqText.trim()) {
      setReqError("Descreva o requisito.");
      return;
    }
    setReqPending(true);
    setReqError(null);
    const result = await addRequirement(org.orgId, opportunityId, {
      description: reqText.trim(),
      mandatory: reqMandatory,
    });
    setReqPending(false);
    if (isApiFailure(result)) {
      setReqError(aiErrorMessage(result, "Não foi possível adicionar o requisito."));
      return;
    }
    setReqText("");
    await load();
  }

  async function onRequirementStatus(requirementId: string, status: RequirementStatus) {
    if (!org.orgId) return;
    setReqError(null);
    const result = await updateRequirement(org.orgId, opportunityId, requirementId, { status });
    if (isApiFailure(result)) {
      setReqError(aiErrorMessage(result, "Não foi possível atualizar o requisito."));
      return;
    }
    await load();
  }

  const baseBreadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Oportunidades públicas", href: "/app/oportunidades-publicas" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={[...baseBreadcrumb, { label: "Detalhe" }]} />
        <NoPermission>Você não tem permissão para consultar oportunidades públicas.</NoPermission>
      </div>
    );
  }
  if (loading || !org.ready) return <LoadingState label="Carregando oportunidade" />;
  if (error || !opportunity) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={[...baseBreadcrumb, { label: "Detalhe" }]} />
        <ErrorState title="Erro ao carregar oportunidade">
          {error ?? "Oportunidade não encontrada."}
        </ErrorState>
      </div>
    );
  }

  const isManual = opportunity.sourceProvider === "manual";

  return (
    <div className="vj-stack">
      <Breadcrumb items={[...baseBreadcrumb, { label: opportunity.title }]} />
      <PageHeader
        title={opportunity.title}
        eyebrow={OPPORTUNITY_TYPE_LABELS[opportunity.opportunityType]}
        description={opportunity.publicBodyName ?? "Órgão não informado"}
      />
      <div className="vj-inline-actions">
        <SourceBadge source={opportunity.sourceProvider} />
        <InterestBadge status={interest?.status} />
        <StatePill tone={opportunityStatusTone(opportunity.status)}>
          {OPPORTUNITY_STATUS_LABELS[opportunity.status]}
        </StatePill>
      </div>

      {isManual ? (
        <Alert tone="info" title="Cadastro manual">
          Este registro foi cadastrado pela equipe e não é fonte oficial. Confira os dados no edital
          original antes de agir.
        </Alert>
      ) : null}

      <div className="vj-detail-grid">
        <div className="vj-stack">
          <section className="vj-card vj-stack" aria-labelledby="op-object">
            <h2 id="op-object" className="vj-section-title">
              Objeto
            </h2>
            <p className="vj-prose">{opportunity.object}</p>
            {opportunity.description ? (
              <>
                <h3 className="vj-section-title">Descrição</h3>
                <p className="vj-prose">{opportunity.description}</p>
              </>
            ) : null}
          </section>

          <section className="vj-card vj-stack" aria-labelledby="op-data">
            <h2 id="op-data" className="vj-section-title">
              Dados do edital
            </h2>
            <MetaRow
              label="Número do processo"
              value={opportunity.processNumber ?? "Não informado"}
            />
            <MetaRow
              label="Número da licitação / edital"
              value={opportunity.procurementNumber ?? "Não informado"}
            />
            <MetaRow label="Modalidade" value={opportunity.modality ?? "Não informada"} />
            <MetaRow
              label="Valor estimado"
              value={formatOpportunityValue(opportunity.estimatedValueCents, opportunity.currency)}
            />
            <MetaRow label="Publicação" value={formatDateTime(opportunity.publicationDate)} />
            <MetaRow
              label="Prazo para proposta"
              value={formatDateTime(opportunity.proposalDeadline)}
            />
            <MetaRow
              label="Local"
              value={
                [opportunity.municipality, opportunity.stateCode].filter(Boolean).join(" / ") ||
                "Não informado"
              }
            />
            <MetaRow
              label="Fonte"
              value={
                opportunity.sourceUrl ? (
                  <a href={opportunity.sourceUrl} target="_blank" rel="noopener noreferrer">
                    Abrir link informado (nova aba)
                  </a>
                ) : (
                  "Link não informado"
                )
              }
            />
            {opportunity.sourceReference ? (
              <MetaRow label="Referência" value={opportunity.sourceReference} />
            ) : null}
          </section>

          <section className="vj-card vj-stack" aria-labelledby="op-reqs">
            <h2 id="op-reqs" className="vj-section-title">
              Requisitos
            </h2>
            {requirements.length === 0 ? (
              <p className="vj-meta">Nenhum requisito registrado.</p>
            ) : (
              <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {requirements.map((req) => (
                  <li key={req.id} className="vj-stack">
                    <p>
                      {req.description}{" "}
                      <span className="vj-meta">
                        {req.mandatory ? "(obrigatório)" : "(opcional)"}
                      </span>
                    </p>
                    <div className="vj-inline-actions">
                      <StatePill
                        tone={
                          req.status === "met"
                            ? "success"
                            : req.status === "not_met"
                              ? "error"
                              : req.status === "waived"
                                ? "neutral"
                                : "warning"
                        }
                      >
                        {REQUIREMENT_STATUS_LABELS[req.status]}
                      </StatePill>
                      {canRequirements ? (
                        <>
                          <label className="vj-visually-hidden" htmlFor={`req-${req.id}`}>
                            Situação do requisito: {req.description}
                          </label>
                          <Select
                            id={`req-${req.id}`}
                            value={req.status}
                            onChange={(event) =>
                              void onRequirementStatus(
                                req.id,
                                event.target.value as RequirementStatus,
                              )
                            }
                          >
                            {Object.entries(REQUIREMENT_STATUS_LABELS).map(([key, label]) => (
                              <option key={key} value={key}>
                                {label}
                              </option>
                            ))}
                          </Select>
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {reqError ? (
              <Alert tone="error" title="Requisitos">
                {reqError}
              </Alert>
            ) : null}
            {canRequirements ? (
              <form className="vj-stack" onSubmit={(event) => void onAddRequirement(event)}>
                <FormField id="req-new" label="Novo requisito">
                  <Textarea
                    id="req-new"
                    value={reqText}
                    onChange={(event) => setReqText(event.target.value)}
                    maxLength={2000}
                  />
                </FormField>
                <label className="vj-inline-actions" htmlFor="req-mandatory">
                  <input
                    id="req-mandatory"
                    type="checkbox"
                    checked={reqMandatory}
                    onChange={(event) => setReqMandatory(event.target.checked)}
                  />
                  Requisito obrigatório
                </label>
                <div className="vj-form-actions">
                  <Button
                    type="submit"
                    variant="secondary"
                    loading={reqPending}
                    loadingLabel="Adicionando…"
                  >
                    Adicionar requisito
                  </Button>
                </div>
              </form>
            ) : null}
          </section>

          <section className="vj-card vj-stack" aria-labelledby="op-docs">
            <h2 id="op-docs" className="vj-section-title">
              Documentos
            </h2>
            {documents.length === 0 ? (
              <p className="vj-meta">Nenhum documento vinculado.</p>
            ) : (
              <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {documents.map((doc) => (
                  <li key={doc.id}>
                    <a href={`/app/documentos/${doc.id}`}>{doc.title}</a>
                  </li>
                ))}
              </ul>
            )}
            <div>
              <ButtonLink href="/app/documentos" variant="secondary">
                Abrir documentos
              </ButtonLink>
            </div>
          </section>

          {hasPermission(permissions, "legal_analysis.read") ||
          hasPermission(permissions, "legal_analysis.create") ? (
            org.orgId ? (
              <AssistedAnalysisPanel
                orgId={org.orgId}
                headingId="op-analysis"
                heading="Análise assistida"
                canRun={hasPermission(permissions, "legal_analysis.create")}
                canReview={hasPermission(permissions, "legal_analysis.review")}
                analysisTypes={[{ value: "public_opportunity", label: "Análise da oportunidade" }]}
                loadItems={loadAnalyses}
                run={runAnalysis}
                emptyText="Nenhuma análise assistida foi gerada para esta oportunidade."
              />
            ) : null
          ) : null}
        </div>

        <aside className="vj-stack">
          <section className="vj-card vj-stack" aria-labelledby="op-interest">
            <h2 id="op-interest" className="vj-section-title">
              Interesse da organização
            </h2>
            {canSave ? (
              <form className="vj-stack" onSubmit={(event) => void onSaveInterest(event)}>
                <FormField id="op-interest-status" label="Situação">
                  <Select
                    id="op-interest-status"
                    value={interestStatus}
                    onChange={(event) => setInterestStatus(event.target.value as InterestStatus)}
                  >
                    {Object.entries(INTEREST_STATUS_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField id="op-interest-notes" label="Anotações internas">
                  <Textarea
                    id="op-interest-notes"
                    value={interestNotes}
                    onChange={(event) => setInterestNotes(event.target.value)}
                    maxLength={4000}
                  />
                </FormField>
                <div className="vj-form-actions">
                  <Button type="submit" loading={interestPending} loadingLabel="Salvando…">
                    {interest ? "Atualizar interesse" : "Salvar interesse"}
                  </Button>
                </div>
              </form>
            ) : (
              <p className="vj-meta">
                {interest
                  ? `Situação: ${INTEREST_STATUS_LABELS[interest.status]}`
                  : "Sem interesse registrado."}
              </p>
            )}
            {interestError ? (
              <Alert tone="error" title="Interesse">
                {interestError}
              </Alert>
            ) : null}
            {interestMessage ? <Alert tone="success" title={interestMessage} /> : null}
          </section>

          <section className="vj-card vj-stack" aria-labelledby="op-deadlines">
            <h2 id="op-deadlines" className="vj-section-title">
              Prazos
            </h2>
            {deadlines.length === 0 ? (
              <p className="vj-meta">Nenhum prazo vinculado.</p>
            ) : (
              <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {deadlines.map((item) => (
                  <li key={item.id}>
                    <a href={`/app/prazos/${item.id}`}>{item.title}</a>
                    {item.dueAt ? (
                      <div className="vj-meta">{formatDateTime(item.dueAt)}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {hasPermission(permissions, "deadline.create") ? (
              <div>
                <ButtonLink href="/app/prazos/novo" variant="secondary">
                  Registrar prazo
                </ButtonLink>
              </div>
            ) : null}
            <p className="vj-meta">
              O prazo para proposta deve ser conferido no edital. Registre um prazo jurídico para
              receber alertas.
            </p>
          </section>

          <section className="vj-card vj-stack" aria-labelledby="op-tasks">
            <h2 id="op-tasks" className="vj-section-title">
              Tarefas
            </h2>
            {tasks.length === 0 ? (
              <p className="vj-meta">Nenhuma tarefa vinculada.</p>
            ) : (
              <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {tasks.map((item) => (
                  <li key={item.id}>
                    <a href={`/app/tarefas/${item.id}`}>{item.title}</a>
                  </li>
                ))}
              </ul>
            )}
            {hasPermission(permissions, "task.create") ? (
              <div>
                <ButtonLink href="/app/tarefas/nova" variant="secondary">
                  Criar tarefa
                </ButtonLink>
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
