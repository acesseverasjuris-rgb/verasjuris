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
  LoadingState,
  PageHeader,
  Select,
  Textarea,
} from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  apiErrorMessage,
  convertLead,
  createNote,
  fetchLead,
  fetchLeadTimeline,
  getActiveOrgId,
  isApiFailure,
  updateLead,
  LEAD_STATUS_LABELS,
  PERSON_TYPE_LABELS,
  type CrmLeadStatus,
  type CrmTag,
  type CrmTimelineItem,
} from "../../../../../lib/crm";

type LeadDetail = {
  id: string;
  personType: "person" | "organization";
  name: string;
  tradeName: string | null;
  email: string | null;
  phone: string | null;
  status: CrmLeadStatus;
  summary: string | null;
  source: { id: string; name: string } | null;
  channel: { id: string; name: string } | null;
  tags: Array<{ tag: CrmTag } | CrmTag>;
  convertedClientId: string | null;
  convertedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function normalizeTags(tags: LeadDetail["tags"]): CrmTag[] {
  return tags.map((item) => ("tag" in item ? item.tag : item));
}

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const leadId = params.id;
  const [orgId, setOrgId] = useState<string | null>(null);
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [timeline, setTimeline] = useState<CrmTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState("");

  const reload = useCallback(
    async (activeId: string) => {
      const [leadData, timelineData] = await Promise.all([
        fetchLead(activeId, leadId),
        fetchLeadTimeline(activeId, leadId),
      ]);
      if (isApiFailure(leadData)) {
        setError(apiErrorMessage(leadData, "Não foi possível carregar o lead."));
        setLoading(false);
        return;
      }
      setLead(leadData.lead as unknown as LeadDetail);
      if (!isApiFailure(timelineData)) setTimeline(timelineData.items);
      setLoading(false);
    },
    [leadId],
  );

  useEffect(() => {
    void (async () => {
      const activeId = await getActiveOrgId();
      if (!activeId) {
        setError("Nenhuma organização ativa.");
        setLoading(false);
        return;
      }
      setOrgId(activeId);
      await reload(activeId);
    })();
  }, [reload]);

  async function saveStatus(status: CrmLeadStatus) {
    if (!orgId || !lead) return;
    setPending(true);
    setError(null);
    const result = await updateLead(orgId, lead.id, { status });
    setPending(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível atualizar o status."));
      return;
    }
    await reload(orgId);
  }

  async function submitNote(event: React.FormEvent) {
    event.preventDefault();
    if (!orgId || !lead || !note.trim()) return;
    setPending(true);
    setError(null);
    const result = await createNote(orgId, {
      resourceType: "lead",
      resourceId: lead.id,
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

  async function confirmConvert() {
    if (!orgId || !lead) return;
    setPending(true);
    setError(null);
    const result = await convertLead(orgId, lead.id);
    setPending(false);
    setConvertOpen(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível converter o lead."));
      return;
    }
    setMessage("Lead convertido. O histórico e as informações disponíveis foram preservados.");
    await reload(orgId);
  }

  const canConvert = lead && lead.status !== "converted" && !lead.convertedClientId;

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Painel", href: "/app" },
          { label: "CRM", href: "/app/crm" },
          { label: "Leads", href: "/app/crm/leads" },
          { label: lead?.name ?? "Lead" },
        ]}
      />
      {loading ? <LoadingState label="Carregando lead" /> : null}
      {error ? <ErrorState title="Erro ao carregar lead">{error}</ErrorState> : null}
      {message ? (
        <Alert tone="success" title={message}>
          {lead?.convertedClientId ? (
            <ButtonLink href={`/app/crm/clientes/${lead.convertedClientId}`} variant="secondary">
              Ver cliente
            </ButtonLink>
          ) : null}
        </Alert>
      ) : null}
      {lead ? (
        <>
          <PageHeader
            title={lead.name}
            description={lead.summary ?? "Sem resumo informado."}
            eyebrow={PERSON_TYPE_LABELS[lead.personType]}
            actions={
              canConvert ? (
                <Button type="button" onClick={() => setConvertOpen(true)}>
                  Converter em cliente
                </Button>
              ) : lead.convertedClientId ? (
                <ButtonLink href={`/app/crm/clientes/${lead.convertedClientId}`}>
                  Ver cliente
                </ButtonLink>
              ) : null
            }
          />
          <div className="vj-split">
            <section className="vj-card vj-stack" aria-labelledby="lead-info">
              <h2 id="lead-info" className="vj-section-title">
                Informações
              </h2>
              <p>
                <strong>Status:</strong>{" "}
                <Badge tone={lead.status === "converted" ? "success" : "neutral"}>
                  {LEAD_STATUS_LABELS[lead.status]}
                </Badge>
              </p>
              {lead.tradeName ? (
                <p>
                  <strong>Nome fantasia:</strong> {lead.tradeName}
                </p>
              ) : null}
              <p>
                <strong>E-mail:</strong> {lead.email ?? "—"}
              </p>
              <p>
                <strong>Telefone:</strong> {lead.phone ?? "—"}
              </p>
              <p>
                <strong>Origem:</strong> {lead.source?.name ?? "—"}
              </p>
              <p>
                <strong>Canal:</strong> {lead.channel?.name ?? "—"}
              </p>
              <p className="vj-meta">
                Criado em {new Date(lead.createdAt).toLocaleString("pt-BR")} · Atualizado em{" "}
                {new Date(lead.updatedAt).toLocaleString("pt-BR")}
              </p>
              {lead.status !== "converted" ? (
                <FormField id="status" label="Alterar status">
                  <Select
                    id="status"
                    value={lead.status}
                    disabled={pending}
                    onChange={(event) => void saveStatus(event.target.value as CrmLeadStatus)}
                  >
                    {(Object.keys(LEAD_STATUS_LABELS) as CrmLeadStatus[])
                      .filter((key) => key !== "converted")
                      .map((key) => (
                        <option key={key} value={key}>
                          {LEAD_STATUS_LABELS[key]}
                        </option>
                      ))}
                  </Select>
                </FormField>
              ) : null}
            </section>
            <section className="vj-card vj-stack" aria-labelledby="lead-tags">
              <h2 id="lead-tags" className="vj-section-title">
                Tags
              </h2>
              {normalizeTags(lead.tags).length === 0 ? (
                <p className="vj-meta">Nenhuma tag associada.</p>
              ) : (
                <ul className="vj-inline-actions">
                  {normalizeTags(lead.tags).map((tag) => (
                    <li key={tag.id}>
                      <Badge>{tag.name}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <section className="vj-card vj-stack" aria-labelledby="lead-notes">
            <h2 id="lead-notes" className="vj-section-title">
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
          <section className="vj-card vj-stack" aria-labelledby="lead-timeline">
            <h2 id="lead-timeline" className="vj-section-title">
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
            A conversão cria um cliente com os dados disponíveis do lead, preserva contatos e tags
            associadas e registra o histórico. O lead passará ao status convertido e não poderá
            voltar a outro status operacional.
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
