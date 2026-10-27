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
import { getActiveMembership } from "../../../lib/crm";
import {
  apiErrorMessage,
  fetchIntakes,
  fetchLegalAreas,
  getActiveOrgId,
  INTAKE_STATUS_LABELS,
  isApiFailure,
  URGENCY_LABELS,
  urgencyBadgeTone,
  type IntakeStatus,
  type IntakeSummary,
  type IntakeUrgency,
  type LegalArea,
} from "../../../lib/intake";

const PAGE_SIZE = 20;

export default function AtendimentosListPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [canRead, setCanRead] = useState(true);
  const [canCreate, setCanCreate] = useState(false);
  const [items, setItems] = useState<IntakeSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [urgency, setUrgency] = useState("");
  const [legalAreaId, setLegalAreaId] = useState("");
  const [legalAreas, setLegalAreas] = useState<LegalArea[]>([]);

  const load = useCallback(
    async (activeId: string, nextOffset: number) => {
      setLoading(true);
      setError(null);
      const data = await fetchIntakes(activeId, {
        q: q || undefined,
        status: status ? (status as IntakeStatus) : undefined,
        urgency: urgency ? (urgency as IntakeUrgency) : undefined,
        legalAreaId: legalAreaId || undefined,
        limit: PAGE_SIZE,
        offset: nextOffset,
        sort: "updatedAt",
        order: "desc",
      });
      if (isApiFailure(data)) {
        setError(apiErrorMessage(data, "Não foi possível listar os atendimentos."));
        setLoading(false);
        return;
      }
      setItems(data.items);
      setTotal(data.total);
      setOffset(nextOffset);
      setLoading(false);
    },
    [q, status, urgency, legalAreaId],
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
      const readable = membership?.permissions.includes("intake.read") ?? false;
      setCanRead(readable);
      setCanCreate(membership?.permissions.includes("intake.create") ?? false);
      if (!readable) {
        setLoading(false);
        return;
      }
      setOrgId(activeId);
      const areasData = await fetchLegalAreas(activeId);
      if (!cancelled && !isApiFailure(areasData)) {
        setLegalAreas(areasData.legalAreas);
      }
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
        <Breadcrumb items={[{ label: "Painel", href: "/app" }, { label: "Atendimentos" }]} />
        <ErrorState title="Você não pode consultar atendimentos.">
          Nenhum dado foi exibido ou alterado.
        </ErrorState>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Painel", href: "/app" }, { label: "Atendimentos" }]} />
      <PageHeader
        title="Atendimentos"
        description="Registro inicial de demandas e triagem. As informações refletem o que foi informado — não constituem parecer jurídico."
        actions={
          canCreate ? (
            <ButtonLink href="/app/atendimentos/novo" variant="primary">
              Novo atendimento
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
              placeholder="Título, resumo ou pessoa vinculada"
            />
          </FormField>
          <FormField id="status" label="Status">
            <Select id="status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Todos</option>
              {(Object.keys(INTAKE_STATUS_LABELS) as IntakeStatus[]).map((key) => (
                <option key={key} value={key}>
                  {INTAKE_STATUS_LABELS[key]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div className="vj-split">
          <FormField id="urgency" label="Urgência">
            <Select
              id="urgency"
              value={urgency}
              onChange={(event) => setUrgency(event.target.value)}
            >
              <option value="">Todas</option>
              {(Object.keys(URGENCY_LABELS) as IntakeUrgency[]).map((key) => (
                <option key={key} value={key}>
                  {URGENCY_LABELS[key]}
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
        <div className="vj-form-actions">
          <button type="submit" className="vj-button vj-button-primary">
            Aplicar filtros
          </button>
        </div>
      </form>
      {loading ? <LoadingState label="Carregando atendimentos" /> : null}
      {error ? <ErrorState title="Erro ao carregar atendimentos">{error}</ErrorState> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title="Nenhum atendimento encontrado"
          action={
            canCreate ? (
              <ButtonLink href="/app/atendimentos/novo" variant="primary">
                Registrar atendimento
              </ButtonLink>
            ) : undefined
          }
        >
          Não há atendimentos com os filtros atuais. Ajuste a busca ou registre um novo atendimento.
        </EmptyState>
      ) : null}
      {!loading && !error && items.length > 0 ? (
        <>
          <div className="vj-table-wrap">
            <table className="vj-table">
              <thead>
                <tr>
                  <th scope="col">Atendimento</th>
                  <th scope="col">Pessoa</th>
                  <th scope="col">Status</th>
                  <th scope="col">Urgência</th>
                  <th scope="col">Área</th>
                  <th scope="col">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Atendimento">
                      <a href={`/app/atendimentos/${item.id}`}>{item.title}</a>
                      {item.summary ? (
                        <div className="vj-meta">
                          {item.summary.length > 80
                            ? `${item.summary.slice(0, 80)}…`
                            : item.summary}
                        </div>
                      ) : null}
                    </td>
                    <td data-label="Pessoa">
                      {item.lead?.name ?? item.client?.displayName ?? "—"}
                      {item.lead?.email || item.lead?.phone ? (
                        <div className="vj-meta">{item.lead.email ?? item.lead.phone}</div>
                      ) : null}
                    </td>
                    <td data-label="Status">
                      <Badge
                        tone={
                          item.status === "converted" || item.status === "qualified"
                            ? "success"
                            : item.status === "not_qualified" || item.status === "archived"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {INTAKE_STATUS_LABELS[item.status]}
                      </Badge>
                    </td>
                    <td data-label="Urgência">
                      <Badge tone={urgencyBadgeTone(item.urgency)}>
                        {URGENCY_LABELS[item.urgency]}
                      </Badge>
                    </td>
                    <td data-label="Área">{item.legalArea?.name ?? "—"}</td>
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
