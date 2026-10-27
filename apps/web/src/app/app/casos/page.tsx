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
import { useCallback, useEffect, useState } from "react";
import {
  apiErrorMessage,
  clientDisplayName,
  fetchMatters,
  getActiveMembership,
  getActiveOrgId,
  hasMatterPermission,
  isApiFailure,
  MATTER_PRIORITY_LABELS,
  MATTER_STATUS_LABELS,
  matterPriorityTone,
  matterStatusTone,
  type MatterPriority,
  type MatterStatus,
  type MatterSummary,
} from "../../../lib/matters";

const PAGE_SIZE = 20;

export default function CasosListPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [canRead, setCanRead] = useState(true);
  const [canCreate, setCanCreate] = useState(false);
  const [items, setItems] = useState<MatterSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");

  const load = useCallback(
    async (activeId: string, nextOffset: number) => {
      setLoading(true);
      setError(null);
      const data = await fetchMatters(activeId, {
        q: q || undefined,
        status: status ? (status as MatterStatus) : undefined,
        priority: priority ? (priority as MatterPriority) : undefined,
        limit: PAGE_SIZE,
        offset: nextOffset,
      });
      if (isApiFailure(data)) {
        setError(apiErrorMessage(data, "Não foi possível listar os casos."));
        setLoading(false);
        return;
      }
      setItems(data.items);
      setTotal(data.total);
      setOffset(nextOffset);
      setLoading(false);
    },
    [q, status, priority],
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
      const readable = hasMatterPermission(membership?.permissions, "read");
      setCanRead(readable);
      setCanCreate(hasMatterPermission(membership?.permissions, "create"));
      if (!readable) {
        setLoading(false);
        return;
      }
      setOrgId(activeId);
      await load(activeId, 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    if (orgId) void load(orgId, 0);
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (!canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={[{ label: "Painel", href: "/app" }, { label: "Casos" }]} />
        <ErrorState title="Sem permissão">
          Você não tem permissão para consultar casos nesta organização.
        </ErrorState>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Painel", href: "/app" }, { label: "Casos" }]} />
      <PageHeader
        title="Casos"
        description="Unidade jurídica de trabalho: contexto da demanda, situação operacional, responsável e próxima ação registrada."
        actions={
          canCreate ? (
            <ButtonLink href="/app/casos/novo" variant="primary">
              Novo caso
            </ButtonLink>
          ) : null
        }
      />
      <form className="vj-card vj-stack vj-filters" onSubmit={applyFilters} aria-label="Filtros">
        <div className="vj-split">
          <FormField id="q" label="Busca">
            <Input
              id="q"
              name="q"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Referência, título ou cliente"
            />
          </FormField>
          <FormField id="status" label="Status">
            <Select id="status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Todos</option>
              {(Object.keys(MATTER_STATUS_LABELS) as MatterStatus[]).map((key) => (
                <option key={key} value={key}>
                  {MATTER_STATUS_LABELS[key]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div className="vj-split">
          <FormField id="priority" label="Prioridade">
            <Select
              id="priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            >
              <option value="">Todas</option>
              {(Object.keys(MATTER_PRIORITY_LABELS) as MatterPriority[]).map((key) => (
                <option key={key} value={key}>
                  {MATTER_PRIORITY_LABELS[key]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div className="vj-form-actions">
          <button type="submit" className="vj-button vj-button-primary">
            Aplicar filtros
          </button>
        </div>
      </form>
      {loading ? <LoadingState label="Carregando casos" /> : null}
      {error ? <ErrorState title="Erro ao carregar casos">{error}</ErrorState> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title="Nenhum caso encontrado"
          action={
            canCreate ? (
              <ButtonLink href="/app/casos/novo" variant="primary">
                Abrir caso
              </ButtonLink>
            ) : null
          }
        >
          Não há casos com os filtros atuais. Ajuste a busca ou registre um novo caso.
        </EmptyState>
      ) : null}
      {!loading && !error && items.length > 0 ? (
        <>
          <div className="vj-table-wrap">
            <table className="vj-table">
              <thead>
                <tr>
                  <th scope="col">Referência</th>
                  <th scope="col">Contexto</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Responsável</th>
                  <th scope="col">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((matter) => (
                  <tr key={matter.id}>
                    <td data-label="Referência">
                      <a href={`/app/casos/${matter.id}`}>
                        <span className="vj-technical">{matter.internalReference}</span>
                      </a>
                    </td>
                    <td data-label="Contexto">
                      <a href={`/app/casos/${matter.id}`}>{matter.title}</a>
                      <div className="vj-meta">{clientDisplayName(matter.client)}</div>
                      {matter.legalArea?.name ? (
                        <div className="vj-meta">{matter.legalArea.name}</div>
                      ) : null}
                    </td>
                    <td data-label="Situação">
                      <Badge tone={matterStatusTone(matter.status)}>
                        {MATTER_STATUS_LABELS[matter.status]}
                      </Badge>
                      <div className="vj-meta">
                        <Badge tone={matterPriorityTone(matter.priority)}>
                          {MATTER_PRIORITY_LABELS[matter.priority]}
                        </Badge>
                      </div>
                    </td>
                    <td data-label="Responsável">{matter.responsible?.displayName ?? "—"}</td>
                    <td data-label="Atualizado">
                      {new Date(matter.updatedAt).toLocaleString("pt-BR")}
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
              onClick={() => orgId && void load(orgId, Math.max(0, offset - PAGE_SIZE))}
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
              onClick={() => orgId && void load(orgId, offset + PAGE_SIZE)}
            >
              Próxima
            </button>
          </nav>
        </>
      ) : null}
    </div>
  );
}
