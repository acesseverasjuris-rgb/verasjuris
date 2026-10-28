"use client";

import { Breadcrumb, ErrorState, PageHeader } from "@verasjuris/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NoPermission } from "../../../../components/ai-ui";
import {
  createMarketplaceRequest,
  fetchMarketplaceCategories,
  hasMarketplacePermission,
  isApiFailure,
  marketplaceErrorMessage,
  publishMarketplaceRequest,
  type MarketplaceCategory,
} from "../../../../lib/marketplace";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function MarketplaceNewRequestPage() {
  const org = useOrgContext();
  const router = useRouter();
  const canCreate = hasMarketplacePermission(org.permissions, "request.create");
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!org.orgId) return;
    void fetchMarketplaceCategories(org.orgId).then((data) => {
      if (!isApiFailure(data)) setCategories(data.items);
    });
  }, [org.orgId]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!org.orgId) return;
    setSubmitting(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const body = {
      categoryId: String(form.get("categoryId")),
      title: String(form.get("title")),
      description: String(form.get("description")),
      locationState: String(form.get("locationState") || "SP"),
      remoteAllowed: form.get("remoteAllowed") === "on",
      status: form.get("publish") === "on" ? "open" : "draft",
    };
    const created = await createMarketplaceRequest(org.orgId, body);
    if (isApiFailure(created)) {
      setError(marketplaceErrorMessage(created));
      setSubmitting(false);
      return;
    }
    if (body.status === "open") {
      await publishMarketplaceRequest(org.orgId, created.request.id);
    }
    router.push(`/marketplace/solicitacoes/${created.request.id}`);
  }

  if (org.ready && !canCreate) {
    return <NoPermission>Sem permissão para criar solicitações.</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Marketplace", href: "/marketplace" },
          { label: "Solicitações", href: "/marketplace/solicitacoes" },
          { label: "Nova" },
        ]}
      />
      <PageHeader title="Nova solicitação" description="Descreva a demanda jurídica em poucos passos." />
      {error ? <ErrorState title="Não foi possível salvar">{error}</ErrorState> : null}
      <form className="vj-stack vj-form" onSubmit={(e) => void onSubmit(e)}>
        <label>
          Categoria
          <select name="categoryId" className="vj-select" required>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Título
          <input name="title" className="vj-input" required minLength={3} />
        </label>
        <label>
          Descrição
          <textarea name="description" className="vj-textarea" required minLength={20} rows={6} />
        </label>
        <label>
          UF
          <input name="locationState" className="vj-input" maxLength={2} defaultValue="SP" />
        </label>
        <label className="vj-checkbox">
          <input type="checkbox" name="remoteAllowed" defaultChecked /> Aceita remoto
        </label>
        <label className="vj-checkbox">
          <input type="checkbox" name="publish" /> Publicar imediatamente
        </label>
        <button type="submit" className="vj-button vj-button-primary" disabled={submitting}>
          {submitting ? "Salvando…" : "Criar solicitação"}
        </button>
      </form>
    </div>
  );
}
