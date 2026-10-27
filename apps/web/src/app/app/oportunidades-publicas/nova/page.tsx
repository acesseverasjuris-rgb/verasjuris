"use client";

import {
  Alert,
  Breadcrumb,
  Button,
  ErrorState,
  FormField,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@verasjuris/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { NoPermission } from "../../../../components/ai-ui";
import { aiErrorMessage } from "../../../../lib/ai";
import {
  BR_STATES,
  createOpportunity,
  hasOpportunityPermission,
  isApiFailure,
  OPPORTUNITY_STATUS_LABELS,
  OPPORTUNITY_TYPE_LABELS,
  parseMoneyToCents,
  type CreateOpportunityInput,
  type PublicOpportunityStatus,
  type PublicOpportunityType,
} from "../../../../lib/public-opportunities";
import { useOrgContext } from "../../../../lib/use-org-context";

function dateToIso(value: string, endOfDay = false): string | undefined {
  if (!value) return undefined;
  return new Date(`${value}T${endOfDay ? "23:59:00" : "00:00:00"}`).toISOString();
}

export default function NovaOportunidadePage() {
  const router = useRouter();
  const org = useOrgContext();
  const canCreate = hasOpportunityPermission(org.permissions, "create");

  const [title, setTitle] = useState("");
  const [objectText, setObjectText] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<PublicOpportunityType>("tender");
  const [status, setStatus] = useState<PublicOpportunityStatus>("open");
  const [body, setBody] = useState("");
  const [processNumber, setProcessNumber] = useState("");
  const [procurementNumber, setProcurementNumber] = useState("");
  const [modality, setModality] = useState("");
  const [value, setValue] = useState("");
  const [publicationDate, setPublicationDate] = useState("");
  const [proposalDeadline, setProposalDeadline] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [sourceReference, setSourceReference] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Oportunidades públicas", href: "/app/oportunidades-publicas" },
    { label: "Cadastro manual" },
  ];

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!org.orgId) {
      setError("Nenhuma organização ativa.");
      return;
    }
    const nextErrors: Record<string, string> = {};
    if (!title.trim()) nextErrors.title = "Informe o título.";
    if (!objectText.trim()) nextErrors.object = "Informe o objeto da oportunidade.";
    let cents: number | undefined;
    if (value.trim()) {
      const parsed = parseMoneyToCents(value);
      if (parsed === null) nextErrors.value = "Informe um valor válido, por exemplo 1.250,00.";
      else cents = parsed;
    }
    if (sourceUrl.trim() && !sourceUrl.trim().startsWith("https://")) {
      nextErrors.sourceUrl = "O link deve começar com https://.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setPending(true);
    setError(null);
    const payload: CreateOpportunityInput = {
      title: title.trim(),
      object: objectText.trim(),
      description: description.trim() || undefined,
      opportunityType: type,
      status,
      publicBodyName: body.trim() || undefined,
      processNumber: processNumber.trim() || undefined,
      procurementNumber: procurementNumber.trim() || undefined,
      modality: modality.trim() || undefined,
      estimatedValueCents: cents,
      publicationDate: dateToIso(publicationDate),
      proposalDeadline: dateToIso(proposalDeadline, true),
      stateCode: stateCode || undefined,
      municipality: municipality.trim() || undefined,
      sourceReference: sourceReference.trim() || undefined,
      sourceUrl: sourceUrl.trim() || undefined,
      sourceProvider: "manual",
    };
    const result = await createOpportunity(org.orgId, payload);
    setPending(false);
    if (isApiFailure(result)) {
      setError(aiErrorMessage(result, "Não foi possível cadastrar a oportunidade."));
      return;
    }
    router.push(`/app/oportunidades-publicas/${result.opportunity.id}`);
  }

  if (org.ready && !canCreate) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para cadastrar oportunidades públicas.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Cadastrar oportunidade"
        description="Cadastro manual feito pela equipe. O registro será identificado como “CADASTRO MANUAL” e não representa fonte oficial."
      />
      <Alert tone="info" title="Informe a fonte original">
        Preencha o número do edital e o link da fonte sempre que possível, para que a equipe possa
        conferir os dados.
      </Alert>
      {error ? <ErrorState title="Não foi possível cadastrar">{error}</ErrorState> : null}

      <form className="vj-stack" onSubmit={(event) => void onSubmit(event)} noValidate>
        <section className="vj-card vj-stack" aria-labelledby="nova-basico">
          <h2 id="nova-basico" className="vj-section-title">
            Identificação
          </h2>
          <FormField id="nova-title" label="Título" error={errors.title}>
            <Input
              id="nova-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={500}
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? "nova-title-error" : undefined}
            />
          </FormField>
          <FormField
            id="nova-object"
            label="Objeto"
            error={errors.object}
            hint="O que está sendo contratado, credenciado ou concedido."
          >
            <Textarea
              id="nova-object"
              value={objectText}
              onChange={(event) => setObjectText(event.target.value)}
              required
              maxLength={8000}
              aria-invalid={Boolean(errors.object)}
              aria-describedby={`nova-object-hint${errors.object ? " nova-object-error" : ""}`}
            />
          </FormField>
          <FormField id="nova-description" label="Descrição" hint="Opcional">
            <Textarea
              id="nova-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={20000}
            />
          </FormField>
          <div className="vj-split">
            <FormField id="nova-type" label="Tipo">
              <Select
                id="nova-type"
                value={type}
                onChange={(event) => setType(event.target.value as PublicOpportunityType)}
              >
                {Object.entries(OPPORTUNITY_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="nova-status" label="Situação">
              <Select
                id="nova-status"
                value={status}
                onChange={(event) => setStatus(event.target.value as PublicOpportunityStatus)}
              >
                {Object.entries(OPPORTUNITY_STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        </section>

        <section className="vj-card vj-stack" aria-labelledby="nova-orgao">
          <h2 id="nova-orgao" className="vj-section-title">
            Órgão e processo
          </h2>
          <FormField id="nova-body" label="Órgão público">
            <Input
              id="nova-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={300}
            />
          </FormField>
          <div className="vj-split">
            <FormField id="nova-process" label="Número do processo">
              <Input
                id="nova-process"
                value={processNumber}
                onChange={(event) => setProcessNumber(event.target.value)}
                maxLength={120}
              />
            </FormField>
            <FormField id="nova-procurement" label="Número da licitação / edital">
              <Input
                id="nova-procurement"
                value={procurementNumber}
                onChange={(event) => setProcurementNumber(event.target.value)}
                maxLength={120}
              />
            </FormField>
          </div>
          <div className="vj-split">
            <FormField id="nova-modality" label="Modalidade">
              <Input
                id="nova-modality"
                value={modality}
                onChange={(event) => setModality(event.target.value)}
                maxLength={120}
              />
            </FormField>
            <FormField id="nova-value" label="Valor estimado (R$)" error={errors.value}>
              <Input
                id="nova-value"
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                aria-invalid={Boolean(errors.value)}
                aria-describedby={errors.value ? "nova-value-error" : undefined}
              />
            </FormField>
          </div>
          <div className="vj-split">
            <FormField id="nova-state" label="UF">
              <Select
                id="nova-state"
                value={stateCode}
                onChange={(event) => setStateCode(event.target.value)}
              >
                <option value="">Não informada</option>
                {BR_STATES.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="nova-city" label="Município">
              <Input
                id="nova-city"
                value={municipality}
                onChange={(event) => setMunicipality(event.target.value)}
                maxLength={200}
              />
            </FormField>
          </div>
        </section>

        <section className="vj-card vj-stack" aria-labelledby="nova-datas">
          <h2 id="nova-datas" className="vj-section-title">
            Datas e fonte
          </h2>
          <div className="vj-split">
            <FormField id="nova-publication" label="Data de publicação">
              <Input
                id="nova-publication"
                type="date"
                value={publicationDate}
                onChange={(event) => setPublicationDate(event.target.value)}
              />
            </FormField>
            <FormField id="nova-deadline" label="Prazo para proposta" hint="Fuso America/São_Paulo">
              <Input
                id="nova-deadline"
                type="date"
                value={proposalDeadline}
                onChange={(event) => setProposalDeadline(event.target.value)}
              />
            </FormField>
          </div>
          <FormField
            id="nova-source-ref"
            label="Referência da fonte"
            hint="Opcional. Ex.: número do edital no portal de origem."
          >
            <Input
              id="nova-source-ref"
              value={sourceReference}
              onChange={(event) => setSourceReference(event.target.value)}
              maxLength={200}
            />
          </FormField>
          <FormField
            id="nova-source-url"
            label="Link da fonte"
            error={errors.sourceUrl}
            hint="Opcional. Use https://"
          >
            <Input
              id="nova-source-url"
              type="url"
              inputMode="url"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              aria-invalid={Boolean(errors.sourceUrl)}
              aria-describedby={`nova-source-url-hint${errors.sourceUrl ? " nova-source-url-error" : ""}`}
            />
          </FormField>
        </section>

        <div className="vj-form-actions">
          <Button type="submit" loading={pending} loadingLabel="Salvando…">
            Cadastrar oportunidade
          </Button>
          <a className="vj-button vj-button-secondary" href="/app/oportunidades-publicas">
            Cancelar
          </a>
        </div>
      </form>
    </div>
  );
}
