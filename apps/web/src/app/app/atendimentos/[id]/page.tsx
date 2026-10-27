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
import { getActiveMembership } from "../../../../lib/crm";
import {
  apiErrorMessage,
  convertIntake,
  createIntakeNote,
  DOCUMENT_STATUS_LABELS,
  fetchIntake,
  fetchIntakeDocuments,
  fetchIntakeTimeline,
  fetchLegalAreas,
  getActiveOrgId,
  INTAKE_STATUS_LABELS,
  isApiFailure,
  isNotConfiguredError,
  registerIntakeDocument,
  SERVICE_MODE_LABELS,
  TRIAGE_STATUS_LABELS,
  updateIntake,
  upsertTriage,
  URGENCY_FIELD_LABEL,
  URGENCY_LABELS,
  urgencyBadgeTone,
  type IntakeDetail,
  type IntakeDocument,
  type IntakeDocumentStatus,
  type IntakeStatus,
  type IntakeUrgency,
  type LegalArea,
  type Triage,
  type TriageStatus,
  type CrmTimelineItem,
} from "../../../../lib/intake";

export default function AtendimentoDetailPage() {
  const params = useParams<{ id: string }>();
  const intakeId = params.id;
  const [orgId, setOrgId] = useState<string | null>(null);
  const [canRead, setCanRead] = useState(true);
  const [canUpdate, setCanUpdate] = useState(false);
  const [canConvert, setCanConvert] = useState(false);
  const [intake, setIntake] = useState<IntakeDetail | null>(null);
  const [triage, setTriage] = useState<Triage | null>(null);
  const [documents, setDocuments] = useState<IntakeDocument[]>([]);
  const [timeline, setTimeline] = useState<CrmTimelineItem[]>([]);
  const [legalAreas, setLegalAreas] = useState<LegalArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [note, setNote] = useState("");
  const [docFilename, setDocFilename] = useState("");
  const [docStatus, setDocStatus] = useState<IntakeDocumentStatus>("pending");
  const [docReason, setDocReason] = useState("");
  const [uploadNotConfigured, setUploadNotConfigured] = useState(false);

  const reload = useCallback(
    async (activeId: string) => {
      const [intakeData, docsData, timelineData] = await Promise.all([
        fetchIntake(activeId, intakeId),
        fetchIntakeDocuments(activeId, intakeId),
        fetchIntakeTimeline(activeId, intakeId),
      ]);
      if (isApiFailure(intakeData)) {
        setError(apiErrorMessage(intakeData, "Não foi possível carregar o atendimento."));
        setLoading(false);
        return;
      }
      setIntake(intakeData.intake);
      setTriage(intakeData.intake.triage ?? null);
      if (!isApiFailure(docsData)) setDocuments(docsData.documents);
      if (!isApiFailure(timelineData)) setTimeline(timelineData.items);
      setLoading(false);
    },
    [intakeId],
  );

  useEffect(() => {
    void (async () => {
      const [activeId, membership] = await Promise.all([getActiveOrgId(), getActiveMembership()]);
      if (!activeId) {
        setError("Nenhuma organização ativa.");
        setLoading(false);
        return;
      }
      const readable = membership?.permissions.includes("intake.read") ?? false;
      setCanRead(readable);
      setCanUpdate(membership?.permissions.includes("intake.update") ?? false);
      setCanConvert(membership?.permissions.includes("intake.convert") ?? false);
      if (!readable) {
        setLoading(false);
        return;
      }
      setOrgId(activeId);
      const areasData = await fetchLegalAreas(activeId);
      if (!isApiFailure(areasData)) setLegalAreas(areasData.legalAreas);
      await reload(activeId);
    })();
  }, [reload]);

  async function saveStatus(status: IntakeStatus) {
    if (!orgId || !intake) return;
    setPending(true);
    setError(null);
    const result = await updateIntake(orgId, intake.id, { status });
    setPending(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível atualizar o status."));
      return;
    }
    await reload(orgId);
  }

  async function saveIntakeField(field: string, value: unknown) {
    if (!orgId || !intake) return;
    setPending(true);
    setError(null);
    const result = await updateIntake(orgId, intake.id, { [field]: value });
    setPending(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível salvar a alteração."));
      return;
    }
    await reload(orgId);
  }

  async function submitTriage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orgId || !intake) return;
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      summary: String(form.get("summary") ?? "") || undefined,
      facts: String(form.get("facts") ?? "") || undefined,
      requestNeed: String(form.get("requestNeed") ?? "") || undefined,
      relevantDates: String(form.get("relevantDates") ?? "") || undefined,
      riskNotes: String(form.get("riskNotes") ?? "") || undefined,
      missingInformation: String(form.get("missingInformation") ?? "") || undefined,
      nextAction: String(form.get("nextAction") ?? "") || undefined,
      status: String(form.get("triageStatus") ?? "") || undefined,
      urgency: String(form.get("triageUrgency") ?? "") || undefined,
      legalAreaId: String(form.get("triageLegalAreaId") ?? "") || undefined,
    };
    const result = await upsertTriage(orgId, intake.id, payload);
    setPending(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível salvar a triagem."));
      return;
    }
    setMessage(
      "Triagem salva. As informações registradas refletem o que foi levantado até o momento.",
    );
    await reload(orgId);
  }

  async function submitNote(event: React.FormEvent) {
    event.preventDefault();
    if (!orgId || !intake || !note.trim()) return;
    setPending(true);
    setError(null);
    const result = await createIntakeNote(orgId, {
      resourceId: intake.id,
      content: note.trim(),
    });
    setPending(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível salvar a anotação."));
      return;
    }
    setNote("");
    await reload(orgId);
  }

  async function submitDocument(event: React.FormEvent) {
    event.preventDefault();
    if (!orgId || !intake || !docFilename.trim()) return;
    setPending(true);
    setError(null);
    setUploadNotConfigured(false);
    const result = await registerIntakeDocument(orgId, intake.id, {
      filename: docFilename.trim(),
      status: docStatus,
      unavailableReason: docStatus === "unavailable" ? docReason.trim() || undefined : undefined,
    });
    setPending(false);
    if (isApiFailure(result)) {
      if (isNotConfiguredError(result)) {
        setUploadNotConfigured(true);
        setError(
          "O envio de arquivos ainda não está configurado nesta organização. Você pode registrar documentos como pendentes ou indisponíveis.",
        );
      } else {
        setError(apiErrorMessage(result, "Não foi possível registrar o documento."));
      }
      return;
    }
    setDocFilename("");
    setDocReason("");
    setDocStatus("pending");
    await reload(orgId);
  }

  async function confirmConvert() {
    if (!orgId || !intake) return;
    setPending(true);
    setError(null);
    const result = await convertIntake(orgId, intake.id);
    setPending(false);
    setConvertOpen(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível converter o atendimento."));
      return;
    }
    setMessage(
      "Atendimento convertido. O lead vinculado passou a cliente, preservando o histórico disponível.",
    );
    await reload(orgId);
  }

  const showConvert =
    canConvert && intake && intake.leadId && intake.status !== "converted" && !intake.convertedAt;

  if (!canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb
          items={[
            { label: "Painel", href: "/app" },
            { label: "Atendimentos", href: "/app/atendimentos" },
            { label: "Detalhe" },
          ]}
        />
        <ErrorState title="Você não pode consultar atendimentos.">
          Nenhum dado foi exibido ou alterado.
        </ErrorState>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Painel", href: "/app" },
          { label: "Atendimentos", href: "/app/atendimentos" },
          { label: intake?.title ?? "Atendimento" },
        ]}
      />
      {loading ? <LoadingState label="Carregando atendimento" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {message ? (
        <Alert tone="success" title={message}>
          {intake?.clientId ? (
            <ButtonLink href={`/app/crm/clientes/${intake.clientId}`} variant="secondary">
              Ver cliente
            </ButtonLink>
          ) : null}
        </Alert>
      ) : null}
      {intake ? (
        <>
          <PageHeader
            title={intake.title}
            description={intake.summary ?? "Sem resumo informado."}
            actions={
              showConvert ? (
                <Button type="button" onClick={() => setConvertOpen(true)}>
                  Converter lead em cliente
                </Button>
              ) : intake.clientId ? (
                <ButtonLink href={`/app/crm/clientes/${intake.clientId}`}>Ver cliente</ButtonLink>
              ) : null
            }
          />

          <div className="vj-split">
            <section className="vj-card vj-stack" aria-labelledby="intake-ident">
              <h2 id="intake-ident" className="vj-section-title">
                Identificação
              </h2>
              <p>
                <strong>Início:</strong> {new Date(intake.startedAt).toLocaleString("pt-BR")}
              </p>
              {intake.externalReference ? (
                <p>
                  <strong>Referência externa:</strong> {intake.externalReference}
                </p>
              ) : null}
              <p className="vj-meta">
                Criado em {new Date(intake.createdAt).toLocaleString("pt-BR")} · Atualizado em{" "}
                {new Date(intake.updatedAt).toLocaleString("pt-BR")}
              </p>
            </section>

            <section className="vj-card vj-stack" aria-labelledby="intake-person">
              <h2 id="intake-person" className="vj-section-title">
                Pessoa
              </h2>
              {intake.lead ? (
                <p>
                  <strong>Lead:</strong>{" "}
                  <a href={`/app/crm/leads/${intake.lead.id}`}>{intake.lead.name}</a>
                  {intake.lead.email ? (
                    <span className="vj-meta"> · {intake.lead.email}</span>
                  ) : null}
                </p>
              ) : null}
              {intake.client ? (
                <p>
                  <strong>Cliente:</strong>{" "}
                  <a href={`/app/crm/clientes/${intake.client.id}`}>{intake.client.displayName}</a>
                </p>
              ) : null}
              {intake.contact ? (
                <p>
                  <strong>Contato:</strong> {intake.contact.name}
                  {intake.contact.email ? (
                    <span className="vj-meta"> · {intake.contact.email}</span>
                  ) : null}
                </p>
              ) : null}
              {!intake.lead && !intake.client && !intake.contact ? (
                <p className="vj-meta">Nenhuma pessoa vinculada.</p>
              ) : null}
            </section>
          </div>

          <div className="vj-split">
            <section className="vj-card vj-stack" aria-labelledby="intake-status">
              <h2 id="intake-status" className="vj-section-title">
                Status
              </h2>
              <Badge
                tone={
                  intake.status === "converted" || intake.status === "qualified"
                    ? "success"
                    : intake.status === "not_qualified"
                      ? "warning"
                      : "neutral"
                }
              >
                {INTAKE_STATUS_LABELS[intake.status]}
              </Badge>
              {canUpdate && intake.status !== "converted" ? (
                <FormField id="status" label="Alterar status">
                  <Select
                    id="status"
                    value={intake.status}
                    disabled={pending}
                    onChange={(event) => void saveStatus(event.target.value as IntakeStatus)}
                  >
                    {(Object.keys(INTAKE_STATUS_LABELS) as IntakeStatus[])
                      .filter((key) => key !== "converted")
                      .map((key) => (
                        <option key={key} value={key}>
                          {INTAKE_STATUS_LABELS[key]}
                        </option>
                      ))}
                  </Select>
                </FormField>
              ) : null}
            </section>

            <section className="vj-card vj-stack" aria-labelledby="intake-area">
              <h2 id="intake-area" className="vj-section-title">
                Área jurídica
              </h2>
              {canUpdate ? (
                <FormField id="legalAreaId" label="Área">
                  <Select
                    id="legalAreaId"
                    value={intake.legalAreaId ?? ""}
                    disabled={pending}
                    onChange={(event) =>
                      void saveIntakeField("legalAreaId", event.target.value || null)
                    }
                  >
                    <option value="">A definir</option>
                    {legalAreas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              ) : (
                <p>{intake.legalArea?.name ?? "A definir"}</p>
              )}
            </section>
          </div>

          <div className="vj-split">
            <section className="vj-card vj-stack" aria-labelledby="intake-urgency">
              <h2 id="intake-urgency" className="vj-section-title">
                {URGENCY_FIELD_LABEL}
              </h2>
              <Badge tone={urgencyBadgeTone(intake.urgency)}>
                {URGENCY_LABELS[intake.urgency]}
              </Badge>
              {canUpdate ? (
                <FormField id="urgency" label={URGENCY_FIELD_LABEL}>
                  <Select
                    id="urgency"
                    value={intake.urgency}
                    disabled={pending}
                    onChange={(event) =>
                      void saveIntakeField("urgency", event.target.value as IntakeUrgency)
                    }
                  >
                    {(Object.keys(URGENCY_LABELS) as IntakeUrgency[]).map((key) => (
                      <option key={key} value={key}>
                        {URGENCY_LABELS[key]}
                      </option>
                    ))}
                  </Select>
                </FormField>
              ) : null}
            </section>

            <section className="vj-card vj-stack" aria-labelledby="intake-mode">
              <h2 id="intake-mode" className="vj-section-title">
                Forma de atendimento
              </h2>
              {canUpdate ? (
                <FormField id="serviceMode" label="Forma">
                  <Select
                    id="serviceMode"
                    value={intake.serviceMode}
                    disabled={pending}
                    onChange={(event) => void saveIntakeField("serviceMode", event.target.value)}
                  >
                    {Object.entries(SERVICE_MODE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </FormField>
              ) : (
                <p>{SERVICE_MODE_LABELS[intake.serviceMode]}</p>
              )}
            </section>
          </div>

          <section className="vj-card vj-stack" aria-labelledby="intake-summary">
            <h2 id="intake-summary" className="vj-section-title">
              Resumo
            </h2>
            <p>{intake.summary ?? "Sem resumo informado."}</p>
            <p className="vj-meta">
              <strong>Origem:</strong> {intake.source?.name ?? "—"} · <strong>Canal:</strong>{" "}
              {intake.channel?.name ?? "—"}
            </p>
          </section>

          <section className="vj-card vj-stack" aria-labelledby="intake-triage">
            <h2 id="intake-triage" className="vj-section-title">
              Triagem
            </h2>
            <p className="vj-prose">
              Registre o contexto levantado na triagem. Isso não substitui análise jurídica
              formalizada.
            </p>
            {triage ? (
              <p className="vj-meta">
                Status da triagem:{" "}
                <Badge tone="neutral">{TRIAGE_STATUS_LABELS[triage.status]}</Badge>
              </p>
            ) : null}
            <form className="vj-stack" onSubmit={submitTriage}>
              <FormField id="summary" label="Contexto">
                <Textarea
                  id="summary"
                  name="summary"
                  defaultValue={triage?.summary ?? ""}
                  maxLength={4000}
                  disabled={!canUpdate || pending}
                />
              </FormField>
              <FormField id="facts" label="Situação">
                <Textarea
                  id="facts"
                  name="facts"
                  defaultValue={triage?.facts ?? ""}
                  maxLength={8000}
                  disabled={!canUpdate || pending}
                />
              </FormField>
              <FormField id="requestNeed" label="Informações e necessidade">
                <Textarea
                  id="requestNeed"
                  name="requestNeed"
                  defaultValue={triage?.requestNeed ?? ""}
                  maxLength={4000}
                  disabled={!canUpdate || pending}
                />
              </FormField>
              <FormField id="relevantDates" label="Datas relevantes">
                <Textarea
                  id="relevantDates"
                  name="relevantDates"
                  defaultValue={triage?.relevantDates ?? ""}
                  maxLength={2000}
                  disabled={!canUpdate || pending}
                />
              </FormField>
              <FormField id="missingInformation" label="Pendências">
                <Textarea
                  id="missingInformation"
                  name="missingInformation"
                  defaultValue={triage?.missingInformation ?? ""}
                  maxLength={4000}
                  disabled={!canUpdate || pending}
                />
              </FormField>
              <FormField id="nextAction" label="Próxima ação">
                <Textarea
                  id="nextAction"
                  name="nextAction"
                  defaultValue={triage?.nextAction ?? ""}
                  maxLength={2000}
                  disabled={!canUpdate || pending}
                />
              </FormField>
              <FormField id="riskNotes" label="Observações de risco">
                <Textarea
                  id="riskNotes"
                  name="riskNotes"
                  defaultValue={triage?.riskNotes ?? ""}
                  maxLength={4000}
                  disabled={!canUpdate || pending}
                />
              </FormField>
              <div className="vj-split">
                <FormField id="triageStatus" label="Status da triagem">
                  <Select
                    id="triageStatus"
                    name="triageStatus"
                    defaultValue={triage?.status ?? "draft"}
                    disabled={!canUpdate || pending}
                  >
                    {(Object.keys(TRIAGE_STATUS_LABELS) as TriageStatus[]).map((key) => (
                      <option key={key} value={key}>
                        {TRIAGE_STATUS_LABELS[key]}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField id="triageUrgency" label={URGENCY_FIELD_LABEL}>
                  <Select
                    id="triageUrgency"
                    name="triageUrgency"
                    defaultValue={triage?.urgency ?? intake.urgency}
                    disabled={!canUpdate || pending}
                  >
                    {(Object.keys(URGENCY_LABELS) as IntakeUrgency[]).map((key) => (
                      <option key={key} value={key}>
                        {URGENCY_LABELS[key]}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
              <FormField id="triageLegalAreaId" label="Área jurídica (triagem)">
                <Select
                  id="triageLegalAreaId"
                  name="triageLegalAreaId"
                  defaultValue={triage?.legalAreaId ?? intake.legalAreaId ?? ""}
                  disabled={!canUpdate || pending}
                >
                  <option value="">A definir</option>
                  {legalAreas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              {canUpdate ? (
                <Button type="submit" loading={pending} loadingLabel="Salvando">
                  Salvar triagem
                </Button>
              ) : null}
            </form>
          </section>

          <section className="vj-card vj-stack" aria-labelledby="intake-docs">
            <h2 id="intake-docs" className="vj-section-title">
              Documentos iniciais
            </h2>
            {uploadNotConfigured ? (
              <Alert tone="info" title="Envio de arquivos não configurado">
                O armazenamento de documentos ainda não está disponível. Registre metadados como
                pendente ou indisponível conforme a situação informada.
              </Alert>
            ) : (
              <p className="vj-prose">
                O envio de arquivos depende de configuração de armazenamento. Enquanto isso, é
                possível registrar documentos como pendentes ou indisponíveis.
              </p>
            )}
            {documents.length === 0 ? (
              <p className="vj-meta">Nenhum documento registrado.</p>
            ) : (
              <ul className="vj-stack">
                {documents.map((doc) => (
                  <li key={doc.id}>
                    <strong>{doc.filename}</strong> · {DOCUMENT_STATUS_LABELS[doc.status]}
                    {doc.unavailableReason ? (
                      <span className="vj-meta"> — {doc.unavailableReason}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {canUpdate ? (
              <form className="vj-stack" onSubmit={submitDocument}>
                <FormField id="docFilename" label="Nome do documento">
                  <Input
                    id="docFilename"
                    value={docFilename}
                    onChange={(event) => setDocFilename(event.target.value)}
                    required
                    maxLength={200}
                    placeholder="Ex.: RG, comprovante de residência"
                  />
                </FormField>
                <FormField id="docStatus" label="Situação">
                  <Select
                    id="docStatus"
                    value={docStatus}
                    onChange={(event) => setDocStatus(event.target.value as IntakeDocumentStatus)}
                  >
                    <option value="pending">{DOCUMENT_STATUS_LABELS.pending}</option>
                    <option value="unavailable">{DOCUMENT_STATUS_LABELS.unavailable}</option>
                  </Select>
                </FormField>
                {docStatus === "unavailable" ? (
                  <FormField id="docReason" label="Motivo da indisponibilidade">
                    <Input
                      id="docReason"
                      value={docReason}
                      onChange={(event) => setDocReason(event.target.value)}
                      maxLength={500}
                    />
                  </FormField>
                ) : null}
                <Button type="submit" loading={pending} loadingLabel="Registrando">
                  Registrar documento
                </Button>
              </form>
            ) : null}
          </section>

          <section className="vj-card vj-stack" aria-labelledby="intake-notes">
            <h2 id="intake-notes" className="vj-section-title">
              Anotações
            </h2>
            <form className="vj-stack" onSubmit={submitNote}>
              <FormField id="note" label="Nova anotação">
                <Textarea
                  id="note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  required
                  minLength={1}
                  maxLength={8000}
                />
              </FormField>
              <Button type="submit" loading={pending} loadingLabel="Salvando">
                Registrar anotação
              </Button>
            </form>
          </section>

          <section className="vj-card vj-stack" aria-labelledby="intake-timeline">
            <h2 id="intake-timeline" className="vj-section-title">
              Linha do tempo
            </h2>
            {timeline.length === 0 ? (
              <p className="vj-meta">
                Interações e anotações aparecerão aqui conforme forem registradas.
              </p>
            ) : (
              <ul className="vj-stack">
                {timeline.map((item) => (
                  <li key={`${item.kind}-${item.id}`}>
                    <strong>{item.title}</strong>
                    <span className="vj-meta">
                      {" "}
                      · {new Date(item.occurredAt).toLocaleString("pt-BR")}
                    </span>
                    {item.body ? <p>{item.body}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      <Dialog
        open={convertOpen}
        title="Converter lead em cliente"
        onClose={() => setConvertOpen(false)}
      >
        <div className="vj-stack">
          <p>
            A conversão cria um cliente a partir do lead vinculado, preserva o histórico disponível
            e atualiza o status do atendimento. Esta ação não substitui análise jurídica do caso.
          </p>
          <div className="vj-form-actions">
            <Button
              type="button"
              loading={pending}
              loadingLabel="Convertendo"
              onClick={() => void confirmConvert()}
            >
              Confirmar conversão
            </Button>
            <Button type="button" variant="secondary" onClick={() => setConvertOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
