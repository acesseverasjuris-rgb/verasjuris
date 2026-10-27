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
} from "@verasjuris/ui";
import { useCallback, useEffect, useState } from "react";
import {
  apiErrorMessage,
  fetchContacts,
  getActiveOrgId,
  isApiFailure,
  type CrmContact,
} from "../../../../lib/crm";

const PAGE_SIZE = 20;

export default function ContactsListPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [items, setItems] = useState<CrmContact[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(
    async (activeId: string, nextOffset: number) => {
      setLoading(true);
      setError(null);
      const data = await fetchContacts(activeId, {
        q: q || undefined,
        limit: PAGE_SIZE,
        offset: nextOffset,
        sort: "name",
        order: "asc",
      });
      if (isApiFailure(data)) {
        setError(
          apiErrorMessage(
            data,
            "Não foi possível listar os contatos. Verifique se a rota de contatos está disponível na API.",
          ),
        );
        setLoading(false);
        return;
      }
      setItems(data.items);
      setTotal(data.total);
      setOffset(nextOffset);
      setLoading(false);
    },
    [q],
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
          { label: "Contatos" },
        ]}
      />
      <PageHeader
        title="Contatos"
        description="Pessoas de contato vinculadas a leads e clientes. A listagem usa a rota consolidada de contatos da organização."
      />
      <form className="vj-card vj-stack vj-filters" onSubmit={applyFilters} aria-label="Filtros">
        <FormField id="q" label="Busca">
          <Input
            id="q"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Nome, e-mail ou telefone"
          />
        </FormField>
        <div className="vj-form-actions">
          <button type="submit" className="vj-button vj-button-primary">
            Aplicar filtros
          </button>
        </div>
      </form>
      {loading ? <LoadingState label="Carregando contatos" /> : null}
      {error ? <ErrorState title="Erro ao carregar contatos">{error}</ErrorState> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhum contato encontrado">
          Contatos aparecem quando associados a leads ou clientes. Nenhum registro fictício é
          exibido.
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
                  <th scope="col">Cargo</th>
                  <th scope="col">Vínculo</th>
                </tr>
              </thead>
              <tbody>
                {items.map((contact) => (
                  <tr key={contact.id}>
                    <td data-label="Nome">
                      {contact.name}
                      {contact.isPrimary ? (
                        <>
                          {" "}
                          <Badge tone="success">Principal</Badge>
                        </>
                      ) : null}
                    </td>
                    <td data-label="Contato">
                      {contact.email ?? "—"}
                      {contact.phone ? <div className="vj-meta">{contact.phone}</div> : null}
                    </td>
                    <td data-label="Cargo">{contact.jobTitle ?? "—"}</td>
                    <td data-label="Vínculo">
                      {contact.clientId ? (
                        <a href={`/app/crm/clientes/${contact.clientId}`}>Cliente</a>
                      ) : contact.leadId ? (
                        <a href={`/app/crm/leads/${contact.leadId}`}>Lead</a>
                      ) : (
                        "—"
                      )}
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
