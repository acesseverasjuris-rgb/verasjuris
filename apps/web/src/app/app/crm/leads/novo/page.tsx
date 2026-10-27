"use client";

import {
  Alert,
  Breadcrumb,
  Button,
  ButtonLink,
  FormField,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  apiErrorMessage,
  createLead,
  fetchChannels,
  fetchSources,
  fetchTags,
  getActiveOrgId,
  isApiFailure,
  PERSON_TYPE_LABELS,
  type CrmChannel,
  type CrmPersonType,
  type CrmSource,
  type CrmTag,
} from "../../../../../lib/crm";

export default function NewLeadPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [personType, setPersonType] = useState<CrmPersonType>("person");
  const [sources, setSources] = useState<CrmSource[]>([]);
  const [channels, setChannels] = useState<CrmChannel[]>([]);
  const [tags, setTags] = useState<CrmTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void (async () => {
      const activeId = await getActiveOrgId();
      if (!activeId) {
        setError("Nenhuma organização ativa.");
        return;
      }
      setOrgId(activeId);
      const [sourcesData, channelsData, tagsData] = await Promise.all([
        fetchSources(activeId),
        fetchChannels(activeId),
        fetchTags(activeId),
      ]);
      if (!isApiFailure(sourcesData)) setSources(sourcesData.sources ?? []);
      if (!isApiFailure(channelsData)) setChannels(channelsData.channels ?? []);
      if (!isApiFailure(tagsData)) setTags(tagsData.tags ?? []);
    })();
  }, []);

  function toggleTag(tagId: string) {
    setSelectedTags((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId],
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orgId) return;
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      personType,
      name: String(form.get("name") ?? ""),
      tradeName:
        personType === "organization"
          ? String(form.get("tradeName") ?? "") || undefined
          : undefined,
      email: String(form.get("email") ?? "") || undefined,
      phone: String(form.get("phone") ?? "") || undefined,
      summary: String(form.get("summary") ?? "") || undefined,
      sourceId: String(form.get("sourceId") ?? "") || undefined,
      channelId: String(form.get("channelId") ?? "") || undefined,
      tagIds: selectedTags.length > 0 ? selectedTags : undefined,
    };
    const result = await createLead(orgId, payload);
    setPending(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível criar o lead."));
      return;
    }
    window.location.assign(`/app/crm/leads/${result.lead.id}`);
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Painel", href: "/app" },
          { label: "CRM", href: "/app/crm" },
          { label: "Leads", href: "/app/crm/leads" },
          { label: "Novo lead" },
        ]}
      />
      <PageHeader
        title="Novo lead"
        description="Registro progressivo. Escolha o tipo de pessoa e preencha apenas os campos necessários."
      />
      {error ? (
        <p role="alert" className="vj-field-error">
          {error}
        </p>
      ) : null}
      {step === 1 ? (
        <section className="vj-card vj-stack" aria-labelledby="step-type">
          <h2 id="step-type" className="vj-section-title">
            Passo 1 · Tipo de pessoa
          </h2>
          <p className="vj-prose">Selecione se o lead é pessoa física ou jurídica.</p>
          <div className="vj-split">
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
          <div className="vj-form-actions">
            <Button type="button" onClick={() => setStep(2)}>
              Continuar
            </Button>
            <ButtonLink href="/app/crm/leads" variant="secondary">
              Cancelar
            </ButtonLink>
          </div>
        </section>
      ) : (
        <form className="vj-card vj-stack" onSubmit={submit} aria-labelledby="step-details">
          <h2 id="step-details" className="vj-section-title">
            Passo 2 · Dados do lead
          </h2>
          <Alert tone="info" title={`Tipo selecionado: ${PERSON_TYPE_LABELS[personType]}`}>
            <button type="button" className="vj-button vj-button-ghost" onClick={() => setStep(1)}>
              Alterar tipo
            </button>
          </Alert>
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
          <FormField id="summary" label="Resumo">
            <Textarea id="summary" name="summary" maxLength={2000} />
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
          {tags.length > 0 ? (
            <fieldset className="vj-field">
              <legend className="vj-label">Tags</legend>
              <div className="vj-inline-actions">
                {tags.map((tag) => (
                  <label key={tag.id} className="vj-meta">
                    <input
                      type="checkbox"
                      checked={selectedTags.includes(tag.id)}
                      onChange={() => toggleTag(tag.id)}
                    />{" "}
                    {tag.name}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <div className="vj-form-actions">
            <Button type="submit" loading={pending} loadingLabel="Salvando">
              Criar lead
            </Button>
            <ButtonLink href="/app/crm/leads" variant="secondary">
              Cancelar
            </ButtonLink>
          </div>
        </form>
      )}
    </div>
  );
}
