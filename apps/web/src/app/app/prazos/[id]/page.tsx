"use client";

import { Alert, Badge, Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  apiErrorMessage,
  confirmDeadline,
  fetchDeadline,
  getActiveOrgId,
  isApiFailure,
} from "../../../../lib/productivity";

export default function PrazoDetailPage() {
  const params = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("");
  const [microcopy, setMicrocopy] = useState("");
  const [due, setDue] = useState<string | null>(null);
  const [history, setHistory] = useState<
    Array<{ id: string; title: string; eventAt: string; reason: string | null }>
  >([]);
  const [orgId, setOrgId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const activeId = await getActiveOrgId();
    if (!activeId) {
      setError("Nenhuma organização ativa.");
      setLoading(false);
      return;
    }
    setOrgId(activeId);
    const data = await fetchDeadline(activeId, params.id);
    if (isApiFailure(data)) {
      setError(apiErrorMessage(data, "Não foi possível carregar o prazo."));
      setLoading(false);
      return;
    }
    setTitle(data.deadline.title);
    setStatus(data.deadline.status);
    setMicrocopy(data.deadline.microcopy ?? "");
    setDue(data.deadline.confirmedDueAt ?? data.deadline.calculatedDueAt);
    setHistory(data.history);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onConfirm() {
    if (!orgId) return;
    const result = await confirmDeadline(orgId, params.id);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível confirmar."));
      return;
    }
    await load();
  }

  if (loading) return <LoadingState label="Carregando prazo…" />;
  if (error) return <ErrorState title="Erro">{error}</ErrorState>;

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Painel", href: "/app" },
          { label: "Prazos", href: "/app/prazos" },
          { label: title },
        ]}
      />
      <PageHeader title={title} description="Detalhe do prazo central." />
      <p>
        Status: <Badge>{status}</Badge>
      </p>
      <Alert tone="info" title="Conferência">
        {microcopy}
      </Alert>
      <p className="vj-meta">
        Data: {due ? new Date(due).toLocaleString("pt-BR") : "—"} · feriados NOT_CONFIGURED
      </p>
      {status === "suggested" || status === "pending_confirmation" ? (
        <button type="button" className="vj-button" onClick={() => void onConfirm()}>
          Confirmar prazo
        </button>
      ) : null}
      <section>
        <h2 className="vj-section-title">Histórico</h2>
        <ul>
          {history.map((h) => (
            <li key={h.id}>
              {h.title}
              <span className="vj-meta">
                {" "}
                · {new Date(h.eventAt).toLocaleString("pt-BR")}
                {h.reason ? ` · ${h.reason}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
