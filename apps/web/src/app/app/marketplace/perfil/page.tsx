"use client";

import { Breadcrumb, ErrorState, PageHeader } from "@verasjuris/ui";
import { useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { MARKETPLACE_APP_TABS } from "../../../../components/marketplace-ui";
import {
  hasMarketplacePermission,
  isApiFailure,
  marketplaceErrorMessage,
  patchMarketplaceProfile,
} from "../../../../lib/marketplace";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function AppMarketplaceProfilePage() {
  const org = useOrgContext();
  const can = hasMarketplacePermission(org.permissions, "service.manage");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!org.orgId) return;
    setError(null);
    setSaved(false);
    const form = new FormData(event.currentTarget);
    const result = await patchMarketplaceProfile(org.orgId, {
      marketplaceEnabled: true,
      marketplaceStatus: "active",
      marketplaceHeadline: String(form.get("headline") ?? ""),
      marketplaceDescription: String(form.get("description") ?? ""),
      serviceStates: String(form.get("serviceStates") ?? ""),
      remoteAvailable: form.get("remoteAvailable") === "on",
    });
    if (isApiFailure(result)) setError(marketplaceErrorMessage(result));
    else setSaved(true);
  }

  if (org.ready && !can)
    return <NoPermission>Sem permissão para editar perfil marketplace.</NoPermission>;

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[{ label: "Marketplace", href: "/app/marketplace" }, { label: "Perfil" }]}
      />
      <PageHeader title="Perfil no marketplace" />
      <SectionTabs label="Seções" items={MARKETPLACE_APP_TABS} current="" />
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {saved ? <p role="status">Perfil atualizado.</p> : null}
      <form className="vj-stack vj-form" onSubmit={(e) => void onSubmit(e)}>
        <label>
          Headline
          <input name="headline" className="vj-input" maxLength={200} />
        </label>
        <label>
          Descrição
          <textarea name="description" className="vj-textarea" rows={5} minLength={10} />
        </label>
        <label>
          UFs atendidas
          <input name="serviceStates" className="vj-input" placeholder="SP,RJ" />
        </label>
        <label className="vj-checkbox">
          <input type="checkbox" name="remoteAvailable" defaultChecked /> Atendo remoto
        </label>
        <button type="submit" className="vj-button vj-button-primary">
          Salvar perfil
        </button>
      </form>
    </div>
  );
}
