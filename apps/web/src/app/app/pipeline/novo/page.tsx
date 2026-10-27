"use client";

import {
  Alert,
  Breadcrumb,
  Button,
  ButtonLink,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Textarea,
} from "@verasjuris/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  apiErrorMessage,
  createOpportunity,
  fetchLegalAreas,
  getActiveMembership,
  getActiveOrgId,
  isApiFailure,
  searchLeadsForOpportunity,
  type LegalArea,
} from "../../../../lib/pipeline";
import type { CrmLeadSummary } from "../../../../lib/crm";

export default function NovaOportunidadePage() {
  const router = useRouter();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leadQuery, setLeadQuery] = useState("");
  const [leadResults, setLeadResults] = useState<CrmLeadSummary[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [legalAreas, setLegalAreas] = useState<LegalArea[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    void (async () => {
      const [activeId, membership] = await Promise.all([getActiveOrgId(), getActiveMembership()]);
      if (!activeId) {
        setError("Nenhuma organização ativa.");
        setLoading(false);
        return;
      }
      const manageable = membership?.permissions.includes("pipeline.manage") ?? false;
      setCanManage(manageable);
      if (!manageable) {
        setLoading(false);
        return;
      }
      setOrgId(activeId);
      const areasData = await fetchLegalAreas(activeId);
      if (!isApiFailure(areasData)) setLegalAreas(areasData.legalAreas);
      setLoading(false);
    })();
  }, []);

  async function searchLeads(event: React.FormEvent) {
    event.preventDefault();
    if (!orgId || leadQuery.trim().length < 2) return;
    setSearching(true);
    setError(null);
    const data = await searchLeadsForOpportunity(orgId, leadQuery.trim());
    setSearching(false);
    if (isApiFailure(data)) {
      setError(apiErrorMessage(data, "Não foi possível buscar leads."));
      return;
    }
    setLeadResults(data.items);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orgId) return;
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const estimatedRaw = String(form.get("estimatedValue") ?? "").replace(/\D/g, "");
    const payload = {
      title: String(form.get("title") ?? ""),
      leadId: selectedLeadId || undefined,
      legalAreaId: String(form.get("legalAreaId") ?? "") || undefined,
      estimatedValueCents: estimatedRaw ? Number(estimatedRaw) : undefined,
    };
    const result = await createOpportunity(orgId, payload);
    setPending(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível criar a oportunidade."));
      return;
    }
    router.push(`/app/pipeline/${result.opportunity.id}`);
  }

  if (loading) return <LoadingState label="Carregando formulário" />;

  if (!canManage) {
    return (
      <div className="vj-stack">
        <Breadcrumb
          items={[
            { label: "Painel", href: "/app" },
            { label: "Pipeline", href: "/app/pipeline" },
            { label: "Nova oportunidade" },
          ]}
        />
        <ErrorState title="Você não pode registrar oportunidades.">
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
          { label: "Pipeline", href: "/app/pipeline" },
          { label: "Nova oportunidade" },
        ]}
      />
      <PageHeader
        title="Nova oportunidade"
        description="Registre uma oportunidade a partir de um lead qualificado ou informe os dados manualmente."
      />
      {error ? (
        <Alert tone="error" title="Não foi possível concluir">
          {error}
        </Alert>
      ) : null}
      <section className="vj-card vj-stack">
        <h2 className="vj-section-title">Buscar lead (opcional)</h2>
        <form className="vj-inline-actions" onSubmit={searchLeads}>
          <FormField id="leadQuery" label="Nome, e-mail ou telefone">
            <Input
              id="leadQuery"
              value={leadQuery}
              onChange={(event) => setLeadQuery(event.target.value)}
              placeholder="Digite ao menos 2 caracteres"
            />
          </FormField>
          <button type="submit" className="vj-button vj-button-secondary" disabled={searching}>
            {searching ? "Buscando…" : "Buscar"}
          </button>
        </form>
        {leadResults.length > 0 ? (
          <FormField id="selectedLeadId" label="Lead encontrado">
            <Select
              id="selectedLeadId"
              value={selectedLeadId}
              onChange={(event) => setSelectedLeadId(event.target.value)}
            >
              <option value="">Nenhum selecionado</option>
              {leadResults.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.name}
                  {lead.email ? ` · ${lead.email}` : ""}
                </option>
              ))}
            </Select>
          </FormField>
        ) : null}
      </section>
      <form className="vj-card vj-stack" onSubmit={submit}>
        <FormField id="title" label="Título">
          <Input
            id="title"
            name="title"
            required
            placeholder="Ex.: Consultoria trabalhista — Silva"
          />
        </FormField>
        <FormField id="legalAreaId" label="Área jurídica">
          <Select id="legalAreaId" name="legalAreaId">
            <option value="">Não informada</option>
            {legalAreas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="estimatedValue" label="Valor estimado (R$)">
          <Input
            id="estimatedValue"
            name="estimatedValue"
            inputMode="numeric"
            placeholder="Ex.: 500000 para R$ 5.000,00"
          />
          <p className="vj-hint">Informe o valor em centavos, sem pontuação.</p>
        </FormField>
        <FormField id="notes" label="Observações">
          <Textarea id="notes" name="notes" placeholder="Contexto inicial, se houver." />
        </FormField>
        <div className="vj-form-actions">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Registrando…" : "Registrar oportunidade"}
          </Button>
          <ButtonLink href="/app/pipeline" variant="secondary">
            Cancelar
          </ButtonLink>
        </div>
      </form>
    </div>
  );
}
