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
  fetchChannels,
  fetchLeads,
  fetchSources,
  fetchTags,
  getActiveOrgId,
  isApiFailure,
  LEAD_STATUS_LABELS,
  PERSON_TYPE_LABELS,
  type CrmChannel,
  type CrmLeadStatus,
  type CrmLeadSummary,
  type CrmSource,
  type CrmTag,
} from "../../../../lib/crm";

const PAGE_SIZE = 20;

export default function LeadsListPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [items, setItems] = useState<CrmLeadSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [personType, setPersonType] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [tagId, setTagId] = useState("");
  const [sources, setSources] = useState<CrmSource[]>([]);
  const [channels, setChannels] = useState<CrmChannel[]>([]);
  const [tags, setTags] = useState<CrmTag[]>([]);

  const load = useCallback(
    async (activeId: string, nextOffset: number) => {
      setLoading(true);
      setError(null);
      const data = await fetchLeads(activeId, {
        q: q || undefined,
        status: status || undefined,
        personType: personType ? (personType as "person" | "organization") : undefined,
        sourceId: sourceId || undefined,
        channelId: channelId || undefined,
        tagId: tagId || undefined,
        limit: PAGE_SIZE,
        offset: nextOffset,
        sort: "updatedAt",
        order: "desc",
      });
      if (isApiFailure(data)) {
        setError(apiErrorMessage(data, "Não foi possível listar os leads."));
        setLoading(false);
        return;
      }
      setItems(data.items);
      setTotal(data.total);
      setOffset(nextOffset);
      setLoading(false);
    },
    [q, status, personType, sourceId, channelId, tagId],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const activeId = await getActiveOrgId();
      if (cancelled) return;
      if (!activeId) {
        setError("Nenhuma organização ativa.");
        setLoading(false);
        return;
      }
      setOrgId(activeId);
      const [sourcesData, channelsData, tagsData] = await Promise.all([
        fetchSources(activeId),
        fetchChannels(activeId),
        fetchTags(activeId),
      ]);
      if (!cancelled) {
        if (!isApiFailure(sourcesData)) setSources(sourcesData.sources ?? []);
        if (!isApiFailure(channelsData)) setChannels(channelsData.channels ?? []);
        if (!isApiFailure(tagsData)) setTags(tagsData.tags ?? []);
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

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Painel", href: "/app" },
          { label: "CRM", href: "/app/crm" },
          { label: "Leads" },
        ]}
      />
      <PageHeader
        title="Leads"
        description="Oportunidades em acompanhamento. A conversão preserva histórico e informações disponíveis."
        actions={
          <ButtonLink href="/app/crm/leads/novo" variant="primary">
            Novo lead
          </ButtonLink>
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
              placeholder="Nome, e-mail ou telefone"
            />
          </FormField>
          <FormField id="status" label="Status">
            <Select id="status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Todos</option>
              {(Object.keys(LEAD_STATUS_LABELS) as CrmLeadStatus[]).map((key) => (
                <option key={key} value={key}>
                  {LEAD_STATUS_LABELS[key]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div className="vj-split">
          <FormField id="personType" label="Tipo">
            <Select
              id="personType"
              value={personType}
              onChange={(event) => setPersonType(event.target.value)}
            >
              <option value="">Todos</option>
              <option value="person">{PERSON_TYPE_LABELS.person}</option>
              <option value="organization">{PERSON_TYPE_LABELS.organization}</option>
            </Select>
          </FormField>
          <FormField id="sourceId" label="Origem">
            <Select
              id="sourceId"
              value={sourceId}
              onChange={(event) => setSourceId(event.target.value)}
            >
              <option value="">Todas</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div className="vj-split">
          <FormField id="channelId" label="Canal">
            <Select
              id="channelId"
              value={channelId}
              onChange={(event) => setChannelId(event.target.value)}
            >
              <option value="">Todos</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="tagId" label="Tag">
            <Select id="tagId" value={tagId} onChange={(event) => setTagId(event.target.value)}>
              <option value="">Todas</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
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
      {loading ? <LoadingState label="Carregando leads" /> : null}
      {error ? <ErrorState title="Erro ao carregar leads">{error}</ErrorState> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title="Nenhum lead encontrado"
          action={
            <ButtonLink href="/app/crm/leads/novo" variant="primary">
              Registrar lead
            </ButtonLink>
          }
        >
          Não há leads com os filtros atuais. Ajuste a busca ou registre um novo lead.
        </EmptyState>
      ) : null}
      {!loading && !error && items.length > 0 ? (
        <>
          <div className="vj-table-wrap">
            <table className="vj-table">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Contato</th>
                  <th scope="col">Status</th>
                  <th scope="col">Origem</th>
                  <th scope="col">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((lead) => (
                  <tr key={lead.id}>
                    <td data-label="Nome">
                      <a href={`/app/crm/leads/${lead.id}`}>{lead.name}</a>
                      {lead.tradeName ? <span className="vj-meta"> · {lead.tradeName}</span> : null}
                      <div className="vj-meta">{PERSON_TYPE_LABELS[lead.personType]}</div>
                    </td>
                    <td data-label="Contato">
                      {lead.email ?? "—"}
                      {lead.phone ? <div className="vj-meta">{lead.phone}</div> : null}
                    </td>
                    <td data-label="Status">
                      <Badge
                        tone={
                          lead.status === "converted"
                            ? "success"
                            : lead.status === "unqualified" || lead.status === "archived"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {LEAD_STATUS_LABELS[lead.status]}
                      </Badge>
                    </td>
                    <td data-label="Origem">{lead.source?.name ?? "—"}</td>
                    <td data-label="Atualizado">
                      {new Date(lead.updatedAt).toLocaleString("pt-BR")}
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
