"use client";

import {
  Badge,
  Breadcrumb,
  ButtonLink,
  EmptyState,
  ErrorState,
  FormField,
  LoadingState,
  PageHeader,
  Select,
} from "@verasjuris/ui";
import { useCallback, useEffect, useState } from "react";
import {
  apiErrorMessage,
  fetchTasks,
  getActiveMembership,
  getActiveOrgId,
  hasPermission,
  isApiFailure,
  TASK_STATUS_LABELS,
  type TaskStatus,
  type TaskSummary,
} from "../../../lib/productivity";

export default function TarefasPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [canRead, setCanRead] = useState(true);
  const [canCreate, setCanCreate] = useState(false);
  const [items, setItems] = useState<TaskSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "kanban">("list");

  const load = useCallback(
    async (activeId: string) => {
      setLoading(true);
      setError(null);
      const data = await fetchTasks(activeId, {
        status: status || undefined,
        limit: 100,
      });
      if (isApiFailure(data)) {
        setError(apiErrorMessage(data, "Não foi possível listar as tarefas."));
        setLoading(false);
        return;
      }
      setItems(data.tasks);
      setTotal(data.total);
      setLoading(false);
    },
    [status],
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
      setCanRead(hasPermission(membership?.permissions, "task.read"));
      setCanCreate(hasPermission(membership?.permissions, "task.create"));
      if (!hasPermission(membership?.permissions, "task.read")) {
        setLoading(false);
        return;
      }
      setOrgId(activeId);
      await load(activeId);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (!canRead) {
    return (
      <EmptyState title="Sem permissão">Você não tem permissão para consultar tarefas.</EmptyState>
    );
  }

  const columns: TaskStatus[] = ["todo", "in_progress", "waiting", "blocked", "done"];

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Painel", href: "/app" }, { label: "Tarefas" }]} />
      <PageHeader
        title="Tarefas"
        description="Tarefas operacionais. SLA operacional não é prazo jurídico."
        actions={
          canCreate ? <ButtonLink href="/app/tarefas/nova">Nova tarefa</ButtonLink> : undefined
        }
      />
      <form
        className="vj-inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (orgId) void load(orgId);
        }}
      >
        <FormField id="status" label="Status">
          <Select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="view" label="Visualização">
          <Select
            id="view"
            value={view}
            onChange={(e) => setView(e.target.value as "list" | "kanban")}
          >
            <option value="list">Lista</option>
            <option value="kanban">Kanban</option>
          </Select>
        </FormField>
        <button type="submit" className="vj-button vj-button-secondary">
          Filtrar
        </button>
      </form>
      {loading ? <LoadingState label="Carregando tarefas…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhuma tarefa">Crie a primeira tarefa da organização.</EmptyState>
      ) : null}
      {!loading && !error && view === "list" && items.length > 0 ? (
        <ul className="vj-list">
          {items.map((task) => (
            <li key={task.id}>
              <a href={`/app/tarefas/${task.id}`}>
                <strong>{task.title}</strong>
              </a>{" "}
              <Badge>{TASK_STATUS_LABELS[task.status]}</Badge>
              <span className="vj-meta">
                {task.dueAt ? ` · venc. ${new Date(task.dueAt).toLocaleString("pt-BR")}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {!loading && !error && view === "kanban" && items.length > 0 ? (
        <section className="vj-stack" aria-label="Quadro de tarefas">
          {columns.map((col) => (
            <section key={col} aria-labelledby={`col-${col}`}>
              <h2 id={`col-${col}`} className="vj-section-title">
                {TASK_STATUS_LABELS[col]} ({items.filter((t) => t.status === col).length})
              </h2>
              <ul>
                {items
                  .filter((t) => t.status === col)
                  .map((task) => (
                    <li key={task.id}>
                      <a href={`/app/tarefas/${task.id}`}>{task.title}</a>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </section>
      ) : null}
      <p className="vj-meta">{total} tarefa(s)</p>
    </div>
  );
}
