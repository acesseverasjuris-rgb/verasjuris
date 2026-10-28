"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  PortalAccessDenied,
  PortalMessageThread,
  PortalThreadList,
} from "../../../components/client-portal-ui";
import {
  createPortalThread,
  fetchPortalMessages,
  fetchPortalThreads,
  isApiFailure,
  portalErrorMessage,
  sendPortalMessage,
  type PortalMessage,
  type PortalThread,
} from "../../../lib/client-portal";
import { usePortalContext } from "../../../lib/use-portal-context";

export default function PortalMensagensPage() {
  const portal = usePortalContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threads, setThreads] = useState<PortalThread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [compose, setCompose] = useState("");
  const [newSubject, setNewSubject] = useState("");

  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedId só para pré-seleção inicial
  useEffect(() => {
    if (!portal.ready || !portal.linked || !portal.orgId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const data = await fetchPortalThreads(portal.orgId!, { limit: 50 });
      if (cancelled) return;
      if (isApiFailure(data))
        setError(portalErrorMessage(data, "Não foi possível listar conversas."));
      else {
        setThreads(data.threads);
        if (data.threads[0] && !selectedId) setSelectedId(data.threads[0].id);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [portal.ready, portal.linked, portal.orgId]);

  useEffect(() => {
    if (!portal.orgId || !selectedId || !portal.linked) return;
    let cancelled = false;
    void (async () => {
      setMsgLoading(true);
      const data = await fetchPortalMessages(portal.orgId!, selectedId, { limit: 100 });
      if (cancelled) return;
      if (!isApiFailure(data)) setMessages(data.messages);
      setMsgLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [portal.orgId, selectedId, portal.linked]);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    if (!portal.orgId || !selectedId || !compose.trim()) return;
    const result = await sendPortalMessage(portal.orgId, selectedId, compose.trim());
    if (isApiFailure(result)) {
      setError(portalErrorMessage(result, "Não foi possível enviar a mensagem."));
      return;
    }
    setMessages((prev) => [...prev, result.message]);
    setCompose("");
  }

  async function handleNewThread(event: React.FormEvent) {
    event.preventDefault();
    if (!portal.orgId || !newSubject.trim()) return;
    const result = await createPortalThread(portal.orgId, { subject: newSubject.trim() });
    if (isApiFailure(result)) {
      setError(portalErrorMessage(result, "Não foi possível abrir a conversa."));
      return;
    }
    setThreads((prev) => [result.thread, ...prev]);
    setSelectedId(result.thread.id);
    setNewSubject("");
  }

  const breadcrumb = [{ label: "Portal", href: "/portal" }, { label: "Mensagens" }];

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
      <PageHeader title="Mensagens" description="Conversas seguras com o escritório." />
      {loading || !portal.ready ? <LoadingState label="Carregando conversas" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        <div
          className="vj-split"
          style={{ gridTemplateColumns: "minmax(min(100%, 16rem), 1fr) minmax(0, 2fr)" }}
        >
          <div className="vj-stack">
            <form
              className="vj-stack"
              onSubmit={(e) => void handleNewThread(e)}
              aria-label="Nova conversa"
            >
              <label htmlFor="new-thread-subject">Nova conversa</label>
              <input
                id="new-thread-subject"
                className="vj-input"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                minLength={2}
                required
              />
              <button type="submit" className="vj-button vj-button-secondary">
                Abrir
              </button>
            </form>
            {threads.length > 0 ? (
              <PortalThreadList
                threads={threads}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ) : (
              <EmptyState title="Sem conversas">
                Abra uma conversa para falar com o escritório.
              </EmptyState>
            )}
          </div>
          <div className="vj-stack">
            {selectedId ? (
              <>
                {msgLoading ? <LoadingState label="Carregando mensagens" /> : null}
                <PortalMessageThread messages={messages} />
                <form
                  className="vj-stack"
                  onSubmit={(e) => void handleSend(e)}
                  aria-label="Enviar mensagem"
                >
                  <label htmlFor="portal-message-body">Sua mensagem</label>
                  <textarea
                    id="portal-message-body"
                    className="vj-textarea"
                    rows={3}
                    value={compose}
                    onChange={(e) => setCompose(e.target.value)}
                    required
                  />
                  <button type="submit" className="vj-button vj-button-primary">
                    Enviar
                  </button>
                </form>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
