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
  APPEAL_STATUS_LABELS,
  apiErrorMessage,
  CONFIDENTIALITY_LABELS,
  courtUnitLabel,
  DATA_SOURCE_LABELS,
  dataSourceLabel,
  DECISION_TYPE_LABELS,
  districtLabel,
  ENFORCEMENT_STATUS_LABELS,
  ENFORCEMENT_TYPE_LABELS,
  fetchJudicialAppeals,
  fetchJudicialDecisions,
  fetchJudicialEnforcements,
  fetchJudicialHearings,
  fetchJudicialLawyers,
  fetchJudicialMovements,
  fetchJudicialParties,
  fetchJudicialProcess,
  fetchJudicialTimeline,
  getActiveMembership,
  getActiveOrgId,
  hasJudicialPermission,
  HEARING_LOCATION_LABELS,
  HEARING_STATUS_LABELS,
  HEARING_TYPE_LABELS,
  isApiFailure,
  JUDICIAL_STATUS_LABELS,
  judicialStatusTone,
  LAWYER_REPRESENTATION_LABELS,
  oabStatusLabel,
  PARTY_ROLE_LABELS,
  PARTY_SIDE_LABELS,
  type JudicialAppeal,
  type JudicialDecision,
  type JudicialEnforcement,
  type JudicialHearing,
  type JudicialMovement,
  type JudicialProcessDetail,
  type JudicialProcessLawyer,
  type JudicialProcessParty,
  type JudicialTimelineItem,
} from "../../../../../../lib/judicial";
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
      Fonte/origem: {dataSourceLabel(source)}
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

