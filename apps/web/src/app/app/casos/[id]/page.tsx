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
  apiErrorMessage,
  clientDisplayName,
  FEE_STATUS_LABELS,
  FEE_TYPE_LABELS,
  fetchMatter,
  fetchMatterTimeline,
  formatBasisPoints,
  formatCents,
  getActiveMembership,
  getActiveOrgId,
  hasMatterPermission,
  isApiFailure,
  MATTER_PRIORITY_LABELS,
  MATTER_STATUS_LABELS,
  matterPriorityTone,
  matterStatusTone,
  PARTY_PERSON_TYPE_LABELS,
  PARTY_POSITION_LABELS,
  TEAM_ROLE_LABELS,
  teamMemberLabel,
  type MatterDetail,
  type MatterTimelineItem,
} from "../../../../lib/matters";
import { AssistedAnalysisPanel } from "../../../../components/assisted-analysis-panel";
import {
  fetchLegalAnalyses,
  hasPermission,
  runLegalAnalysis,
  type AiApiFailure,
  type LegalAnalysisSummary,
} from "../../../../lib/ai";

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

function feeSummary(fee: MatterDetail["fees"][number]): string {
  const parts: string[] = [FEE_TYPE_LABELS[fee.type]];
  if (fee.fixedAmountCents != null) parts.push(formatCents(fee.fixedAmountCents));
  if (fee.hourlyRateCents != null) parts.push(`${formatCents(fee.hourlyRateCents)}/h`);
  if (fee.percentageBasisPoints != null) parts.push(formatBasisPoints(fee.percentageBasisPoints));
  if (fee.successFeeBasisPoints != null) {
    parts.push(`êxito ${formatBasisPoints(fee.successFeeBasisPoints)}`);
  }
  return parts.join(" · ");
}

