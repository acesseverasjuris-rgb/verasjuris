"use client";

import {
  Alert,
  Breadcrumb,
  Button,
  ButtonLink,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Textarea,
} from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  apiErrorMessage,
  fetchChannels,
  fetchClients,
  fetchLeads,
  fetchSources,
  getActiveMembership,
  isApiFailure,
  PERSON_TYPE_LABELS,
  type CrmChannel,
  type CrmClientSummary,
  type CrmLeadSummary,
  type CrmPersonType,
  type CrmSource,
} from "../../../../lib/crm";
import {
  createIntake,
  fetchLegalAreas,
  getActiveOrgId,
  SERVICE_MODE_LABELS,
  URGENCY_LABELS,
  type IntakeServiceMode,
  type IntakeUrgency,
  type LegalArea,
} from "../../../../lib/intake";

type PersonMode = "lead" | "client" | "create";

export default function NovoAtendimentoPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [canCreate, setCanCreate] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<CrmSource[]>([]);
  const [channels, setChannels] = useState<CrmChannel[]>([]);
  const [legalAreas, setLegalAreas] = useState<LegalArea[]>([]);
  const [personMode, setPersonMode] = useState<PersonMode>("lead");
  const [personType, setPersonType] = useState<CrmPersonType>("person");
  const [personQuery, setPersonQuery] = useState("");
  const [personResults, setPersonResults] = useState<Array<CrmLeadSummary | CrmClientSummary>>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void (async () => {
      const [activeId, membership] = await Promise.all([getActiveOrgId(), getActiveMembership()]);
      if (!activeId) {
        setError("Nenhuma organização ativa.");
        setLoading(false);
        return;
      }
      setCanCreate(membership?.permissions.includes("intake.create") ?? false);
      setOrgId(activeId);
      const [sourcesData, channelsData, areasData] = await Promise.all([
        fetchSources(activeId),
        fetchChannels(activeId),
        fetchLegalAreas(activeId),
      ]);
      if (!isApiFailure(sourcesData)) setSources(sourcesData.sources ?? []);
      if (!isApiFailure(channelsData)) setChannels(channelsData.channels ?? []);
      if (!isApiFailure(areasData)) setLegalAreas(areasData.legalAreas);
      setLoading(false);
    })();
  }, []);

  async function searchPerson(event: React.FormEvent) {
    event.preventDefault();
    if (!orgId || !personQuery.trim()) return;
    setSearching(true);
    setError(null);
    setSelectedPersonId(null);
    if (personMode === "lead") {
      const data = await fetchLeads(orgId, { q: personQuery.trim(), limit: 10 });
      setSearching(false);
      if (isApiFailure(data)) {
        setError(apiErrorMessage(data, "Não foi possível buscar leads."));
        return;
      }
      setPersonResults(data.items);
    } else if (personMode === "client") {
      const data = await fetchClients(orgId, { q: personQuery.trim(), limit: 10 });
      setSearching(false);
      if (isApiFailure(data)) {
        setError(apiErrorMessage(data, "Não foi possível buscar clientes."));
        return;
      }
      setPersonResults(data.items);
    }
  }

  function personLabel(item: CrmLeadSummary | CrmClientSummary): string {
    if ("displayName" in item) return item.displayName;
    return item.name;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orgId) return;
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = {
      title: String(form.get("title") ?? ""),
      summary: String(form.get("summary") ?? "") || undefined,
      serviceMode: String(form.get("serviceMode") ?? "online") as IntakeServiceMode,
      urgency: String(form.get("urgency") ?? "normal") as IntakeUrgency,
      legalAreaId: String(form.get("legalAreaId") ?? "") || undefined,
      sourceId: String(form.get("sourceId") ?? "") || undefined,
      channelId: String(form.get("channelId") ?? "") || undefined,
    };

    if (personMode === "lead" && selectedPersonId) {
      payload.leadId = selectedPersonId;
    } else if (personMode === "client" && selectedPersonId) {
      payload.clientId = selectedPersonId;
    } else if (personMode === "create") {
      payload.createLead = {
        personType,
        name: String(form.get("name") ?? ""),
        tradeName:
          personType === "organization"
            ? String(form.get("tradeName") ?? "") || undefined
            : undefined,
        email: String(form.get("email") ?? "") || undefined,
        phone: String(form.get("phone") ?? "") || undefined,
      };
    }

    const result = await createIntake(orgId, payload);
    setPending(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível registrar o atendimento."));
      return;
    }
    window.location.assign(`/app/atendimentos/${result.intake.id}`);
  }

  if (loading) return <LoadingState label="Preparando formulário" />;

  if (!canCreate) {
    return (
      <div className="vj-stack">
        <Breadcrumb
          items={[
            { label: "Painel", href: "/app" },
            { label: "Atendimentos", href: "/app/atendimentos" },
            { label: "Novo atendimento" },
          ]}
        />
        <Alert tone="warning" title="Você não pode registrar atendimentos.">
          Solicite permissão à administração da organização, se necessário.
        </Alert>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Painel", href: "/app" },
          { label: "Atendimentos", href: "/app/atendimentos" },
          { label: "Novo atendimento" },
        ]}
      />
      <PageHeader
        title="Novo atendimento"
        description="Registre a demanda inicial com o que foi informado. A triagem detalhada pode ser feita em seguida."
      />
      {error ? (
        <p role="alert" className="vj-field-error">
          {error}
        </p>
      ) : null}
      <form className="vj-card vj-stack" onSubmit={submit} aria-labelledby="intake-form">
        <h2 id="intake-form" className="vj-section-title">
          Dados do atendimento
        </h2>
        <FormField id="title" label="Título">
          <Input id="title" name="title" required minLength={2} maxLength={200} />
        </FormField>
        <FormField id="summary" label="Resumo inicial">
          <Textarea
            id="summary"
            name="summary"
            maxLength={4000}
            placeholder="Descreva brevemente o que foi relatado, sem conclusões jurídicas."
          />
        </FormField>
        <div className="vj-split">
          <FormField id="serviceMode" label="Forma de atendimento">
            <Select id="serviceMode" name="serviceMode" defaultValue="online">
              {(Object.keys(SERVICE_MODE_LABELS) as IntakeServiceMode[]).map((key) => (
                <option key={key} value={key}>
                  {SERVICE_MODE_LABELS[key]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="urgency" label="Urgência informada">
            <Select id="urgency" name="urgency" defaultValue="normal">
              {(Object.keys(URGENCY_LABELS) as IntakeUrgency[]).map((key) => (
                <option key={key} value={key}>
                  {URGENCY_LABELS[key]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <FormField id="legalAreaId" label="Área jurídica">
          <Select id="legalAreaId" name="legalAreaId" defaultValue="">
            <option value="">A definir na triagem</option>
            {legalAreas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="vj-split">
          <FormField id="sourceId" label="Origem">
            <Select id="sourceId" name="sourceId" defaultValue="">
              <option value="">Não informada</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="channelId" label="Canal">
            <Select id="channelId" name="channelId" defaultValue="">
              <option value="">Não informado</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <h3 className="vj-section-title">Pessoa vinculada</h3>
        <p className="vj-prose">
          Vincule um lead ou cliente existente, ou registre um novo lead junto com o atendimento.
        </p>
        <div className="vj-inline-actions">
          <button
            type="button"
            className={`vj-button ${personMode === "lead" ? "vj-button-primary" : "vj-button-secondary"}`}
            onClick={() => {
              setPersonMode("lead");
              setPersonResults([]);
              setSelectedPersonId(null);
            }}
          >
            Lead existente
          </button>
          <button
            type="button"
            className={`vj-button ${personMode === "client" ? "vj-button-primary" : "vj-button-secondary"}`}
            onClick={() => {
              setPersonMode("client");
              setPersonResults([]);
              setSelectedPersonId(null);
            }}
          >
            Cliente existente
          </button>
          <button
            type="button"
            className={`vj-button ${personMode === "create" ? "vj-button-primary" : "vj-button-secondary"}`}
            onClick={() => {
              setPersonMode("create");
              setPersonResults([]);
              setSelectedPersonId(null);
            }}
          >
            Novo lead
          </button>
        </div>

        {personMode === "lead" || personMode === "client" ? (
          <div className="vj-stack">
            <form className="vj-split" onSubmit={searchPerson}>
              <FormField
                id="personQuery"
                label={personMode === "lead" ? "Buscar lead" : "Buscar cliente"}
              >
                <Input
                  id="personQuery"
                  value={personQuery}
                  onChange={(event) => setPersonQuery(event.target.value)}
                  placeholder="Nome, e-mail ou telefone"
                />
              </FormField>
              <div className="vj-form-actions">
                <Button type="submit" loading={searching} loadingLabel="Buscando">
                  Buscar
                </Button>
              </div>
            </form>
            {personResults.length > 0 ? (
              <fieldset className="vj-field">
                <legend className="vj-label">Selecione a pessoa</legend>
                <ul className="vj-stack">
                  {personResults.map((item) => (
                    <li key={item.id}>
                      <label className="vj-inline-actions">
                        <input
                          type="radio"
                          name="selectedPerson"
                          value={item.id}
                          checked={selectedPersonId === item.id}
                          onChange={() => setSelectedPersonId(item.id)}
                        />
                        <span>
                          {personLabel(item)}
                          {item.email ? ` · ${item.email}` : ""}
                          {item.phone ? ` · ${item.phone}` : ""}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            ) : null}
          </div>
        ) : (
          <div className="vj-stack">
            <div className="vj-inline-actions">
              <button
                type="button"
                className={`vj-button ${personType === "person" ? "vj-button-primary" : "vj-button-secondary"}`}
                onClick={() => setPersonType("person")}
              >
                {PERSON_TYPE_LABELS.person}
              </button>
              <button
                type="button"
                className={`vj-button ${personType === "organization" ? "vj-button-primary" : "vj-button-secondary"}`}
                onClick={() => setPersonType("organization")}
              >
                {PERSON_TYPE_LABELS.organization}
              </button>
            </div>
            <FormField id="name" label={personType === "person" ? "Nome completo" : "Razão social"}>
              <Input id="name" name="name" required minLength={2} maxLength={160} />
            </FormField>
            {personType === "organization" ? (
              <FormField id="tradeName" label="Nome fantasia">
                <Input id="tradeName" name="tradeName" maxLength={160} />
              </FormField>
            ) : null}
            <div className="vj-split">
              <FormField id="email" label="E-mail">
                <Input id="email" name="email" type="email" autoComplete="email" />
              </FormField>
              <FormField id="phone" label="Telefone">
                <Input id="phone" name="phone" type="tel" autoComplete="tel" />
              </FormField>
            </div>
          </div>
        )}

        <div className="vj-form-actions">
          <Button type="submit" loading={pending} loadingLabel="Registrando">
            Registrar atendimento
          </Button>
          <ButtonLink href="/app/atendimentos" variant="secondary">
            Cancelar
          </ButtonLink>
        </div>
      </form>
    </div>
  );
}
