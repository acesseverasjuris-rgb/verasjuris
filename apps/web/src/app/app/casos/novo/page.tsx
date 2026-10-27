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
import { fetchClients, type CrmClientSummary } from "../../../../lib/crm";
import {
  apiErrorMessage,
  createMatter,
  fetchDemandTypes,
  fetchLegalAreas,
  fetchLegalSubareas,
  fetchOrganizationMembers,
  getActiveMembership,
  getActiveOrgId,
  hasMatterPermission,
  isApiFailure,
  MATTER_PRIORITY_LABELS,
  type DemandType,
  type LegalArea,
  type LegalSubarea,
  type MatterPriority,
  type OrgMember,
} from "../../../../lib/matters";

export default function NovoCasoPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [canCreate, setCanCreate] = useState(true);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<CrmClientSummary[]>([]);
  const [demandTypes, setDemandTypes] = useState<DemandType[]>([]);
  const [legalAreas, setLegalAreas] = useState<LegalArea[]>([]);
  const [subareas, setSubareas] = useState<LegalSubarea[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [clientQuery, setClientQuery] = useState("");
  const [clientId, setClientId] = useState("");
  const [legalAreaId, setLegalAreaId] = useState("");
  const [legalSubareaId, setLegalSubareaId] = useState("");
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
      setCanCreate(hasMatterPermission(membership?.permissions, "create"));
      setOrgId(activeId);
      const [demandData, areasData, membersData] = await Promise.all([
        fetchDemandTypes(activeId),
        fetchLegalAreas(activeId),
        fetchOrganizationMembers(activeId),
      ]);
      if (!isApiFailure(demandData)) setDemandTypes(demandData.demandTypes);
      if (!isApiFailure(areasData)) setLegalAreas(areasData.legalAreas);
      if (!isApiFailure(membersData)) setMembers(membersData.members);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!orgId || !legalAreaId) {
      setSubareas([]);
      setLegalSubareaId("");
      return;
    }
    void (async () => {
      const data = await fetchLegalSubareas(orgId, { legalAreaId });
      if (!isApiFailure(data)) {
        setSubareas(data.legalSubareas);
      } else {
        setSubareas([]);
      }
      setLegalSubareaId("");
    })();
  }, [orgId, legalAreaId]);

  async function searchClients(event: React.FormEvent) {
    event.preventDefault();
    if (!orgId || !clientQuery.trim()) return;
    setSearching(true);
    setError(null);
    const data = await fetchClients(orgId, {
      q: clientQuery.trim(),
      status: "active",
      limit: 15,
    });
    setSearching(false);
    if (isApiFailure(data)) {
      setError(apiErrorMessage(data, "Não foi possível buscar clientes."));
      return;
    }
    setClients(data.items);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orgId || !clientId) {
      setError("Selecione um cliente para abrir o caso.");
      return;
    }
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const result = await createMatter(orgId, {
      clientId,
      title: String(form.get("title") ?? ""),
      summary: String(form.get("summary") ?? "") || undefined,
      demandTypeId: String(form.get("demandTypeId") ?? "") || undefined,
      legalAreaId: legalAreaId || undefined,
      legalSubareaId: legalSubareaId || undefined,
      priority: (String(form.get("priority") ?? "normal") as MatterPriority) || "normal",
      responsibleMembershipId: String(form.get("responsibleMembershipId") ?? "") || undefined,
    });
    setPending(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível criar o caso."));
      return;
    }
    window.location.assign(`/app/casos/${result.matter.id}`);
  }

  if (loading) return <LoadingState label="Preparando formulário" />;

  if (!canCreate) {
    return (
      <div className="vj-stack">
        <Breadcrumb
          items={[
            { label: "Painel", href: "/app" },
            { label: "Casos", href: "/app/casos" },
            { label: "Novo caso" },
          ]}
        />
        <Alert tone="error" title="Sem permissão">
          Você não tem permissão para abrir casos nesta organização.
        </Alert>
        <ButtonLink href="/app/casos" variant="secondary">
          Voltar aos casos
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Painel", href: "/app" },
          { label: "Casos", href: "/app/casos" },
          { label: "Novo caso" },
        ]}
      />
      <PageHeader
        title="Novo caso"
        description="Cadastro manual da unidade jurídica de trabalho. Informe o cliente, o contexto da demanda e o responsável."
      />
      {error ? (
        <p role="alert" className="vj-field-error">
          {error}
        </p>
      ) : null}

      <section className="vj-card vj-stack" aria-labelledby="client-search">
        <h2 id="client-search" className="vj-section-title">
          Cliente
        </h2>
        <p className="vj-meta">O caso exige um cliente ativo da organização.</p>
        <form className="vj-stack" onSubmit={searchClients} aria-label="Buscar cliente">
          <FormField id="clientQuery" label="Buscar cliente">
            <Input
              id="clientQuery"
              value={clientQuery}
              onChange={(event) => setClientQuery(event.target.value)}
              placeholder="Nome, e-mail ou documento"
            />
          </FormField>
          <div className="vj-form-actions">
            <Button type="submit" variant="secondary" disabled={searching}>
              {searching ? "Buscando…" : "Buscar"}
            </Button>
          </div>
        </form>
        {clients.length > 0 ? (
          <fieldset className="vj-stack">
            <legend className="vj-meta">Resultados</legend>
            {clients.map((client) => (
              <label key={client.id} className="vj-inline-actions">
                <input
                  type="radio"
                  name="clientPick"
                  value={client.id}
                  checked={clientId === client.id}
                  onChange={() => setClientId(client.id)}
                />
                <span>
                  {client.displayName}
                  {client.email ? <span className="vj-meta"> · {client.email}</span> : null}
                </span>
              </label>
            ))}
          </fieldset>
        ) : null}
        {clientId ? (
          <Alert tone="info" title="Cliente selecionado">
            {clients.find((item) => item.id === clientId)?.displayName ?? clientId}
          </Alert>
        ) : null}
      </section>

      <form className="vj-card vj-stack" onSubmit={submit} aria-labelledby="matter-form">
        <h2 id="matter-form" className="vj-section-title">
          Contexto da demanda
        </h2>
        <FormField id="title" label="Título">
          <Input
            id="title"
            name="title"
            required
            maxLength={200}
            placeholder="Ex.: Revisão contratual — Empresa X"
          />
        </FormField>
        <div className="vj-split">
          <FormField id="demandTypeId" label="Tipo de demanda">
            <Select id="demandTypeId" name="demandTypeId" defaultValue="">
              <option value="">Não informado</option>
              {demandTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="priority" label="Prioridade">
            <Select id="priority" name="priority" defaultValue="normal">
              {(Object.keys(MATTER_PRIORITY_LABELS) as MatterPriority[]).map((key) => (
                <option key={key} value={key}>
                  {MATTER_PRIORITY_LABELS[key]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div className="vj-split">
          <FormField id="legalAreaId" label="Área jurídica">
            <Select
              id="legalAreaId"
              value={legalAreaId}
              onChange={(event) => setLegalAreaId(event.target.value)}
            >
              <option value="">Não informada</option>
              {legalAreas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="legalSubareaId" label="Subárea">
            <Select
              id="legalSubareaId"
              value={legalSubareaId}
              onChange={(event) => setLegalSubareaId(event.target.value)}
              disabled={!legalAreaId}
            >
              <option value="">Não informada</option>
              {subareas.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <FormField id="summary" label="Resumo">
          <Textarea
            id="summary"
            name="summary"
            rows={4}
            placeholder="Situação narrada pelo cliente e o que precisa ser tratado."
          />
        </FormField>
        <FormField id="responsibleMembershipId" label="Responsável">
          <Select id="responsibleMembershipId" name="responsibleMembershipId" defaultValue="">
            <option value="">Não atribuído</option>
            {members.map((member) => (
              <option key={member.membershipId} value={member.membershipId}>
                {member.displayName}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="vj-form-actions">
          <Button type="submit" disabled={pending || !clientId}>
            {pending ? "Salvando…" : "Abrir caso"}
          </Button>
          <ButtonLink href="/app/casos" variant="secondary">
            Cancelar
          </ButtonLink>
        </div>
      </form>
    </div>
  );
}
