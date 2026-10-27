"use client";

import {
  Badge,
  Breadcrumb,
  ButtonLink,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ADMIN_APPEAL_STATUS_LABELS,
  ADMIN_DATA_SOURCE_LABELS,
  ADMIN_DEADLINE_STATUS_LABELS,
  ADMIN_PRIORITY_LABELS,
  ADMIN_REQUEST_STATUS_LABELS,
  ADMIN_REQUIREMENT_STATUS_LABELS,
  ADMIN_STATUS_LABELS,
  administrativeDataSourceLabel,
  administrativeStatusTone,
  apiErrorMessage,
  bodyLabel,
  fetchAdministrativeAppeals,
  fetchAdministrativeDeadlines,
  fetchAdministrativeDecisions,
  fetchAdministrativeProcess,
  fetchAdministrativeRequests,
  fetchAdministrativeRequirements,
  fetchAdministrativeTimeline,
  getActiveMembership,
  getActiveOrgId,
  hasAdministrativePermission,
  isApiFailure,
  protocolStatusLabel,
  type AdministrativeAppeal,
  type AdministrativeDeadline,
  type AdministrativeDecision,
  type AdministrativeProcessDetail,
  type AdministrativeRequest,
  type AdministrativeRequirement,
  type AdministrativeTimelineItem,
} from "../../../../../../lib/administrative";
import { fetchMatter } from "../../../../../../lib/matters";

function DataBlock({
  title,
  id,
  children,
}: {
  title: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <section className="vj-card vj-stack" aria-labelledby={id}>
      <h2 id={id} className="vj-section-title">
        {title}
      </h2>
      {children}
    </section>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <p>
      <strong>{label}:</strong> {value}
    </p>
  );
}

