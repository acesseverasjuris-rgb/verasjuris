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
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ADMIN_PRIORITY_LABELS,
  apiErrorMessage,
  createAdministrativeProcess,
  fetchAdministrativeBodies,
  getActiveMembership,
  getActiveOrgId,
  hasAdministrativePermission,
  isApiFailure,
  type AdministrativeBody,
  type AdministrativePriority,
} from "../../../../../../lib/administrative";
import {
  fetchMatter,
  fetchOrganizationMembers,
  type OrgMember,
} from "../../../../../../lib/matters";

export default function NovoProcessoAdministrativoPage() {
  const params = useParams<{ id: string }>();
  const matterId = params.id;

  const [orgId, setOrgId] = useState<string | null>(null);
  const [canCreate, setCanCreate] = useState(true);
  const [loading, setLoading] = useState(true);
  const [matterTitle, setMatterTitle] = useState("Caso");
  const [matterRef, setMatterRef] = useState("");
  const [bodies, setBodies] = useState<AdministrativeBody[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);

  const [administrativeBodyId, setAdministrativeBodyId] = useState("");
  const [number, setNumber] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [protocolNumber, setProtocolNumber] = useState("");
  const [protocolDate, setProtocolDate] = useState("");
  const [priority, setPriority] = useState<AdministrativePriority>("normal");
  const [currentPhase, setCurrentPhase] = useState("");
  const [responsibleMembershipId, setResponsibleMembershipId] = useState("");
  const [externalReference, setExternalReference] = useState("");

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
      setCanCreate(hasAdministrativePermission(membership?.permissions, "create"));
      setOrgId(activeId);

      const [matterData, bodiesData, membersData] = await Promise.all([
        fetchMatter(activeId, matterId),
        fetchAdministrativeBodies(activeId),
        fetchOrganizationMembers(activeId),
      ]);
      if (!isApiFailure(matterData)) {
        setMatterTitle(matterData.matter.title);
        setMatterRef(matterData.matter.internalReference);
        if (matterData.matter.responsibleMembershipId) {
          setResponsibleMembershipId(matterData.matter.responsibleMembershipId);
        }
      }
      if (!isApiFailure(bodiesData)) {
        setBodies(bodiesData.bodies.filter((item) => item.active !== false));
      }
      if (!isApiFailure(membersData)) {
        setMembers(membersData.members);
      }
      setLoading(false);
    })();
  }, [matterId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orgId) return;

    if (!administrativeBodyId) {
      setError("Selecione o órgão.");
      return;
    }
    if (!number.trim()) {
      setError("Informe o número do processo.");
      return;
    }
    if (!subject.trim()) {
      setError("Informe o assunto.");
      return;
    }

    setPending(true);
    setError(null);
    const result = await createAdministrativeProcess(orgId, matterId, {
      administrativeBodyId,
      number: number.trim(),
      subject: subject.trim(),
      description: description.trim() || undefined,
      protocolNumber: protocolNumber.trim() || undefined,
      protocolDate: protocolDate || undefined,
      externalReference: externalReference.trim() || undefined,
      priority,
      currentPhase: currentPhase.trim() || undefined,
      responsibleMembershipId: responsibleMembershipId || undefined,
    });
    setPending(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível cadastrar o processo administrativo."));
      return;
    }
    window.location.assign(`/app/casos/${matterId}/administrativos/${result.process.id}`);
  }

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Casos", href: "/app/casos" },
    { label: matterRef || matterTitle, href: `/app/casos/${matterId}` },
    { label: "Processos administrativos", href: `/app/casos/${matterId}/administrativos` },
    { label: "Novo processo" },
  ];

  if (loading) return <LoadingState label="Preparando formulário" />;

  if (!canCreate) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <Alert tone="error" title="Sem permissão">
          Você não tem permissão para cadastrar processos administrativos nesta organização.
        </Alert>
        <ButtonLink href={`/app/casos/${matterId}/administrativos`} variant="secondary">
          Voltar aos processos
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Cadastrar processo administrativo"
        eyebrow={matterRef || undefined}
        description="Informe o órgão, o número e o assunto. O protocolo, quando informado, é registro manual — não confirmação automática do órgão."
      />

      <Alert tone="info" title="Origem: cadastro manual">
        Nesta etapa os processos administrativos são registrados manualmente. Não há integração com
        sistemas de órgãos públicos nem atualização automática de andamentos.
      </Alert>

      {error ? (
        <p role="alert" className="vj-field-error">
          {error}
        </p>
      ) : null}

      <form className="vj-card vj-stack" onSubmit={submit} aria-labelledby="admin-form">
        <h2 id="admin-form" className="vj-section-title">
          Identificação
        </h2>

        <FormField id="administrativeBodyId" label="Órgão">
          <Select
            id="administrativeBodyId"
            name="administrativeBodyId"
            required
            value={administrativeBodyId}
            onChange={(event) => setAdministrativeBodyId(event.target.value)}
          >
            <option value="">Selecione</option>
            {bodies.map((body) => (
              <option key={body.id} value={body.id}>
                {body.acronym ? `${body.acronym} — ` : ""}
                {body.name}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField
          id="number"
          label="Número do processo"
          hint="Número informado no cadastro do órgão"
        >
          <Input
            id="number"
            name="number"
            required
            autoComplete="off"
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            maxLength={120}
          />
        </FormField>

        <FormField
          id="protocolNumber"
          label="Protocolo"
          hint="Protocolo informado manualmente. Não implica confirmação pelo órgão."
        >
          <Input
            id="protocolNumber"
            name="protocolNumber"
            autoComplete="off"
            value={protocolNumber}
            onChange={(event) => setProtocolNumber(event.target.value)}
            maxLength={120}
          />
        </FormField>

        <FormField id="protocolDate" label="Data do protocolo">
          <Input
            id="protocolDate"
            name="protocolDate"
            type="date"
            value={protocolDate}
            onChange={(event) => setProtocolDate(event.target.value)}
          />
        </FormField>

        <FormField id="subject" label="Assunto">
          <Input
            id="subject"
            name="subject"
            required
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            maxLength={300}
          />
        </FormField>

        <FormField id="description" label="Descrição">
          <Textarea
            id="description"
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
          />
        </FormField>

        <div className="vj-split">
          <FormField id="priority" label="Prioridade">
            <Select
              id="priority"
              name="priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as AdministrativePriority)}
            >
              {(Object.keys(ADMIN_PRIORITY_LABELS) as AdministrativePriority[]).map((key) => (
                <option key={key} value={key}>
                  {ADMIN_PRIORITY_LABELS[key]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="currentPhase" label="Fase atual">
            <Input
              id="currentPhase"
              name="currentPhase"
              value={currentPhase}
              onChange={(event) => setCurrentPhase(event.target.value)}
              maxLength={120}
              placeholder="Ex.: Análise inicial"
            />
          </FormField>
        </div>

        <FormField id="responsibleMembershipId" label="Responsável">
          <Select
            id="responsibleMembershipId"
            name="responsibleMembershipId"
            value={responsibleMembershipId}
            onChange={(event) => setResponsibleMembershipId(event.target.value)}
          >
            <option value="">Não atribuído</option>
            {members.map((member) => (
              <option key={member.membershipId} value={member.membershipId}>
                {member.displayName}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField id="externalReference" label="Referência externa">
          <Input
            id="externalReference"
            name="externalReference"
            value={externalReference}
            onChange={(event) => setExternalReference(event.target.value)}
            maxLength={200}
          />
        </FormField>

        <div className="vj-form-actions">
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Cadastrar processo"}
          </Button>
          <ButtonLink href={`/app/casos/${matterId}/administrativos`} variant="secondary">
            Cancelar
          </ButtonLink>
        </div>
      </form>
    </div>
  );
}