export default function CasoDetailPage() {
  const params = useParams<{ id: string }>();
  const matterId = params.id;

  const [canRead, setCanRead] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [matter, setMatter] = useState<MatterDetail | null>(null);
  const [timeline, setTimeline] = useState<MatterTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    async (activeId: string) => {
      const [matterData, timelineData] = await Promise.all([
        fetchMatter(activeId, matterId),
        fetchMatterTimeline(activeId, matterId),
      ]);
      if (isApiFailure(matterData)) {
        setError(apiErrorMessage(matterData, "Não foi possível carregar o caso."));
        setLoading(false);
        return;
      }
      setMatter(matterData.matter);
      if (!isApiFailure(timelineData)) {
        setTimeline(timelineData.items);
      } else if (matterData.matter.timeline?.length) {
        setTimeline(matterData.matter.timeline);
      }
      setLoading(false);
    },
    [matterId],
  );

  const loadAnalyses = useCallback(async () => {
    if (!orgId) return { items: [] as LegalAnalysisSummary[] };
    return fetchLegalAnalyses(orgId, { legalMatterId: matterId, limit: 20 });
  }, [orgId, matterId]);

  const runAnalysis = useCallback(
    async (analysisType: string) => {
      if (!orgId) {
        return {
          error: { code: "NOT_FOUND", message: "Nenhuma organização ativa." },
        } as AiApiFailure;
      }
      return runLegalAnalysis(orgId, { legalMatterId: matterId, analysisType });
    },
    [orgId, matterId],
  );

  useEffect(() => {
    void (async () => {
      const [activeId, membership] = await Promise.all([getActiveOrgId(), getActiveMembership()]);
      if (!activeId) {
        setError("Nenhuma organização ativa.");
        setLoading(false);
        return;
      }
      const readable = hasMatterPermission(membership?.permissions, "read");
      setCanRead(readable);
      setOrgId(activeId);
      setPermissions(membership?.permissions ?? []);
      if (!readable) {
        setLoading(false);
        return;
      }
      await reload(activeId);
    })();
  }, [reload]);

  if (!canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb
          items={[
            { label: "Painel", href: "/app" },
            { label: "Casos", href: "/app/casos" },
            { label: "Detalhe" },
          ]}
        />
        <ErrorState title="Sem permissão">
          Você não tem permissão para consultar este caso.
        </ErrorState>
      </div>
    );
  }

  if (loading) return <LoadingState label="Carregando caso" />;

  if (error && !matter) {
    return (
      <div className="vj-stack">
        <Breadcrumb
          items={[
            { label: "Painel", href: "/app" },
            { label: "Casos", href: "/app/casos" },
            { label: "Detalhe" },
          ]}
        />
        <ErrorState title="Erro ao carregar caso">{error}</ErrorState>
      </div>
    );
  }

  if (!matter) return null;

  const activeTeam = matter.teamMembers.filter((member) => !member.removedAt);
  const timelineItems = timeline.length > 0 ? timeline : (matter.timeline ?? []);

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Painel", href: "/app" },
          { label: "Casos", href: "/app/casos" },
          { label: matter.internalReference || matter.title },
        ]}
      />
      <PageHeader
        title={matter.title}
        eyebrow={matter.internalReference}
        description={matter.summary ?? "Sem resumo cadastrado."}
        actions={
          <div className="vj-inline-actions">
            {hasPermission(permissions, "legal_analysis.read") ? (
              <ButtonLink href="#matter-analysis" variant="secondary">
                Análise assistida
              </ButtonLink>
            ) : null}
            {hasPermission(permissions, "legal_draft.create") ? (
              <ButtonLink
                href={`/app/documentos-juridicos/minutas/nova?legalMatterId=${matter.id}`}
                variant="secondary"
              >
                Gerar documento
              </ButtonLink>
            ) : null}
            {hasPermission(permissions, "legal_comparison.create") ? (
              <ButtonLink
                href={`/app/comparador/novo?legalMatterId=${matter.id}`}
                variant="secondary"
              >
                Comparar peças
              </ButtonLink>
            ) : null}
            {matter.originatingOpportunityId ? (
              <ButtonLink
                href={`/app/pipeline/${matter.originatingOpportunityId}`}
                variant="secondary"
              >
                Ver origem no pipeline
              </ButtonLink>
            ) : null}
          </div>
        }
      />

      <div className="vj-detail-grid">
        <div className="vj-stack">
          <DataBlock title="Contexto" id="matter-context">
            <MetaRow
              label="Referência interna"
              value={<span className="vj-technical">{matter.internalReference}</span>}
            />
            <MetaRow
              label="Cliente"
              value={
                matter.client ? (
                  <a href={`/app/crm/clientes/${matter.client.id}`}>
                    {clientDisplayName(matter.client)}
                  </a>
                ) : (
                  "—"
                )
              }
            />
            <MetaRow label="Tipo de demanda" value={matter.demandType?.name ?? "—"} />
            <MetaRow label="Área" value={matter.legalArea?.name ?? "—"} />
            <MetaRow label="Subárea" value={matter.legalSubarea?.name ?? "—"} />
            {matter.summary ? <MetaRow label="Resumo" value={matter.summary} /> : null}
          </DataBlock>

          <DataBlock title="Situação" id="matter-status">
            <div className="vj-inline-actions">
              <Badge tone={matterStatusTone(matter.status)}>
                {MATTER_STATUS_LABELS[matter.status]}
              </Badge>
              <Badge tone={matterPriorityTone(matter.priority)}>
                {MATTER_PRIORITY_LABELS[matter.priority]}
              </Badge>
            </div>
            <MetaRow label="Aberto em" value={new Date(matter.openedAt).toLocaleString("pt-BR")} />
            {matter.closedAt ? (
              <MetaRow
                label="Encerrado em"
                value={new Date(matter.closedAt).toLocaleString("pt-BR")}
              />
            ) : null}
            {matter.archivedAt ? (
              <MetaRow
                label="Arquivado em"
                value={new Date(matter.archivedAt).toLocaleString("pt-BR")}
              />
            ) : null}
          </DataBlock>

          <DataBlock title="Partes" id="matter-parties">
            {matter.parties.length === 0 ? (
              <p className="vj-meta">Nenhuma parte adicional registrada.</p>
            ) : (
              <ul className="vj-stack">
                {matter.parties.map((party) => (
                  <li key={party.id}>
                    <strong>{party.displayName}</strong>
                    <div className="vj-meta">
                      {PARTY_POSITION_LABELS[party.position]} ·{" "}
                      {PARTY_PERSON_TYPE_LABELS[party.personType]}
                      {party.isPrimary ? " · principal" : ""}
                    </div>
                    {party.roleDescription ? (
                      <div className="vj-meta">{party.roleDescription}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </DataBlock>

          <DataBlock title="Honorários (regra contratual)" id="matter-fees">
            <p className="vj-meta">
              Arranjos comerciais registrados. Pagamentos, saldos e recebimentos não fazem parte
              desta etapa.
            </p>
            {matter.fees.length === 0 ? (
              <p className="vj-meta">Nenhum arranjo de honorários cadastrado.</p>
            ) : (
              <ul className="vj-stack">
                {matter.fees.map((fee) => (
                  <li key={fee.id}>
                    <strong>{feeSummary(fee)}</strong>
                    <div className="vj-meta">{FEE_STATUS_LABELS[fee.status]}</div>
                    {fee.description ? <div className="vj-meta">{fee.description}</div> : null}
                  </li>
                ))}
              </ul>
            )}
          </DataBlock>

          <DataBlock title="Linha do tempo" id="matter-timeline">
            {timelineItems.length === 0 ? (
              <p className="vj-meta">Eventos operacionais deste caso aparecerão aqui.</p>
            ) : (
              <ul className="vj-stack">
                {timelineItems.map((item) => (
                  <li key={item.id}>
                    <strong>{item.title}</strong>
                    <div className="vj-meta">
                      {new Date(item.occurredAt).toLocaleString("pt-BR")}
                      {item.eventType ? ` · ${item.eventType}` : ""}
                    </div>
                    {item.body ? <p className="vj-prose">{item.body}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </DataBlock>

          {orgId &&
          (hasPermission(permissions, "legal_analysis.read") ||
            hasPermission(permissions, "legal_analysis.create")) ? (
            <AssistedAnalysisPanel
              orgId={orgId}
              headingId="matter-analysis"
              canRun={hasPermission(permissions, "legal_analysis.create")}
              canReview={hasPermission(permissions, "legal_analysis.review")}
              analysisTypes={[
                { value: "full", label: "Análise assistida completa" },
                { value: "facts_and_claims", label: "Fatos e pedidos" },
                { value: "contradictions", label: "Possíveis inconsistências" },
              ]}
              loadItems={loadAnalyses}
              run={runAnalysis}
              emptyText="Nenhuma análise assistida foi gerada para este caso."
            />
          ) : null}
        </div>

        <aside className="vj-stack">
          <DataBlock title="Responsável" id="matter-responsible">
            <p>{matter.responsible?.displayName ?? "Não atribuído"}</p>
          </DataBlock>

          <DataBlock title="Equipe" id="matter-team">
            {activeTeam.length === 0 ? (
              <p className="vj-meta">Nenhum membro de equipe ativo.</p>
            ) : (
              <ul className="vj-stack">
                {activeTeam.map((member) => (
                  <li key={member.id}>
                    <strong>{teamMemberLabel(member)}</strong>
                    <div className="vj-meta">
                      {TEAM_ROLE_LABELS[member.teamRole]}
                      {member.isPrimary ? " · principal" : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </DataBlock>

          <DataBlock title="Tags" id="matter-tags">
            {matter.tags.length === 0 ? (
              <p className="vj-meta">Nenhuma tag associada.</p>
            ) : (
              <ul className="vj-inline-actions">
                {matter.tags.map((tag) => (
                  <li key={tag.id}>
                    <Badge>{tag.name}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </DataBlock>

          <DataBlock title="Processos judiciais" id="matter-judicial">
            <p className="vj-meta">Processos judiciais vinculados a este caso (cadastro manual).</p>
            <ButtonLink href={`/app/casos/${matter.id}/processos`} variant="primary">
              Ver processos judiciais
            </ButtonLink>
          </DataBlock>

          <DataBlock title="Processos administrativos" id="matter-admin">
            <p className="vj-meta">
              Processos administrativos vinculados a este caso (cadastro manual).
            </p>
            <ButtonLink href={`/app/casos/${matter.id}/administrativos`} variant="primary">
              Ver processos administrativos
            </ButtonLink>
          </DataBlock>

          <DataBlock title="Documentos" id="matter-documents">
            <p className="vj-meta">Documentos vinculados a este caso.</p>
            <ButtonLink href={`/app/casos/${matter.id}/documentos`} variant="primary">
              Ver documentos
            </ButtonLink>
          </DataBlock>

          <DataBlock title="Fonte" id="matter-source">
            {matter.originatingOpportunityId ? (
              <>
                <MetaRow label="Origem" value="Pipeline" />
                <ButtonLink
                  href={`/app/pipeline/${matter.originatingOpportunityId}`}
                  variant="secondary"
                >
                  Abrir oportunidade
                </ButtonLink>
              </>
            ) : (
              <p className="vj-meta">Cadastro manual — sem origem no pipeline.</p>
            )}
            {matter.intakeId ? (
              <ButtonLink href={`/app/atendimentos/${matter.intakeId}`} variant="secondary">
                Ver atendimento vinculado
              </ButtonLink>
            ) : null}
          </DataBlock>

          {hasPermission(permissions, "legal_draft.read") ||
          hasPermission(permissions, "legal_comparison.read") ? (
            <DataBlock title="Documentos jurídicos" id="matter-legal-docs">
              <p className="vj-meta">Minutas e comparações vinculadas ao fluxo do caso.</p>
              <div className="vj-inline-actions">
                {hasPermission(permissions, "legal_draft.create") ? (
                  <ButtonLink
                    href={`/app/documentos-juridicos/minutas/nova?legalMatterId=${matter.id}`}
                    variant="secondary"
                  >
                    Gerar documento
                  </ButtonLink>
                ) : null}
                {hasPermission(permissions, "legal_comparison.create") ? (
                  <ButtonLink
                    href={`/app/comparador/novo?legalMatterId=${matter.id}`}
                    variant="secondary"
                  >
                    Comparar peças
                  </ButtonLink>
                ) : null}
              </div>
            </DataBlock>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
