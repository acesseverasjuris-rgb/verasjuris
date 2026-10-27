"use client";

import {
  Badge,
  Breadcrumb,
  ButtonLink,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from "@verasjuris/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  apiErrorMessage,
  fetchLegalAreas,
  fetchOpportunities,
  fetchOrganizationMembers,
  fetchPipelineBoard,
  formatMoneyFromCents,
  getActiveMembership,
  getActiveOrgId,
  isApiFailure,
  MAIN_BOARD_STAGES,
  moveOpportunity,
  STAGE_LABELS,
  stageBadgeTone,
  type LegalArea,
  type OpportunityStage,
  type OpportunitySummary,
  type OrgMember,
  type PipelineBoardColumn,
} from "../../../lib/pipeline";

const PAGE_SIZE = 20;

type ViewMode = "kanban" | "list";

function useMobileDefaultList(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 960px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return mobile;
}

function PipelineCard({
  item,
  canMove,
  onMove,
  moveError,
}: {
  item: OpportunitySummary;
  canMove: boolean;
  onMove: (opportunityId: string, stage: OpportunityStage) => Promise<void>;
  moveError: string | null;
}) {
  const [pending, setPending] = useState(false);

  async function handleMove(stage: OpportunityStage) {
    if (stage === item.stage) return;
    setPending(true);
    await onMove(item.id, stage);
    setPending(false);
  }

  function handleDragStart(event: React.DragEvent) {
    event.dataTransfer.setData("text/plain", item.id);
    event.dataTransfer.effectAllowed = "move";
  }

  const error = moveError;

  return (
    <li
      className="vj-pipeline-card"
      draggable={canMove}
      onDragStart={canMove ? handleDragStart : undefined}
    >
      <p className="vj-pipeline-card-title">
        <a href={`/app/pipeline/${item.id}`}>{item.title}</a>
      </p>
      <div className="vj-pipeline-card-meta">
        <Badge tone={stageBadgeTone(item.stage)}>{STAGE_LABELS[item.stage]}</Badge>
        {item.responsible ? (
          <span> · {item.responsible.displayName}</span>
        ) : (
          <span> · Sem responsável</span>
        )}
        {item.estimatedValueCents != null ? (
          <span> · {formatMoneyFromCents(item.estimatedValueCents, item.currency)}</span>
        ) : null}
      </div>
      {canMove ? (
        <div className="vj-pipeline-move">
          <label htmlFor={`move-${item.id}`}>Mover para</label>
          <Select
            id={`move-${item.id}`}
            value={item.stage}
            disabled={pending}
            onChange={(event) => void handleMove(event.target.value as OpportunityStage)}
            aria-describedby={error ? `move-error-${item.id}` : undefined}
          >
            {MAIN_BOARD_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {STAGE_LABELS[stage]}
              </option>
            ))}
            <option value="lost">{STAGE_LABELS.lost}</option>
            <option value="archived">{STAGE_LABELS.archived}</option>
          </Select>
          {error ? (
            <p id={`move-error-${item.id}`} className="vj-field-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export default function PipelinePage() {
  const mobileDefault = useMobileDefaultList();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [canRead, setCanRead] = useState(true);
  const [canMove, setCanMove] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [view, setView] = useState<ViewMode>("list");
  const [columns, setColumns] = useState<PipelineBoardColumn[]>([]);
  const [items, setItems] = useState<OpportunitySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [responsibleMembershipId, setResponsibleMembershipId] = useState("");
  const [legalAreaId, setLegalAreaId] = useState("");
  const [terminalFilter, setTerminalFilter] = useState("");
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [legalAreas, setLegalAreas] = useState<LegalArea[]>([]);

  useEffect(() => {
    setView(mobileDefault ? "list" : "kanban");
  }, [mobileDefault]);

  const queryBase = useMemo(
    () => ({
      q: q || undefined,
      stage: (stage || terminalFilter || undefined) as OpportunityStage | undefined,
      responsibleMembershipId: responsibleMembershipId || undefined,
      legalAreaId: legalAreaId || undefined,
      includeTerminal: terminalFilter ? true : undefined,
    }),
    [q, stage, responsibleMembershipId, legalAreaId, terminalFilter],
  );

  const loadBoard = useCallback(
    async (activeId: string) => {
      const data = await fetchPipelineBoard(activeId, queryBase);
      if (isApiFailure(data)) {
        setError(apiErrorMessage(data, "Não foi possível carregar o pipeline."));
        return false;
      }
      setColumns(data.columns);
      return true;
    },
    [queryBase],
  );

  const loadList = useCallback(
    async (activeId: string, nextOffset: number) => {
      const data = await fetchOpportunities(activeId, {
        ...queryBase,
        limit: PAGE_SIZE,
        offset: nextOffset,
        sort: "updatedAt",
        order: "desc",
      });
      if (isApiFailure(data)) {
        setError(apiErrorMessage(data, "Não foi possível listar as oportunidades."));
        return false;
      }
      setItems(data.items);
      setTotal(data.total);
      setOffset(nextOffset);
      return true;
    },
    [queryBase],
  );

  const reload = useCallback(
    async (activeId: string, mode: ViewMode) => {
      setLoading(true);
      setError(null);
      const ok = mode === "kanban" ? await loadBoard(activeId) : await loadList(activeId, 0);
      if (ok) setLoading(false);
      else setLoading(false);
    },
    [loadBoard, loadList],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [activeId, membership] = await Promise.all([getActiveOrgId(), getActiveMembership()]);
      if (cancelled) return;
      if (!activeId) {
        setError("Nenhuma organização ativa.");
        setLoading(false);
        return;
      }
      const readable = membership?.permissions.includes("pipeline.read") ?? false;
      setCanRead(readable);
      setCanMove(membership?.permissions.includes("pipeline.move") ?? false);
      setCanManage(membership?.permissions.includes("pipeline.manage") ?? false);
      if (!readable) {
        setLoading(false);
        return;
      }
      setOrgId(activeId);
      const [membersData, areasData] = await Promise.all([
        fetchOrganizationMembers(activeId),
        fetchLegalAreas(activeId),
      ]);
      if (!cancelled && !isApiFailure(membersData)) setMembers(membersData.members);
      if (!cancelled && !isApiFailure(areasData)) setLegalAreas(areasData.legalAreas);
      const initialView = mobileDefault ? "list" : "kanban";
      await reload(activeId, initialView);
    })();
    return () => {
      cancelled = true;
    };
  }, [mobileDefault, reload]);

  function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    if (orgId) void reload(orgId, view);
  }

  async function handleMove(opportunityId: string, nextStage: OpportunityStage) {
    if (!orgId) return;
    const previousColumns = columns;
    const previousItems = items;
    setMoveError(null);

    const movedItem = previousColumns
      .flatMap((column) => column.opportunities)
      .find((item) => item.id === opportunityId);
    if (movedItem) {
      setColumns((current) =>
        current.map((column) => {
          const without = column.opportunities.filter((item) => item.id !== opportunityId);
          if (column.stage === nextStage) {
            return {
              ...column,
              opportunities: [...without, { ...movedItem, stage: nextStage }],
            };
          }
          return { ...column, opportunities: without };
        }),
      );
    }
    setItems((current) =>
      current.map((item) => (item.id === opportunityId ? { ...item, stage: nextStage } : item)),
    );

    const result = await moveOpportunity(orgId, opportunityId, { stage: nextStage });
    if (isApiFailure(result)) {
      setColumns(previousColumns);
      setItems(previousItems);
      setMoveError(apiErrorMessage(result, "Não foi possível mover a oportunidade."));
      return;
    }
    if (view === "kanban") await loadBoard(orgId);
    else await loadList(orgId, offset);
  }

  async function handleDrop(targetStage: OpportunityStage, opportunityId: string) {
    const item = columns
      .flatMap((column) => column.opportunities)
      .find((o) => o.id === opportunityId);
    if (!item || item.stage === targetStage) return;
    await handleMove(opportunityId, targetStage);
  }

  function switchView(next: ViewMode) {
    setView(next);
    if (orgId) void reload(orgId, next);
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const boardColumns = useMemo(() => {
    const byStage = new Map(columns.map((column) => [column.stage, column]));
    return MAIN_BOARD_STAGES.map(
      (stageKey) => byStage.get(stageKey) ?? { stage: stageKey, opportunities: [] },
    );
  }, [columns]);

  if (!canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={[{ label: "Painel", href: "/app" }, { label: "Pipeline" }]} />
        <ErrorState title="Você não pode consultar o pipeline.">
          Nenhum dado foi exibido ou alterado.
        </ErrorState>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Painel", href: "/app" }, { label: "Pipeline" }]} />
      <PageHeader
        title="Pipeline"
        description="Acompanhamento institucional da jornada comercial e jurídica. As etapas refletem o andamento registrado — não indicam probabilidade de êxito."
        actions={
          canManage ? (
            <ButtonLink href="/app/pipeline/novo" variant="primary">
              Nova oportunidade
            </ButtonLink>
          ) : null
        }
      />
      <fieldset className="vj-inline-actions" aria-label="Modo de visualização">
        <legend className="vj-visually-hidden">Modo de visualização</legend>
        <div className="vj-view-toggle">
          <button
            type="button"
            aria-pressed={view === "kanban"}
            onClick={() => switchView("kanban")}
          >
            Kanban
          </button>
          <button type="button" aria-pressed={view === "list"} onClick={() => switchView("list")}>
            Lista
          </button>
        </div>
      </fieldset>
      <form className="vj-card vj-stack vj-filters" onSubmit={applyFilters} aria-label="Filtros">
        <div className="vj-split">
          <FormField id="q" label="Busca">
            <Input
              id="q"
              name="q"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Título ou pessoa vinculada"
            />
          </FormField>
          <FormField id="stage" label="Etapa">
            <Select id="stage" value={stage} onChange={(event) => setStage(event.target.value)}>
              <option value="">Todas (ativas)</option>
              {MAIN_BOARD_STAGES.map((key) => (
                <option key={key} value={key}>
                  {STAGE_LABELS[key]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div className="vj-split">
          <FormField id="responsibleMembershipId" label="Responsável">
            <Select
              id="responsibleMembershipId"
              value={responsibleMembershipId}
              onChange={(event) => setResponsibleMembershipId(event.target.value)}
            >
              <option value="">Todos</option>
              {members.map((member) => (
                <option key={member.membershipId} value={member.membershipId}>
                  {member.displayName}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="legalAreaId" label="Área jurídica">
            <Select
              id="legalAreaId"
              value={legalAreaId}
              onChange={(event) => setLegalAreaId(event.target.value)}
            >
              <option value="">Todas</option>
              {legalAreas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div className="vj-split">
          <FormField id="terminalFilter" label="Perdidas e arquivadas">
            <Select
              id="terminalFilter"
              value={terminalFilter}
              onChange={(event) => {
                setTerminalFilter(event.target.value);
                setStage("");
              }}
            >
              <option value="">Ocultar</option>
              <option value="lost">{STAGE_LABELS.lost}</option>
              <option value="archived">{STAGE_LABELS.archived}</option>
            </Select>
          </FormField>
        </div>
        <div className="vj-form-actions">
          <button type="submit" className="vj-button vj-button-primary">
            Aplicar filtros
          </button>
        </div>
      </form>
      {loading ? <LoadingState label="Carregando pipeline" /> : null}
      {error ? <ErrorState title="Erro ao carregar pipeline">{error}</ErrorState> : null}
      {!loading && !error && view === "kanban" && !terminalFilter ? (
        boardColumns.every((column) => column.opportunities.length === 0) ? (
          <EmptyState
            title="Nenhuma oportunidade no pipeline"
            action={
              canManage ? (
                <ButtonLink href="/app/pipeline/novo" variant="primary">
                  Registrar oportunidade
                </ButtonLink>
              ) : undefined
            }
          >
            Não há oportunidades nas etapas ativas com os filtros atuais.
          </EmptyState>
        ) : (
          <section className="vj-pipeline-board" aria-label="Quadro kanban do pipeline">
            {boardColumns.map((column) => (
              <section
                key={column.stage}
                className="vj-pipeline-column"
                aria-label={STAGE_LABELS[column.stage]}
                onDragOver={
                  canMove
                    ? (event) => {
                        event.preventDefault();
                        event.currentTarget.classList.add("vj-pipeline-drop-target");
                      }
                    : undefined
                }
                onDragLeave={
                  canMove
                    ? (event) => {
                        event.currentTarget.classList.remove("vj-pipeline-drop-target");
                      }
                    : undefined
                }
                onDrop={
                  canMove
                    ? (event) => {
                        event.preventDefault();
                        event.currentTarget.classList.remove("vj-pipeline-drop-target");
                        const opportunityId = event.dataTransfer.getData("text/plain");
                        if (opportunityId) void handleDrop(column.stage, opportunityId);
                      }
                    : undefined
                }
              >
                <h2 className="vj-pipeline-column-header">
                  {STAGE_LABELS[column.stage]}{" "}
                  <span className="vj-pipeline-column-count">({column.opportunities.length})</span>
                </h2>
                <ul className="vj-pipeline-cards">
                  {column.opportunities.map((item) => (
                    <PipelineCard
                      key={item.id}
                      item={item}
                      canMove={canMove}
                      onMove={handleMove}
                      moveError={moveError}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </section>
        )
      ) : null}
      {!loading && !error && (view === "list" || terminalFilter) ? (
        items.length === 0 ? (
          <EmptyState
            title="Nenhuma oportunidade encontrada"
            action={
              canManage && !terminalFilter ? (
                <ButtonLink href="/app/pipeline/novo" variant="primary">
                  Registrar oportunidade
                </ButtonLink>
              ) : undefined
            }
          >
            Não há oportunidades com os filtros atuais.
          </EmptyState>
        ) : (
          <>
            <div className="vj-table-wrap">
              <table className="vj-table">
                <thead>
                  <tr>
                    <th scope="col">Oportunidade</th>
                    <th scope="col">Etapa</th>
                    <th scope="col">Responsável</th>
                    <th scope="col">Área</th>
                    <th scope="col">Valor estimado</th>
                    <th scope="col">Atualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Oportunidade">
                        <a href={`/app/pipeline/${item.id}`}>{item.title}</a>
                        {item.lead ? <div className="vj-meta">{item.lead.name}</div> : null}
                      </td>
                      <td data-label="Etapa">
                        <Badge tone={stageBadgeTone(item.stage)}>{STAGE_LABELS[item.stage]}</Badge>
                      </td>
                      <td data-label="Responsável">{item.responsible?.displayName ?? "—"}</td>
                      <td data-label="Área">{item.legalArea?.name ?? "—"}</td>
                      <td data-label="Valor estimado">
                        {formatMoneyFromCents(item.estimatedValueCents, item.currency)}
                      </td>
                      <td data-label="Atualizado">
                        {new Date(item.updatedAt).toLocaleString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav className="vj-inline-actions" aria-label="Paginação">
              <button
                type="button"
                className="vj-button vj-button-secondary"
                disabled={offset === 0}
                onClick={() => orgId && void loadList(orgId, Math.max(0, offset - PAGE_SIZE))}
              >
                Anterior
              </button>
              <span className="vj-meta">
                Página {page} de {totalPages} · {total} registro{total === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                className="vj-button vj-button-secondary"
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => orgId && void loadList(orgId, offset + PAGE_SIZE)}
              >
                Próxima
              </button>
            </nav>
          </>
        )
      ) : null}
    </div>
  );
}