function SourceMeta({
  source,
  sourceReference,
  sourceUpdatedAt,
}: {
  source?: string | null;
  sourceReference?: string | null;
  sourceUpdatedAt?: string | null;
}) {
  if (!source) return null;
  return (
    <div className="vj-meta">
      Fonte/origem: {administrativeDataSourceLabel(source)}
      {sourceReference ? ` · ref. ${sourceReference}` : ""}
      {sourceUpdatedAt
        ? ` · atualizado em ${new Date(sourceUpdatedAt).toLocaleString("pt-BR")}`
        : ""}
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="vj-meta">{children}</p>;
}

export default function ProcessoAdministrativoDetailPage() {
  const params = useParams<{ id: string; processId: string }>();
  const matterId = params.id;
  const processId = params.processId;

  const [canRead, setCanRead] = useState(true);
  const [matterTitle, setMatterTitle] = useState("Caso");
  const [matterRef, setMatterRef] = useState("");
  const [process, setProcess] = useState<AdministrativeProcessDetail | null>(null);
  const [requests, setRequests] = useState<AdministrativeRequest[]>([]);
  const [requirements, setRequirements] = useState<AdministrativeRequirement[]>([]);
  const [deadlines, setDeadlines] = useState<AdministrativeDeadline[]>([]);
  const [decisions, setDecisions] = useState<AdministrativeDecision[]>([]);
  const [appeals, setAppeals] = useState<AdministrativeAppeal[]>([]);
  const [timeline, setTimeline] = useState<AdministrativeTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    async (orgId: string) => {
      const [matterData, processData] = await Promise.all([
        fetchMatter(orgId, matterId),
        fetchAdministrativeProcess(orgId, processId),
      ]);
      if (!isApiFailure(matterData)) {
        setMatterTitle(matterData.matter.title);
        setMatterRef(matterData.matter.internalReference);
      }
      if (isApiFailure(processData)) {
        setError(
          apiErrorMessage(processData, "Não foi possível carregar o processo administrativo."),
        );
        setLoading(false);
        return;
      }

      const detail = processData.process;
      if (detail.legalMatterId && detail.legalMatterId !== matterId) {
        setError("Este processo administrativo não pertence ao caso informado.");
        setLoading(false);
        return;
      }
      setProcess(detail);

      const [
        requestsData,
        requirementsData,
        deadlinesData,
        decisionsData,
        appealsData,
        timelineData,
      ] = await Promise.all([
        fetchAdministrativeRequests(orgId, processId),
        fetchAdministrativeRequirements(orgId, processId),
        fetchAdministrativeDeadlines(orgId, processId),
        fetchAdministrativeDecisions(orgId, processId),
        fetchAdministrativeAppeals(orgId, processId),
        fetchAdministrativeTimeline(orgId, processId),
      ]);

      setRequests(!isApiFailure(requestsData) ? requestsData.requests : (detail.requests ?? []));
      setRequirements(
        !isApiFailure(requirementsData)
          ? requirementsData.requirements
          : (detail.requirements ?? []),
      );
      setDeadlines(
        !isApiFailure(deadlinesData) ? deadlinesData.deadlines : (detail.deadlines ?? []),
      );
      setDecisions(
        !isApiFailure(decisionsData) ? decisionsData.decisions : (detail.decisions ?? []),
      );
      setAppeals(!isApiFailure(appealsData) ? appealsData.appeals : (detail.appeals ?? []));
      setTimeline(!isApiFailure(timelineData) ? timelineData.items : (detail.timeline ?? []));
      setLoading(false);
    },
    [matterId, processId],
  );

  useEffect(() => {
    void (async () => {
      const [activeId, membership] = await Promise.all([getActiveOrgId(), getActiveMembership()]);
      if (!activeId) {
        setError("Nenhuma organização ativa.");
        setLoading(false);
        return;
      }
      const readable = hasAdministrativePermission(membership?.permissions, "read");
      setCanRead(readable);
      if (!readable) {
        setLoading(false);
        return;
      }
      await reload(activeId);
    })();
  }, [reload]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Casos", href: "/app/casos" },
    { label: matterRef || matterTitle, href: `/app/casos/${matterId}` },
    { label: "Processos administrativos", href: `/app/casos/${matterId}/administrativos` },
    { label: process?.number ?? "Processo" },
  ];

  if (!canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <ErrorState title="Sem permissão">
          Você não tem permissão para consultar este processo administrativo.
        </ErrorState>
      </div>
    );
  }

  if (loading) return <LoadingState label="Carregando processo administrativo" />;

  if (error && !process) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <ErrorState title="Erro ao carregar processo">{error}</ErrorState>
      </div>
    );
  }

  if (!process) return null;

  const processProtocolNote = protocolStatusLabel({
    protocolNumber: process.protocolNumber,
  });

  const sortedTimeline = [...timeline].sort(
    (a, b) => new Date(b.eventAt).getTime() - new Date(a.eventAt).getTime(),
  );
  const sortedDeadlines = [...deadlines].sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
  );

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title={process.number}
        eyebrow={bodyLabel(process)}
        description={`${matterTitle} · ${ADMIN_STATUS_LABELS[process.status]}`}
        actions={
          <div className="vj-inline-actions">
            <ButtonLink
              href={`/app/casos/${matterId}/documentos?ownerType=administrative_process&ownerId=${process.id}`}
              variant="secondary"
            >
              Documentos
            </ButtonLink>
            <ButtonLink href={`/app/casos/${matterId}/administrativos`} variant="secondary">
              Todos os processos
            </ButtonLink>
          </div>
        }
      />

      <div className="vj-detail-grid">
        <div className="vj-stack">
          <DataBlock title="Órgão" id="ap-body">
            <MetaRow label="Órgão" value={bodyLabel(process)} />
          </DataBlock>

          <DataBlock title="Número" id="ap-number">
            <MetaRow
              label="Número"
              value={<span className="vj-technical">{process.number}</span>}
            />
            {process.normalizedNumber ? (
              <MetaRow
                label="Normalizado"
                value={<span className="vj-technical">{process.normalizedNumber}</span>}
              />
            ) : null}
            {process.externalReference ? (
              <MetaRow label="Referência externa" value={process.externalReference} />
            ) : null}
          </DataBlock>

          <DataBlock title="Protocolo" id="ap-protocol">
            {process.protocolNumber ? (
              <>
                <MetaRow
                  label="Protocolo"
                  value={<span className="vj-technical">{process.protocolNumber}</span>}
                />
                {process.protocolDate ? (
                  <MetaRow
                    label="Data"
                    value={new Date(process.protocolDate).toLocaleDateString("pt-BR")}
                  />
                ) : null}
                {processProtocolNote ? <p className="vj-meta">{processProtocolNote}</p> : null}
                <SourceMeta
                  source={process.protocolSource}
                  sourceReference={process.protocolReference}
                />
              </>
            ) : (
              <EmptyNote>Nenhum protocolo informado.</EmptyNote>
            )}
          </DataBlock>

          <DataBlock title="Assunto" id="ap-subject">
            <MetaRow label="Assunto" value={process.subject} />
            {process.description ? (
              <p className="vj-prose">{process.description}</p>
            ) : (
              <EmptyNote>Sem descrição adicional.</EmptyNote>
            )}
          </DataBlock>

          <DataBlock title="Status" id="ap-status">
            <div className="vj-inline-actions">
              <Badge tone={administrativeStatusTone(process.status)}>
                {ADMIN_STATUS_LABELS[process.status]}
              </Badge>
              <Badge>{ADMIN_PRIORITY_LABELS[process.priority]}</Badge>
            </div>
            <MetaRow label="Fase atual" value={process.currentPhase ?? "—"} />
            {process.filedAt ? (
              <MetaRow
                label="Protocolado / ajuizado em"
                value={new Date(process.filedAt).toLocaleDateString("pt-BR")}
              />
            ) : null}
            {process.startedAt ? (
              <MetaRow
                label="Início"
                value={new Date(process.startedAt).toLocaleDateString("pt-BR")}
              />
            ) : null}
            {process.closedAt ? (
              <MetaRow
                label="Encerrado em"
                value={new Date(process.closedAt).toLocaleString("pt-BR")}
              />
            ) : null}
          </DataBlock>

          <DataBlock title="Responsável" id="ap-responsible">
            <p>{process.responsible?.displayName ?? "Não atribuído"}</p>
          </DataBlock>

          <DataBlock title="Requerimentos" id="ap-requests">
            {requests.length === 0 ? (
              <EmptyNote>Nenhum requerimento cadastrado.</EmptyNote>
            ) : (
              <ul className="vj-stack">
                {requests.map((item) => {
                  const note = protocolStatusLabel({
                    protocolNumber: item.protocolNumber,
                    status: item.status,
                  });
                  return (
                    <li key={item.id}>
                      <strong>{item.title}</strong>
                      <div className="vj-meta">
                        {item.requestType} · {ADMIN_REQUEST_STATUS_LABELS[item.status]}
                      </div>
                      {item.description ? <p className="vj-prose">{item.description}</p> : null}
                      {item.protocolNumber ? (
                        <div className="vj-meta">
                          Protocolo: <span className="vj-technical">{item.protocolNumber}</span>
                          {note ? ` · ${note}` : ""}
                        </div>
                      ) : null}
                      <SourceMeta source={item.source} />
                    </li>
                  );
                })}
              </ul>
            )}
          </DataBlock>

          <DataBlock title="Exigências" id="ap-requirements">
            {requirements.length === 0 ? (
              <EmptyNote>Nenhuma exigência registrada.</EmptyNote>
            ) : (
              <ul className="vj-stack">
                {requirements.map((item) => (
                  <li key={item.id}>
                    <strong>{item.title}</strong>
                    <div className="vj-inline-actions">
                      <Badge>{ADMIN_REQUIREMENT_STATUS_LABELS[item.status]}</Badge>
                    </div>
                    {item.description ? <p className="vj-prose">{item.description}</p> : null}
                    {item.dueAt ? (
                      <div className="vj-meta">
                        Prazo: {new Date(item.dueAt).toLocaleString("pt-BR")}
                      </div>
                    ) : null}
                    {item.responseSummary ? (
                      <MetaRow label="Resposta" value={item.responseSummary} />
                    ) : null}
                    <SourceMeta source={item.source} sourceReference={item.sourceReference} />
                  </li>
                ))}
              </ul>
            )}
          </DataBlock>

          <DataBlock title="Prazos" id="ap-deadlines">
            {sortedDeadlines.length === 0 ? (
              <EmptyNote>Nenhum prazo cadastrado.</EmptyNote>
            ) : (
              <ul className="vj-stack">
                {sortedDeadlines.map((item) => (
                  <li key={item.id}>
                    <strong>{item.title}</strong>
                    <div className="vj-inline-actions">
                      <Badge>{ADMIN_DEADLINE_STATUS_LABELS[item.status]}</Badge>
                    </div>
                    <div className="vj-meta">
                      Vencimento: {new Date(item.dueAt).toLocaleString("pt-BR")}
                      {item.timezone ? ` (${item.timezone})` : ""}
                    </div>
                    {item.calculationNotes ? (
                      <p className="vj-prose">{item.calculationNotes}</p>
                    ) : null}
                    {item.status === "confirmed" && item.confirmedAt ? (
                      <div className="vj-meta">
                        Confirmado em {new Date(item.confirmedAt).toLocaleString("pt-BR")}
                      </div>
                    ) : item.status !== "confirmed" ? (
                      <div className="vj-meta">Prazo informado manualmente.</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </DataBlock>

          <DataBlock title="Decisões" id="ap-decisions">
            {decisions.length === 0 ? (
              <EmptyNote>Nenhuma decisão registrada.</EmptyNote>
            ) : (
              <ul className="vj-stack">
                {decisions.map((decision) => (
                  <li key={decision.id}>
                    <strong>{decision.title}</strong>
                    <div className="vj-meta">
                      {decision.decisionType}
                      {decision.decidedAt
                        ? ` · ${new Date(decision.decidedAt).toLocaleDateString("pt-BR")}`
                        : ""}
                    </div>
                    <p className="vj-prose">{decision.summary}</p>
                    {decision.outcome ? (
                      <MetaRow label="Resultado" value={decision.outcome} />
                    ) : null}
                    {decision.documentId ? (
                      <ButtonLink
                        href={`/app/documentos?q=${encodeURIComponent(decision.documentId)}`}
                        variant="secondary"
                      >
                        Ver documento vinculado
                      </ButtonLink>
                    ) : null}
                    <SourceMeta
                      source={decision.source}
                      sourceReference={decision.sourceReference}
                    />
                  </li>
                ))}
              </ul>
            )}
          </DataBlock>

          <DataBlock title="Recursos" id="ap-appeals">
            {appeals.length === 0 ? (
              <EmptyNote>Nenhum recurso cadastrado.</EmptyNote>
            ) : (
              <ul className="vj-stack">
                {appeals.map((appeal) => {
                  const note = protocolStatusLabel({
                    protocolNumber: appeal.protocolNumber,
                    status: appeal.status,
                  });
                  return (
                    <li key={appeal.id}>
                      <strong>{appeal.title}</strong>
                      <div className="vj-meta">
                        {appeal.appealType} · {ADMIN_APPEAL_STATUS_LABELS[appeal.status]}
                      </div>
                      <p className="vj-prose">{appeal.summary}</p>
                      {appeal.filedAt ? (
                        <div className="vj-meta">
                          Interposto em {new Date(appeal.filedAt).toLocaleDateString("pt-BR")}
                        </div>
                      ) : null}
                      {appeal.protocolNumber ? (
                        <div className="vj-meta">
                          Protocolo: <span className="vj-technical">{appeal.protocolNumber}</span>
                          {note ? ` · ${note}` : ""}
                        </div>
                      ) : null}
                      <SourceMeta source={appeal.source} />
                    </li>
                  );
                })}
              </ul>
            )}
          </DataBlock>
        </div>

        <aside className="vj-stack">
          <DataBlock title="Documentos" id="ap-documents">
            <p className="vj-meta">
              Documentos vinculados a este processo administrativo ficam no repositório documental
              do caso.
            </p>
            <ButtonLink
              href={`/app/casos/${matterId}/documentos?ownerType=administrative_process&ownerId=${process.id}`}
              variant="primary"
            >
              Abrir documentos
            </ButtonLink>
          </DataBlock>

          <DataBlock title="Origem" id="ap-source">
            <MetaRow
              label="Origem"
              value={ADMIN_DATA_SOURCE_LABELS[process.source] ?? process.source}
            />
            {process.sourceReference ? (
              <MetaRow label="Referência" value={process.sourceReference} />
            ) : null}
            <p className="vj-meta">
              Dados informados no cadastro. Não há sincronização com o órgão nesta etapa.
            </p>
          </DataBlock>

          <DataBlock title="Última atualização" id="ap-updated">
            <MetaRow
              label="Atualizado em"
              value={new Date(process.updatedAt).toLocaleString("pt-BR")}
            />
            {process.lastActivityAt ? (
              <MetaRow
                label="Última atividade"
                value={new Date(process.lastActivityAt).toLocaleString("pt-BR")}
              />
            ) : null}
            {process.sourceUpdatedAt ? (
              <MetaRow
                label="Fonte atualizada em"
                value={new Date(process.sourceUpdatedAt).toLocaleString("pt-BR")}
              />
            ) : null}
          </DataBlock>

          <DataBlock title="Linha do tempo" id="ap-timeline">
            {sortedTimeline.length === 0 ? (
              <EmptyNote>
                Eventos deste processo administrativo aparecerão aqui, com a data do fato.
              </EmptyNote>
            ) : (
              <ol className="vj-stack" aria-label="Linha do tempo do processo administrativo">
                {sortedTimeline.map((item) => (
                  <li key={item.id}>
                    <strong>{item.title}</strong>
                    <div className="vj-meta">
                      {new Date(item.eventAt).toLocaleString("pt-BR")}
                      {item.eventType ? ` · ${item.eventType}` : ""}
                    </div>
                    {item.summary ? <p className="vj-prose">{item.summary}</p> : null}
                    <SourceMeta source={item.source} />
                  </li>
                ))}
              </ol>
            )}
          </DataBlock>
        </aside>
      </div>
    </div>
  );
}
