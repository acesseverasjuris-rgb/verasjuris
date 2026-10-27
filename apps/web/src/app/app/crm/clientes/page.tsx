"use client";

import {
  Badge,
  Breadcrumb,
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
  CLIENT_STATUS_LABELS,
  fetchClients,
  getActiveOrgId,
  isApiFailure,
  PERSON_TYPE_LABELS,
  type CrmClientStatus,
  type CrmClientSummary,
  type CrmPersonType,
} from "../../../../lib/crm";

const PAGE_SIZE = 20;

export default function ClientsListPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [items, setItems] = useState<CrmClientSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [personType, setPersonType] = useState("");

  const load = useCallback(
    async (activeId: string, nextOffset: number) => {
      setLoading(true);
      setError(null);
      const data = await fetchClients(activeId, {
        q: q || undefined,
        status: status || undefined,
        personType: personType ? (personType as CrmPersonType) : undefined,
        limit: PAGE_SIZE,
        offset: nextOffset,
        sort: "updatedAt",
        order: "desc",
      });
      if (isApiFailure(data)) {
        setError(apiErrorMessage(data, "Não foi possível listar os clientes."));
        setLoading(false);
        return;
      }
      setItems(data.items);
      setTotal(data.total);
      setOffset(nextOffset);
      setLoading(false);
    },
    [q, status, personType],
  );

  useEffect(() => {
    void (async () => {
      const activeId = await getActiveOrgId();
      if (!activeId) {
        setError("Nenhuma organização ativa.");
        setLoading(false);
        return;
      }
      setOrgId(activeId);
      await load(activeId, 0);
    })();
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
          { label: "Clientes" },
        ]}
      />
      <PageHeader
        title="Clientes"
        description="Relacionamentos comerciais consolidados. Clientes podem originar-se de leads convertidos ou cadastro direto."
      />
      <form className="vj-card vj-stack vj-filters" onSubmit={applyFilters} aria-label="Filtros">
        <div className="vj-split">
          <FormField id="q" label="Busca">
            <Input
              id="q"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Nome, e-mail ou telefone"
            />
          </FormField>
          <FormField id="status" label="Status">
            <Select id="status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Todos</option>
              {(Object.keys(CLIENT_STATUS_LABELS) as CrmClientStatus[]).map((key) => (
                <option key={key} value={key}>
                  {CLIENT_STATUS_LABELS[key]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
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
        <div className="vj-form-actions">
          <button type="submit" className="vj-button vj-button-primary">
            Aplicar filtros
          </button>
        </div>
      </form>
      {loading ? <LoadingState label="Carregando clientes" /> : null}
      {error ? <ErrorState title="Erro ao carregar clientes">{error}</ErrorState> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhum cliente encontrado">
          Não há clientes com os filtros atuais. Converta um lead ou aguarde novos registros.
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
                  <th scope="col">Documento</th>
                  <th scope="col">Status</th>
                  <th scope="col">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((client) => (
                  <tr key={client.id}>
                    <td data-label="Nome">
                      <a href={`/app/crm/clientes/${client.id}`}>{client.displayName}</a>
                      <div className="vj-meta">{PERSON_TYPE_LABELS[client.personType]}</div>
                    </td>
                    <td data-label="Contato">
                      {client.email ?? "—"}
                      {client.phone ? <div className="vj-meta">{client.phone}</div> : null}
                    </td>
                    <td data-label="Documento">{client.cpfMasked ?? client.cnpjMasked ?? "—"}</td>
                    <td data-label="Status">
                      <Badge tone={client.status === "active" ? "success" : "neutral"}>
                        {CLIENT_STATUS_LABELS[client.status]}
                      </Badge>
                    </td>
                    <td data-label="Atualizado">
                      {new Date(client.updatedAt).toLocaleString("pt-BR")}
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
