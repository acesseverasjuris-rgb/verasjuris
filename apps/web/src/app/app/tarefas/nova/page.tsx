"use client";

import {
  Breadcrumb,
  ErrorState,
  FormField,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@verasjuris/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  apiErrorMessage,
  createTask,
  getActiveOrgId,
  isApiFailure,
} from "../../../../lib/productivity";

export default function NovaTarefaPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const orgId = await getActiveOrgId();
    if (!orgId) {
      setError("Nenhuma organização ativa.");
      setPending(false);
      return;
    }
    const result = await createTask(orgId, {
      title,
      description: description || undefined,
      priority,
    });
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível criar a tarefa."));
      setPending(false);
      return;
    }
    router.push(`/app/tarefas/${result.task.id}`);
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Painel", href: "/app" },
          { label: "Tarefas", href: "/app/tarefas" },
          { label: "Nova" },
        ]}
      />
      <PageHeader
        title="Nova tarefa"
        description="Tarefa operacional — distinta de prazo jurídico."
      />
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      <form className="vj-stack" onSubmit={(e) => void onSubmit(e)}>
        <FormField id="title" label="Título">
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </FormField>
        <FormField id="description" label="Descrição">
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </FormField>
        <FormField id="priority" label="Prioridade">
          <Select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="low">Baixa</option>
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </Select>
        </FormField>
        <button type="submit" className="vj-button" disabled={pending}>
          {pending ? "Salvando…" : "Criar tarefa"}
        </button>
      </form>
    </div>
  );
}
