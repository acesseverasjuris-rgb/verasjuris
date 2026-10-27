"use client";

import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  ButtonLink,
  Dialog,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Textarea,
} from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  acceptProposal,
  activateEngagement,
  ANALYSIS_STATUS_LABELS,
  apiErrorMessage,
  approveProposal,
  archiveOpportunity,
  createProposal,
  ENGAGEMENT_STATUS_LABELS,
  fetchLossReasons,
  fetchOpportunity,
  formatMoneyFromCents,
  getActiveMembership,
  getActiveOrgId,
  isApiFailure,
  loseOpportunity,
  NEXT_ACTION_LABELS,
  openCaseFromOpportunity,
  PROPOSAL_STATUS_LABELS,
  sendProposal,
  STAGE_LABELS,
  stageBadgeTone,
  STATUS_LABELS,
  upsertOpportunityAnalysis,
  type LossReason,
  type NextActionHint,
  type OpportunityDetail,
  type PipelineAnalysis,
  type PipelineProposal,
} from "../../../../lib/pipeline";

function DataBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="vj-card vj-stack">
      <h2 className="vj-section-title">{title}</h2>
      {children}
    </section>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <p className="vj-meta">
      <strong>{label}:</strong> {value}
    </p>
  );
}

export default function PipelineDetailPage() {
  const params = useParams<{ id: string }>();
  const opportunityId = params.id;

  const [orgId, setOrgId] = useState<string | null>(null);
  const [canRead, setCanRead] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [canAnalysis, setCanAnalysis] = useState(false);
  const [canProposalCreate, setCanProposalCreate] = useState(false);
  const [canProposalApprove, setCanProposalApprove] = useState(false);
  const [canProposalSend, setCanProposalSend] = useState(false);
  const [canEngagement, setCanEngagement] = useState(false);
  const [canCase, setCanCase] = useState(false);

  const [opportunity, setOpportunity] = useState<OpportunityDetail | null>(null);
  const [lossReasons, setLossReasons] = useState<LossReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [loseOpen, setLoseOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [loseReasonId, setLoseReasonId] = useState("");
  const [loseNotes, setLoseNotes] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const [contractReference, setContractReference] = useState("");

  const [analysisForm, setAnalysisForm] = useState({
    summary: "",
    feasibilityNotes: "",
    riskNotes: "",
    missingInformation: "",
    recommendedNextStep: "",
    status: "draft" as PipelineAnalysis["status"],
  });

  const reload = useCallback(
    async (activeId: string) => {
      const data = await fetchOpportunity(activeId, opportunityId);
      if (isApiFailure(data)) {
        setError(apiErrorMessage(data, "Não foi possível carregar a oportunidade."));
        setLoading(false);
        return;
      }
      const item = data.opportunity;
      setOpportunity(item);
      if (item.analysis) {
        setAnalysisForm({
          summary: item.analysis.summary ?? "",
          feasibilityNotes: item.analysis.feasibilityNotes ?? "",
          riskNotes: item.analysis.riskNotes ?? "",
          missingInformation: item.analysis.missingInformation ?? "",
          recommendedNextStep: item.analysis.recommendedNextStep ?? "",
          status: item.analysis.status,
        });
      }
      setLoading(false);
    },
    [opportunityId],
  );

  useEffect(() => {
    void (async () => {
      const [activeId, membership] = await Promise.all([getActiveOrgId(), getActiveMembership()]);
      if (!activeId) {
        setError("Nenhuma organização ativa.");
        setLoading(false);
        return;
      }
      const readable = membership?.permissions.includes("pipeline.read") ?? false;
      setCanRead(readable);
      setCanManage(membership?.permissions.includes("pipeline.manage") ?? false);
      setCanAnalysis(membership?.permissions.includes("analysis.manage") ?? false);
      setCanProposalCreate(membership?.permissions.includes("proposal.create") ?? false);
      setCanProposalApprove(membership?.permissions.includes("proposal.approve") ?? false);
      setCanProposalSend(membership?.permissions.includes("proposal.send") ?? false);
      setCanEngagement(membership?.permissions.includes("engagement.manage") ?? false);
      setCanCase(
        membership?.permissions.includes("matter.create") ||
          membership?.permissions.includes("case.create") ||
          false,
      );
      if (!readable) {
        setLoading(false);
        return;
      }
      setOrgId(activeId);
      const reasonsData = await fetchLossReasons(activeId);
      if (!isApiFailure(reasonsData)) setLossReasons(reasonsData.lossReasons);
      await reload(activeId);
    })();
  }, [reload]);

  async function submitAnalysis(event: React.FormEvent) {
    event.preventDefault();
    if (!orgId) return;
    setPending(true);
    setError(null);
    const result = await upsertOpportunityAnalysis(orgId, opportunityId, {
      ...analysisForm,
      status: analysisForm.status,
    });
    setPending(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível salvar a análise."));
      return;
    }
    setMessage("Análise registrada.");
    await reload(orgId);
  }

  async function submitProposal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orgId) return;
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const priceRaw = String(form.get("priceCents") ?? "").replace(/\D/g, "");
    const result = await createProposal(orgId, opportunityId, {
      title: String(form.get("title") ?? ""),
      scope: String(form.get("scope") ?? "") || undefined,
      exclusions: String(form.get("exclusions") ?? "") || undefined,
      priceCents: Number(priceRaw) || 0,
      paymentTerms: String(form.get("paymentTerms") ?? "") || undefined,
    });
    setPending(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível criar a proposta."));
      return;
    }
    setProposalOpen(false);
    setMessage("Proposta registrada.");
    await reload(orgId);
  }

  async function handleApproveProposal(proposal: PipelineProposal) {
    if (!orgId) return;
    setPending(true);
    const result = await approveProposal(orgId, proposal.id);
    setPending(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível aprovar a proposta."));
      return;
    }
    setMessage("Proposta aprovada para envio.");
    await reload(orgId);
  }

  async function handleSendProposal(proposal: PipelineProposal) {
    if (!orgId) return;
    setPending(true);
    const result = await sendProposal(orgId, proposal.id);
    setPending(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível registrar o envio."));
      return;
    }
    setMessage("Envio da proposta registrado.");
    await reload(orgId);
  }

  async function handleAcceptProposal(proposal: PipelineProposal) {
    if (!orgId) return;
    setPending(true);
    const result = await acceptProposal(orgId, proposal.id);
    setPending(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível registrar o aceite."));
      return;
    }
    setMessage("Proposta aceita.");
    await reload(orgId);
  }

  async function handleActivateEngagement() {
    if (!orgId) return;
    setPending(true);
    const result = await activateEngagement(orgId, opportunityId, {
      contractReference: contractReference || undefined,
    });
    setPending(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível ativar a contratação."));
      return;
    }
    setMessage("Contratação ativa.");
    await reload(orgId);
  }

  async function handleOpenCase() {
    if (!orgId || !opportunity) return;
    setPending(true);
    const result = await openCaseFromOpportunity(orgId, opportunityId, {
      title: opportunity.title,
    });
    setPending(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível abrir o caso."));
      return;
    }
    setMessage("Caso aberto.");
    const caseId = result.matter?.id ?? result.case.id;
    if (caseId) {
      window.location.assign(`/app/casos/${caseId}`);
      return;
    }
    await reload(orgId);
  }

  async function confirmLose() {
    if (!orgId || !loseReasonId) return;
    setPending(true);
    const result = await loseOpportunity(orgId, opportunityId, {
      lossReasonId: loseReasonId,
      lossNotes: loseNotes || undefined,
    });
    setPending(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível registrar a perda."));
      return;
    }
    setLoseOpen(false);
    setMessage("Oportunidade registrada como perdida.");
    await reload(orgId);
  }

  async function confirmArchive() {
    if (!orgId) return;
    setPending(true);
    const result = await archiveOpportunity(orgId, opportunityId, {
      archiveReason: archiveReason || undefined,
    });
    setPending(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível arquivar."));
      return;
    }
    setArchiveOpen(false);
    setMessage("Oportunidade arquivada.");
    await reload(orgId);
  }

  function renderNextActionCta(nextAction: NextActionHint) {
    if (nextAction === "none" || !opportunity) return null;
    const label = NEXT_ACTION_LABELS[nextAction];
    if (nextAction === "start_intake" && opportunity.leadId) {
      return (
        <ButtonLink href={`/app/atendimentos/novo?leadId=${opportunity.leadId}`} variant="primary">
          {label}
        </ButtonLink>
      );
    }
    if (nextAction === "complete_triage" && opportunity.intakeId) {
      return (
        <ButtonLink href={`/app/atendimentos/${opportunity.intakeId}`} variant="primary">
          {label}
        </ButtonLink>
      );
    }
    if (nextAction === "complete_analysis" && canAnalysis) {
      return (
        <a href="#analise" className="vj-button vj-button-primary">
          {label}
        </a>
      );
    }
    if (nextAction === "create_proposal" && canProposalCreate) {
      return (
        <Button type="button" variant="primary" onClick={() => setProposalOpen(true)}>
          {label}
        </Button>
      );
    }
    if (nextAction === "send_proposal" && opportunity.proposal && canProposalSend) {
      return (
        <Button
          type="button"
          variant="primary"
          disabled={pending}
          onClick={() => void handleSendProposal(opportunity.proposal!)}
        >
          {label}
        </Button>
      );
    }
    if (nextAction === "accept_proposal" && opportunity.proposal && canProposalSend) {
      return (
        <Button
          type="button"
          variant="primary"
          disabled={pending}
          onClick={() => void handleAcceptProposal(opportunity.proposal!)}
        >
          {label}
        </Button>
      );
    }
    if (nextAction === "activate_engagement" && canEngagement) {
      return (
        <Button
          type="button"
          variant="primary"
          disabled={pending}
          onClick={() => void handleActivateEngagement()}
        >
          {label}
        </Button>
      );
    }
    if (nextAction === "open_case" && canCase) {
      return (
        <Button
          type="button"
          variant="primary"
          disabled={pending}
          onClick={() => void handleOpenCase()}
        >
          {label}
        </Button>
      );
    }
    return <p className="vj-meta">{label}</p>;
  }

  if (!canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb
          items={[
            { label: "Painel", href: "/app" },
            { label: "Pipeline", href: "/app/pipeline" },
            { label: "Detalhe" },
          ]}
        />
        <ErrorState title="Você não pode consultar o pipeline.">
          Nenhum dado foi exibido ou alterado.
        </ErrorState>
      </div>
    );
  }

  if (loading) return <LoadingState label="Carregando oportunidade" />;

  if (error && !opportunity) {
    return (
      <div className="vj-stack">
        <Breadcrumb
          items={[
            { label: "Painel", href: "/app" },
            { label: "Pipeline", href: "/app/pipeline" },
            { label: "Detalhe" },
          ]}
        />
        <ErrorState title="Erro ao carregar oportunidade">{error}</ErrorState>
      </div>
    );
  }

  if (!opportunity) return null;

  const isTerminal = opportunity.stage === "lost" || opportunity.stage === "archived";

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Painel", href: "/app" },
          { label: "Pipeline", href: "/app/pipeline" },
          { label: opportunity.title },
        ]}
      />
      <PageHeader
        title={opportunity.title}
        description="Registro da jornada comercial e jurídica. Informações registradas não constituem parecer."
        actions={
          canManage && !isTerminal ? (
            <div className="vj-inline-actions">
              <Button type="button" variant="secondary" onClick={() => setLoseOpen(true)}>
                Registrar perda
              </Button>
              <Button type="button" variant="secondary" onClick={() => setArchiveOpen(true)}>
                Arquivar
              </Button>
            </div>
          ) : null
        }
      />
      {message ? (
        <Alert tone="success" title="Atualização registrada">
          {message}
        </Alert>
      ) : null}
      {error ? (
        <Alert tone="error" title="Não foi possível concluir">
          {error}
        </Alert>
      ) : null}
      <div className="vj-detail-grid">
        <div className="vj-stack">
          <section className="vj-card vj-stack">
            <div className="vj-inline-actions">
              <Badge tone={stageBadgeTone(opportunity.stage)}>
                {STAGE_LABELS[opportunity.stage]}
              </Badge>
              <Badge tone="neutral">{STATUS_LABELS[opportunity.status]}</Badge>
            </div>
            <MetaRow
              label="Valor estimado"
              value={formatMoneyFromCents(opportunity.estimatedValueCents, opportunity.currency)}
            />
            <MetaRow label="Responsável" value={opportunity.responsible?.displayName ?? "—"} />
            <MetaRow label="Área jurídica" value={opportunity.legalArea?.name ?? "—"} />
            <MetaRow
              label="Atualizado"
              value={new Date(opportunity.updatedAt).toLocaleString("pt-BR")}
            />
            {opportunity.stage === "lost" && opportunity.lossReason ? (
              <>
                <MetaRow label="Motivo da perda" value={opportunity.lossReason.name} />
                {opportunity.lossNotes ? (
                  <MetaRow label="Observações" value={opportunity.lossNotes} />
                ) : null}
              </>
            ) : null}
            {opportunity.stage === "archived" && opportunity.archiveReason ? (
              <MetaRow label="Motivo do arquivamento" value={opportunity.archiveReason} />
            ) : null}
          </section>

          {opportunity.lead ? (
            <DataBlock title="Lead">
              <MetaRow label="Nome" value={opportunity.lead.name} />
              {opportunity.lead.email ? (
                <MetaRow label="E-mail" value={opportunity.lead.email} />
              ) : null}
              {opportunity.lead.phone ? (
                <MetaRow label="Telefone" value={opportunity.lead.phone} />
              ) : null}
              <ButtonLink href={`/app/crm/leads/${opportunity.lead.id}`} variant="secondary">
                Ver lead
              </ButtonLink>
            </DataBlock>
          ) : null}

          {opportunity.intake ? (
            <DataBlock title="Atendimento">
              <MetaRow label="Título" value={opportunity.intake.title} />
              <MetaRow label="Status" value={opportunity.intake.status} />
              {opportunity.intake.summary ? (
                <MetaRow label="Resumo" value={opportunity.intake.summary} />
              ) : null}
              <ButtonLink href={`/app/atendimentos/${opportunity.intake.id}`} variant="secondary">
                Ver atendimento
              </ButtonLink>
            </DataBlock>
          ) : null}

          {opportunity.triage ? (
            <DataBlock title="Triagem">
              <MetaRow label="Status" value={opportunity.triage.status} />
              {opportunity.triage.summary ? (
                <MetaRow label="Resumo" value={opportunity.triage.summary} />
              ) : null}
              {opportunity.triage.nextAction ? (
                <MetaRow label="Próxima ação registrada" value={opportunity.triage.nextAction} />
              ) : null}
            </DataBlock>
          ) : null}

          {opportunity.analysis ? (
            <DataBlock title="Análise">
              <MetaRow label="Status" value={ANALYSIS_STATUS_LABELS[opportunity.analysis.status]} />
              {opportunity.analysis.summary ? (
                <MetaRow label="Resumo" value={opportunity.analysis.summary} />
              ) : null}
              {opportunity.analysis.feasibilityNotes ? (
                <MetaRow label="Viabilidade" value={opportunity.analysis.feasibilityNotes} />
              ) : null}
              {opportunity.analysis.riskNotes ? (
                <MetaRow label="Riscos" value={opportunity.analysis.riskNotes} />
              ) : null}
            </DataBlock>
          ) : null}

          {canAnalysis && !isTerminal ? (
            <section className="vj-card vj-stack" id="analise">
              <h2 className="vj-section-title">
                {opportunity.analysis ? "Atualizar análise" : "Registrar análise"}
              </h2>
              <form className="vj-stack" onSubmit={submitAnalysis}>
                <FormField id="summary" label="Resumo">
                  <Textarea
                    id="summary"
                    value={analysisForm.summary}
                    onChange={(event) =>
                      setAnalysisForm((current) => ({ ...current, summary: event.target.value }))
                    }
                  />
                </FormField>
                <FormField id="feasibilityNotes" label="Notas de viabilidade">
                  <Textarea
                    id="feasibilityNotes"
                    value={analysisForm.feasibilityNotes}
                    onChange={(event) =>
                      setAnalysisForm((current) => ({
                        ...current,
                        feasibilityNotes: event.target.value,
                      }))
                    }
                  />
                </FormField>
                <FormField id="riskNotes" label="Riscos identificados">
                  <Textarea
                    id="riskNotes"
                    value={analysisForm.riskNotes}
                    onChange={(event) =>
                      setAnalysisForm((current) => ({ ...current, riskNotes: event.target.value }))
                    }
                  />
                </FormField>
                <FormField id="missingInformation" label="Informações pendentes">
                  <Textarea
                    id="missingInformation"
                    value={analysisForm.missingInformation}
                    onChange={(event) =>
                      setAnalysisForm((current) => ({
                        ...current,
                        missingInformation: event.target.value,
                      }))
                    }
                  />
                </FormField>
                <FormField id="recommendedNextStep" label="Próximo passo recomendado">
                  <Input
                    id="recommendedNextStep"
                    value={analysisForm.recommendedNextStep}
                    onChange={(event) =>
                      setAnalysisForm((current) => ({
                        ...current,
                        recommendedNextStep: event.target.value,
                      }))
                    }
                  />
                </FormField>
                <FormField id="analysisStatus" label="Status">
                  <Select
                    id="analysisStatus"
                    value={analysisForm.status}
                    onChange={(event) =>
                      setAnalysisForm((current) => ({
                        ...current,
                        status: event.target.value as PipelineAnalysis["status"],
                      }))
                    }
                  >
                    {(Object.keys(ANALYSIS_STATUS_LABELS) as PipelineAnalysis["status"][]).map(
                      (key) => (
                        <option key={key} value={key}>
                          {ANALYSIS_STATUS_LABELS[key]}
                        </option>
                      ),
                    )}
                  </Select>
                </FormField>
                <div className="vj-form-actions">
                  <Button type="submit" variant="primary" disabled={pending}>
                    {pending ? "Salvando…" : "Salvar análise"}
                  </Button>
                </div>
              </form>
            </section>
          ) : null}

          {opportunity.proposal ? (
            <DataBlock title="Proposta">
              <MetaRow label="Título" value={opportunity.proposal.title} />
              <MetaRow label="Status" value={PROPOSAL_STATUS_LABELS[opportunity.proposal.status]} />
              <MetaRow
                label="Valor"
                value={formatMoneyFromCents(
                  opportunity.proposal.priceCents,
                  opportunity.proposal.currency,
                )}
              />
              {opportunity.proposal.scope ? (
                <MetaRow label="Escopo" value={opportunity.proposal.scope} />
              ) : null}
              <div className="vj-inline-actions">
                {canProposalApprove &&
                (opportunity.proposal.status === "draft" ||
                  opportunity.proposal.status === "internal_review") ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => void handleApproveProposal(opportunity.proposal!)}
                  >
                    Aprovar proposta
                  </Button>
                ) : null}
                {canProposalSend && opportunity.proposal.status === "approved" ? (
                  <Button
                    type="button"
                    variant="primary"
                    disabled={pending}
                    onClick={() => void handleSendProposal(opportunity.proposal!)}
                  >
                    Registrar envio
                  </Button>
                ) : null}
                {canProposalSend && opportunity.proposal.status === "sent" ? (
                  <Button
                    type="button"
                    variant="primary"
                    disabled={pending}
                    onClick={() => void handleAcceptProposal(opportunity.proposal!)}
                  >
                    Registrar aceite
                  </Button>
                ) : null}
              </div>
            </DataBlock>
          ) : canProposalCreate && !isTerminal ? (
            <section className="vj-card vj-stack">
              <h2 className="vj-section-title">Proposta</h2>
              <p className="vj-meta">Nenhuma proposta registrada para esta oportunidade.</p>
              <Button type="button" variant="primary" onClick={() => setProposalOpen(true)}>
                Elaborar proposta
              </Button>
            </section>
          ) : null}

          {opportunity.engagement ? (
            <DataBlock title="Contratação">
              <MetaRow
                label="Status"
                value={ENGAGEMENT_STATUS_LABELS[opportunity.engagement.status]}
              />
              {opportunity.engagement.contractReference ? (
                <MetaRow
                  label="Referência contratual"
                  value={opportunity.engagement.contractReference}
                />
              ) : null}
              {canEngagement && opportunity.engagement.status !== "active" && !isTerminal ? (
                <FormField id="contractReference" label="Referência contratual (opcional)">
                  <Input
                    id="contractReference"
                    value={contractReference}
                    onChange={(event) => setContractReference(event.target.value)}
                  />
                </FormField>
              ) : null}
            </DataBlock>
          ) : null}

          {opportunity.client ? (
            <DataBlock title="Cliente">
              <MetaRow label="Nome" value={opportunity.client.displayName} />
              <MetaRow label="Status" value={opportunity.client.status} />
              <ButtonLink href={`/app/crm/clientes/${opportunity.client.id}`} variant="secondary">
                Ver cliente
              </ButtonLink>
            </DataBlock>
          ) : null}

          {opportunity.legalCase ? (
            <DataBlock title="Caso">
              <MetaRow label="Título" value={opportunity.legalCase.title} />
              <MetaRow label="Status" value={opportunity.legalCase.status} />
              <ButtonLink href={`/app/casos/${opportunity.legalCase.id}`} variant="secondary">
                Abrir caso
              </ButtonLink>
            </DataBlock>
          ) : null}
        </div>

        <aside className="vj-stack">
          <section className="vj-card vj-stack">
            <h2 className="vj-section-title">Próxima ação</h2>
            <p className="vj-meta">{NEXT_ACTION_LABELS[opportunity.nextAction]}</p>
            {renderNextActionCta(opportunity.nextAction)}
          </section>
          {canEngagement &&
          opportunity.engagement &&
          opportunity.engagement.status !== "active" &&
          !isTerminal ? (
            <section className="vj-card vj-stack">
              <h2 className="vj-section-title">Contratação</h2>
              <p className="vj-meta">
                Ative a contratação após o aceite da proposta, quando aplicável.
              </p>
              <Button
                type="button"
                variant="primary"
                disabled={pending}
                onClick={() => void handleActivateEngagement()}
              >
                Ativar contratação
              </Button>
            </section>
          ) : null}
          {opportunity.legalCase ? (
            <section className="vj-card vj-stack">
              <h2 className="vj-section-title">Caso</h2>
              <p className="vj-meta">{opportunity.legalCase.title}</p>
              <ButtonLink href={`/app/casos/${opportunity.legalCase.id}`} variant="primary">
                Ver caso
              </ButtonLink>
            </section>
          ) : null}
          {canCase && opportunity.client && !opportunity.legalCase && !isTerminal ? (
            <section className="vj-card vj-stack">
              <h2 className="vj-section-title">Caso</h2>
              <p className="vj-meta">
                Abra o LegalMatter (Caso) quando a contratação estiver registrada.
              </p>
              <Button
                type="button"
                variant="primary"
                disabled={pending}
                onClick={() => void handleOpenCase()}
              >
                Abrir caso
              </Button>
            </section>
          ) : null}
        </aside>
      </div>

      <Dialog open={loseOpen} title="Registrar perda" onClose={() => setLoseOpen(false)}>
        <div className="vj-stack">
          <p className="vj-meta">
            Registre o encerramento desta oportunidade sem conclusão contratual.
          </p>
          <FormField id="loseReasonId" label="Motivo">
            <Select
              id="loseReasonId"
              value={loseReasonId}
              onChange={(event) => setLoseReasonId(event.target.value)}
              required
            >
              <option value="">Selecione</option>
              {lossReasons.map((reason) => (
                <option key={reason.id} value={reason.id}>
                  {reason.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="loseNotes" label="Observações">
            <Textarea
              id="loseNotes"
              value={loseNotes}
              onChange={(event) => setLoseNotes(event.target.value)}
            />
          </FormField>
          <div className="vj-form-actions">
            <Button
              type="button"
              variant="danger"
              disabled={pending || !loseReasonId}
              onClick={() => void confirmLose()}
            >
              Confirmar perda
            </Button>
            <Button type="button" variant="secondary" onClick={() => setLoseOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={archiveOpen}
        title="Arquivar oportunidade"
        onClose={() => setArchiveOpen(false)}
      >
        <div className="vj-stack">
          <p className="vj-meta">
            A oportunidade permanecerá consultável, mas fora do quadro ativo.
          </p>
          <FormField id="archiveReason" label="Motivo (opcional)">
            <Textarea
              id="archiveReason"
              value={archiveReason}
              onChange={(event) => setArchiveReason(event.target.value)}
            />
          </FormField>
          <div className="vj-form-actions">
            <Button
              type="button"
              variant="primary"
              disabled={pending}
              onClick={() => void confirmArchive()}
            >
              Arquivar
            </Button>
            <Button type="button" variant="secondary" onClick={() => setArchiveOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={proposalOpen} title="Elaborar proposta" onClose={() => setProposalOpen(false)}>
        <form className="vj-stack" onSubmit={submitProposal}>
          <FormField id="proposalTitle" label="Título">
            <Input id="proposalTitle" name="title" required defaultValue={opportunity.title} />
          </FormField>
          <FormField id="scope" label="Escopo">
            <Textarea id="scope" name="scope" />
          </FormField>
          <FormField id="exclusions" label="Exclusões">
            <Textarea id="exclusions" name="exclusions" />
          </FormField>
          <FormField id="priceCents" label="Valor (centavos)">
            <Input id="priceCents" name="priceCents" inputMode="numeric" required />
          </FormField>
          <FormField id="paymentTerms" label="Condições de pagamento">
            <Textarea id="paymentTerms" name="paymentTerms" />
          </FormField>
          <div className="vj-form-actions">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Registrando…" : "Registrar proposta"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setProposalOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
