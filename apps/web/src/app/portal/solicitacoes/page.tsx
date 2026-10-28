"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { PortalAccessDenied, PortalRequestsTable } from "../../../components/client-portal-ui";
import {
  createPortalRequest,
  fetchPortalRequests,
  isApiFailure,
  portalErrorMessage,
  type PortalClientRequest,
} from "../../../lib/client-portal";
import { usePortalContext } from "../../../lib/use-portal-context";

export default function PortalSolicitacoesPage() {
  const portal = usePortalContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PortalClientRequest[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  function reload() {
    if (!portal.orgId) return;
    void fetchPortalRequests(portal.orgId, { limit: 50 }).then((data) => {
      if (!isApiFailure(data)) setItems(data.requests);
    });
  }

  useEffect(() => {
    if (!portal.ready || !portal.linked || !portal.orgId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const data = await fetchPortalRequests(portal.orgId!, { limit: 50 });
      if (cancelled) return;
      if (isApiFailure(data))
        setError(portalErrorMessage(data, "Não foi possível listar solicitações."));
      else setItems(data.requests);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [portal.ready, portal.linked, portal.orgId]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!portal.orgId || !title.trim()) return;
    const result = await createPortalRequest(portal.orgId, {
      title: title.trim(),
      description: description.trim() || undefined,
    });
    if (isApiFailure(result)) {
      setError(portalErrorMessage(result, "Não foi possível registrar a solicitação."));
      return;
    }
    setTitle("");
    setDescription("");
    reload();
  }

  const breadcrumb = [{ label: "Portal", href: "/portal" }, { label: "Solicitações" }];

  if (portal.ready && !portal.linked) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <PortalAccessDenied message={portal.deniedMessage ?? undefined} />
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader title="Solicitações" description="Pedidos gerais ao escritório." />
      <form
        className="vj-stack vj-card"
        onSubmit={(e) => void handleCreate(e)}
        aria-label="Nova solicitação"
      >
        <h2 className="vj-section-title">Nova solicitação</h2>
        <label htmlFor="req-title">Título</label>
        <input
          id="req-title"
          className="vj-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={2}
        />
        <label htmlFor="req-desc">Descrição</label>
        <textarea
          id="req-desc"
          className="vj-textarea"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button type="submit" className="vj-button vj-button-primary">
          Enviar solicitação
        </button>
      </form>
      {loading || !portal.ready ? <LoadingState label="Carregando solicitações" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length > 0 ? <PortalRequestsTable items={items} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhuma solicitação">
          Registre um pedido usando o formulário acima.
        </EmptyState>
      ) : null}
    </div>
  );
}
