"use client";

import {
  Alert,
  Badge,
  Breadcrumb,
  ErrorState,
  FormField,
  LoadingState,
  PageHeader,
  Select,
  Textarea,
} from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  addTaskComment,
  apiErrorMessage,
  fetchTask,
  getActiveOrgId,
  isApiFailure,
  TASK_STATUS_LABELS,
  updateTaskStatus,
  type TaskStatus,
} from "../../../../lib/productivity";

export default function TarefaDetailPage() {
  const params = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [comments, setComments] = useState<Array<{ id: string; body: string; createdAt: string }>>(
    [],
  );
  const [checklist, setChecklist] = useState<
    Array<{ id: string; title: string; completed: boolean }>
  >([]);
  const [slaNote, setSlaNote] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const activeId = await getActiveOrgId();
    if (!activeId) {
      setError("Nenhuma organização ativa.");
      setLoading(false);
      return;
    }
    setOrgId(activeId);
    const data = await fetchTask(activeId, params.id);
    if (isApiFailure(data)) {
      setError(apiErrorMessage(data, "Não foi possível carregar a tarefa."));
      setLoading(false);
      return;
    }
    setTitle(data.task.title);
    setStatus(data.task.status);
    setComments(data.comments);
    setChecklist(data.checklist);
    setSlaNote(data.sla?.note ?? null);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeStatus(next: TaskStatus) {
    if (!orgId) return;
    const result = await updateTaskStatus(orgId, params.id, next);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível atualizar o status."));
      return;
    }
    setStatus(result.task.status);
  }

  async function submitComment(event: React.FormEvent) {
    event.preventDefault();
    if (!orgId || !comment.trim()) return;
    const result = await addTaskComment(orgId, params.id, comment);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível comentar."));
      return;
    }
    setComment("");
    await load();
  }

  if (loading) return <LoadingState label="Carregando tarefa…" />;
  if (error) return <ErrorState title="Erro">{error}</ErrorState>;

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Painel", href: "/app" },
          { label: "Tarefas", href: "/app/tarefas" },
          { label: title },
        ]}
      />
      <PageHeader title={title} description="Detalhe da tarefa operacional." />
      <p>
        Status: <Badge>{TASK_STATUS_LABELS[status]}</Badge>
      </p>
      {slaNote ? (
        <Alert tone="info" title="SLA operacional">
          {slaNote}
        </Alert>
      ) : null}
      <FormField id="status" label="Alterar status">
        <Select
          id="status"
          value={status}
          onChange={(e) => void changeStatus(e.target.value as TaskStatus)}
        >
          {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FormField>
      <section>
        <h2 className="vj-section-title">Checklist</h2>
        {checklist.length === 0 ? <p className="vj-meta">Nenhum item.</p> : null}
        <ul>
          {checklist.map((item) => (
            <li key={item.id}>
              {item.completed ? "✓ " : "○ "}
              {item.title}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="vj-section-title">Comentários</h2>
        <p className="vj-meta">Texto puro — HTML é removido no servidor.</p>
        <ul>
          {comments.map((c) => (
            <li key={c.id}>
              {c.body}
              <span className="vj-meta"> · {new Date(c.createdAt).toLocaleString("pt-BR")}</span>
            </li>
          ))}
        </ul>
        <form className="vj-stack" onSubmit={(e) => void submitComment(e)}>
          <FormField id="comment" label="Novo comentário">
            <Textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} />
          </FormField>
          <button type="submit" className="vj-button">
            Comentar
          </button>
        </form>
      </section>
    </div>
  );
}