export default function ProcessoJudicialDetailPage() {
  const params = useParams<{ id: string; processId: string }>();
  const matterId = params.id;
  const processId = params.processId;

  const [canRead, setCanRead] = useState(true);
  const [matterTitle, setMatterTitle] = useState("Caso");
  const [matterRef, setMatterRef] = useState("");
  const [process, setProcess] = useState<JudicialProcessDetail | null>(null);
  const [parties, setParties] = useState<JudicialProcessParty[]>([]);
  const [lawyers, setLawyers] = useState<JudicialProcessLawyer[]>([]);
  const [movements, setMovements] = useState<JudicialMovement[]>([]);
  const [hearings, setHearings] = useState<JudicialHearing[]>([]);
  const [decisions, setDecisions] = useState<JudicialDecision[]>([]);
  const [appeals, setAppeals] = useState<JudicialAppeal[]>([]);
  const [enforcements, setEnforcements] = useState<JudicialEnforcement[]>([]);
  const [timeline, setTimeline] = useState<JudicialTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    async (orgId: string) => {
      const [matterData, processData] = await Promise.all([
        fetchMatter(orgId, matterId),
        fetchJudicialProcess(orgId, matterId, processId),
      ]);
      if (!isApiFailure(matterData)) {
        setMatterTitle(matterData.matter.title);
        setMatterRef(matterData.matter.internalReference);
      }
      if (isApiFailure(processData)) {
        setError(apiErrorMessage(processData, "Não foi possível carregar o processo judicial."));
        setLoading(false);
        return;
      }

      const detail = processData.process;
      setProcess(detail);

      const [
        partiesData,
        lawyersData,
        movementsData,
        hearingsData,
        decisionsData,
        appealsData,
        enforcementData,
        timelineData,
      ] = await Promise.all([
        fetchJudicialParties(orgId, matterId, processId),
        fetchJudicialLawyers(orgId, matterId, processId),
        fetchJudicialMovements(orgId, matterId, processId),
        fetchJudicialHearings(orgId, matterId, processId),
        fetchJudicialDecisions(orgId, matterId, processId),
        fetchJudicialAppeals(orgId, matterId, processId),
        fetchJudicialEnforcements(orgId, matterId, processId),
        fetchJudicialTimeline(orgId, matterId, processId),
      ]);

      setParties(!isApiFailure(partiesData) ? partiesData.parties : (detail.parties ?? []));
      setLawyers(!isApiFailure(lawyersData) ? lawyersData.lawyers : (detail.lawyers ?? []));
      setMovements(
        !isApiFailure(movementsData) ? movementsData.movements : (detail.movements ?? []),
      );
      setHearings(!isApiFailure(hearingsData) ? hearingsData.hearings : (detail.hearings ?? []));
      setDecisions(
        !isApiFailure(decisionsData) ? decisionsData.decisions : (detail.decisions ?? []),
      );
      setAppeals(!isApiFailure(appealsData) ? appealsData.appeals : (detail.appeals ?? []));
      setEnforcements(
        !isApiFailure(enforcementData) ? enforcementData.enforcements : (detail.enforcements ?? []),
      );
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
      const readable = hasJudicialPermission(membership?.permissions, "read");
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
    { label: "Processos judiciais", href: `/app/casos/${matterId}/processos` },
    { label: process?.cnjNumber ?? "Processo" },
  ];

  if (!canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <ErrorState title="Sem permissão">
          Você não tem permissão para consultar este processo judicial.
        </ErrorState>
      </div>
    );
  }

  if (loading) return <LoadingState label="Carregando processo judicial" />;

  if (error && !process) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <ErrorState title="Erro ao carregar processo">{error}</ErrorState>
      </div>
    );
  }

  if (!process) return null;

  const subjects =
    process.subjects?.map((item) => item.subject?.name ?? item.subjectId).filter(Boolean) ??
    (process.primarySubject?.name ? [process.primarySubject.name] : []);

  const sortedTimeline = [...timeline].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
  const sortedMovements = [...movements].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
  const sortedHearings = [...hearings].sort(
    (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
  );

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title={process.cnjNumber}
        eyebrow={process.tribunal?.acronym ?? process.tribunal?.name ?? "Processo judicial"}
        description={`${matterTitle} · ${JUDICIAL_STATUS_LABELS[process.status]}`}
        actions={
          <div className="vj-inline-actions">
            <ButtonLink
              href={`/app/casos/${matterId}/documentos?ownerType=judicial_process&ownerId=${processId}`}
              variant="secondary"
            >
              Documentos
            </ButtonLink>
            <ButtonLink href={`/app/casos/${matterId}/processos`} variant="secondary">
              Todos os processos
            </ButtonLink>
          </div>
        }
      />

      <div className="vj-detail-grid">
        <div className="vj-stack">
          <DataBlock title="Identificação CNJ" id="jp-cnj">
            <MetaRow
              label="Número CNJ"
              value={<span className="vj-technical">{process.cnjNumber}</span>}
            />
            <MetaRow
              label="Normalizado"
              value={<span className="vj-technical">{process.cnjNumberNormalized}</span>}
            />
            <SourceMeta
              source={process.source}
              sourceReference={process.sourceReference}
              sourceUpdatedAt={process.sourceUpdatedAt}
            />
          </DataBlock>

          <DataBlock title="Tribunal, unidade e comarca" id="jp-forum">
            <MetaRow
              label="Tribunal"
              value={
                process.tribunal
                  ? `${process.tribunal.acronym ?? ""} ${process.tribunal.name}`.trim()
                  : "—"
              }
            />
            <MetaRow label="Vara / unidade" value={courtUnitLabel(process)} />
            <MetaRow label="Comarca" value={districtLabel(process)} />
          </DataBlock>

          <DataBlock title="Classe e assuntos" id="jp-class">
            <MetaRow label="Classe" value={process.proceduralClass?.name ?? "—"} />
            <MetaRow label="Assuntos" value={subjects.length > 0 ? subjects.join(", ") : "—"} />
            <MetaRow
              label="Confidencialidade"
              value={CONFIDENTIALITY_LABELS[process.confidentialityLevel]}
            />
          </DataBlock>

          <DataBlock title="Status e fase" id="jp-status">
            <div className="vj-inline-actions">
              <Badge tone={judicialStatusTone(process.status)}>
                {JUDICIAL_STATUS_LABELS[process.status]}
              </Badge>
            </div>
            <MetaRow label="Fase atual" value={process.currentPhase?.name ?? "—"} />
            {process.filingDate ? (
              <MetaRow
                label="Distribuição / ajuizamento"
                value={new Date(process.filingDate).toLocaleDateString("pt-BR")}
              />
            ) : null}
            {process.distributionDate ? (
              <MetaRow
                label="Data de distribuição"
                value={new Date(process.distributionDate).toLocaleDateString("pt-BR")}
              />
            ) : null}
            {process.lastMovementAt ? (
              <MetaRow
                label="Última movimentação registrada"
                value={new Date(process.lastMovementAt).toLocaleString("pt-BR")}
              />
            ) : null}
            {process.closedAt ? (
              <MetaRow
                label="Baixado em"
                value={new Date(process.closedAt).toLocaleString("pt-BR")}
              />
            ) : null}
            {process.closureReason ? (
              <MetaRow label="Motivo da baixa" value={process.closureReason} />
            ) : null}
            {process.closureSource ? <SourceMeta source={process.closureSource} /> : null}
          </DataBlock>

          <DataBlock title="Partes" id="jp-parties">
            {parties.length === 0 ? (
              <EmptyNote>Nenhuma parte processual cadastrada.</EmptyNote>
            ) : (
              <ul className="vj-stack">
                {parties.map((party) => (
                  <li key={party.id}>
                    <strong>{party.displayName}</strong>
                    <div className="vj-meta">
                      {PARTY_ROLE_LABELS[party.proceduralRole]} · {PARTY_SIDE_LABELS[party.side]}
                      {party.isPrimary ? " · principal" : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </DataBlock>

          <DataBlock title="Advogados" id="jp-lawyers">
            {lawyers.length === 0 ? (
              <EmptyNote>Nenhum advogado cadastrado neste processo.</EmptyNote>
            ) : (
              <ul className="vj-stack">
                {lawyers.map((lawyer) => (
                  <li key={lawyer.id}>
                    <strong>{lawyer.displayName}</strong>
                    <div className="vj-meta">
                      {LAWYER_REPRESENTATION_LABELS[lawyer.representationType]}
                      {lawyer.oabNumber
                        ? ` · OAB ${lawyer.oabState ? `${lawyer.oabState} ` : ""}${lawyer.oabNumber}`
                        : ""}
                    </div>
                    <Badge tone="warning">{oabStatusLabel(lawyer.oabVerificationStatus)}</Badge>
                    <SourceMeta source={lawyer.source} />
                  </li>
                ))}
              </ul>
            )}
          </DataBlock>

          <DataBlock title="Movimentações" id="jp-movements">
            {sortedMovements.length === 0 ? (
              <EmptyNote>Nenhuma movimentação registrada manualmente.</EmptyNote>
            ) : (
              <ul className="vj-stack">
                {sortedMovements.map((item) => (
                  <li key={item.id}>
                    <strong>{item.title}</strong>
                    <div className="vj-meta">
                      {new Date(item.occurredAt).toLocaleString("pt-BR")}
                      {item.movementCode ? ` · ${item.movementCode}` : ""}
                    </div>
                    {item.description ? <p className="vj-prose">{item.description}</p> : null}
                    <SourceMeta
                      source={item.source}
                      sourceReference={item.sourceReference}
                      sourceUpdatedAt={item.capturedAt}
                    />
                  </li>
                ))}
              </ul>
            )}
          </DataBlock>

          <DataBlock title="Audiências" id="jp-hearings">
            {sortedHearings.length === 0 ? (
              <EmptyNote>Nenhuma audiência cadastrada.</EmptyNote>
            ) : (
              <ul className="vj-stack">
                {sortedHearings.map((hearing) => (
                  <li key={hearing.id}>
                    <strong>{HEARING_TYPE_LABELS[hearing.type]}</strong>
                    <div className="vj-meta">
                      {new Date(hearing.scheduledAt).toLocaleString("pt-BR")}
                      {hearing.timezone ? ` (${hearing.timezone})` : ""}
                    </div>
                    <div className="vj-inline-actions">
                      <Badge>{HEARING_STATUS_LABELS[hearing.status]}</Badge>
                      <span className="vj-meta">
                        {HEARING_LOCATION_LABELS[hearing.locationType]}
                      </span>
                    </div>
                    {hearing.locationText ? (
                      <div className="vj-meta">{hearing.locationText}</div>
                    ) : null}
                    {hearing.resultSummary ? (
                      <p className="vj-prose">{hearing.resultSummary}</p>
                    ) : null}
                    <SourceMeta source={hearing.source} />
                  </li>
                ))}
              </ul>
            )}
          </DataBlock>

          <DataBlock title="Decisões" id="jp-decisions">
            {decisions.length === 0 ? (
              <EmptyNote>Nenhuma decisão registrada.</EmptyNote>
            ) : (
              <ul className="vj-stack">
                {decisions.map((decision) => (
                  <li key={decision.id}>
                    <strong>{decision.title}</strong>
                    <div className="vj-meta">
                      {DECISION_TYPE_LABELS[decision.decisionType]}
                      {decision.decidedAt
                        ? ` · ${new Date(decision.decidedAt).toLocaleDateString("pt-BR")}`
                        : ""}
                    </div>
                    {decision.summary ? <p className="vj-prose">{decision.summary}</p> : null}
                    {decision.outcome ? (
                      <MetaRow label="Resultado" value={decision.outcome} />
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

          <DataBlock title="Recursos" id="jp-appeals">
            {appeals.length === 0 ? (
              <EmptyNote>Nenhum recurso cadastrado.</EmptyNote>
            ) : (
              <ul className="vj-stack">
                {appeals.map((appeal) => (
                  <li key={appeal.id}>
                    <strong>{appeal.appealType}</strong>
                    <div className="vj-inline-actions">
                      <Badge>{APPEAL_STATUS_LABELS[appeal.status]}</Badge>
                    </div>
                    {appeal.filedAt ? (
                      <div className="vj-meta">
                        Protocolado em {new Date(appeal.filedAt).toLocaleDateString("pt-BR")}
                        {appeal.protocolReference ? ` · ref. ${appeal.protocolReference}` : ""}
                      </div>
                    ) : null}
                    <SourceMeta source={appeal.source} />
                  </li>
                ))}
              </ul>
            )}
          </DataBlock>

          <DataBlock title="Cumprimento / execução" id="jp-enforcement">
            {enforcements.length === 0 ? (
              <EmptyNote>Nenhum cumprimento ou execução registrado.</EmptyNote>
            ) : (
              <ul className="vj-stack">
                {enforcements.map((item) => (
                  <li key={item.id}>
                    <strong>{ENFORCEMENT_TYPE_LABELS[item.type]}</strong>
                    <div className="vj-inline-actions">
                      <Badge>{ENFORCEMENT_STATUS_LABELS[item.status]}</Badge>
                    </div>
                    <div className="vj-meta">
                      Início {new Date(item.startedAt).toLocaleDateString("pt-BR")}
                      {item.endedAt
                        ? ` · fim ${new Date(item.endedAt).toLocaleDateString("pt-BR")}`
                        : ""}
                    </div>
                    {item.summary ? <p className="vj-prose">{item.summary}</p> : null}
                    <SourceMeta source={item.source} />
                  </li>
                ))}
              </ul>
            )}
          </DataBlock>
        </div>

        <aside className="vj-stack">
          <DataBlock title="Documentos" id="jp-documents">
            <p className="vj-meta">
              Documentos vinculados a este processo judicial ficam no repositório documental do
              caso.
            </p>
            <ButtonLink
              href={`/app/casos/${matterId}/documentos?ownerType=judicial_process&ownerId=${process.id}`}
              variant="primary"
            >
              Abrir documentos
            </ButtonLink>
          </DataBlock>

          <DataBlock title="Fonte e origem" id="jp-source">
            <MetaRow label="Origem" value={DATA_SOURCE_LABELS[process.source] ?? process.source} />
            {process.sourceReference ? (
              <MetaRow label="Referência" value={process.sourceReference} />
            ) : null}
            {process.sourceUpdatedAt ? (
              <MetaRow
                label="Atualizado em"
                value={new Date(process.sourceUpdatedAt).toLocaleString("pt-BR")}
              />
            ) : (
              <p className="vj-meta">
                Dados informados no cadastro. Não há sincronização com o tribunal nesta etapa.
              </p>
            )}
          </DataBlock>

          <DataBlock title="Linha do tempo" id="jp-timeline">
            {sortedTimeline.length === 0 ? (
              <EmptyNote>
                Eventos processuais registrados neste processo aparecerão aqui, com a data do fato e
                a data de inserção quando disponíveis.
              </EmptyNote>
            ) : (
              <ol className="vj-stack" aria-label="Linha do tempo do processo">
                {sortedTimeline.map((item) => (
                  <li key={item.id}>
                    <strong>{item.title}</strong>
                    <div className="vj-meta">
                      Fato: {new Date(item.occurredAt).toLocaleString("pt-BR")}
                      {item.recordedAt
                        ? ` · registrado em ${new Date(item.recordedAt).toLocaleString("pt-BR")}`
                        : ""}
                      {item.eventType ? ` · ${item.eventType}` : ""}
                    </div>
                    {item.body ? <p className="vj-prose">{item.body}</p> : null}
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
