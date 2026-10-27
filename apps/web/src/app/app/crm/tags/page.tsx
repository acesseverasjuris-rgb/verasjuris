"use client";

import {
  Breadcrumb,
  Button,
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
  createTag,
  fetchTags,
  getActiveMembership,
  getActiveOrgId,
  isApiFailure,
  type CrmTag,
} from "../../../../lib/crm";

export default function TagsPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [tags, setTags] = useState<CrmTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const reload = useCallback(async (activeId: string) => {
    const data = await fetchTags(activeId);
    if (isApiFailure(data)) {
      setError(apiErrorMessage(data, "Não foi possível listar as tags."));
      setLoading(false);
      return;
    }
    setTags(data.tags);
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      const [activeId, membership] = await Promise.all([getActiveOrgId(), getActiveMembership()]);
      if (!activeId) {
        setError("Nenhuma organização ativa.");
        setLoading(false);
        return;
      }
      setOrgId(activeId);
      setCanManage(membership?.permissions.includes("crm.manage_tags") ?? false);
      await reload(activeId);
    })();
  }, [reload]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orgId) return;
    setPending(true);
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const result = await createTag(orgId, {
      name: String(form.get("name") ?? ""),
      color: String(form.get("color") ?? "") || undefined,
    });
    setPending(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível criar a tag."));
      return;
    }
    setMessage(`Tag "${result.tag.name}" criada.`);
    event.currentTarget.reset();
    await reload(orgId);
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Painel", href: "/app" },
          { label: "CRM", href: "/app/crm" },
          { label: "Tags" },
        ]}
      />
      <PageHeader
        title="Tags"
        description="Etiquetas para organizar leads e clientes dentro da organização."
      />
      {message ? <p role="status">{message}</p> : null}
      {error ? (
        <p role="alert" className="vj-field-error">
          {error}
        </p>
      ) : null}
      {canManage ? (
        <section className="vj-card vj-stack" aria-labelledby="create-tag">
          <h2 id="create-tag" className="vj-section-title">
            Nova tag
          </h2>
          <form className="vj-stack" onSubmit={submit}>
            <div className="vj-split">
              <FormField id="name" label="Nome">
                <Input id="name" name="name" required minLength={1} maxLength={60} />
              </FormField>
              <FormField id="color" label="Cor" hint="Opcional. Ex.: #0B56F0">
                <Input id="color" name="color" maxLength={20} placeholder="#0B56F0" />
              </FormField>
            </div>
            <Button type="submit" loading={pending} loadingLabel="Criando">
              Criar tag
            </Button>
          </form>
        </section>
      ) : (
        <p className="vj-meta">Você pode consultar as tags. A criação exige permissão de gestão.</p>
      )}
      {loading ? <LoadingState label="Carregando tags" /> : null}
      {!loading && tags.length === 0 ? (
        <EmptyState title="Nenhuma tag cadastrada">
          {canManage
            ? "Crie a primeira tag para classificar leads e clientes."
            : "A organização ainda não possui tags visíveis para você."}
        </EmptyState>
      ) : null}
      {!loading && tags.length > 0 ? (
        <div className="vj-table-wrap">
          <table className="vj-table">
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">Cor</th>
              </tr>
            </thead>
            <tbody>
              {tags.map((tag) => (
                <tr key={tag.id}>
                  <td data-label="Nome">{tag.name}</td>
                  <td data-label="Cor">
                    {tag.color ? (
                      <>
                        <span
                          aria-hidden="true"
                          style={{
                            display: "inline-block",
                            width: "1rem",
                            height: "1rem",
                            background: tag.color,
                            border: "1px solid var(--vj-border)",
                            verticalAlign: "middle",
                            marginRight: "0.5rem",
                          }}
                        />
                        {tag.color}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
